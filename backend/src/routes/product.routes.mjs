
import { Router } from "express";
import {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  archiveProduct,
  restoreProduct, deleteProduct, permanentlyDeleteProduct
} from "../controllers/product.controller.mjs";

const router = Router();

router.post("/", createProduct);
router.get("/", listProducts);
router.get("/:id", getProduct);
router.patch("/:id", updateProduct);
router.patch("/:id/archive", archiveProduct);
router.patch("/:id/restore", restoreProduct);
router.delete("/:id", deleteProduct);
router.delete("/:id/permanent", permanentlyDeleteProduct);


export default router;
