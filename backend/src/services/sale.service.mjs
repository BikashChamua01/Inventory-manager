import { randomUUID } from "node:crypto";
import { prisma } from "../config/database.mjs";

function saleError(message, statusCode = 400) {
     const error = new Error(message);
     error.statusCode = statusCode;
     return error;
}

export async function createSale(data) {
     if (!data || typeof data !== "object" || Array.isArray(data)) {
          throw saleError("Request body must be a JSON object");
     }

     if (!Array.isArray(data.items) || data.items.length === 0) {
          throw saleError("At least one sale item is required");
     }

     const items = data.items.map((item) => {
          if (
               !item ||
               typeof item.variantId !== "string" ||
               !item.variantId.trim() ||
               !Number.isSafeInteger(item.quantity) ||
               item.quantity <= 0
          ) {
               throw saleError(
                    "Each item needs a variantId and a positive integer quantity"
               );
          }

          if (
               item.unitSellingPricePaise !== undefined &&
               (!Number.isSafeInteger(item.unitSellingPricePaise) ||
                    item.unitSellingPricePaise < 0)
          ) {
               throw saleError(
                    "Selling price must be a non-negative integer in paise"
               );
          }

          return {
               variantId: item.variantId.trim(),
               quantity: item.quantity,
               unitSellingPricePaise: item.unitSellingPricePaise,
          };
     });

     const seenVariantIds = new Set();

     for (const item of items) {
          if (seenVariantIds.has(item.variantId)) {
               throw saleError(
                    `Duplicate variant in sale: ${item.variantId}. ` +
                    "Combine the quantities into one item."
               );
          }

          seenVariantIds.add(item.variantId);
     }

     if (data.notes != null && typeof data.notes !== "string") {
          throw saleError("notes must be a string");
     }

     if (
          data.customerId != null &&
          (typeof data.customerId !== "string" || !data.customerId.trim())
     ) {
          throw saleError("customerId must be a non-empty string or null");
     }

     return prisma.$transaction(async (tx) => {
          if (data.customerId != null) {
               const customer = await tx.customer.findUnique({
                    where: { id: data.customerId.trim() },
                    select: { id: true },
               });

               if (!customer) {
                    throw saleError("Customer not found", 404);
               }
          }

          const saleItems = [];

          for (const item of items) {
               const variant = await tx.productVariant.findUnique({
                    where: { id: item.variantId },
                    select: {
                         id: true,
                         name: true,
                         stockQuantity: true,
                         sellingPricePaise: true,
                         averageCostPaise: true,
                         averageCostKnown: true,
                         isActive: true,
                         product: {
                              select: { isActive: true },
                         },
                    },
               });

               if (!variant) {
                    throw saleError(`Variant not found: ${item.variantId}`, 404);
               }

               if (!variant.isActive || !variant.product.isActive) {
                    throw saleError(
                         "Cannot sell an inactive variant or archived product",
                         409
                    );
               }

               if (variant.stockQuantity < item.quantity) {
                    throw saleError(
                         `Insufficient stock for ${variant.name}. Available: ${variant.stockQuantity}`,
                         409
                    );
               }

               if (
                    !variant.averageCostKnown ||
                    !Number.isSafeInteger(variant.averageCostPaise) ||
                    variant.averageCostPaise < 0
               ) {
                    throw saleError(
                         `Cannot sell ${variant.name}: inventory cost is unknown. ` +
                         "Record the opening stock cost or resolve the inventory cost first.",
                         409
                    );
               }

               const unitSellingPricePaise =
                    item.unitSellingPricePaise ?? variant.sellingPricePaise;

               if (
                    !Number.isSafeInteger(unitSellingPricePaise) ||
                    unitSellingPricePaise < 0
               ) {
                    throw saleError(
                         `A valid selling price is required for ${variant.name}`
                    );
               }

               const unitCostPaise = variant.averageCostPaise;
               const lineTotalPaise = item.quantity * unitSellingPricePaise;
               const costTotalPaise = item.quantity * unitCostPaise;

               if (
                    !Number.isSafeInteger(lineTotalPaise) ||
                    !Number.isSafeInteger(costTotalPaise)
               ) {
                    throw saleError("Sale amount is too large");
               }

               const grossProfitPaise = lineTotalPaise - costTotalPaise;

               if (!Number.isSafeInteger(grossProfitPaise)) {
                    throw saleError("Sale profit amount is too large");
               }

               saleItems.push({
                    variantId: item.variantId,
                    quantity: item.quantity,
                    unitSellingPricePaise,
                    unitCostPaise,
                    lineTotalPaise,
                    costTotalPaise,
                    grossProfitPaise,
               });
          }

          const subtotalPaise = saleItems.reduce(
               (sum, item) => sum + item.lineTotalPaise,
               0
          );

          if (!Number.isSafeInteger(subtotalPaise)) {
               throw saleError("Sale total is too large");
          }

          for (const item of saleItems) {
               const result = await tx.productVariant.updateMany({
                    where: {
                         id: item.variantId,
                         stockQuantity: { gte: item.quantity },
                         isActive: true,
                         product: { isActive: true },
                    },
                    data: {
                         stockQuantity: { decrement: item.quantity },
                    },
               });

               if (result.count !== 1) {
                    throw saleError(
                         `Stock changed or is insufficient for variant ${item.variantId}. ` +
                         "Refresh inventory and try again.",
                         409
                    );
               }
          }

          const sale = await tx.sale.create({
               data: {
                    saleNumber: `SALE-${randomUUID()}`,
                    customerId: data.customerId?.trim() || null,
                    subtotalPaise,
                    totalPaise: subtotalPaise,
                    notes: data.notes?.trim() || null,
                    status: "COMPLETED",
                    items: {
                         create: saleItems,
                    },
               },
               include: { items: true },
          });

          for (const item of saleItems) {
               await tx.stockMovement.create({
                    data: {
                         variantId: item.variantId,
                         movementType: "SALE",
                         quantityChange: -item.quantity,
                         unitCostPaise: item.unitCostPaise,
                         referenceType: "Sale",
                         referenceId: sale.id,
                         note: `Sale ${sale.saleNumber}`,
                    },
               });
          }

          return sale;
     });
}

export async function listSales() {
     return prisma.sale.findMany({
          include: {
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
                    },
               },
               customer: true,
          },
          orderBy: {
               soldAt: "desc",
          },
     });
}