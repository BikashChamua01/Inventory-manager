
import { prisma } from "../config/database.mjs";

function variantError(message, statusCode = 400) {
     const error = new Error(message);
     error.statusCode = statusCode;
     return error;
}

function cleanOptionalString(value) {
     if (value === undefined || value === null) return value;
     return value.trim() || null;
}

function normalizeAttributes(attributes = []) {
     return attributes.map((attribute) => ({
          name: attribute.name.trim(),
          value: attribute.value,
     }));
}

const variantInclude = {
     attributes: true,
     product: {
          select: {
               id: true,
               name: true,
               sku: true,
               isActive: true,
          },
     },
};

export async function createVariant(productId, data) {
     const product = await prisma.product.findUnique({
          where: { id: productId },
          select: { id: true, isActive: true },
     });

     if (!product) {
          throw variantError("Product not found", 404);
     }

     if (!product.isActive) {
          throw variantError("Cannot add a variant to an archived product", 400);
     }

     try {
          return await prisma.productVariant.create({
               data: {
                    productId,
                    name: data.name.trim(),
                    sku: cleanOptionalString(data.sku),
                    unit: data.unit?.trim() || "piece",
                    purchasePricePaise: data.purchasePricePaise,
                    sellingPricePaise: data.sellingPricePaise,
                    // Stock is managed only by the Inventory module.
                    stockQuantity: 0,
                    attributes: {
                         create: normalizeAttributes(data.attributes),
                    },
               },
               include: variantInclude,
          });
     } catch (error) {
          if (error.code === "P2002") {
               throw variantError("This SKU is already in use", 409);
          }
          throw error;
     }
}

export async function getVariantById(id) {
     const variant = await prisma.productVariant.findUnique({
          where: { id },
          include: variantInclude,
     });

     if (!variant) {
          throw variantError("Variant not found", 404);
     }

     return variant;
}

export async function listVariants(productId, { includeInactive = false } = {}) {
     const product = await prisma.product.findUnique({
          where: { id: productId },
          select: { id: true },
     });

     if (!product) {
          throw variantError("Product not found", 404);
     }

     return prisma.productVariant.findMany({
          where: {
               productId,
               ...(includeInactive ? {} : { isActive: true }),
          },
          include: { attributes: true },
          orderBy: { createdAt: "asc" },
     });
}


export async function updateVariant(id, data) {
     const existing = await prisma.productVariant.findUnique({
          where: { id },
          select: {
               id: true,
               product: {
                    select: {
                         isActive: true,
                    },
               },
          },
     });

     if (!existing) {
          throw variantError("Variant not found", 404);
     }

     if (!existing.product.isActive) {
          throw variantError(
               "Cannot edit a variant belonging to an archived product. Restore the product first.",
               409
          );
     }

     const updateData = {};


     for (const field of [
          "name",
          "sku",
          "unit",
          "purchasePricePaise",
          "sellingPricePaise",
          "isActive",
     ]) {
          if (field in data) {
               updateData[field] =
                    field === "name"
                         ? data.name.trim()
                         : field === "sku" || field === "unit"
                              ? cleanOptionalString(data[field])
                              : data[field];
          }
     }

     if ("attributes" in data) {
          updateData.attributes = {
               deleteMany: {},
               create: normalizeAttributes(data.attributes),
          };
     }

     try {
          return await prisma.productVariant.update({
               where: { id },
               data: updateData,
               include: variantInclude,
          });
     } catch (error) {
          if (error.code === "P2002") {
               throw variantError("This SKU is already in use", 409);
          }
          throw error;
     }
}





export async function setVariantActiveStatus(id, isActive) {
     const existing = await prisma.productVariant.findUnique({
          where: { id },
          select: { id: true, product: { select: { isActive: true } } },
     });

     if (!existing) {
          throw variantError("Variant not found", 404);
     }

     if (isActive && !existing.product.isActive) {
          throw variantError(
               "Restore the parent product before activating this variant",
               400
          );
     }

     return prisma.productVariant.update({
          where: { id },
          data: { isActive },
          include: variantInclude,
     });
}


export async function restoreProduct(id) {
     const product = await prisma.product.findUnique({
          where: { id },
     });

     if (!product) {
          throw productError("Product not found", 404);
     }

     return prisma.product.update({
          where: { id },
          data: { isActive: true },
          include: productInclude,
     });
}


export async function deleteVariant(id) {
     const variant = await prisma.productVariant.findUnique({
          where: { id },
          include: {
               _count: {
                    select: {
                         stockMovements: true,
                         purchaseItems: true,
                         saleItems: true,
                         purchaseReturnItems: true,
                         saleReturnItems: true,
                    },
               },
          },
     });

     if (!variant) {
          throw variantError("Variant not found", 404);
     }

     const hasHistory = Object.values(variant._count).some(
          (count) => count > 0
     );

     const auditLogCount = await prisma.auditLog.count({
          where: {
               entityType: "ProductVariant",
               entityId: id,
          },
     });

     if (variant.stockQuantity !== 0 || hasHistory || auditLogCount > 0) {
          throw variantError(
               "This variant has stock or history and cannot be permanently deleted. Deactivate it instead.",
               409
          );
     }

     await prisma.productVariant.delete({
          where: { id },
     });

     return {
          message: "Variant permanently deleted",
          id,
     };
}

