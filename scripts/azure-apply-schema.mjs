/**
 * Apply a numbered azure/schema/*.sql file.
 * Usage: node scripts/azure-apply-schema.mjs [002_simple_social_templates.sql]
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const fileArg = process.argv[2] || "001_init.sql";
const sqlPath = path.join(root, "azure", "schema", fileArg);

function loadConnectionString() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  const secretPath = path.join(root, ".azure-pg-secret.local.json");
  if (!fs.existsSync(secretPath)) {
    throw new Error("No DATABASE_URL and no .azure-pg-secret.local.json");
  }
  const raw = fs.readFileSync(secretPath, "utf8").replace(/^\uFEFF/, "");
  const secret = JSON.parse(raw);
  return secret.connectionString;
}

if (!fs.existsSync(sqlPath)) {
  throw new Error(`Schema file not found: ${sqlPath}`);
}

const sql = fs.readFileSync(sqlPath, "utf8");
const connectionString = loadConnectionString();
const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  console.log(`Applied azure/schema/${fileArg} successfully`);
} finally {
  await client.end();
}
