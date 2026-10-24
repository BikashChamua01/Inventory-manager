
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("inventoryApp", {
  getAppInfo: () => ({
    name: "Inventory Manager",
    version: "1.0.0",
  }),
});
