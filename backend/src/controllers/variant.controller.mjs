
import * as variantService from "../services/variant.service.mjs";
import { validateVariant } from "../validators/variant.validator.mjs";

export async function createVariant(req, res, next) {
  try {
    const errors = validateVariant(req.body);

    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    const variant = await variantService.createVariant(
      req.params.productId,
      req.body
    );

    return res.status(201).json({
      success: true,
      data: variant,
    });
  } catch (error) {
    next(error);
  }
}

export async function listVariants(req, res, next) {
  try {
    const variants = await variantService.listVariants(
      req.params.productId,
      { includeInactive: req.query.includeInactive === "true" }
    );

    return res.json({
      success: true,
      count: variants.length,
      data: variants,
    });
  } catch (error) {
    next(error);
  }
}

export async function getVariant(req, res, next) {
  try {
    const variant = await variantService.getVariantById(req.params.id);

    return res.json({
      success: true,
      data: variant,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateVariant(req, res, next) {
  try {
    const errors = validateVariant(req.body, { partial: true });

    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    const variant = await variantService.updateVariant(
      req.params.id,
      req.body
    );

    return res.json({
      success: true,
      data: variant,
    });
  } catch (error) {
    next(error);
  }
}

export async function setVariantActiveStatus(req, res, next) {
  try {
    if (typeof req.body?.isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean",
      });
    }

    const variant = await variantService.setVariantActiveStatus(
      req.params.id,
      req.body.isActive
    );

    return res.json({
      success: true,
      data: variant,
    });
  } catch (error) {
    next(error);
  }
}



export async function deleteVariant(req, res, next) {
  try {
    const result = await variantService.deleteVariant(req.params.id);

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}
