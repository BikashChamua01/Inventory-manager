
import * as saleService from "../services/sale.service.mjs";

export async function createSale(req, res, next) {
     try {
          const data = await saleService.createSale(req.body);

          res.status(201).json({
               success: true,
               data,
          });
     } catch (error) {
          next(error);
     }
}

export async function listSales(req, res, next) {
     try {
          const data = await saleService.listSales();

          res.json({
               success: true,
               count: data.length,
               data,
          });
     } catch (error) {
          next(error);
     }
}
