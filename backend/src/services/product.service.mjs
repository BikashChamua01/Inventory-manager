
import { prisma } from "../config/database.mjs";

function cleanOptionalString(value) {
     if (value === undefined || value === null) return value;
     const trimmed = value.trim();
     return trimmed || null;
}

function productError(message, statusCode = 400) {
     const error = new Error(message);
     error.statusCode = statusCode;
     return error;
}

function normalizeAttributes(attributes = []) {
     return attributes.map((attribute) => ({
          name: attribute.name.trim(),
          value: attribute.value,
     }));
}

function normalizeVariants(variants = []) {
     return variants.map((variant) => ({
          name: variant.name.trim(),
          sku: cleanOptionalString(variant.sku),
          unit: variant.unit?.trim() || "piece",
          purchasePricePaise: variant.purchasePricePaise,
          sellingPricePaise: variant.sellingPricePaise,
          // Initial stock must be recorded through the inventory module.
          stockQuantity: 0,
          attributes: {
               create: normalizeAttributes(variant.attributes),
          },
     }));
}

const productInclude = {
     category: true,
     attributes: true,
     variants: {
          include: { attributes: true },
     },
};

export async function createProduct(data) {
     if (data.categoryId) {
          const category = await prisma.category.findUnique({
               where: { id: data.categoryId },
          });

          if (!category || !category.isActive) {
               throw productError("Category not found or inactive", 400);
          }
     }

     try {
          return await prisma.product.create({
               data: {
                    name: data.name.trim(),
                    sku: cleanOptionalString(data.sku),
                    description: cleanOptionalString(data.description),
                    categoryId: data.categoryId || null,
                    attributes: {
                         create: normalizeAttributes(data.attributes),
                    },
                    variants: {
                         create: normalizeVariants(data.variants),
                    },
               },
               include: productInclude,
          });
     } catch (error) {
          if (error.code === "P2002") {
               throw productError("Product SKU or variant SKU already exists", 409);
          }
          throw error;
     }
}


export async function listProducts({
     search,
     categoryId,
     includeArchived = false,
}) {
     return prisma.product.findMany({
          where: {
               ...(includeArchived ? {} : { isActive: true }),

               ...(categoryId ? { categoryId } : {}),

               ...(search
                    ? {
                         OR: [
                              { name: { contains: search } },
                              { sku: { contains: search } },
                              {
                                   attributes: {
                                        some: { name: { contains: search } },
                                   },
                              },
                              {
                                   attributes: {
                                        some: { value: { contains: search } },
                                   },
                              },
                         ],
                    }
                    : {}),
          },
          include: productInclude,
          orderBy: { createdAt: "desc" },
     });
}


export async function getProductById(id) {
     const product = await prisma.product.findUnique({
          where: { id },
          include: productInclude,
     });

     if (!product) {
          throw productError("Product not found", 404);
     }

     return product;
}

export async function updateProduct(id, data) {
     const existing = await prisma.product.findUnique({
          where: { id },
     });

     if (!existing) {
          throw productError("Product not found", 404);
     }

     if (data.categoryId) {
          const category = await prisma.category.findUnique({
               where: { id: data.categoryId },
          });

          if (!category || !category.isActive) {
               throw productError("Category not found or inactive", 400);
          }
     }

     // This first implementation updates product details and attributes.
     // Variant management and stock changes will have separate operations.
     const updateData = {};

     for (const field of ["name", "sku", "description", "categoryId", "isActive"]) {
          if (field in data) {
               updateData[field] =
                    field === "name"
                         ? data.name.trim()
                         : field === "sku" || field === "description"
                              ? cleanOptionalString(data[field])
                              : data[field];
          }
     }

     if (data.attributes) {
          updateData.attributes = {
               deleteMany: {},
               create: normalizeAttributes(data.attributes),
          };
     }

     try {
          return await prisma.product.update({
               where: { id },
               data: updateData,
               include: productInclude,
          });
     } catch (error) {
          if (error.code === "P2002") {
               throw productError("Product SKU already exists", 409);
          }
          throw error;
     }
}

export async function archiveProduct(id) {
     const product = await prisma.product.findUnique({
          where: { id },
     });

     if (!product) {
          throw productError("Product not found", 404);
     }

     return prisma.product.update({
          where: { id },
          data: { isActive: false },
          include: productInclude,
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



export async function deleteProduct(id) {
     const product = await prisma.product.findUnique({
          where: { id },
          include: {
               variants: {
                    select: {
                         id: true,
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
               },
          },
     });

     if (!product) {
          throw productError("Product not found", 404);
     }

     const auditLogCount = await prisma.auditLog.count({
          where: {
               entityType: "Product",
               entityId: id,
          },
     });

     // A product with variants is archived rather than permanently deleted.
     if (product.variants.length > 0 || auditLogCount > 0) {
          return {
               archived: true,
               product: await archiveProduct(id),
               message:
                    "Product has variants or audit history. It was archived to protect inventory and history.",
          };
     }

     await prisma.product.delete({
          where: { id },
     });

     return {
          archived: false,
          message: "Product permanently deleted",
     };
}

