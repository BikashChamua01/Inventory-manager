
import {
     app,
     BrowserWindow,
     dialog,
} from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let isQuitting = false;
let isRestartingBackend = false;

const isDevelopment = !app.isPackaged;
const backendPort = 3000;
const backendUrl = `http://127.0.0.1:${backendPort}`;
const RESTORE_EXIT_CODE = 42;

const restoreRequestPath = path.join(
     app.getPath("userData"),
     "restore-request.json",
);

function getBackendEntry(): string {
     return path.join(
          app.getAppPath(),
          "backend",
          "src",
          "server.mjs",
     );
}

function getDatabasePath(): string {
     if (isDevelopment) {
          const databaseUrl =
               process.env.DATABASE_URL || "file:./dev.db";

          if (!databaseUrl.startsWith("file:")) {
               throw new Error(
                    "Restore supports SQLite file databases only.",
               );
          }

          return path.resolve(
               app.getAppPath(),
               databaseUrl.slice("file:".length),
          );
     }

     return path.join(app.getPath("userData"), "inventory.db");
}


function startBackend(): ChildProcess {
     const entry = getBackendEntry();

     if (!fs.existsSync(entry)) {
          throw new Error(`Backend entry was not found: ${entry}`);
     }

     const databasePath = getDatabasePath();

     fs.mkdirSync(path.dirname(databasePath), {
          recursive: true,
     });

     const databaseUrl = `file:${databasePath.replace(/\\/g, "/")}`;

     const backupDirectory = app.isPackaged
          ? path.join(app.getPath("userData"), "backups")
          : path.join(app.getAppPath(), "backups");

     fs.mkdirSync(backupDirectory, {
          recursive: true,
     });

     const child = spawn(process.execPath, [entry], {
          cwd: app.getAppPath(),
          env: {
               ...process.env,
               ELECTRON_RUN_AS_NODE: "1",
               PORT: String(backendPort),
               DATABASE_URL: databaseUrl,
               BACKUP_DIRECTORY: backupDirectory,
               RESTORE_REQUEST_PATH: restoreRequestPath,
               NODE_OPTIONS: [
                    process.env.NODE_OPTIONS,
                    "--experimental-strip-types",
               ]
                    .filter(Boolean)
                    .join(" "),
          },
          stdio: "inherit",
          windowsHide: true,
     });

     backendProcess = child;

     child.on("error", (error) => {
          console.error("Backend launch error:", error);
     });

     child.on("exit", (code, signal) => {
          if (isQuitting) return;

          if (code === RESTORE_EXIT_CODE) {
               void handleRestoreRestart();
               return;
          }

          console.error(
               `Backend exited unexpectedly. Code: ${code}, signal: ${signal}`,
          );
     });

     return child;
}


async function waitForBackend(
     child: ChildProcess,
     timeoutMs = 30000,
): Promise<void> {
     const startedAt = Date.now();

     while (Date.now() - startedAt < timeoutMs) {
          if (child.exitCode !== null && child.exitCode !== undefined) {
               throw new Error(
                    `Backend exited with code ${child.exitCode}.`,
               );
          }

          if (child.signalCode !== null) {
               throw new Error(
                    `Backend exited with signal ${child.signalCode}.`,
               );
          }

          try {
               const response = await fetch(
                    `${backendUrl}/api/health`,
               );

               if (response.ok) return;
          } catch {
               // Backend is still starting.
          }

          await new Promise((resolve) => setTimeout(resolve, 300));
     }

     throw new Error("Backend did not become healthy within 30 seconds.");
}


async function stopBackend(child: ChildProcess | null): Promise<void> {
     if (!child) return;

     const hasExited = () =>
          child.exitCode !== null || child.signalCode !== null;

     if (hasExited()) return;

     await new Promise<void>((resolve, reject) => {
          let settled = false;

          const cleanup = () => {
               clearTimeout(forceTimer);
               clearTimeout(finalTimer);
               child.removeListener("exit", onExit);
               child.removeListener("error", onError);
          };

          const finish = () => {
               if (settled) return;
               settled = true;
               cleanup();

               if (hasExited()) {
                    resolve();
               } else {
                    reject(new Error(
                         "Backend exit was not confirmed. Database files were not moved."
                    ));
               }
          };

          const onExit = () => finish();

          const onError = (error: Error) => {
               if (hasExited()) {
                    finish();
               } else {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    reject(error);
               }
          };

          const forceTimer = setTimeout(() => {
               if (hasExited()) {
                    finish();
                    return;
               }

               try {
                    child.kill();
               } catch (error) {
                    console.error("Second backend termination request failed:", error);
               }
          }, 3000);

          const finalTimer = setTimeout(() => {
               if (hasExited()) {
                    finish();
                    return;
               }

               if (settled) return;
               settled = true;
               cleanup();
               reject(new Error(
                    "Backend did not exit within 8 seconds. Restore aborted; database files must remain untouched."
               ));
          }, 8000);

          child.once("exit", onExit);
          child.once("error", onError);

          try {
               child.kill();
          } catch (error) {
               settled = true;
               cleanup();
               reject(error);
          }
     });
}


