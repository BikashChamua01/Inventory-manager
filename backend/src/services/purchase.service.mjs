
import { randomUUID } from "node:crypto";
import { prisma } from "../config/database.mjs";

function purchaseError(message, statusCode = 400) {
     const error = new Error(message);
     error.statusCode = statusCode;
     return error;
}

export async function createPurchase(data) {
     if (!data || typeof data !== "object" || Array.isArray(data)) {
          throw purchaseError("Request body must be a JSON object");
     }

     if (!Array.isArray(data.items) || data.items.length === 0) {
          throw purchaseError("At least one purchase item is required");
     }

     const items = data.items.map((item) => {
          if (
               !item ||
               typeof item.variantId !== "string" ||
               !item.variantId.trim() ||
               !Number.isSafeInteger(item.quantity) ||
               item.quantity <= 0 ||
               !Number.isSafeInteger(item.unitCostPaise) ||
               item.unitCostPaise < 0
          ) {
               throw purchaseError(
                    "Each item needs a variantId, positive integer quantity, and non-negative unit cost in paise"
               );
          }

          const lineTotalPaise = item.quantity * item.unitCostPaise;

          if (!Number.isSafeInteger(lineTotalPaise)) {
               throw purchaseError("Purchase item total is too large");
          }

          return {
               variantId: item.variantId.trim(),
               quantity: item.quantity,
               unitCostPaise: item.unitCostPaise,
               lineTotalPaise,
          };
     });

     const subtotalPaise = items.reduce(
          (sum, item) => sum + item.lineTotalPaise,
          0
     );

     if (!Number.isSafeInteger(subtotalPaise)) {
          throw purchaseError("Purchase total is too large");
     }

     if (
          data.supplierId != null &&
          (typeof data.supplierId !== "string" || !data.supplierId.trim())
     ) {
          throw purchaseError("supplierId must be a non-empty string or null");
     }

     if (data.notes != null && typeof data.notes !== "string") {
          throw purchaseError("notes must be a string");
     }

     return prisma.$transaction(async (tx) => {
          if (data.supplierId) {
               const supplier = await tx.supplier.findUnique({
                    where: { id: data.supplierId.trim() },
                    select: { id: true },
               });

               if (!supplier) {
                    throw purchaseError("Supplier not found", 404);
               }
          }

          // Validate every distinct variant and capture its original state.
          const variantIds = [
               ...new Set(items.map((item) => item.variantId)),
          ];

          const stockSnapshot = {};

          for (const variantId of variantIds) {
               const variant = await tx.productVariant.findUnique({
                    where: { id: variantId },
                    select: {
                         id: true,
                         isActive: true,
                         stockQuantity: true,
                         purchasePricePaise: true,
                         averageCostPaise: true,
                         averageCostKnown: true,
                         product: {
                              select: { isActive: true },
                         },
                    },
               });

               if (!variant) {
                    throw purchaseError(`Variant not found: ${variantId}`, 404);
               }

               if (!variant.isActive || !variant.product.isActive) {
                    throw purchaseError(
                         "Cannot purchase an inactive variant or archived product",
                         409
                    );
               }

               // Capture the state before this purchase changes inventory.
               // Each variant is recorded only once.
               stockSnapshot[variantId] = {
                    stockQuantity: variant.stockQuantity,
                    purchasePricePaise: variant.purchasePricePaise,
                    averageCostPaise: variant.averageCostPaise,
                    averageCostKnown: variant.averageCostKnown,
               };
          }

          const purchase = await tx.purchase.create({
               data: {
                    purchaseNumber: `PUR-${randomUUID()}`,
                    supplierId: data.supplierId?.trim() || null,
                    subtotalPaise,
                    discountPaise: 0,
                    taxPaise: 0,
                    shippingPaise: 0,
                    totalPaise: subtotalPaise,
                    notes: data.notes?.trim() || null,
                    status: "COMPLETED",
                    stockSnapshotJson: JSON.stringify(stockSnapshot),
                    items: {
                         create: items,
                    },
               },
               include: { items: true },
          });

          // Update stock, average cost, and stock movement atomically.
          for (const item of items) {
               const variant = await tx.productVariant.findUnique({
                    where: { id: item.variantId },
                    select: {
                         stockQuantity: true,
                         averageCostPaise: true,
                         averageCostKnown: true,
                    },
               });

               if (!variant) {
                    throw purchaseError(
                         `Variant not found: ${item.variantId}`,
                         404
                    );
               }

               const oldQuantity = variant.stockQuantity;
               const newQuantity = oldQuantity + item.quantity;

               if (!Number.isSafeInteger(newQuantity)) {
                    throw purchaseError("Stock quantity is too large");
               }

               let newAverageCost;
               let newAverageCostKnown;

               if (oldQuantity === 0) {
                    newAverageCost = item.unitCostPaise;
                    newAverageCostKnown = true;
               } else if (variant.averageCostKnown) {
                    const weightedCost =
                         oldQuantity * variant.averageCostPaise +
                         item.quantity * item.unitCostPaise;

                    if (!Number.isSafeInteger(weightedCost)) {
                         throw purchaseError("Average inventory cost is too large");
                    }

                    newAverageCost = Math.round(weightedCost / newQuantity);
                    newAverageCostKnown = true;
               } else {
                    // Existing inventory cost is unknown; do not guess.
                    newAverageCost = variant.averageCostPaise;
                    newAverageCostKnown = false;
               }

               await tx.productVariant.update({
                    where: { id: item.variantId },
                    data: {
                         stockQuantity: newQuantity,
                         purchasePricePaise: item.unitCostPaise,
                         averageCostPaise: newAverageCost,
                         averageCostKnown: newAverageCostKnown,
                    },
               });

               await tx.stockMovement.create({
                    data: {
                         variantId: item.variantId,
                         movementType: "PURCHASE",
                         quantityChange: item.quantity,
                         unitCostPaise: item.unitCostPaise,
                         referenceType: "Purchase",
                         referenceId: purchase.id,
                         note: `Purchase ${purchase.purchaseNumber}`,
                    },
               });
          }

          return purchase;
     });
}


