
import { Router } from "express";

import {
     createPurchase,
     listPurchases,
     cancelPurchase,
} from "../controllers/purchase.controller.mjs";

const router = Router();

router.post("/", createPurchase);
router.get("/", listPurchases);
router.post("/:id/cancel", cancelPurchase);

export default router;
