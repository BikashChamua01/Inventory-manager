
import {
     createPurchase as createPurchaseService,
     listPurchases as listPurchasesService,
     cancelPurchase as cancelPurchaseService,
} from "../services/purchase.service.mjs";

export async function createPurchase(req, res, next) {
     try {
          const purchase = await createPurchaseService(req.body);

          res.status(201).json({
               success: true,
               data: purchase,
          });
     } catch (error) {
          next(error);
     }
}

export async function listPurchases(req, res, next) {
     try {
          const purchases = await listPurchasesService();

          res.json({
               success: true,
               data: purchases,
          });
     } catch (error) {
          next(error);
     }
}

export async function cancelPurchase(req, res, next) {
     try {
          const purchase = await cancelPurchaseService(
               req.params.id,
               req.body?.reason ?? ""
          );

          res.json({
               success: true,
               message: "Purchase cancelled successfully",
               data: purchase,
          });
     } catch (error) {
          next(error);
     }
}
