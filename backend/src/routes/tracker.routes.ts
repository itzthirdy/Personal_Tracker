import { Router } from "express";
import {
  handleAddCustomItem,
  handleBulkDeleteRoutines,
  handleCheckAllItems,
  handleCreateCategory,
  handleCreateRoutine,
  handleDeleteCategory,
  handleGetDailyLog,
  handleGetMonthlyCalendar,
  handleGetStats,
  handleGetWeeklyInsights,
  handleListCategories,
  handleListRoutines,
  handleRemoveChecklistItem,
  handleToggleChecklistItem,
  handleUpdateRoutine,
} from "../controllers/tracker.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

// Protect all tracker routes with JWT Authentication
router.use(requireAuth);

// Custom categories / genres
router.get("/categories", handleListCategories);
router.post("/categories", handleCreateCategory);
router.delete("/categories/:id", handleDeleteCategory);

// Master recurring routines (daysOfWeek / specificDate)
router.get("/routines", handleListRoutines);
router.post("/routines", handleCreateRoutine);
router.post("/routines/bulk-delete", handleBulkDeleteRoutines);
router.put("/routines/:id", handleUpdateRoutine);

// Daily checklist log endpoints (YYYY-MM-DD)
router.get("/logs/:date", handleGetDailyLog);
router.patch("/logs/:date/items/:itemId", handleToggleChecklistItem);
router.patch("/logs/:date/check-all", handleCheckAllItems);
router.post("/logs/:date/items", handleAddCustomItem);
router.delete("/logs/:date/items/:itemId", handleRemoveChecklistItem);

// Calendar heatmap, consistency statistics & weekly AI insights
router.get("/calendar", handleGetMonthlyCalendar);
router.get("/stats", handleGetStats);
router.get("/insights/weekly", handleGetWeeklyInsights);

export default router;