export async function listPurchases() {
     const purchases = await prisma.purchase.findMany({
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
               supplier: true,
               payments: { select: { id: true } },
               returns: { select: { id: true } },
          },
          orderBy: {
               purchasedAt: "desc",
          },
     });

     const results = [];

     for (const purchase of purchases) {
          let cancellationEligible = false;
          let cancellationBlockedReason = null;

          if (purchase.status !== "COMPLETED") {
               cancellationBlockedReason =
                    `Purchase status is ${purchase.status}; only completed purchases can be cancelled.`;
          } else if (!purchase.stockSnapshotJson) {
               cancellationBlockedReason =
                    "This older purchase has no stock snapshot and cannot be safely reversed.";
          } else if (purchase.payments.length > 0) {
               cancellationBlockedReason =
                    "This purchase has payment records.";
          } else if (purchase.returns.length > 0) {
               cancellationBlockedReason =
                    "This purchase has return records.";
          } else {
               let snapshot = null;

               try {
                    snapshot = JSON.parse(purchase.stockSnapshotJson);
               } catch {
                    snapshot = null;
               }

               if (
                    !snapshot ||
                    typeof snapshot !== "object" ||
                    Array.isArray(snapshot)
               ) {
                    cancellationBlockedReason =
                         "The purchase stock snapshot is invalid.";
               } else {
                    const variantIds = [
                         ...new Set(
                              purchase.items.map((item) => item.variantId)
                         ),
                    ];

                    let blocked = false;

                    for (const variantId of variantIds) {
                         const original = snapshot[variantId];

                         if (
                              !original ||
                              !Number.isSafeInteger(original.stockQuantity) ||
                              original.stockQuantity < 0 ||
                              !Number.isSafeInteger(original.purchasePricePaise) ||
                              original.purchasePricePaise < 0 ||
                              !Number.isSafeInteger(original.averageCostPaise) ||
                              original.averageCostPaise < 0 ||
                              typeof original.averageCostKnown !== "boolean"
                         ) {
                              cancellationBlockedReason =
                                   "A valid original stock snapshot is missing.";
                              blocked = true;
                              break;
                         }

                         const purchasedQuantity = purchase.items
                              .filter((item) => item.variantId === variantId)
                              .reduce((sum, item) => sum + item.quantity, 0);

                         const variant = await prisma.productVariant.findUnique({
                              where: { id: variantId },
                              select: { stockQuantity: true },
                         });

                         if (!variant) {
                              cancellationBlockedReason =
                                   "A product variant from this purchase no longer exists.";
                              blocked = true;
                              break;
                         }

                         if (
                              variant.stockQuantity !==
                              original.stockQuantity + purchasedQuantity
                         ) {
                              cancellationBlockedReason =
                                   "Stock has changed since this purchase. Cancellation is blocked to protect inventory.";
                              blocked = true;
                              break;
                         }

                         const movements = await prisma.stockMovement.findMany({
                              where: {
                                   variantId,
                                   referenceType: "Purchase",
                                   referenceId: purchase.id,
                                   movementType: "PURCHASE",
                              },
                         });

                         const expectedQuantity = purchase.items
                              .filter((item) => item.variantId === variantId)
                              .reduce((sum, item) => sum + item.quantity, 0);

                         if (
                              movements.length === 0 ||
                              movements.some(
                                   (movement) =>
                                        !Number.isSafeInteger(movement.quantityChange) ||
                                        movement.quantityChange <= 0
                              ) ||
                              movements.reduce(
                                   (sum, movement) => sum + movement.quantityChange,
                                   0
                              ) !== expectedQuantity
                         ) {
                              cancellationBlockedReason =
                                   "Original purchase stock movements are missing or inconsistent.";
                              blocked = true;
                              break;
                         }

                         const latestOriginalTime = Math.max(
                              ...movements.map((movement) =>
                                   movement.createdAt.getTime()
                              )
                         );

                         const laterMovement =
                              await prisma.stockMovement.findFirst({
                                   where: {
                                        variantId,
                                        createdAt: {
                                             gte: new Date(latestOriginalTime),
                                        },
                                        NOT: {
                                             AND: [
                                                  { referenceType: "Purchase" },
                                                  { referenceId: purchase.id },
                                                  { movementType: "PURCHASE" },
                                             ],
                                        },
                                   },
                                   select: { id: true },
                              });

                         if (laterMovement) {
                              cancellationBlockedReason =
                                   "This variant has subsequent stock movements. Cancellation is blocked to protect inventory history.";
                              blocked = true;
                              break;
                         }
                    }

                    if (!blocked) {
                         cancellationEligible = true;
                    }
               }
          }

          const {
               stockSnapshotJson,
               payments,
               returns,
               ...publicPurchase
          } = purchase;

          results.push({
               ...publicPurchase,
               cancellationEligible,
               cancellationBlockedReason,
          });
     }

     return results;
}



