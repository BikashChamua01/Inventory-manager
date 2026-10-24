
import { randomUUID } from "node:crypto";
import { prisma } from "../config/database.mjs";

function returnError(message, statusCode = 400) {
     const error = new Error(message);
     error.statusCode = statusCode;
     return error;
}

function validateReturnRequest(data, type) {
     if (!data || typeof data !== "object" || Array.isArray(data)) {
          throw returnError("Request body must be a JSON object");
     }

     const referenceField = type === "SALE" ? "saleId" : "purchaseId";

     if (
          typeof data[referenceField] !== "string" ||
          !data[referenceField].trim()
     ) {
          throw returnError(`${referenceField} is required`);
     }

     if (!Array.isArray(data.items) || data.items.length === 0) {
          throw returnError("At least one return item is required");
     }

     if (data.reason != null && typeof data.reason !== "string") {
          throw returnError("Reason must be a string");
     }

     const itemReferenceField =
          type === "SALE" ? "saleItemId" : "originalPurchaseItemId";

     const seen = new Set();

     const items = data.items.map((item) => {
          if (
               !item ||
               typeof item[itemReferenceField] !== "string" ||
               !item[itemReferenceField].trim() ||
               !Number.isSafeInteger(item.quantity) ||
               item.quantity <= 0
          ) {
               throw returnError(
                    `Each item requires ${itemReferenceField} and a positive integer quantity`
               );
          }

          const referenceId = item[itemReferenceField].trim();

          if (seen.has(referenceId)) {
               throw returnError("Duplicate return items are not allowed");
          }

          seen.add(referenceId);

          return {
               referenceId,
               quantity: item.quantity,
          };
     });

     return {
          referenceId: data[referenceField].trim(),
          reason: data.reason?.trim() || null,
          items,
     };
}

function ensureSafeAmount(value, message = "Return amount is too large") {
     if (!Number.isSafeInteger(value) || value < 0) {
          throw returnError(message);
     }

     return value;
}

export async function createSaleReturn(data) {
     const request = validateReturnRequest(data, "SALE");

     return prisma.$transaction(async (tx) => {
          const sale = await tx.sale.findUnique({
               where: { id: request.referenceId },
               include: { items: true },
          });

          if (!sale) {
               throw returnError("Sale not found", 404);
          }

          if (sale.status !== "COMPLETED") {
               throw returnError("Only completed sales can be returned", 409);
          }

          const returnItems = [];
          let totalPaise = 0;

          for (const requested of request.items) {
               const saleItem = sale.items.find(
                    (item) => item.id === requested.referenceId
               );

               if (!saleItem) {
                    throw returnError(
                         `Sale item not found: ${requested.referenceId}`,
                         404
                    );
               }

               const previousReturns = await tx.saleReturnItem.aggregate({
                    where: { saleItemId: saleItem.id },
                    _sum: { quantity: true },
               });

               const alreadyReturned = previousReturns._sum.quantity ?? 0;
               const remainingQuantity = saleItem.quantity - alreadyReturned;

               if (requested.quantity > remainingQuantity) {
                    throw returnError(
                         `Cannot return more than the remaining sold quantity. Available to return: ${remainingQuantity}`,
                         409
                    );
               }

               const variant = await tx.productVariant.findUnique({
                    where: { id: saleItem.variantId },
                    select: { id: true, stockQuantity: true },
               });

               if (!variant) {
                    throw returnError("Product variant not found", 404);
               }

               const newQuantity = variant.stockQuantity + requested.quantity;

               if (!Number.isSafeInteger(newQuantity)) {
                    throw returnError("Stock quantity is too large");
               }

               // Refund the proportional amount after the original item discount.
               const lineTotalPaise = ensureSafeAmount(
                    Math.round(
                         (saleItem.lineTotalPaise * requested.quantity) /
                         saleItem.quantity
                    )
               );

               const costTotalPaise = ensureSafeAmount(
                    saleItem.unitCostPaise * requested.quantity
               );

               const itemTotal = totalPaise + lineTotalPaise;

               ensureSafeAmount(itemTotal);

               totalPaise = itemTotal;

               returnItems.push({
                    saleItemId: saleItem.id,
                    variantId: saleItem.variantId,
                    quantity: requested.quantity,
                    unitPricePaise: saleItem.unitSellingPricePaise,
                    unitCostPaise: saleItem.unitCostPaise,
                    lineTotalPaise,
               });
          }

          const created = await tx.saleReturn.create({
               data: {
                    returnNumber: `SRET-${randomUUID()}`,
                    saleId: sale.id,
                    status: "COMPLETED",
                    totalPaise,
                    reason: request.reason,
                    items: {
                         create: returnItems,
                    },
               },
               include: { items: true },
          });

          for (const item of returnItems) {
               await tx.productVariant.update({
                    where: { id: item.variantId },
                    data: {
                         stockQuantity: { increment: item.quantity },
                    },
               });

               await tx.stockMovement.create({
                    data: {
                         variantId: item.variantId,
                         movementType: "SALE_RETURN",
                         quantityChange: item.quantity,
                         unitCostPaise: item.unitCostPaise,
                         referenceType: "SALE_RETURN",
                         referenceId: created.id,
                         note: `Sales return ${created.returnNumber}`,
                    },
               });
          }

          return created;
     });
}

