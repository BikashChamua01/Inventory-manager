
import { Router } from "express";
import { stockReport, salesReport, profitReport, purchasesReport } from "../controllers/report.controller.mjs";

const router = Router();

router.get("/stock", stockReport);
router.get("/sales", salesReport);
router.get("/purchases", purchasesReport);
router.get("/profit", profitReport);

export default router;
