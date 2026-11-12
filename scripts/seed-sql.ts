import { readFileSync, writeFileSync } from "node:fs";
import { fixtureSchema } from "../src/domain/governance/fixture";
import { buildSeedSql } from "../src/server/db/seed";

const fixture = fixtureSchema.parse(JSON.parse(readFileSync("data/seed/activities.v1.json", "utf8")));
const sql = buildSeedSql(fixture, new Date().toISOString());
writeFileSync("data/seed/seed.sql", sql.join("\n") + "\n");
console.log(`wrote data/seed/seed.sql: ${sql.length} statements`);
