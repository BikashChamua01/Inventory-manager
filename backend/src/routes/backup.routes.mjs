
import { Router } from "express";

import {
     createBackupController,
     getBackupStatus,
     validateBackupController,
     restoreBackupController,
     deleteBackupController
} from "../controllers/backup.controller.mjs";

const router = Router();

router.get("/status", getBackupStatus);
router.post("/", createBackupController);
router.post("/validate", validateBackupController);
router.post("/restore", restoreBackupController);
router.delete("/", deleteBackupController);

export default router;
