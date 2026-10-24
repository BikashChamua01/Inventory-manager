
import { prisma } from "../config/database.mjs";

function categoryError(message, statusCode = 400) {
     const error = new Error(message);
     error.statusCode = statusCode;
     return error;
}

export async function createCategory(data) {
     const name = data.name.trim();

     if (!name) {
          throw categoryError("Category name is required");
     }

     try {
          return await prisma.category.create({
               data: { name },
          });
     } catch (error) {
          if (error.code === "P2002") {
               throw categoryError("Category name already exists", 409);
          }
          throw error;
     }
}

export async function listCategories({ includeInactive = false } = {}) {
     return prisma.category.findMany({
          where: includeInactive ? {} : { isActive: true },
          orderBy: { name: "asc" },
     });
}

export async function updateCategory(id, data) {
     const existing = await prisma.category.findUnique({
          where: { id },
     });

     if (!existing) {
          throw categoryError("Category not found", 404);
     }

     const updateData = {};

     if ("name" in data) {
          if (typeof data.name !== "string" || !data.name.trim()) {
               throw categoryError("Category name is required");
          }
          updateData.name = data.name.trim();
     }

     if ("isActive" in data) {
          if (typeof data.isActive !== "boolean") {
               throw categoryError("isActive must be a boolean");
          }
          updateData.isActive = data.isActive;
     }

     try {
          return await prisma.category.update({
               where: { id },
               data: updateData,
          });
     } catch (error) {
          if (error.code === "P2002") {
               throw categoryError("Category name already exists", 409);
          }
          throw error;
     }
}
