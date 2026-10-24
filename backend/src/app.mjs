
import express from "express";
import cors from "cors";

import productRoutes from "./routes/product.routes.mjs";
import variantRoutes from "./routes/variant.routes.mjs";
import categoryRoutes from "./routes/category.routes.mjs";
import stockRoutes from "./routes/stock.routes.mjs";
import purchaseRoutes from "./routes/purchase.routes.mjs";
import saleRoutes from "./routes/sale.routes.mjs";
import returnRoutes from "./routes/return.routes.mjs";
import reportRoutes from "./routes/report.routes.mjs";
import settingsRoutes from "./routes/settings.routes.mjs";
import backupRoutes from "./routes/backup.routes.mjs";

import {
     notFoundHandler,
     errorHandler,
} from "./middleware/errorHandler.mjs";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
     res.status(200).json({
          success: true,
          message: "Inventory Manager API is running",
     });
});

app.use("/api/products", productRoutes);
app.use("/api", variantRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/returns", returnRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/backup", backupRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
