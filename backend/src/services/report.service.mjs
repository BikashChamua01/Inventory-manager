
import { prisma } from "../config/database.mjs";
import { getSettings } from "./settings.service.mjs";

function buildDateFilter(from, to) {
     const dateFilter = {};

     if (from) dateFilter.gte = new Date(from);
     if (to) dateFilter.lte = new Date(to);

     if (
          (from && Number.isNaN(dateFilter.gte.getTime())) ||
          (to && Number.isNaN(dateFilter.lte.getTime()))
     ) {
          const error = new Error("Invalid date filter");
          error.statusCode = 400;
          throw error;
     }

     if (from && to && dateFilter.gte > dateFilter.lte) {
          const error = new Error("'from' must not be later than 'to'");
          error.statusCode = 400;
          throw error;
     }

     return dateFilter;
}

// Remove discount fields from report item responses.
// Existing database records are not modified.
function withoutDiscount(item) {
     const { discountPaise, ...result } = item;
     return result;
}


export async function getStockReport() {
     const settings = await getSettings();

     const defaultThreshold = Number(
          settings["inventory.defaultLowStockThreshold"]
     );

     const lowStockWarningsEnabled =
          settings["inventory.lowStockWarnings"] === "true";

     const variants = await prisma.productVariant.findMany({
          where: {
               product: {
                    isActive: true,
               },
          },
          include: {
               product: {
                    select: {
                         id: true,
                         name: true,
                         sku: true,
                         category: {
                              select: {
                                   id: true,
                                   name: true,
                              },
                         },
                    },
               },
               attributes: {
                    select: {
                         name: true,
                         value: true,
                    },
                    orderBy: {
                         name: "asc",
                    },
               },
          },
          orderBy: [
               {
                    product: {
                         name: "asc",
                    },
               },
               {
                    name: "asc",
               },
          ],
     });

     const items = variants.map((variant) => {
          // Use the variant-specific threshold when it is positive.
          // Otherwise, fall back to the default configured in Settings.
          const effectiveThreshold =
               variant.lowStockThreshold > 0
                    ? variant.lowStockThreshold
                    : defaultThreshold;

          return {
               variantId: variant.id,
               productId: variant.productId,
               productName: variant.product.name,
               productSku: variant.product.sku,
               category: variant.product.category?.name ?? null,
               variantName: variant.name,
               sku: variant.sku,
               unit: variant.unit,
               attributes: variant.attributes,
               stockQuantity: variant.stockQuantity,
               lowStockThreshold: effectiveThreshold,

               isLowStock:
                    lowStockWarningsEnabled &&
                    effectiveThreshold > 0 &&
                    variant.stockQuantity <= effectiveThreshold,

               purchasePricePaise: variant.purchasePricePaise,
               sellingPricePaise: variant.sellingPricePaise,
               averageCostPaise: variant.averageCostPaise,
               averageCostKnown: variant.averageCostKnown,

               stockValueAtAverageCostPaise: variant.averageCostKnown
                    ? variant.stockQuantity * variant.averageCostPaise
                    : null,

               isActive: variant.isActive,
          };
     });

     return {
          items,
          summary: {
               totalVariants: items.length,

               totalStockUnits: items.reduce(
                    (sum, item) => sum + item.stockQuantity,
                    0
               ),

               lowStockVariants: items.filter((item) => item.isLowStock).length,
          },
     };
}


