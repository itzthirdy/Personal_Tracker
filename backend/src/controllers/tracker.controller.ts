import type { Request, Response } from "express";
import { DAYS_OF_WEEK, type DayOfWeek, type HabitCategory } from "../config/defaultSchedule";
import {
  addCustomChecklistItem,
  getConsistencyStats,
  getMonthlyCalendar,
  getOrCreateDailyLog,
  getTemplateByDay,
  getWeeklyTemplates,
  removeChecklistItem,
  seedDefaultRoutines,
  setAllChecklistItems,
  toggleChecklistItem,
  updateTemplateForDay,
} from "../services/tracker.service";

function isValidDayOfWeek(day: string): day is DayOfWeek {
  return (DAYS_OF_WEEK as string[]).includes(day.toLowerCase());
}

export async function handleGetWeeklyRoutines(_req: Request, res: Response) {
  try {
    const routines = await getWeeklyTemplates();
    res.json({ routines });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch weekly routines",
    });
  }
}

export async function handleGetRoutineByDay(req: Request, res: Response) {
  try {
    const rawDay = String(req.params.dayOfWeek ?? "").toLowerCase();
    if (!isValidDayOfWeek(rawDay)) {
      res.status(400).json({
        error: `Invalid dayOfWeek "${rawDay}". Must be one of: ${DAYS_OF_WEEK.join(", ")}`,
      });
      return;
    }

    const routine = await getTemplateByDay(rawDay);
    res.json({ routine });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch routine template",
    });
  }
}

export async function handleUpdateRoutineByDay(req: Request, res: Response) {
  try {
    const rawDay = String(req.params.dayOfWeek ?? "").toLowerCase();
    if (!isValidDayOfWeek(rawDay)) {
      res.status(400).json({
        error: `Invalid dayOfWeek "${rawDay}". Must be one of: ${DAYS_OF_WEEK.join(", ")}`,
      });
      return;
    }

    const { items } = req.body as {
      items?: Array<{ title: string; category?: HabitCategory }>;
    };

    if (!Array.isArray(items)) {
      res.status(400).json({ error: "`items` array is required in request body." });
      return;
    }

    const updated = await updateTemplateForDay(
      rawDay,
      items.map((item) => ({
        title: String(item.title ?? ""),
        category: item.category ?? "routine",
      }))
    );

    res.json({ routine: updated });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to update routine template",
    });
  }
}

export async function handleResetRoutines(_req: Request, res: Response) {
  try {
    const routines = await seedDefaultRoutines(true);
    res.json({
      message: "Weekly routine templates reset to default schedule",
      routines,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to reset routines",
    });
  }
}

export async function handleGetDailyLog(req: Request, res: Response) {
  try {
    const date = String(req.params.date ?? "");
    const log = await getOrCreateDailyLog(date);
    res.json({ log });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to get daily checklist log",
    });
  }
}

export async function handleToggleChecklistItem(req: Request, res: Response) {
  try {
    const date = String(req.params.date ?? "");
    const itemId = String(req.params.itemId ?? "");
    const { completed } = req.body as { completed?: boolean };

    const log = await toggleChecklistItem(
      date,
      itemId,
      typeof completed === "boolean" ? completed : undefined
    );
    res.json({ log });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to toggle checklist item",
    });
  }
}

export async function handleCheckAllItems(req: Request, res: Response) {
  try {
    const date = String(req.params.date ?? "");
    const { completed } = req.body as { completed?: boolean };

    if (typeof completed !== "boolean") {
      res.status(400).json({ error: "`completed` boolean is required in request body." });
      return;
    }

    const log = await setAllChecklistItems(date, completed);
    res.json({ log });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to update all checklist items",
    });
  }
}

export async function handleAddCustomItem(req: Request, res: Response) {
  try {
    const date = String(req.params.date ?? "");
    const { title, category } = req.body as {
      title?: string;
      category?: HabitCategory;
    };

    if (!title || !title.trim()) {
      res.status(400).json({ error: "`title` is required to add a checklist item." });
      return;
    }

    const log = await addCustomChecklistItem(date, title, category ?? "custom");
    res.status(201).json({ log });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to add checklist item",
    });
  }
}

export async function handleRemoveChecklistItem(req: Request, res: Response) {
  try {
    const date = String(req.params.date ?? "");
    const itemId = String(req.params.itemId ?? "");
    const log = await removeChecklistItem(date, itemId);
    res.json({ log });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to remove checklist item",
    });
  }
}

export async function handleGetMonthlyCalendar(req: Request, res: Response) {
  try {
    const now = new Date();
    const year = req.query.year ? Number(req.query.year) : now.getUTCFullYear();
    const month = req.query.month ? Number(req.query.month) : now.getUTCMonth() + 1;

    if (Number.isNaN(year) || Number.isNaN(month)) {
      res.status(400).json({ error: "Query parameters `year` and `month` must be numbers." });
      return;
    }

    const calendar = await getMonthlyCalendar(year, month);
    res.json(calendar);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to generate monthly calendar",
    });
  }
}

export async function handleGetStats(_req: Request, res: Response) {
  try {
    const stats = await getConsistencyStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to compute consistency stats",
    });
  }
}

