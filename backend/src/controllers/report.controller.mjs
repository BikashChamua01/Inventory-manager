
import { getStockReport } from "../services/report.service.mjs";
import { getSalesReport, getPurchasesReport, getProfitReport } from "../services/report.service.mjs";

export async function stockReport(req, res, next) {
     try {
          const report = await getStockReport();

          res.status(200).json({
               success: true,
               data: report,
          });
     } catch (error) {
          next(error);
     }
}

export async function salesReport(req, res, next) {
  try {
    const report = await getSalesReport({
      from: req.query.from,
      to: req.query.to,
    });

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}


export async function purchasesReport(req, res, next) {
  try {
    const report = await getPurchasesReport({
      from: req.query.from,
      to: req.query.to,
    });

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}


export async function profitReport(req, res, next) {
  try {
    const report = await getProfitReport({
      from: req.query.from,
      to: req.query.to,
    });

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}