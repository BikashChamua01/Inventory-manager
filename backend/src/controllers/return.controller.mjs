
import {
     createSaleReturn,
     createPurchaseReturn,
     listSaleReturns,
     listPurchaseReturns,
} from "../services/return.service.mjs";

function handleError(res, error) {
     console.error("Return controller error:", error);

     const status = error.status || 500;

     return res.status(status).json({
          success: false,
          message: error.message || "Internal server error",
     });
}

export async function createSaleReturnController(req, res) {
     try {
          const result = await createSaleReturn(req.body);
          return res.status(201).json({
               success: true,
               data: result,
          });
     } catch (error) {
          return handleError(res, error);
     }
}

export async function createPurchaseReturnController(req, res) {
     try {
          const result = await createPurchaseReturn(req.body);
          return res.status(201).json({
               success: true,
               data: result,
          });
     } catch (error) {
          return handleError(res, error);
     }
}

export async function listSaleReturnsController(req, res) {
     try {
          const result = await listSaleReturns();
          return res.json({
               success: true,
               data: result,
          });
     } catch (error) {
          return handleError(res, error);
     }
}

export async function listPurchaseReturnsController(req, res) {
     try {
          const result = await listPurchaseReturns();
          return res.json({
               success: true,
               data: result,
          });
     } catch (error) {
          return handleError(res, error);
     }
}
