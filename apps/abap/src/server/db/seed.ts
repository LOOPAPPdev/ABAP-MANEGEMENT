import type { Fixture } from "~/domain/governance";

export const DEFAULT_PROJECT_ID = "default";

const q = (v: string | null) => (v === null ? "NULL" : `'${v.replaceAll("'", "''")}'`);

/**
 * Builds idempotent seed SQL from the validated fixture. Pure function, shared by
 * scripts/seed-sql.ts and the integration tests.
 */
export function buildSeedSql(fixture: Fixture, now: string, projectName = "Full Stack Governance System"): string[] {
  const p = DEFAULT_PROJECT_ID;
  const stmts = [
    `INSERT OR IGNORE INTO projects (id, name, created_at) VALUES (${q(p)}, ${q(projectName)}, ${q(now)});`,
  ];
  for (const a of fixture.activities) {
    stmts.push(
      `INSERT OR IGNORE INTO activities (project_id, id, phase, area, title, objective, tutorial, knowledge, tool, deliverable, dependency_id, acceptance, reference, status, priority, owner, due, notes, updated_at, updated_by) VALUES (${[
        p, a.ID, a.Phase, a.Area, a.Activity, a.Objective, a.Tutorial, a.Knowledge, a.Tool, a.Deliverable,
      ].map(q).join(", ")}, ${q(a.Dependency || null)}, ${[a.Acceptance, a.Reference, a.Status, a.Priority, a.Owner].map(q).join(", ")}, ${q(a.Due || null)}, ${q(a.Notes)}, ${q(now)}, 'import');`,
    );
    if (a.Evidence) {
      stmts.push(
        `INSERT OR IGNORE INTO evidence (id, project_id, activity_id, kind, ref, note, created_by, created_at) VALUES (${q(`import-${a.ID}`)}, ${q(p)}, ${q(a.ID)}, 'text', ${q(a.Evidence)}, 'Imported from workbook', 'import', ${q(now)});`,
      );
    }
  }
  return stmts;
}