export async function getSalesReport({ from, to } = {}) {
     const dateFilter = buildDateFilter(from, to);

     const sales = await prisma.sale.findMany({
          where: {
               status: "COMPLETED",
               ...(from || to ? { soldAt: dateFilter } : {}),
          },
          include: {
               items: true,
               returns: {
                    where: {
                         status: "COMPLETED",
                    },
                    include: {
                         items: true,
                    },
               },
          },
          orderBy: {
               soldAt: "desc",
          },
     });

     const saleCount = sales.length;

     const grossSalesPaise = sales.reduce(
          (sum, sale) => sum + sale.totalPaise,
          0
     );

     const unitsSold = sales.reduce(
          (sum, sale) =>
               sum + sale.items.reduce((total, item) => total + item.quantity, 0),
          0
     );

     const salesReturnsPaise = sales.reduce(
          (sum, sale) =>
               sum +
               sale.returns.reduce(
                    (returnSum, saleReturn) =>
                         returnSum +
                         saleReturn.items.reduce(
                              (itemSum, item) => itemSum + item.lineTotalPaise,
                              0
                         ),
                    0
               ),
          0
     );

     const unitsReturned = sales.reduce(
          (sum, sale) =>
               sum +
               sale.returns.reduce(
                    (returnSum, saleReturn) =>
                         returnSum +
                         saleReturn.items.reduce(
                              (itemSum, item) => itemSum + item.quantity,
                              0
                         ),
                    0
               ),
          0
     );

     return {
          filters: {
               from: from ?? null,
               to: to ?? null,
          },
          summary: {
               saleCount,
               unitsSold,
               unitsReturned,
               grossSalesPaise,
               salesReturnsPaise,
               netSalesPaise: grossSalesPaise - salesReturnsPaise,
          },
          sales: sales.map((sale) => ({
               id: sale.id,
               saleNumber: sale.saleNumber,
               soldAt: sale.soldAt,
               totalPaise: sale.totalPaise,
               returnedPaise: sale.returns.reduce(
                    (sum, saleReturn) =>
                         sum +
                         saleReturn.items.reduce(
                              (itemSum, item) => itemSum + item.lineTotalPaise,
                              0
                         ),
                    0
               ),
               items: sale.items.map(withoutDiscount),
          })),
     };
}

export async function getPurchasesReport({ from, to } = {}) {
     const dateFilter = buildDateFilter(from, to);

     const purchases = await prisma.purchase.findMany({
          where: {
               status: "COMPLETED",
               ...(from || to ? { purchasedAt: dateFilter } : {}),
          },
          include: {
               items: true,
               supplier: {
                    select: {
                         id: true,
                         name: true,
                    },
               },
               returns: {
                    where: {
                         status: "COMPLETED",
                    },
                    include: {
                         items: true,
                    },
               },
          },
          orderBy: {
               purchasedAt: "desc",
          },
     });

     const purchaseCount = purchases.length;

     const grossPurchasesPaise = purchases.reduce(
          (sum, purchase) => sum + purchase.totalPaise,
          0
     );

     const unitsPurchased = purchases.reduce(
          (sum, purchase) =>
               sum +
               purchase.items.reduce((total, item) => total + item.quantity, 0),
          0
     );

     const purchaseReturnsPaise = purchases.reduce(
          (sum, purchase) =>
               sum +
               purchase.returns.reduce(
                    (returnSum, purchaseReturn) =>
                         returnSum + purchaseReturn.totalPaise,
                    0
               ),
          0
     );

     const unitsReturned = purchases.reduce(
          (sum, purchase) =>
               sum +
               purchase.returns.reduce(
                    (returnSum, purchaseReturn) =>
                         returnSum +
                         purchaseReturn.items.reduce(
                              (itemSum, item) => itemSum + item.quantity,
                              0
                         ),
                    0
               ),
          0
     );

     return {
          filters: {
               from: from ?? null,
               to: to ?? null,
          },
          summary: {
               purchaseCount,
               unitsPurchased,
               unitsReturned,
               grossPurchasesPaise,
               purchaseReturnsPaise,
               netPurchasesPaise: grossPurchasesPaise - purchaseReturnsPaise,
          },
          purchases: purchases.map((purchase) => ({
               id: purchase.id,
               purchaseNumber: purchase.purchaseNumber,
               purchasedAt: purchase.purchasedAt,
               supplier: purchase.supplier,
               totalPaise: purchase.totalPaise,
               returnedPaise: purchase.returns.reduce(
                    (sum, purchaseReturn) => sum + purchaseReturn.totalPaise,
                    0
               ),
               items: purchase.items.map(withoutDiscount),
          })),
     };
}