export async function createPurchaseReturn(data) {
     const request = validateReturnRequest(data, "PURCHASE");

     return prisma.$transaction(async (tx) => {
          const purchase = await tx.purchase.findUnique({
               where: { id: request.referenceId },
               include: { items: true },
          });

          if (!purchase) {
               throw returnError("Purchase not found", 404);
          }

          if (purchase.status !== "COMPLETED") {
               throw returnError(
                    "Only completed purchases can be returned",
                    409
               );
          }

          const returnItems = [];
          let totalPaise = 0;

          for (const requested of request.items) {
               const purchaseItem = purchase.items.find(
                    (item) => item.id === requested.referenceId
               );

               if (!purchaseItem) {
                    throw returnError(
                         `Purchase item not found: ${requested.referenceId}`,
                         404
                    );
               }

               const previousReturns = await tx.purchaseReturnItem.aggregate({
                    where: { originalPurchaseItemId: purchaseItem.id },
                    _sum: { quantity: true },
               });

               const alreadyReturned = previousReturns._sum.quantity ?? 0;
               const remainingQuantity = purchaseItem.quantity - alreadyReturned;

               if (requested.quantity > remainingQuantity) {
                    throw returnError(
                         `Cannot return more than the remaining purchased quantity. Available to return: ${remainingQuantity}`,
                         409
                    );
               }

               const variant = await tx.productVariant.findUnique({
                    where: { id: purchaseItem.variantId },
                    select: {
                         id: true,
                         stockQuantity: true,
                    },
               });

               if (!variant) {
                    throw returnError("Product variant not found", 404);
               }

               if (requested.quantity > variant.stockQuantity) {
                    throw returnError(
                         `Insufficient stock to return this item. Available: ${variant.stockQuantity}`,
                         409
                    );
               }

               const lineTotalPaise = ensureSafeAmount(
                    requested.quantity * purchaseItem.unitCostPaise
               );

               const itemTotal = totalPaise + lineTotalPaise;
               ensureSafeAmount(itemTotal);

               totalPaise = itemTotal;

               returnItems.push({
                    originalPurchaseItemId: purchaseItem.id,
                    variantId: purchaseItem.variantId,
                    quantity: requested.quantity,
                    unitCostPaise: purchaseItem.unitCostPaise,
                    lineTotalPaise,
               });
          }

          const created = await tx.purchaseReturn.create({
               data: {
                    returnNumber: `PRET-${randomUUID()}`,
                    purchaseId: purchase.id,
                    supplierId: purchase.supplierId,
                    status: "COMPLETED",
                    totalPaise,
                    reason: request.reason,
                    items: {
                         create: returnItems,
                    },
               },
               include: { items: true },
          });

          for (const item of returnItems) {
               const stockUpdate = await tx.productVariant.updateMany({
                    where: {
                         id: item.variantId,
                         stockQuantity: { gte: item.quantity },
                    },
                    data: {
                         stockQuantity: { decrement: item.quantity },
                    },
               });

               if (stockUpdate.count !== 1) {
                    throw returnError(
                         `Insufficient stock to complete purchase return for variant ${item.variantId}. Refresh inventory and try again.`,
                         409
                    );
               }

               await tx.stockMovement.create({
                    data: {
                         variantId: item.variantId,
                         movementType: "PURCHASE_RETURN",
                         quantityChange: -item.quantity,
                         unitCostPaise: item.unitCostPaise,
                         referenceType: "PURCHASE_RETURN",
                         referenceId: created.id,
                         note: `Purchase return ${created.returnNumber}`,
                    },
               });
          }

          return created;
     });
}

export async function listSaleReturns() {
     return prisma.saleReturn.findMany({
          include: {
               sale: {
                    select: {
                         id: true,
                         saleNumber: true,
                         soldAt: true,
                    },
               },
               items: {
                    include: {
                         variant: {
                              select: {
                                   id: true,
                                   name: true,
                                   sku: true,
                                   product: {
                                        select: {
                                             id: true,
                                             name: true,
                                        },
                                   },
                              },
                         },
                         saleItem: true,
                    },
               },
          },
          orderBy: { returnedAt: "desc" },
     });
}

export async function listPurchaseReturns() {
     return prisma.purchaseReturn.findMany({
          include: {
               purchase: {
                    select: {
                         id: true,
                         purchaseNumber: true,
                         purchasedAt: true,
                    },
               },
               supplier: true,
               items: {
                    include: {
                         variant: {
                              select: {
                                   id: true,
                                   name: true,
                                   sku: true,
                                   product: {
                                        select: {
                                             id: true,
                                             name: true,
                                        },
                                   },
                              },
                         },
                         originalPurchaseItem: true,
                    },
               },
          },
          orderBy: { returnedAt: "desc" },
     });
}
