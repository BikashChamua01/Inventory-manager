
import { prisma } from "../config/database.mjs";

function stockError(message, statusCode = 400) {
     const error = new Error(message);
     error.statusCode = statusCode;
     return error;
}

// Add or remove stock and record the change together.
export async function adjustStock(variantId, quantityChange, note = "") {
     if (!Number.isSafeInteger(quantityChange) || quantityChange === 0) {
          throw stockError("Quantity change must be a non-zero integer");
     }

     return prisma.$transaction(async (tx) => {
          const variant = await tx.productVariant.findUnique({
               where: { id: variantId },
               select: {
                    id: true,
                    stockQuantity: true,
                    isActive: true,
                    product: { select: { isActive: true } },
               },
          });

          if (!variant) {
               throw stockError("Variant not found", 404);
          }

          if (!variant.isActive || !variant.product.isActive) {
               throw stockError("Cannot adjust stock for an inactive variant or archived product", 409);
          }

          const newQuantity = variant.stockQuantity + quantityChange;

          if (newQuantity < 0) {
               throw stockError("Insufficient stock", 409);
          }

          await tx.productVariant.update({
               where: { id: variantId },
               data: { stockQuantity: newQuantity },
          });

          await tx.stockMovement.create({
               data: {
                    variantId,
                    movementType: "ADJUSTMENT",
                    quantityChange,
                    note: note.trim() || null,
               },
          });

          return {
               variantId,
               previousQuantity: variant.stockQuantity,
               quantityChange,
               currentQuantity: newQuantity,
          };
     });
}

// View the history of stock changes.
export async function getStockHistory(variantId) {
     const variant = await prisma.productVariant.findUnique({
          where: { id: variantId },
          select: { id: true },
     });

     if (!variant) {
          throw stockError("Variant not found", 404);
     }

     return prisma.stockMovement.findMany({
          where: { variantId },
          orderBy: { createdAt: "desc" },
     });
}


export async function getAllStockHistory(filters = {}) {
     const {
          search = "",
          movementType = "",
          from = "",
          to = "",
     } = filters;

     const where = {};

     if (movementType) {
          where.movementType = movementType;
     }

     if (from || to) {
          where.createdAt = {};

          if (from) {
               const fromDate = new Date(`${from}T00:00:00.000Z`);

               if (Number.isNaN(fromDate.getTime())) {
                    throw stockError("Invalid from date");
               }

               where.createdAt.gte = fromDate;
          }

          if (to) {
               const toDate = new Date(`${to}T23:59:59.999Z`);

               if (Number.isNaN(toDate.getTime())) {
                    throw stockError("Invalid to date");
               }

               where.createdAt.lte = toDate;
          }
     }

     const trimmedSearch = search.trim();

     if (trimmedSearch) {
          where.variant = {
               OR: [
                    {
                         name: {
                              contains: trimmedSearch,
                              // mode: "insensitive",
                         },
                    },
                    {
                         sku: {
                              contains: trimmedSearch,
                              // mode: "insensitive",
                         },
                    },
                    {
                         product: {
                              name: {
                                   contains: trimmedSearch,
                                   // mode: "insensitive",
                              },
                         },
                    },
                    {
                         product: {
                              sku: {
                                   contains: trimmedSearch,
                                   // mode: "insensitive",
                              },
                         },
                    },
               ],
          };
     }

     return prisma.stockMovement.findMany({
          where,
          include: {
               variant: {
                    select: {
                         id: true,
                         name: true,
                         sku: true,
                         unit: true,
                         product: {
                              select: {
                                   id: true,
                                   name: true,
                                   sku: true,
                              },
                         },
                    },
               },
          },
          orderBy: [
               { createdAt: "desc" },
               { id: "desc" },
          ],
     });
}