export async function getProfitReport({ from, to } = {}) {
     const dateFilter = buildDateFilter(from, to);

     const sales = await prisma.sale.findMany({
          where: {
               status: "COMPLETED",
               ...(from || to ? { soldAt: dateFilter } : {}),
          },
          include: {
               items: true,
          },
     });

     const saleReturns = await prisma.saleReturn.findMany({
          where: {
               status: "COMPLETED",
               ...(from || to ? { returnedAt: dateFilter } : {}),
          },
          include: {
               items: {
                    include: {
                         saleItem: true,
                    },
               },
          },
     });

     let salesRevenuePaise = 0;
     let costOfGoodsSoldPaise = 0;
     let returnedUnits = 0;
     let unknownCostItems = 0;

     // Count unknown costs on original sale lines.
     for (const sale of sales) {
          salesRevenuePaise += sale.totalPaise;

          for (const item of sale.items) {
               if (item.costTotalPaise != null) {
                    costOfGoodsSoldPaise += item.costTotalPaise;
               } else if (item.unitCostPaise != null) {
                    costOfGoodsSoldPaise +=
                         item.unitCostPaise * item.quantity;
               } else {
                    unknownCostItems += 1;
               }
          }
     }

     // Reverse revenue and cost when returns are recorded.
     for (const saleReturn of saleReturns) {
          for (const item of saleReturn.items) {
               salesRevenuePaise -= item.lineTotalPaise;
               returnedUnits += item.quantity;

               // Use the original sale item's recorded cost.
               // Do not assume an unknown cost is zero.
               const originalItem = item.saleItem;
               const unitCostPaise =
                    originalItem?.unitCostPaise ?? item.unitCostPaise;

               if (unitCostPaise != null) {
                    costOfGoodsSoldPaise -=
                         unitCostPaise * item.quantity;
               } else {
                    unknownCostItems += 1;
               }
          }
     }

     const purchaseReturns = await prisma.purchaseReturn.aggregate({
          where: {
               status: "COMPLETED",
               ...(from || to ? { returnedAt: dateFilter } : {}),
          },
          _sum: {
               totalPaise: true,
          },
     });

     const profitComplete = unknownCostItems === 0;

     return {
          filters: {
               from: from ?? null,
               to: to ?? null,
          },
          summary: {
               salesRevenuePaise,
               costOfGoodsSoldPaise,
               grossProfitPaise: profitComplete
                    ? salesRevenuePaise - costOfGoodsSoldPaise
                    : null,
               profitComplete,
               unknownCostItems,
               returnedUnits,
               purchaseReturnsPaise:
                    purchaseReturns._sum.totalPaise ?? 0,
          },
     };
}



