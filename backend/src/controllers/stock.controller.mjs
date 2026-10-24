
import * as stockService from "../services/stock.service.mjs";

export async function adjustStock(req, res, next) {
     try {
          const { quantityChange, note } = req.body;

          if (!Number.isSafeInteger(quantityChange) || quantityChange === 0) {
               return res.status(400).json({
                    success: false,
                    message: "quantityChange must be a non-zero integer",
               });
          }

          if (note !== undefined && typeof note !== "string") {
               return res.status(400).json({
                    success: false,
                    message: "note must be a string",
               });
          }

          const data = await stockService.adjustStock(
               req.params.variantId,
               quantityChange,
               note
          );

          res.json({ success: true, data });
     } catch (error) {
          next(error);
     }
}

export async function getStockHistory(req, res, next) {
     try {
          const data = await stockService.getStockHistory(req.params.variantId);
          res.json({ success: true, count: data.length, data });
     } catch (error) {
          next(error);
     }
}


export async function getAllStockHistory(req, res, next) {
     try {
          const { search, movementType, from, to } = req.query;

          for (const [key, value] of Object.entries({
               search,
               movementType,
               from,
               to,
          })) {
               if (value !== undefined && typeof value !== "string") {
                    return res.status(400).json({
                         success: false,
                         message: `${key} must be a string`,
                    });
               }
          }

          const data = await stockService.getAllStockHistory({
               search,
               movementType,
               from,
               to,
          });

          res.json({
               success: true,
               count: data.length,
               data,
          });
     } catch (error) {
          next(error);
     }
}
