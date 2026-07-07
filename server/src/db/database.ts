import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const DB_PATH = process.env.DB_PATH || './data/departtravel.db';
const absoluteDbPath = path.resolve(process.cwd(), DB_PATH);
const dataDir = path.dirname(absoluteDbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(absoluteDbPath);

// Enable WAL mode and foreign keys immediately
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function runMigrations(): void {
  const migrationPath = path.join(__dirname, 'migrations', '001_initial.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  // Split and execute statements individually
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  const runAll = db.transaction(() => {
    for (const stmt of statements) {
      try {
        db.prepare(stmt).run();
      } catch (err: unknown) {
        // Ignore PRAGMA statements that return results
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('This statement does not return data')) {
          throw err;
        }
      }
    }
  });

  runAll();
  console.log('[DB] Migrations executed successfully');
}

export { db };
