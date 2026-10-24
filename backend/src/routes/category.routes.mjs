
import { Router } from "express";
import {
  createCategory,
  listCategories,
  updateCategory,
} from "../controllers/category.controller.mjs";

const router = Router();

router.post("/", createCategory);
router.get("/", listCategories);
router.patch("/:id", updateCategory);

export default router;
