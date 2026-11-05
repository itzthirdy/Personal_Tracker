import type { Request, Response } from "express";
import {
  addCustomChecklistItem,
  bulkDeleteRoutines,
  createCategory,
  createRoutine,
  deleteCategory,
  getConsistencyStats,
  getMonthlyCalendar,
  getOrCreateDailyLog,
  listCategories,
  listRoutines,
  removeChecklistItem,
  setAllChecklistItems,
  toggleChecklistItem,
  updateRoutine,
} from "../services/tracker.service";
import { getWeeklyInsights } from "../services/insights.service";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function statusFor(error: unknown): number {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("not found")) return 404;
  if (message.includes("already exists")) return 409;
  return 400;
}

function requireUserId(req: Request, res: Response): string | null {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return userId;
}

// ---------------- Categories ----------------

export async function handleListCategories(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    res.json({ categories: await listCategories(userId) });
  } catch (error) {
    res.status(500).json({ error: errorMessage(error, "Failed to list categories") });
  }
}

export async function handleCreateCategory(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const { name, color, icon } = (req.body ?? {}) as {
      name?: unknown;
      color?: unknown;
      icon?: unknown;
    };
    const category = await createCategory(userId, { name, color, icon });
    res.status(201).json({ category });
  } catch (error) {
    res
      .status(statusFor(error))
      .json({ error: errorMessage(error, "Failed to create category") });
  }
}

export async function handleDeleteCategory(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    res.json(await deleteCategory(userId, String(req.params.id ?? "")));
  } catch (error) {
    res
      .status(statusFor(error))
      .json({ error: errorMessage(error, "Failed to delete category") });
  }
}

// ---------------- Routines ----------------

export async function handleListRoutines(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    res.json({ routines: await listRoutines(userId) });
  } catch (error) {
    res.status(500).json({ error: errorMessage(error, "Failed to list routines") });
  }
}

export async function handleCreateRoutine(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const routine = await createRoutine(userId, (req.body ?? {}) as Record<string, unknown>);
    res.status(201).json({ routine });
  } catch (error) {
    res
      .status(statusFor(error))
      .json({ error: errorMessage(error, "Failed to create routine") });
  }
}

export async function handleUpdateRoutine(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const routine = await updateRoutine(
      userId,
      String(req.params.id ?? ""),
      (req.body ?? {}) as Record<string, unknown>
    );
    res.json({ routine });
  } catch (error) {
    res
      .status(statusFor(error))
      .json({ error: errorMessage(error, "Failed to update routine") });
  }
}

export async function handleBulkDeleteRoutines(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const result = await bulkDeleteRoutines(userId, (req.body ?? {}) as Record<string, unknown>);
    res.json(result);
  } catch (error) {
    res
      .status(statusFor(error))
      .json({ error: errorMessage(error, "Failed to delete routines") });
  }
}

// ---------------- Daily logs ----------------

export async function handleGetDailyLog(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    res.json({ log: await getOrCreateDailyLog(userId, String(req.params.date ?? "")) });
  } catch (error) {
    res
      .status(400)
      .json({ error: errorMessage(error, "Failed to get daily checklist log") });
  }
}

export async function handleToggleChecklistItem(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const { completed } = (req.body ?? {}) as { completed?: boolean };
    const log = await toggleChecklistItem(
      userId,
      String(req.params.date ?? ""),
      String(req.params.itemId ?? ""),
      typeof completed === "boolean" ? completed : undefined
    );
    res.json({ log });
  } catch (error) {
    res
      .status(400)
      .json({ error: errorMessage(error, "Failed to toggle checklist item") });
  }
}

export async function handleCheckAllItems(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const { completed } = (req.body ?? {}) as { completed?: boolean };
    if (typeof completed !== "boolean") {
      res.status(400).json({ error: "`completed` boolean is required in request body." });
      return;
    }
    res.json({
      log: await setAllChecklistItems(userId, String(req.params.date ?? ""), completed),
    });
  } catch (error) {
    res
      .status(400)
      .json({ error: errorMessage(error, "Failed to update all checklist items") });
  }
}

/** Quick add: creates a one-off routine for the given date. */
export async function handleAddCustomItem(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const { title, category } = (req.body ?? {}) as {
      title?: string;
      category?: unknown;
    };
    if (!title || !title.trim()) {
      res.status(400).json({ error: "`title` is required to add a checklist item." });
      return;
    }
    const log = await addCustomChecklistItem(
      userId,
      String(req.params.date ?? ""),
      title,
      category
    );
    res.status(201).json({ log });
  } catch (error) {
    res
      .status(400)
      .json({ error: errorMessage(error, "Failed to add checklist item") });
  }
}

export async function handleRemoveChecklistItem(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const log = await removeChecklistItem(
      userId,
      String(req.params.date ?? ""),
      String(req.params.itemId ?? "")
    );
    res.json({ log });
  } catch (error) {
    res
      .status(400)
      .json({ error: errorMessage(error, "Failed to remove checklist item") });
  }
}

// ---------------- Calendar, stats, insights ----------------

export async function handleGetMonthlyCalendar(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const now = new Date();
    const year = req.query.year ? Number(req.query.year) : now.getUTCFullYear();
    const month = req.query.month ? Number(req.query.month) : now.getUTCMonth() + 1;

    if (Number.isNaN(year) || Number.isNaN(month)) {
      res.status(400).json({ error: "Query parameters `year` and `month` must be numbers." });
      return;
    }
    res.json(await getMonthlyCalendar(userId, year, month));
  } catch (error) {
    res
      .status(400)
      .json({ error: errorMessage(error, "Failed to generate monthly calendar") });
  }
}

export async function handleGetStats(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    res.json(await getConsistencyStats(userId));
  } catch (error) {
    res
      .status(500)
      .json({ error: errorMessage(error, "Failed to compute consistency stats") });
  }
}

export async function handleGetWeeklyInsights(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const startDate =
      typeof req.query.startDate === "string" ? req.query.startDate : undefined;
    const forceRefresh =
      req.query.forceRefresh === "true" || req.query.forceRefresh === "1";
    res.json(await getWeeklyInsights(userId, startDate, forceRefresh));
  } catch (error) {
    res
      .status(400)
      .json({ error: errorMessage(error, "Failed to generate weekly insights") });
  }
}
