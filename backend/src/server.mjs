
import app from "./app.mjs";
import { prisma } from "./config/database.mjs";
import { registerHttpServer } from "./config/restore-runtime.mjs";

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    await prisma.$connect();
    console.log("Database connected successfully.");

    const server = app.listen(PORT, () => {
      console.log(`Backend running at http://localhost:${PORT}`);
    });

    registerHttpServer(server);
  } catch (error) {
    console.error("Failed to start backend:", error);
    await prisma.$disconnect().catch(() => { });
    process.exitCode = 1;
  }
}

startServer();
