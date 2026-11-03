import { Router } from "express";
import {
  handleAddCustomItem,
  handleCheckAllItems,
  handleGetDailyLog,
  handleGetMonthlyCalendar,
  handleGetRoutineByDay,
  handleGetStats,
  handleGetWeeklyRoutines,
  handleRemoveChecklistItem,
  handleResetRoutines,
  handleToggleChecklistItem,
  handleUpdateRoutineByDay,
} from "../controllers/tracker.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

// Protect all tracker routes with JWT Authentication
router.use(requireAuth);

// Weekly routine template endpoints (Monday - Sunday)
router.get("/routines", handleGetWeeklyRoutines);
router.post("/routines/reset", handleResetRoutines);
router.get("/routines/:dayOfWeek", handleGetRoutineByDay);
router.put("/routines/:dayOfWeek", handleUpdateRoutineByDay);

// Daily checklist log endpoints (YYYY-MM-DD)
router.get("/logs/:date", handleGetDailyLog);
router.patch("/logs/:date/items/:itemId", handleToggleChecklistItem);
router.patch("/logs/:date/check-all", handleCheckAllItems);
router.post("/logs/:date/items", handleAddCustomItem);
router.delete("/logs/:date/items/:itemId", handleRemoveChecklistItem);

// Calendar heatmap & consistency statistics endpoints
router.get("/calendar", handleGetMonthlyCalendar);
router.get("/stats", handleGetStats);

export default router;
