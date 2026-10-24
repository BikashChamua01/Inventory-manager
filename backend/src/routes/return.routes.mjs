
import { Router } from "express";

import {
     createSaleReturnController,
     createPurchaseReturnController,
     listSaleReturnsController,
     listPurchaseReturnsController,
} from "../controllers/return.controller.mjs";

const router = Router();

router.get("/sales", listSaleReturnsController);
router.post("/sales", createSaleReturnController);

router.get("/purchases", listPurchaseReturnsController);
router.post("/purchases", createPurchaseReturnController);

export default router;
