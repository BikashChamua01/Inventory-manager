
import { Router } from "express";
import {
  createVariant,
  listVariants,
  getVariant,
  updateVariant,
  setVariantActiveStatus,
  deleteVariant
} from "../controllers/variant.controller.mjs";

const router = Router();

router.post("/products/:productId/variants", createVariant);
router.get("/products/:productId/variants", listVariants);

router.get("/variants/:id", getVariant);
router.patch("/variants/:id", updateVariant);
router.patch("/variants/:id/status", setVariantActiveStatus);
router.delete("/variants/:id", deleteVariant);

export default router;