export async function permanentlyDeleteProduct(id) {
     if (typeof id !== "string" || !id.trim()) {
          throw productError("A valid product ID is required");
     }

     return prisma.$transaction(
          async (tx) => {
               const product = await tx.product.findUnique({
                    where: { id: id.trim() },
                    include: {
                         variants: {
                              select: { id: true },
                         },
                    },
               });

               if (!product) {
                    throw productError("Product not found", 404);
               }

               const variantIds = product.variants.map((variant) => variant.id);

               // A product without variants has no inventory transaction history.
               if (variantIds.length === 0) {
                    await tx.auditLog.deleteMany({
                         where: {
                              entityType: "Product",
                              entityId: product.id,
                         },
                    });

                    await tx.product.delete({
                         where: { id: product.id },
                    });

                    return {
                         productId: product.id,
                         deletedVariants: 0,
                         deletedPurchaseItems: 0,
                         deletedSaleItems: 0,
                         deletedStockMovements: 0,
                         message: "Product permanently deleted",
                    };
               }

               const [purchaseItems, saleItems] = await Promise.all([
                    tx.purchaseItem.findMany({
                         where: { variantId: { in: variantIds } },
                         include: {
                              purchase: {
                                   include: {
                                        items: { select: { id: true, variantId: true } },
                                        payments: { select: { id: true } },
                                   },
                              },
                              returnItems: {
                                   include: {
                                        purchaseReturn: {
                                             include: {
                                                  items: { select: { id: true, variantId: true } },
                                             },
                                        },
                                   },
                              },
                         },
                    }),
                    tx.saleItem.findMany({
                         where: { variantId: { in: variantIds } },
                         include: {
                              sale: {
                                   include: {
                                        items: { select: { id: true, variantId: true } },
                                        payments: { select: { id: true } },
                                   },
                              },
                              returnItems: {
                                   include: {
                                        saleReturn: {
                                             include: {
                                                  items: { select: { id: true, variantId: true } },
                                             },
                                        },
                                   },
                              },
                         },
                    }),
               ]);

               const affectedPurchaseIds = new Set(
                    purchaseItems.map((item) => item.purchaseId)
               );
               const affectedSaleIds = new Set(
                    saleItems.map((item) => item.saleId)
               );

               // Refuse to change shared financial transactions when their
               // payment or header-level adjustment history cannot be reconciled.
               for (const item of purchaseItems) {
                    const purchase = item.purchase;
                    const remainingItems = purchase.items.filter(
                         (other) => !variantIds.includes(other.variantId)
                    );

                    if (
                         remainingItems.length > 0 &&
                         (purchase.payments.length > 0 ||
                              purchase.discountPaise !== 0 ||
                              purchase.taxPaise !== 0 ||
                              purchase.shippingPaise !== 0)
                    ) {
                         throw productError(
                              `Cannot permanently delete this product safely: purchase ${purchase.purchaseNumber} contains other products and has payments or adjustments`,
                              409
                         );
                    }
               }

               for (const item of saleItems) {
                    const sale = item.sale;
                    const remainingItems = sale.items.filter(
                         (other) => !variantIds.includes(other.variantId)
                    );

                    if (
                         remainingItems.length > 0 &&
                         (sale.payments.length > 0 ||
                              sale.discountPaise !== 0 ||
                              sale.taxPaise !== 0)
                    ) {
                         throw productError(
                              `Cannot permanently delete this product safely: sale ${sale.saleNumber} contains other products and has payments or adjustments`,
                              409
                         );
                    }
               }

               const purchaseReturnIds = new Set();
               const saleReturnIds = new Set();

               for (const item of purchaseItems) {
                    for (const returnItem of item.returnItems) {
                         purchaseReturnIds.add(returnItem.purchaseReturnId);
                    }
               }

               for (const item of saleItems) {
                    for (const returnItem of item.returnItems) {
                         saleReturnIds.add(returnItem.saleReturnId);
                    }
               }

               // Remove return items linked to the affected original items.
               await tx.purchaseReturnItem.deleteMany({
                    where: {
                         originalPurchaseItemId: {
                              in: purchaseItems.map((item) => item.id),
                         },
                    },
               });

               await tx.saleReturnItem.deleteMany({
                    where: {
                         saleItemId: {
                              in: saleItems.map((item) => item.id),
                         },
                    },
               });

               // Remove any other return lines belonging to the deleted variants.
               await tx.purchaseReturnItem.deleteMany({
                    where: { variantId: { in: variantIds } },
               });

               await tx.saleReturnItem.deleteMany({
                    where: { variantId: { in: variantIds } },
               });

               // Recalculate surviving return totals, or delete empty return headers.
               for (const returnId of purchaseReturnIds) {
                    const remaining = await tx.purchaseReturnItem.findMany({
                         where: { purchaseReturnId: returnId },
                         select: { lineTotalPaise: true },
                    });

                    if (remaining.length === 0) {
                         await tx.purchaseReturn.delete({
                              where: { id: returnId },
                         });
                    } else {
                         await tx.purchaseReturn.update({
                              where: { id: returnId },
                              data: {
                                   totalPaise: remaining.reduce(
                                        (sum, item) => sum + item.lineTotalPaise,
                                        0
                                   ),
                              },
                         });
                    }
               }

               for (const returnId of saleReturnIds) {
                    const remaining = await tx.saleReturnItem.findMany({
                         where: { saleReturnId: returnId },
                         select: { lineTotalPaise: true },
                    });

                    if (remaining.length === 0) {
                         await tx.saleReturn.delete({
                              where: { id: returnId },
                         });
                    } else {
                         await tx.saleReturn.update({
                              where: { id: returnId },
                              data: {
                                   totalPaise: remaining.reduce(
                                        (sum, item) => sum + item.lineTotalPaise,
                                        0
                                   ),
                              },
                         });
                    }
               }

               // Delete original purchase and sale items for these variants.
               await tx.purchaseItem.deleteMany({
                    where: { variantId: { in: variantIds } },
               });

               await tx.saleItem.deleteMany({
                    where: { variantId: { in: variantIds } },
               });

               // Delete transaction headers that no longer have any items.
               for (const purchaseId of affectedPurchaseIds) {
                    const remaining = await tx.purchaseItem.count({
                         where: { purchaseId },
                    });

                    if (remaining === 0) {
                         await tx.payment.deleteMany({
                              where: { purchaseId },
                         });

                         await tx.purchaseReturn.deleteMany({
                              where: { purchaseId },
                         });

                         await tx.purchase.delete({
                              where: { id: purchaseId },
                         });
                    } else {
                         const remainingItems = await tx.purchaseItem.findMany({
                              where: { purchaseId },
                              select: { lineTotalPaise: true },
                         });

                         const subtotalPaise = remainingItems.reduce(
                              (sum, item) => sum + item.lineTotalPaise,
                              0
                         );

                         await tx.purchase.update({
                              where: { id: purchaseId },
                              data: {
                                   subtotalPaise,
                                   totalPaise: subtotalPaise,
                              },
                         });
                    }
               }

               for (const saleId of affectedSaleIds) {
                    const remaining = await tx.saleItem.count({
                         where: { saleId },
                    });

                    if (remaining === 0) {
                         await tx.payment.deleteMany({
                              where: { saleId },
                         });

                         await tx.saleReturn.deleteMany({
                              where: { saleId },
                         });

                         await tx.sale.delete({
                              where: { id: saleId },
                         });
                    } else {
                         const remainingItems = await tx.saleItem.findMany({
                              where: { saleId },
                              select: { lineTotalPaise: true },
                         });

                         const subtotalPaise = remainingItems.reduce(
                              (sum, item) => sum + item.lineTotalPaise,
                              0
                         );

                         await tx.sale.update({
                              where: { id: saleId },
                              data: {
                                   subtotalPaise,
                                   totalPaise: subtotalPaise,
                              },
                         });
                    }
               }

               // Delete stock movements and audit history for the removed entities.
               await tx.stockMovement.deleteMany({
                    where: { variantId: { in: variantIds } },
               });

               await tx.auditLog.deleteMany({
                    where: {
                         OR: [
                              { entityType: "Product", entityId: product.id },
                              { entityType: "ProductVariant", entityId: { in: variantIds } },
                         ],
                    },
               });

               // Variant attributes cascade on variant deletion.
               // Remaining restrictive relations must be absent by this point.
               await tx.productVariant.deleteMany({
                    where: { id: { in: variantIds } },
               });

               await tx.productAttribute.deleteMany({
                    where: { productId: product.id },
               });

               await tx.product.delete({
                    where: { id: product.id },
               });

               return {
                    productId: product.id,
                    deletedVariants: variantIds.length,
                    deletedPurchaseItems: purchaseItems.length,
                    deletedSaleItems: saleItems.length,
                    deletedStockMovements: variantIds.length,
                    message: "Product permanently deleted",
               };
          },
          {
               maxWait: 5000,
               timeout: 20000,
          }
     );
}
