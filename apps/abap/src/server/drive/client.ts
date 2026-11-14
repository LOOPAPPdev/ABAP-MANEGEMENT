/**
 * Google Drive API v3 client (fetch injectable for tests).
 * Read: list a folder tree, export Google Docs as Markdown. Write: create a Google Doc from Markdown.
 */
import { GoogleError, type Fetch } from "../auth/google";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
export const MIME = {
  folder: "application/vnd.google-apps.folder",
  doc: "application/vnd.google-apps.document",
  sheet: "application/vnd.google-apps.spreadsheet",
  slides: "application/vnd.google-apps.presentation",
} as const;

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
  size?: string;
  /** Folder names from the project folder down to this file ("" at the root). */
  path: string;
}

async function call<T>(f: Fetch, url: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await f(url, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
    throw new GoogleError(`Drive API: ${res.status} ${j.error?.message ?? ""}`.trim(), res.status, j.error?.status);
  }
  return (init.method === undefined || init.method === "GET") && url.includes("/export") ? ((await res.text()) as T) : ((await res.json()) as T);
}

/** Lists every non-trashed file under the folder (subfolders up to `maxDepth`). Folders themselves are not returned. */
export async function listFolderTree(token: string, folderId: string, f: Fetch = fetch, maxDepth = 3): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  // Files of a folder first, then its subfolders (stable, readable order for the UI and the mirror).
  const walk = async (id: string, path: string, depth: number) => {
    const subfolders: { id: string; name: string }[] = [];
    let pageToken: string | undefined;
    do {
      const q = new URLSearchParams({
        q: `'${id.replace(/'/g, "")}' in parents and trashed = false`,
        fields: "nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink, size)",
        pageSize: "200",
        orderBy: "folder,name",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });
      if (pageToken) q.set("pageToken", pageToken);
      const page = await call<{ files: Omit<DriveFile, "path">[]; nextPageToken?: string }>(f, `${API}/files?${q}`, token);
      for (const file of page.files ?? []) {
        if (file.mimeType === MIME.folder) subfolders.push(file);
        else out.push({ ...file, path });
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
    if (depth < maxDepth) for (const sub of subfolders) await walk(sub.id, path ? `${path}/${sub.name}` : sub.name, depth + 1);
  };
  await walk(folderId, "", 0);
  return out;
}

/** Exports a Google Doc as Markdown. */
export function exportMarkdown(token: string, fileId: string, f: Fetch = fetch): Promise<string> {
  return call<string>(f, `${API}/files/${encodeURIComponent(fileId)}/export?mimeType=text%2Fmarkdown`, token);
}

/** Creates a new Google Doc in the folder from Markdown (Drive converts it). Never overwrites. */
export async function createDocument(token: string, folderId: string, title: string, markdown: string, f: Fetch = fetch) {
  const boundary = `abap-${crypto.randomUUID()}`;
  const meta = JSON.stringify({ name: title, parents: [folderId], mimeType: MIME.doc });
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: text/markdown; charset=UTF-8\r\n\r\n${markdown}\r\n--${boundary}--`;
  return call<{ id: string; name: string; webViewLink?: string }>(
    f,
    `${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink`,
    token,
    { method: "POST", headers: { "content-type": `multipart/related; boundary=${boundary}` }, body },
  );
}
