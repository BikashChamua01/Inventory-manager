
import fs from "node:fs";
import path from "node:path";
import {
     createBackup,
     validateBackup,
     prepareRestore,
} from "../services/backup.service.mjs";
import { databasePath, prisma } from "../config/database.mjs";
import { shutdownForRestore } from "../config/restore-runtime.mjs";

const backupDirectory = path.resolve(
     process.env.BACKUP_DIRECTORY || "./backups",
);

function validateBackupFileName(fileName) {
     return (
          typeof fileName === "string" &&
          path.basename(fileName) === fileName &&
          fileName.endsWith(".db") &&
          fileName.startsWith("inventory-backup-")
     );
}

function getBackupPath(fileName) {
     return path.resolve(backupDirectory, fileName);
}

export async function createBackupController(req, res, next) {
     try {
          fs.mkdirSync(backupDirectory, { recursive: true });

          const timestamp = new Date()
               .toISOString()
               .replace(/[:.]/g, "-");

          const destination = path.join(
               backupDirectory,
               `inventory-backup-${timestamp}.db`,
          );

          const backup = await createBackup(destination);

          res.status(201).json({
               success: true,
               message: "Backup created successfully.",
               data: {
                    fileName: backup.fileName,
                    sizeBytes: backup.sizeBytes,
                    createdAt: backup.createdAt,
               },
          });
     } catch (error) {
          next(error);
     }
}

export async function getBackupStatus(req, res, next) {
     try {
          fs.mkdirSync(backupDirectory, { recursive: true });

          const files = fs
               .readdirSync(backupDirectory)
               .filter((name) => name.endsWith(".db"))
               .map((name) => {
                    const filePath = path.join(backupDirectory, name);
                    const stats = fs.statSync(filePath);

                    return {
                         fileName: name,
                         sizeBytes: stats.size,
                         createdAt: stats.mtime.toISOString(),
                    };
               })
               .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

          res.json({
               success: true,
               data: {
                    directory: backupDirectory,
                    backups: files,
                    latest: files[0] ?? null,
               },
          });
     } catch (error) {
          next(error);
     }
}

export async function validateBackupController(req, res, next) {
     try {
          const { fileName } = req.body ?? {};

          if (!validateBackupFileName(fileName)) {
               return res.status(400).json({
                    success: false,
                    message: "Select a valid backup filename.",
               });
          }

          const backupPath = getBackupPath(fileName);

          if (path.dirname(backupPath) !== backupDirectory) {
               return res.status(400).json({
                    success: false,
                    message: "Invalid backup location.",
               });
          }

          const result = validateBackup(backupPath);

          return res.json({
               success: true,
               message: "Backup passed database validation.",
               data: {
                    fileName,
                    valid: result.valid,
                    sizeBytes: result.sizeBytes,
               },
          });
     } catch (error) {
          next(error);
     }
}


export async function restoreBackupController(req, res, next) {
     let prepared = null;

     try {
          const { fileName } = req.body ?? {};

          if (!validateBackupFileName(fileName)) {
               return res.status(400).json({
                    success: false,
                    message: "Select a valid backup filename.",
               });
          }

          const restoreRequestPath = process.env.RESTORE_REQUEST_PATH;
          console.log("[Restore Debug]", {
               restoreRequestPath,
               backupDirectory: process.env.BACKUP_DIRECTORY,
               databasePath,
          });

          if (!restoreRequestPath) {
               return res.status(500).json({
                    success: false,
                    message:
                         "The application restore coordinator is not configured.",
               });
          }

          fs.mkdirSync(backupDirectory, { recursive: true });

          const backupPath = getBackupPath(fileName);

          if (
               path.dirname(backupPath) !== backupDirectory ||
               !fs.existsSync(backupPath)
          ) {
               return res.status(400).json({
                    success: false,
                    message: "The selected backup file was not found.",
               });
          }

          const requestFile = path.resolve(restoreRequestPath);
          const temporaryRequestFile = `${requestFile}.tmp`;

          // Reject duplicate requests BEFORE preparing another restore.
          if (
               fs.existsSync(requestFile) ||
               fs.existsSync(temporaryRequestFile)
          ) {
               return res.status(409).json({
                    success: false,
                    message:
                         "A restore request already exists. Restart the application and verify its state before trying again.",
               });
          }

          // Validate the backup, create a safety backup, and stage the
          // replacement database. The live database is not replaced here.
          prepared = await prepareRestore(
               backupPath,
               backupDirectory,
          );

          const request = {
               stagedPath: prepared.stagedPath,
               expectedDatabasePath: path.resolve(databasePath),
          };

          fs.mkdirSync(path.dirname(requestFile), {
               recursive: true,
          });

          try {
               fs.writeFileSync(
                    temporaryRequestFile,
                    JSON.stringify(request, null, 2),
                    { encoding: "utf8", flag: "wx" },
               );

               // Do not overwrite an existing request.
               if (fs.existsSync(requestFile)) {
                    throw new Error(
                         "A restore request appeared while preparing the restore.",
                    );
               }

               fs.renameSync(temporaryRequestFile, requestFile);
          } catch (error) {
               fs.rmSync(temporaryRequestFile, { force: true });
               fs.rmSync(prepared.stagedPath, { force: true });
               throw error;
          }

          res.once("finish", () => {
               void shutdownForRestore().catch((error) => {
                    console.error(
                         "Restore shutdown failed. Preserve all database, staged, and backup files.",
                         error,
                    );
               });
          });

          return res.json({
               success: true,
               message:
                    "Backup validated and prepared. The application will restart to complete restoration.",
               data: {
                    fileName,
                    safetyBackup: prepared.safetyBackup.fileName,
                    status: "prepared",
               },
          });
     } catch (error) {
          next(error);
     }
}


export async function deleteBackupController(req, res, next) {
     try {
          const { fileName } = req.body ?? {};

          const isBackupFile =
               typeof fileName === "string" &&
               path.basename(fileName) === fileName &&
               (
                    /^inventory-backup-[\w.-]+\.db$/.test(fileName) ||
                    /^inventory-safety-before-restore-[\w.-]+\.db$/.test(fileName)
               );

          if (!isBackupFile) {
               return res.status(400).json({
                    success: false,
                    message: "Select a valid backup filename.",
               });
          }

          const backupPath = path.resolve(backupDirectory, fileName);

          if (path.dirname(backupPath) !== backupDirectory) {
               return res.status(400).json({
                    success: false,
                    message: "Invalid backup location.",
               });
          }

          // Never allow deletion of the active database.
          if (backupPath === path.resolve(databasePath)) {
               return res.status(403).json({
                    success: false,
                    message: "The active database cannot be deleted.",
               });
          }

          // Reject missing files, directories and symbolic links.
          let stats;

          try {
               stats = fs.lstatSync(backupPath);
          } catch (error) {
               if (error.code === "ENOENT") {
                    return res.status(404).json({
                         success: false,
                         message: "The selected backup was not found.",
                    });
               }

               throw error;
          }

          if (!stats.isFile()) {
               return res.status(400).json({
                    success: false,
                    message: "The selected path is not a regular backup file.",
               });
          }

          fs.unlinkSync(backupPath);

          return res.json({
               success: true,
               message: "Backup deleted successfully.",
               data: { fileName },
          });
     } catch (error) {
          next(error);
     }
}

