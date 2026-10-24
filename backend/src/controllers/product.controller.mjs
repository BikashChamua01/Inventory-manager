
import * as productService from "../services/product.service.mjs";
import { validateProduct } from "../validators/product.validator.mjs";

function sendError(error, next) {
     next(error);
}

export async function createProduct(req, res, next) {
     try {
          const errors = validateProduct(req.body);

          if (errors.length) {
               return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors,
               });
          }

          const product = await productService.createProduct(req.body);

          res.status(201).json({
               success: true,
               data: product,
          });
     } catch (error) {
          sendError(error, next);
     }
}

export async function listProducts(req, res, next) {
     try {
          const products = await productService.listProducts({
               search: req.query.search,
               categoryId: req.query.categoryId,
               includeArchived: req.query.includeArchived === "true",
          });

          res.json({
               success: true,
               count: products.length,
               data: products,
          });
     } catch (error) {
          next(error);
     }
}

export async function getProduct(req, res, next) {
     try {
          const product = await productService.getProductById(req.params.id);

          res.json({
               success: true,
               data: product,
          });
     } catch (error) {
          next(error);
     }
}

export async function updateProduct(req, res, next) {
     try {
          const errors = validateProduct(req.body, { partial: true });

          if (errors.length) {
               return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors,
               });
          }

          const product = await productService.updateProduct(
               req.params.id,
               req.body
          );

          res.json({
               success: true,
               data: product,
          });
     } catch (error) {
          next(error);
     }
}

export async function archiveProduct(req, res, next) {
     try {
          const product = await productService.archiveProduct(req.params.id);

          res.json({
               success: true,
               message: "Product archived successfully",
               data: product,
          });
     } catch (error) {
          next(error);
     }
}


export async function restoreProduct(req, res, next) {
     try {
          const product = await productService.restoreProduct(req.params.id);

          return res.json({
               success: true,
               message: "Product restored successfully",
               data: product,
          });
     } catch (error) {
          next(error);
     }
}


export async function deleteProduct(req, res, next) {
     try {
          const result = await productService.deleteProduct(req.params.id);

          return res.json({
               success: true,
               ...result,
          });
     } catch (error) {
          next(error);
     }
}



export async function permanentlyDeleteProduct(req, res, next) {
     try {
          const result = await productService.permanentlyDeleteProduct(
               req.params.id
          );

          return res.json({
               success: true,
               ...result,
          });
     } catch (error) {
          next(error);
     }
}

