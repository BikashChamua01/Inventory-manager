
export function validateProduct(data, { partial = false } = {}) {
     const errors = [];

     if (!data || typeof data !== "object" || Array.isArray(data)) {
          return ["Request body must be a JSON object"];
     }

     // Product fields allowed during creation and updates.
     const allowedFields = new Set([
          "name",
          "sku",
          "description",
          "categoryId",
          "attributes",
          "isActive",
     ]);

     // Variants are allowed only during product creation.
     if (!partial) {
          allowedFields.add("variants");
     }

     for (const field of Object.keys(data)) {
          if (!allowedFields.has(field)) {
               errors.push(`Unknown product field: ${field}`);
          }
     }

     // Product name
     if (!partial || "name" in data) {
          if (typeof data.name !== "string" || !data.name.trim()) {
               errors.push("Product name is required");
          }
     }

     // Optional product fields
     if (
          "sku" in data &&
          data.sku !== null &&
          typeof data.sku !== "string"
     ) {
          errors.push("SKU must be a string or null");
     }

     if (
          "description" in data &&
          data.description !== null &&
          typeof data.description !== "string"
     ) {
          errors.push("Description must be a string or null");
     }

     if (
          "categoryId" in data &&
          data.categoryId !== null &&
          typeof data.categoryId !== "string"
     ) {
          errors.push("categoryId must be a string or null");
     }

     if ("isActive" in data && typeof data.isActive !== "boolean") {
          errors.push("isActive must be a boolean");
     }

     // Reusable dynamic attribute validation.
     function validateAttributes(attributes, label) {
          if (!Array.isArray(attributes)) {
               errors.push(`${label} must be an array`);
               return;
          }

          for (const [index, attribute] of attributes.entries()) {
               if (
                    !attribute ||
                    typeof attribute !== "object" ||
                    Array.isArray(attribute) ||
                    typeof attribute.name !== "string" ||
                    !attribute.name.trim() ||
                    typeof attribute.value !== "string"
               ) {
                    errors.push(
                         `${label} item ${index + 1} must have a name and string value`
                    );
                    continue;
               }

               for (const field of Object.keys(attribute)) {
                    if (field !== "name" && field !== "value") {
                         errors.push(
                              `${label} item ${index + 1}: unknown field ${field}`
                         );
                    }
               }
          }
     }

     // Product attributes
     if ("attributes" in data) {
          validateAttributes(data.attributes, "Attributes");
     }

     // Variants: accepted only during product creation.
     if ("variants" in data) {
          if (partial) {
               // Normally caught by allowedFields; this is an explicit safeguard.
               errors.push("Variants cannot be updated through the product endpoint");
          } else if (!Array.isArray(data.variants)) {
               errors.push("Variants must be an array");
          } else {
               for (const [index, variant] of data.variants.entries()) {
                    const label = `Variant ${index + 1}`;

                    if (
                         !variant ||
                         typeof variant !== "object" ||
                         Array.isArray(variant)
                    ) {
                         errors.push(`${label} must be an object`);
                         continue;
                    }

                    const allowedVariantFields = new Set([
                         "name",
                         "sku",
                         "unit",
                         "purchasePricePaise",
                         "sellingPricePaise",
                         "attributes",
                    ]);

                    for (const field of Object.keys(variant)) {
                         if (!allowedVariantFields.has(field)) {
                              errors.push(`${label}: unknown field ${field}`);
                         }
                    }

                    if (typeof variant.name !== "string" || !variant.name.trim()) {
                         errors.push(`${label} needs a name`);
                    }

                    if (!partial) {
                         for (const field of ["purchasePricePaise", "sellingPricePaise"]) {
                              if (
                                   !(field in variant) ||
                                   !Number.isSafeInteger(variant[field]) ||
                                   variant[field] < 0
                              ) {
                                   errors.push(
                                        `${label}: ${field} is required and must be a non-negative integer in paise`
                                   );
                              }
                         }
                    }


                    for (const field of ["sku", "unit"]) {
                         if (
                              field in variant &&
                              variant[field] !== null &&
                              typeof variant[field] !== "string"
                         ) {
                              errors.push(`${label}: ${field} must be a string or null`);
                         }
                    }

                    for (const field of [
                         "purchasePricePaise",
                         "sellingPricePaise",
                    ]) {
                         if (
                              field in variant &&
                              (!Number.isSafeInteger(variant[field]) ||
                                   variant[field] < 0)
                         ) {
                              errors.push(
                                   `${label}: ${field} must be a non-negative integer in paise`
                              );
                         }
                    }

                    if ("attributes" in variant) {
                         validateAttributes(variant.attributes, `${label} attributes`);
                    }
               }
          }
     }

     return errors;
}