async function handleRestoreRestart(): Promise<void> {
     if (isRestartingBackend || isQuitting) return;
     isRestartingBackend = true;

     let liveDatabase: string | null = null;
     let stagedDatabase: string | null = null;
     let rollbackDatabase: string | null = null;
     let failedDatabase: string | null = null;
     let originalMoved = false;
     let restoredInstalled = false;

     const moveDatabaseBundle = (
          sourceBase: string,
          destinationBase: string,
     ): void => {
          const suffixes = ["", "-wal", "-shm"];
          const moved: Array<{ from: string; to: string }> = [];

          try {
               for (const suffix of suffixes) {
                    const source = `${sourceBase}${suffix}`;
                    const destination = `${destinationBase}${suffix}`;

                    if (!fs.existsSync(source)) continue;

                    if (fs.existsSync(destination)) {
                         throw new Error(
                              `Cannot move database bundle: destination already exists: ${destination}`,
                         );
                    }

                    fs.renameSync(source, destination);
                    moved.push({ from: source, to: destination });
               }
          } catch (error) {
               for (const item of moved.reverse()) {
                    try {
                         if (
                              fs.existsSync(item.to) &&
                              !fs.existsSync(item.from)
                         ) {
                              fs.renameSync(item.to, item.from);
                         }
                    } catch (rollbackError) {
                         console.error(
                              "CRITICAL: failed to reverse a partial database-file move.",
                              rollbackError,
                         );
                    }
               }

               throw error;
          }
     };

     const isBackendStopped = (): boolean =>
          !backendProcess ||
          backendProcess.exitCode !== null ||
          backendProcess.signalCode !== null;

     try {
          if (!fs.existsSync(restoreRequestPath)) {
               throw new Error("Restore request file was not found.");
          }

          const request = JSON.parse(
               fs.readFileSync(restoreRequestPath, "utf8"),
          ) as {
               stagedPath: string;
               expectedDatabasePath: string;
          };

          liveDatabase = path.resolve(getDatabasePath());
          stagedDatabase = path.resolve(request.stagedPath);

          if (
               path.resolve(request.expectedDatabasePath) !== liveDatabase ||
               path.dirname(stagedDatabase) !== path.dirname(liveDatabase) ||
               !stagedDatabase.startsWith(
                    `${liveDatabase}.restore-staged-`,
               )
          ) {
               throw new Error("Restore request contains invalid paths.");
          }

          if (!fs.existsSync(stagedDatabase)) {
               throw new Error("Prepared restore database was not found.");
          }

          if (
               fs.existsSync(`${stagedDatabase}-wal`) ||
               fs.existsSync(`${stagedDatabase}-shm`)
          ) {
               throw new Error(
                    "The staged database has unexpected SQLite sidecar files. Restore was stopped to protect your data.",
               );
          }

          rollbackDatabase = `${liveDatabase}.rollback-${Date.now()}`;

          // Preserve the original database and its SQLite sidecars.
          if (!fs.existsSync(liveDatabase)) {
               throw new Error(
                    "The current database file is missing. Restore was stopped.",
               );
          }

          moveDatabaseBundle(liveDatabase, rollbackDatabase);
          originalMoved = true;

          // Install the staged database only after preserving the original.
          fs.renameSync(stagedDatabase, liveDatabase);
          restoredInstalled = true;

          // Remove the request only after the replacement is installed.
          fs.rmSync(restoreRequestPath, { force: true });

          const restoredBackend = startBackend();

          try {
               await waitForBackend(restoredBackend);
          } catch (error) {
               try {
                    await stopBackend(restoredBackend);
               } catch (stopError) {
                    console.error(
                         "Failed to stop the restored backend:",
                         stopError,
                    );
               }

               throw error;
          }

          console.log("Database restore completed successfully.");
          console.log("Rollback copy retained:", rollbackDatabase);

          if (mainWindow && !mainWindow.isDestroyed()) {
               await dialog.showMessageBox(mainWindow, {
                    type: "info",
                    title: "Restore completed",
                    message: "The database was restored successfully.",
                    detail:
                         "Your previous database and its preserved sidecar files remain available as a rollback copy.",
               });
          }
     } catch (error) {
          console.error("Restore/restart failed:", error);

          // Attempt to stop the backend, but never move files if it may
          // still have the database open.
          try {
               await stopBackend(backendProcess);
          } catch (stopError) {
               console.error(
                    "Failed to stop backend during restore recovery:",
                    stopError,
               );
          }

          const backendStopped = isBackendStopped();
          let rollbackSucceeded = false;

          if (!backendStopped) {
               console.error(
                    "CRITICAL: backend may still be running. No database files will be moved. Manual recovery is required.",
               );
          } else if (
               liveDatabase &&
               rollbackDatabase &&
               originalMoved &&
               fs.existsSync(rollbackDatabase)
          ) {
               try {
                    // Preserve the failed restored database and its sidecars.
                    if (
                         restoredInstalled &&
                         fs.existsSync(liveDatabase)
                    ) {
                         failedDatabase =
                              `${liveDatabase}.failed-${Date.now()}`;

                         moveDatabaseBundle(liveDatabase, failedDatabase);

                         console.error(
                              "Failed restored database preserved at:",
                              failedDatabase,
                         );
                    }

                    // Restore the original database bundle.
                    moveDatabaseBundle(rollbackDatabase, liveDatabase);

                    rollbackSucceeded = true;
                    originalMoved = false;

                    console.error(
                         "Original database restored from rollback copy.",
                    );
               } catch (rollbackError) {
                    console.error(
                         "CRITICAL: automatic rollback failed. Do not delete or rename any remaining database files.",
                         rollbackError,
                    );
               }
          }

          // Restart the original database only after rollback succeeds.
          if (rollbackSucceeded && !isQuitting) {
               try {
                    const recoveredBackend = startBackend();
                    await waitForBackend(recoveredBackend);

                    console.log("Original database backend recovered.");
               } catch (recoveryError) {
                    try {
                         await stopBackend(backendProcess);
                    } catch (stopError) {
                         console.error(
                              "Failed to stop backend after recovery failure:",
                              stopError,
                         );
                    }

                    console.error(
                         "CRITICAL: original database files were restored, but the backend could not be recovered. Preserve all database and backup files.",
                         recoveryError,
                    );
               }
          }

          if (mainWindow && !mainWindow.isDestroyed()) {
               await dialog.showMessageBox(mainWindow, {
                    type: "error",
                    title: "Restore failed",
                    message: "The database restore could not be completed.",
                    detail:
                         (!backendStopped
                              ? "The backend may still be running, so database files were not moved. Manual recovery is required."
                              : rollbackSucceeded
                                   ? "The original database files were restored. Check the application logs if the backend did not recover."
                                   : "Automatic rollback could not be confirmed. Preserve all safety backups, rollback files, and failed database files.") +
                         "\n\n" +
                         String(error),
               });
          }
     } finally {
          isRestartingBackend = false;
     }
}