export async function cancelPurchase(purchaseId, reason = "") {
     if (typeof purchaseId !== "string" || !purchaseId.trim()) {
          throw purchaseError("A valid purchase ID is required");
     }

     if (typeof reason !== "string") {
          throw purchaseError("Cancellation reason must be a string");
     }

     const id = purchaseId.trim();
     const cancellationReason = reason.trim();

     return prisma.$transaction(async (tx) => {
          const purchase = await tx.purchase.findUnique({
               where: { id },
               include: {
                    items: true,
                    payments: true,
                    returns: true,
               },
          });

          if (!purchase) {
               throw purchaseError("Purchase not found", 404);
          }

          if (purchase.status !== "COMPLETED") {
               throw purchaseError(
                    `Only completed purchases can be cancelled. Current status: ${purchase.status}`,
                    409
               );
          }

          if (!purchase.stockSnapshotJson) {
               throw purchaseError(
                    "This purchase has no stock snapshot and cannot be safely cancelled",
                    409
               );
          }

          if (purchase.payments.length > 0) {
               throw purchaseError(
                    "This purchase has payment records. Resolve its payments before cancellation",
                    409
               );
          }

          if (purchase.returns.length > 0) {
               throw purchaseError(
                    "This purchase has returns and cannot be cancelled",
                    409
               );
          }

          let stockSnapshot;

          try {
               stockSnapshot = JSON.parse(purchase.stockSnapshotJson);
          } catch {
               throw purchaseError(
                    "The purchase stock snapshot is invalid. Cancellation is blocked",
                    409
               );
          }

          if (
               !stockSnapshot ||
               typeof stockSnapshot !== "object" ||
               Array.isArray(stockSnapshot)
          ) {
               throw purchaseError(
                    "The purchase stock snapshot is invalid. Cancellation is blocked",
                    409
               );
          }

          const variantIds = [
               ...new Set(purchase.items.map((item) => item.variantId)),
          ];

          // Ensure the snapshot covers every variant affected by the purchase.
          for (const variantId of variantIds) {
               const snapshot = stockSnapshot[variantId];

               if (
                    !snapshot ||
                    !Number.isSafeInteger(snapshot.stockQuantity) ||
                    snapshot.stockQuantity < 0 ||
                    !Number.isSafeInteger(snapshot.purchasePricePaise) ||
                    snapshot.purchasePricePaise < 0 ||
                    !Number.isSafeInteger(snapshot.averageCostPaise) ||
                    snapshot.averageCostPaise < 0 ||
                    typeof snapshot.averageCostKnown !== "boolean"
               ) {
                    throw purchaseError(
                         `A valid stock snapshot is missing for variant ${variantId}`,
                         409
                    );
               }
          }

          // Require exactly one original purchase movement per purchase item.
          const originalMovements = await tx.stockMovement.findMany({
               where: {
                    referenceType: "Purchase",
                    referenceId: purchase.id,
                    movementType: "PURCHASE",
               },
          });

          if (
               originalMovements.length !== purchase.items.length ||
               originalMovements.some((movement) => {
                    const item = purchase.items.find(
                         (entry) => entry.variantId === movement.variantId
                    );

                    return (
                         !item ||
                         !Number.isSafeInteger(movement.quantityChange) ||
                         movement.quantityChange <= 0
                    );
               })
          ) {
               throw purchaseError(
                    "Original purchase stock movements are missing or inconsistent",
                    409
               );
          }

          // Block cancellation if any other stock movement exists for an
          // affected variant. This is deliberately conservative.

          // Block cancellation only when a different stock movement
          // occurred after this purchase's original movement.
          for (const variantId of variantIds) {
               const originalVariantMovements = originalMovements.filter(
                    (movement) => movement.variantId === variantId
               );

               if (originalVariantMovements.length === 0) {
                    throw purchaseError(
                         `Original stock movement missing for variant ${variantId}`,
                         409
                    );
               }

               const latestOriginalTime = Math.max(
                    ...originalVariantMovements.map(
                         (movement) => movement.createdAt.getTime()
                    )
               );

               const laterMovement = await tx.stockMovement.findFirst({
                    where: {
                         variantId,
                         createdAt: { gte: new Date(latestOriginalTime) },
                         NOT: {
                              AND: [
                                   { referenceType: "Purchase" },
                                   { referenceId: purchase.id },
                                   { movementType: "PURCHASE" },
                              ],
                         },
                    },
                    select: { id: true, movementType: true, createdAt: true },
               });

               if (laterMovement) {
                    throw purchaseError(
                         `Variant ${variantId} has a subsequent stock movement. Cancellation is blocked to protect inventory history`,
                         409
                    );
               }
          }


          // Ensure original movement quantities agree with purchase items.
          for (const item of purchase.items) {
               const matchingMovements = originalMovements.filter(
                    (movement) => movement.variantId === item.variantId
               );

               const movementQuantity = matchingMovements.reduce(
                    (sum, movement) => sum + movement.quantityChange,
                    0
               );

               const purchaseQuantity = purchase.items
                    .filter((entry) => entry.variantId === item.variantId)
                    .reduce((sum, entry) => sum + entry.quantity, 0);

               if (movementQuantity !== purchaseQuantity) {
                    throw purchaseError(
                         `Stock movement quantities do not match purchase items for variant ${item.variantId}`,
                         409
                    );
               }
          }

          // Restore the exact pre-purchase state and record compensating
          // movements. All changes roll back if any operation fails.
          for (const variantId of variantIds) {
               const snapshot = stockSnapshot[variantId];

               const currentVariant = await tx.productVariant.findUnique({
                    where: { id: variantId },
                    select: {
                         stockQuantity: true,
                         purchasePricePaise: true,
                         averageCostPaise: true,
                         averageCostKnown: true,
                    },
               });

               if (!currentVariant) {
                    throw purchaseError(
                         `Variant not found: ${variantId}`,
                         404
                    );
               }

               const purchasedQuantity = purchase.items
                    .filter((item) => item.variantId === variantId)
                    .reduce((sum, item) => sum + item.quantity, 0);

               if (
                    currentVariant.stockQuantity !==
                    snapshot.stockQuantity + purchasedQuantity
               ) {
                    throw purchaseError(
                         `Current stock for variant ${variantId} differs from the expected purchase result. Cancellation is blocked`,
                         409
                    );
               }

               await tx.productVariant.update({
                    where: { id: variantId },
                    data: {
                         stockQuantity: snapshot.stockQuantity,
                         purchasePricePaise: snapshot.purchasePricePaise,
                         averageCostPaise: snapshot.averageCostPaise,
                         averageCostKnown: snapshot.averageCostKnown,
                    },
               });

               await tx.stockMovement.create({
                    data: {
                         variantId,
                         movementType: "PURCHASE_CANCELLED",
                         quantityChange: -purchasedQuantity,
                         unitCostPaise: null,
                         referenceType: "Purchase",
                         referenceId: purchase.id,
                         note: `Cancellation of ${purchase.purchaseNumber}${cancellationReason
                              ? `: ${cancellationReason}`
                              : ""
                              }`,
                    },
               });
          }

          const updatedPurchase = await tx.purchase.update({
               where: { id: purchase.id },
               data: { status: "CANCELLED" },
          });

          await tx.auditLog.create({
               data: {
                    entityType: "Purchase",
                    entityId: purchase.id,
                    action: "CANCELLED",
                    beforeJson: JSON.stringify({
                         status: purchase.status,
                         totalPaise: purchase.totalPaise,
                    }),
                    afterJson: JSON.stringify({
                         status: updatedPurchase.status,
                         totalPaise: updatedPurchase.totalPaise,
                    }),
                    note: cancellationReason || null,
               },
          });

          return updatedPurchase;
     });
}
