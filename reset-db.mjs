
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const DB_PATH = "D:\\inventory-manager\\dev.db";
const BACKUP_DIR = "D:\\inventory-manager\\backups";

// Preserve Prisma migration history.
const PRESERVE_TABLES = new Set(["_prisma_migrations"]);

function main() {
     if (!fs.existsSync(DB_PATH)) {
          throw new Error(`Database not found: ${DB_PATH}`);
     }

     fs.mkdirSync(BACKUP_DIR, { recursive: true });

     const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, "-");

     const backupPath = path.join(
          BACKUP_DIR,
          `dev-before-reset-${timestamp}.db`,
     );

     const db = new Database(DB_PATH);

     try {
          db.pragma("busy_timeout = 5000");
          db.pragma("foreign_keys = OFF");

          // Back up the database before making changes.
          db.backup(backupPath);
          console.log(`Backup created: ${backupPath}`);

          const tables = db
               .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
      `)
               .all();

          const tablesToClear = tables
               .map(({ name }) => name)
               .filter((name) => !PRESERVE_TABLES.has(name));

          const reset = db.transaction(() => {
               for (const tableName of tablesToClear) {
                    const quotedName = `"${tableName.replace(/"/g, '""')}"`;
                    db.exec(`DELETE FROM ${quotedName}`);
               }

               // Reset AUTOINCREMENT counters if present.
               const hasSequenceTable = db
                    .prepare(`
          SELECT 1
          FROM sqlite_master
          WHERE type = 'table'
            AND name = 'sqlite_sequence'
        `)
                    .get();

               if (hasSequenceTable) {
                    db.prepare("DELETE FROM sqlite_sequence").run();
               }
          });

          reset();

          console.log("Database reset successfully.");
          console.log(`Cleared ${tablesToClear.length} tables.`);
          console.log("Prisma migration history preserved.");
     } finally {
          db.close();
     }
}

try {
     main();
} catch (error) {
     console.error("Database reset failed:", error);
     process.exitCode = 1;
}
