
import { prisma } from "../config/database.mjs";

export const SETTING_DEFAULTS = {
  "shop.name": "",
  "shop.owner": "",
  "shop.phone": "",
  "shop.email": "",
  "shop.address": "",
  "shop.invoiceHeading": "INVOICE",
  "shop.invoiceFooter": "Thank you for your business!",

  "inventory.defaultUnit": "piece",
  "inventory.defaultLowStockThreshold": "5",
  "inventory.lowStockWarnings": "true",

  "preferences.confirmBeforeDelete": "true",
  "preferences.confirmBeforeStockAdjustment": "true",

  "backup.reminderEnabled": "true",
  "backup.reminderIntervalDays": "7",
};

const MAX_VALUE_LENGTH = 2000;

function settingsError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function getSettings() {
  const records = await prisma.appSetting.findMany();

  const settings = { ...SETTING_DEFAULTS };

  for (const record of records) {
    if (Object.hasOwn(SETTING_DEFAULTS, record.key)) {
      settings[record.key] = record.value;
    }
  }

  return settings;
}

export async function updateSettings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw settingsError("Settings must be an object.");
  }

  const entries = Object.entries(input);

  if (entries.length === 0) {
    throw settingsError("No settings were provided.");
  }

  // Reject unknown settings instead of silently saving arbitrary keys.
  for (const [key, value] of entries) {
    if (!Object.hasOwn(SETTING_DEFAULTS, key)) {
      throw settingsError(`Unsupported setting: ${key}`);
    }

    if (typeof value !== "string") {
      throw settingsError(`${key} must be a string.`);
    }

    if (value.length > MAX_VALUE_LENGTH) {
      throw settingsError(`${key} is too long.`);
    }
  }

  const booleanKeys = [
    "inventory.lowStockWarnings",
    "preferences.confirmBeforeDelete",
    "preferences.confirmBeforeStockAdjustment",
    "backup.reminderEnabled",
  ];

  for (const key of booleanKeys) {
    if (
      Object.hasOwn(input, key) &&
      input[key] !== "true" &&
      input[key] !== "false"
    ) {
      throw settingsError(`${key} must be true or false.`);
    }
  }

  if (Object.hasOwn(input, "inventory.defaultLowStockThreshold")) {
    const value = input["inventory.defaultLowStockThreshold"];

    if (!/^\d+$/.test(value) || Number(value) > 1000000) {
      throw settingsError(
        "The default low-stock threshold must be a whole number between 0 and 1000000."
      );
    }
  }

  if (Object.hasOwn(input, "backup.reminderIntervalDays")) {
    const value = input["backup.reminderIntervalDays"];

    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 365) {
      throw settingsError(
        "The backup reminder interval must be between 1 and 365 days."
      );
    }
  }

  const allowedUnits = [
    "piece",
    "packet",
    "box",
    "dozen",
    "kg",
    "gram",
    "litre",
    "ml",
    "metre",
  ];

  if (
    Object.hasOwn(input, "inventory.defaultUnit") &&
    !allowedUnits.includes(input["inventory.defaultUnit"])
  ) {
    throw settingsError("Please select a supported default unit.");
  }

  // Each upsert persists one setting without deleting other settings.
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    )
  );

  return getSettings();
}
