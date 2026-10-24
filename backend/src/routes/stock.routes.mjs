
import { Router } from "express";

import {
     adjustStock,
     getStockHistory,
     getAllStockHistory,
} from "../controllers/stock.controller.mjs";

const router = Router();

// View all stock movements.
router.get("/history", getAllStockHistory);

// Add or remove stock.
router.post("/variants/:variantId/adjust", adjustStock);

// View history for one variant.
router.get("/variants/:variantId/history", getStockHistory);

export default router;