async function createWindow(): Promise<void> {
     mainWindow = new BrowserWindow({
          width: 1400,
          height: 900,
          minWidth: 1000,
          minHeight: 650,
          show: false,
          webPreferences: {
               preload: path.join(__dirname, "preload.js"),
               contextIsolation: true,
               nodeIntegration: false,
               sandbox: true,
          },
     });

     mainWindow.once("ready-to-show", () => {
          mainWindow?.show();
     });

     mainWindow.webContents.setWindowOpenHandler(() => ({
          action: "deny",
     }));

     if (isDevelopment) {
          await mainWindow.loadURL("http://localhost:5173");
     } else {
          await mainWindow.loadFile(
               path.join(
                    app.getAppPath(),
                    "frontend",
                    "dist",
                    "index.html",
               ),
          );
     }

     mainWindow.on("closed", () => {
          mainWindow = null;
     });
}

app.whenReady().then(async () => {
     try {
          const backend = startBackend();
          await waitForBackend(backend);
          await createWindow();
     } catch (error) {
          console.error(error);

          await dialog.showMessageBox({
               type: "error",
               title: "Inventory Manager",
               message: "The application could not start.",
               detail: String(error),
          });

          app.quit();
     }
});

app.on("before-quit", () => {
     isQuitting = true;

     if (backendProcess && !backendProcess.killed) {
          backendProcess.kill();
     }
});

app.on("window-all-closed", () => {
     if (process.platform !== "darwin") {
          app.quit();
     }
});
