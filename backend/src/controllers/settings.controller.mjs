
import * as settingsService from "../services/settings.service.mjs";

export async function getSettings(req, res, next) {
  try {
    const settings = await settingsService.getSettings();

    return res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const settings = await settingsService.updateSettings(req.body);

    return res.json({
      success: true,
      data: settings,
      message: "Settings saved successfully.",
    });
  } catch (error) {
    next(error);
  }
}
