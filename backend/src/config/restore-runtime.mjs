
import { prisma } from "./database.mjs";

let httpServer = null;
let restoreShutdownStarted = false;

export function registerHttpServer(server) {
     httpServer = server;
}

export async function shutdownForRestore() {
     if (restoreShutdownStarted) {
          return;
     }

     restoreShutdownStarted = true;

     try {
          if (httpServer) {
               await new Promise((resolve, reject) => {
                    httpServer.close((error) => {
                         if (error) {
                              reject(error);
                         } else {
                              resolve();
                         }
                    });

                    // Close idle keep-alive connections so shutdown
                    // does not wait indefinitely for the browser.
                    httpServer.closeIdleConnections?.();
               });
          }

          await prisma.$disconnect();

          // Electron listens for this exit code and performs
          // the database replacement.
          process.exit(42);
     } catch (error) {
          console.error("Failed to shut down for database restore:", error);
          process.exit(1);
     }
}
