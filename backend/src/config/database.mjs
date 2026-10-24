
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../../generated/prisma/client.ts";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

// Resolve the database path relative to the project root.
const projectRoot = path.resolve(currentDirectory, "../../..");

const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";

export const databasePath = databaseUrl.startsWith("file:")
  ? path.resolve(projectRoot, databaseUrl.slice("file:".length))
  : databaseUrl;

const adapter = new PrismaBetterSqlite3({
  url: `file:${databasePath.replace(/\\/g, "/")}`,
});

export const prisma = new PrismaClient({ adapter });
