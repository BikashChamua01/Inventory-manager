
import * as categoryService from "../services/category.service.mjs";

export async function createCategory(req, res, next) {
  try {
    const { name } = req.body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const category = await categoryService.createCategory({ name });

    return res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
}

export async function listCategories(req, res, next) {
  try {
    const includeInactive = req.query.includeInactive === "true";

    const categories = await categoryService.listCategories({
      includeInactive,
    });

    return res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const category = await categoryService.updateCategory(
      req.params.id,
      req.body ?? {}
    );

    return res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
}
