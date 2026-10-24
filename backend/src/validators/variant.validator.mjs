
export function validateVariant(data, { partial = false } = {}) {
  const errors = [];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return ["Request body must be a JSON object"];
  }

  const allowedFields = new Set([
    "name",
    "sku",
    "unit",
    "purchasePricePaise",
    "sellingPricePaise",
    "attributes",
    "isActive",
  ]);

  for (const field of Object.keys(data)) {
    if (!allowedFields.has(field)) {
      errors.push(`Unknown variant field: ${field}`);
    }
  }

  if (!partial || "name" in data) {
    if (typeof data.name !== "string" || !data.name.trim()) {
      errors.push("Variant name is required");
    }
  }

  for (const field of ["sku", "unit"]) {
    if (field in data && data[field] !== null &&
      typeof data[field] !== "string") {
      errors.push(`${field} must be a string or null`);
    }
  }


  for (const field of ["purchasePricePaise", "sellingPricePaise"]) {
    if (
      (!partial && !(field in data)) ||
      (field in data &&
        (!Number.isSafeInteger(data[field]) || data[field] < 0))
    ) {
      errors.push(
        `${field} is required on creation and must be a non-negative integer in paise`
      );
    }
  }


  if ("isActive" in data && typeof data.isActive !== "boolean") {
    errors.push("isActive must be a boolean");
  }

  if ("attributes" in data) {
    if (!Array.isArray(data.attributes)) {
      errors.push("Attributes must be an array");
    } else {
      for (const [index, attribute] of data.attributes.entries()) {
        if (
          !attribute ||
          typeof attribute.name !== "string" ||
          !attribute.name.trim() ||
          typeof attribute.value !== "string"
        ) {
          errors.push(
            `Attribute ${index + 1} must have a name and string value`
          );
        }
      }
    }
  }

  return errors;
}
