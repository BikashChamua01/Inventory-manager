
import { Router } from "express";
import {
     createSale,
     listSales,
} from "../controllers/sale.controller.mjs";

const router = Router();

router.post("/", createSale);
router.get("/", listSales);

export default router;
