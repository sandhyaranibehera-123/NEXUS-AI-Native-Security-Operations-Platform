import "dotenv/config";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "../../../../database/migrations");

async function migrate() {
  const url = process.env.DATABASE_URL ?? "postgresql://nexus:nexus@localhost:5432/nexus";
  const sql = postgres(url);

  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const applied = await sql<{ name: string }[]>`SELECT name FROM _migrations ORDER BY id`;
  const appliedSet = new Set(applied.map((r) => r.name));

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`⏭  Skipping ${file} (already applied)`);
      continue;
    }
    console.log(`▶  Applying ${file}...`);
    const content = readFileSync(join(migrationsDir, file), "utf-8");
    await sql.unsafe(content);
    await sql`INSERT INTO _migrations (name) VALUES (${file})`;
    console.log(`✓  Applied ${file}`);
  }

  console.log("Migration complete.");
  await sql.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
