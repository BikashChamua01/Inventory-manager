
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import Database from "better-sqlite3";

const require = createRequire(import.meta.url);
const projectRoot = process.cwd();
const envPath = resolve(projectRoot, ".env");

if (!existsSync(envPath)) {
     console.error("Cannot find the root .env file.");
     process.exit(1);
}

// Read DATABASE_URL without printing any other environment values.
const envText = readFileSync(envPath, "utf8");
const match = envText.match(
     /^\s*DATABASE_URL\s*=\s*["']?file:([^"'\r\n]+)["']?\s*$/m
);

if (!match) {
     console.error(
          'Could not parse DATABASE_URL. Expected a SQLite URL such as file:./dev.db'
     );
     process.exit(1);
}

const databasePath = resolve(projectRoot, match[1]);

if (!existsSync(databasePath)) {
     console.error(`Database file not found: ${databasePath}`);
     process.exit(1);
}

console.log("DATABASE RESET");
console.log(`Database: ${databasePath}`);
console.log("WARNING: This permanently deletes application data.");
console.log("The database schema and migration files will be preserved.");

if (process.argv.includes("--confirm") === false) {
     console.error(
          "\nNo data was deleted. Run with --confirm to perform the reset."
     );
     process.exit(1);
}

const db = new Database(databasePath);

try {
     // Refuse to proceed if foreign-key integrity is already disabled.
     db.pragma("foreign_keys = ON");

     const tables = db
          .prepare(
               `SELECT name FROM sqlite_master
       WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%'
         AND name != '_prisma_migrations'
       ORDER BY name`
          )
          .all()
          .map((row) => row.name);

     const existingTables = new Set(tables);

     // Delete children before parents. This list matches the current schema.
     const preferredOrder = [
          "SaleReturnItem",
          "PurchaseReturnItem",
          "Payment",
          "SaleReturn",
          "PurchaseReturn",
          "SaleItem",
          "PurchaseItem",
          "StockMovement",
          "VariantAttribute",
          "ProductAttribute",
          "AuditLog",
          "Sale",
          "Purchase",
          "ProductVariant",
          "Product",
          "Customer",
          "Supplier",
          "Category",
          "AppSetting",
     ];

     const deleteTables = [
          ...preferredOrder.filter((table) => existingTables.has(table)),
          ...tables.filter((table) => !preferredOrder.includes(table)),
     ];

     const reset = db.transaction(() => {
          for (const table of deleteTables) {
               // Identifiers come only from the database's table list or our fixed list.
               const quotedTable = `"${table.replaceAll('"', '""')}"`;
               db.exec(`DELETE FROM ${quotedTable}`);
          }

          const violations = db.pragma("foreign_key_check");

          if (violations.length > 0) {
               throw new Error(
                    `Foreign-key check failed after reset: ${violations.length} violation(s)`
               );
          }
     });

     reset();

     console.log("\nDatabase reset completed successfully.");
     console.log("All application records have been cleared.");
     console.log("Schema and Prisma migration history were preserved.");
} catch (error) {
     console.error("\nDatabase reset failed; changes were rolled back.");
     console.error(error.message);
     process.exitCode = 1;
} finally {
     db.close();
}
