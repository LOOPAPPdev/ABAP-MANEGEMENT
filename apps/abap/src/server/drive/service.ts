import { z } from "zod";
import type { AppConfig } from "../config";
import { SCOPE_DRIVE, type Fetch } from "../auth/google";
import { getDb } from "../db/client";
import type { Clock } from "../governance-service";
import { googleAccess, GoogleNotConnectedError } from "../google-token";
import { ProjectService, type Project } from "../projects";
import { createDocument, exportMarkdown, listFolderTree, MIME, type DriveFile } from "./client";

export class DriveUnavailableError extends Error {
  constructor(
    message: string,
    readonly reason: "local" | "not_linked" | "not_connected" | "scope_missing",
  ) {
    super(message);
  }
}

export const newDocumentSchema = z.object({
  title: z.string().trim().min(3).max(120),
  markdown: z.string().min(1).max(200_000),
  confirm: z.literal(true, { message: "confirme a criação do documento na pasta do cliente" }),
});

export const MAX_EXPORT_DOCS = 100;

/** Drive access for one project (its linked folder). Reads and approved writes; every write is audited. */
export class DriveService {
  constructor(
    private readonly d1: D1Database,
    private readonly cfg: AppConfig,
    private readonly project: Pick<Project, "id" | "driveFolderId">,
    private readonly clock: Clock,
    private readonly f: Fetch = (...a) => fetch(...a),
  ) {}

  private async ready(): Promise<{ token: string; folderId: string }> {
    if (this.cfg.auth === "dev-bypass") throw new DriveUnavailableError("Drive indisponível no modo local (Google não configurado).", "local");
    if (!this.project.driveFolderId) throw new DriveUnavailableError("Nenhuma pasta do Drive vinculada a este projeto: vincule em Projects.", "not_linked");
    try {
      const { accessToken, scopes } = await googleAccess(getDb(this.d1), this.cfg, this.f);
      if (!scopes.includes(SCOPE_DRIVE)) throw new DriveUnavailableError("A conexão Google não tem acesso ao Drive: reconecte em Settings e autorize o Drive.", "scope_missing");
      return { token: accessToken, folderId: this.project.driveFolderId };
    } catch (e) {
      if (e instanceof GoogleNotConnectedError) throw new DriveUnavailableError(e.message, "not_connected");
      throw e;
    }
  }

  async list(): Promise<DriveFile[]> {
    const { token, folderId } = await this.ready();
    return listFolderTree(token, folderId, this.f);
  }

  /** Markdown of one Google Doc of this project's folder (null for other file types). Refuses files outside the folder. */
  async read(fileId: string): Promise<{ file: DriveFile; markdown: string | null }> {
    const { token, folderId } = await this.ready();
    const file = (await listFolderTree(token, folderId, this.f)).find((x) => x.id === fileId);
    if (!file) throw new DriveUnavailableError("Arquivo não encontrado na pasta deste projeto.", "not_linked");
    return { file, markdown: file.mimeType === MIME.doc ? await exportMarkdown(token, file.id, this.f) : null };
  }

  /** Everything the repository mirror needs: file list + Markdown of Google Docs (up to MAX_EXPORT_DOCS). */
  async exportAll() {
    const { token, folderId } = await this.ready();
    const files = await listFolderTree(token, folderId, this.f);
    let exported = 0;
    const out: (DriveFile & { markdown: string | null })[] = [];
    for (const file of files) {
      const isDoc = file.mimeType === MIME.doc && exported < MAX_EXPORT_DOCS;
      if (isDoc) exported++;
      out.push({ ...file, markdown: isDoc ? await exportMarkdown(token, file.id, this.f) : null });
    }
    return { project: this.project.id, exportedAt: this.clock().toISOString(), files: out, truncated: files.filter((x) => x.mimeType === MIME.doc).length > MAX_EXPORT_DOCS };
  }

  /** Approved write: creates a NEW Google Doc in the project folder (never overwrites) and audits it. */
  async createDocument(input: z.infer<typeof newDocumentSchema>, actor: string) {
    const { token, folderId } = await this.ready();
    const created = await createDocument(token, folderId, input.title, input.markdown, this.f);
    await new ProjectService(this.d1, this.clock).logEvent(this.project.id, actor, "drive.document.created", `${input.title} (${created.id})`);
    return created;
  }

  /** Finds the governance spreadsheet in the folder and links it when there is exactly one. */
  async detectSpreadsheet(actor: string) {
    const sheets = (await this.list()).filter((x) => x.mimeType === MIME.sheet);
    if (sheets.length === 1) await new ProjectService(this.d1, this.clock).setLinks(this.project.id, { spreadsheetId: sheets[0]!.id }, actor);
    return { linked: sheets.length === 1 ? sheets[0]! : null, candidates: sheets };
  }
}
