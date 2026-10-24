
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const databasePath = path.resolve("./restore-swap-lab/live.db");

// Safety: change to true only after confirming the exact database path.
const CONFIRM_DELETE_ALL_DATA = true;

if (!fs.existsSync(databasePath)) {
  throw new Error(`Database not found: ${databasePath}`);
}

if (path.basename(databasePath).toLowerCase() === "dev.db") {
  throw new Error("Refusing to clear dev.db with this script.");
}

const db = new Database(databasePath);

try {
  console.log("Target database:", databasePath);

  const integrity = db.pragma("integrity_check");
  if (integrity[0]?.integrity_check !== "ok") {
    throw new Error("Database integrity check failed. Nothing was deleted.");
  }

  const tables = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      AND name <> '_prisma_migrations'
    ORDER BY name
  `).all().map(row => row.name);

  console.log("Tables whose data would be cleared:", tables);

  if (!CONFIRM_DELETE_ALL_DATA) {
    console.log("DRY RUN ONLY. No data was deleted.");
    console.log(
      "After checking the target path, set CONFIRM_DELETE_ALL_DATA = true."
    );
  } else {
    db.pragma("foreign_keys = OFF");

    const clearAll = db.transaction(() => {
      for (const table of tables) {
        const safeName = `"${table.replace(/"/g, '""')}"`;
        db.exec(`DELETE FROM ${safeName}`);
      }
    });

    clearAll();

    db.pragma("foreign_keys = ON");

    console.log("Application data cleared. Database schema retained.");
    console.log("Integrity:", db.pragma("integrity_check"));
  }
} finally {
  db.close();
}
