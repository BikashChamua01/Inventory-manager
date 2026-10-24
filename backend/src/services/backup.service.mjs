
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { databasePath } from "../config/database.mjs";

const REQUIRED_TABLES = [
     "Category",
     "Product",
     "ProductAttribute",
     "ProductVariant",
     "VariantAttribute",
     "Supplier",
     "Customer",
     "Purchase",
     "PurchaseItem",
     "Sale",
     "SaleItem",
     "PurchaseReturn",
     "PurchaseReturnItem",
     "SaleReturn",
     "SaleReturnItem",
     "Payment",
     "StockMovement",
     "AuditLog",
     "AppSetting",
];

function createHttpError(message, statusCode) {
     const error = new Error(message);
     error.statusCode = statusCode;
     return error;
}

function validateDatabaseFile(filePath) {
     if (!fs.existsSync(filePath)) {
          throw createHttpError("The database file was not found.", 404);
     }

     const db = new Database(filePath, {
          readonly: true,
          fileMustExist: true,
     });

     try {
          const integrity = db.pragma("integrity_check", {
               simple: true,
          });

          if (integrity !== "ok") {
               throw createHttpError(
                    "The database failed SQLite integrity validation.",
                    400,
               );
          }

          const tables = new Set(
               db
                    .prepare(
                         "SELECT name FROM sqlite_master WHERE type = 'table'",
                    )
                    .all()
                    .map((row) => row.name),
          );

          const missingTables = REQUIRED_TABLES.filter(
               (table) => !tables.has(table),
          );

          if (missingTables.length > 0) {
               throw createHttpError(
                    `The database is missing required tables: ${missingTables.join(", ")}`,
                    400,
               );
          }

          const foreignKeyErrors = db.pragma("foreign_key_check");

          if (foreignKeyErrors.length > 0) {
               throw createHttpError(
                    "The database contains foreign-key integrity errors.",
                    400,
               );
          }

          return {
               valid: true,
               sizeBytes: fs.statSync(filePath).size,
          };
     } finally {
          db.close();
     }
}

export async function createBackup(destinationPath) {
     if (!destinationPath || typeof destinationPath !== "string") {
          throw createHttpError(
               "A backup destination path is required.",
               400,
          );
     }

     const source = path.resolve(databasePath);
     const destination = path.resolve(destinationPath);

     if (source === destination) {
          throw createHttpError(
               "The backup destination cannot be the live database.",
               400,
          );
     }

     if (!fs.existsSync(source)) {
          throw createHttpError("The database file was not found.", 404);
     }

     if (fs.existsSync(destination)) {
          throw createHttpError(
               "A file already exists at the backup destination.",
               409,
          );
     }

     fs.mkdirSync(path.dirname(destination), { recursive: true });

     const db = new Database(source, {
          readonly: true,
          fileMustExist: true,
     });

     try {
          await db.backup(destination);
     } finally {
          db.close();
     }

     return {
          fileName: path.basename(destination),
          path: destination,
          sizeBytes: fs.statSync(destination).size,
          createdAt: new Date().toISOString(),
     };
}

export function validateBackup(backupPath) {
     return validateDatabaseFile(path.resolve(backupPath));
}

export async function prepareRestore(
     backupPath,
     backupDirectory,
) {
     const source = path.resolve(backupPath);
     const liveDatabase = path.resolve(databasePath);
     const backups = path.resolve(backupDirectory);

     if (source === liveDatabase) {
          throw createHttpError(
               "The live database cannot be selected as a backup.",
               400,
          );
     }

     // Only allow a backup file directly inside the configured backup folder.
     if (path.dirname(source) !== backups) {
          throw createHttpError(
               "The selected backup is outside the backup directory.",
               400,
          );
     }

     validateDatabaseFile(source);

     // Protect the current database before preparing any replacement.
     const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, "-");

     const safetyPath = path.join(
          backups,
          `inventory-safety-before-restore-${timestamp}.db`,
     );

     const safetyBackup = await createBackup(safetyPath);

     // Stage the selected backup beside the live database. Do not replace
     // the live database in this function.
     const stagedPath = `${liveDatabase}.restore-staged-${timestamp}`;

     const sourceDb = new Database(source, {
          readonly: true,
          fileMustExist: true,
     });

     try {
          await sourceDb.backup(stagedPath);
     } finally {
          sourceDb.close();
     }

     try {
          validateDatabaseFile(stagedPath);
     } catch (error) {
          if (fs.existsSync(stagedPath)) {
               fs.rmSync(stagedPath, { force: true });
          }
          throw error;
     }

     return {
          stagedPath,
          safetyBackup: {
               fileName: safetyBackup.fileName,
               sizeBytes: safetyBackup.sizeBytes,
               createdAt: safetyBackup.createdAt,
          },
     };
}
