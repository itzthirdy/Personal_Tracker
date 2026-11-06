import type { Request, Response } from "express";
import mongoose from "mongoose";
import { isDatabaseConnected } from "../config/database";
import { CategoryModel } from "../models/Category";
import { CalendarEvent, type ICalendarEvent } from "../models/CalendarEvent";

// In-memory fallback store for calendar events when MongoDB is not connected
export interface MemoryCalendarEvent {
  _id: string;
  userId: string;
  title: string;
  startDate: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  categoryId?: string | null;
  notes?: string;
  recurrence: "none" | "daily" | "weekly" | "weekdays";
  daysOfWeek?: number[];
  createdAt: Date;
  updatedAt: Date;
}

const memoryEventsByUser = new Map<string, MemoryCalendarEvent[]>();

function memCalendarEvents(userId: string): MemoryCalendarEvent[] {
  let list = memoryEventsByUser.get(userId);
  if (!list) {
    list = [];
    memoryEventsByUser.set(userId, list);
  }
  return list;
}

export function resetMemoryCalendarEvents(): void {
  memoryEventsByUser.clear();
}

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(dateStr: string, days: number): string {
  const dt = parseDate(dateStr);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatDate(dt);
}

function isValidTime(timeStr: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return false;
  const parts = timeStr.split(":").map(Number);
  const h = parts[0];
  const m = parts[1];
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) {
    return false;
  }
  return h >= 0 && h < 24 && m >= 0 && m < 60;
}

function isEndAfterStart(startTime: string, endTime: string): boolean {
  const sParts = startTime.split(":").map(Number);
  const eParts = endTime.split(":").map(Number);
  const sh = sParts[0] ?? 0;
  const sm = sParts[1] ?? 0;
  const eh = eParts[0] ?? 0;
  const em = eParts[1] ?? 0;
  return eh * 60 + em > sh * 60 + sm;
}

export interface ExpandedCalendarEventInstance {
  id: string;
  eventId: string;
  title: string;
  startDate: string; // The instance's active date (YYYY-MM-DD)
  endDate?: string;
  startTime: string;
  endTime: string;
  categoryId: string | null;
  category?: {
    id: string;
    name: string;
    color: string;
    icon: string;
  } | null;
  notes: string;
  recurrence: "none" | "daily" | "weekly" | "weekdays";
  daysOfWeek: number[];
  isRecurringInstance: boolean;
}

/**
 * GET /api/calendar/events?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Retrieves events and virtually expands recurring rules across the queried range.
 */
export async function getEvents(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const todayStr = formatDate(new Date());
    const startStr =
      typeof req.query.start === "string" && req.query.start.trim()
        ? req.query.start.trim()
        : addDays(todayStr, -35);
    const endStr =
      typeof req.query.end === "string" && req.query.end.trim()
        ? req.query.end.trim()
        : addDays(todayStr, 65);

    // Build list of all dates in the requested range
    const dateList: string[] = [];
    let cur = startStr;
    while (cur <= endStr) {
      dateList.push(cur);
      cur = addDays(cur, 1);
      if (dateList.length > 366) break; // safety guard
    }

    let rawEvents: Array<{
      _id: any;
      userId: any;
      title: string;
      startDate: string;
      endDate?: string;
      startTime: string;
      endTime: string;
      categoryId?: any;
      notes?: string;
      recurrence: "none" | "daily" | "weekly" | "weekdays";
      daysOfWeek?: number[];
    }> = [];

    if (isDatabaseConnected()) {
      rawEvents = await CalendarEvent.find({
        userId,
        $or: [
          { recurrence: { $ne: "none" }, startDate: { $lte: endStr } },
          {
            recurrence: "none",
            startDate: { $lte: endStr },
            $or: [
              { endDate: { $gte: startStr } },
              { endDate: { $exists: false } },
              { endDate: null },
            ],
          },
        ],
      })
        .populate("categoryId", "name color icon")
        .lean();
    } else {
      const allMem = memCalendarEvents(userId);
      rawEvents = allMem.filter((ev) => {
        if (ev.recurrence !== "none") {
          return ev.startDate <= endStr;
        }
        const effectiveEnd = ev.endDate || ev.startDate;
        return ev.startDate <= endStr && effectiveEnd >= startStr;
      });
    }

    const instances: ExpandedCalendarEventInstance[] = [];

    for (const ev of rawEvents) {
      const eventId = String(ev._id);
      let catObj: ExpandedCalendarEventInstance["category"] = null;
      let catIdStr: string | null = null;

      if (ev.categoryId) {
        if (typeof ev.categoryId === "object" && "_id" in ev.categoryId) {
          catIdStr = String(ev.categoryId._id);
          catObj = {
            id: catIdStr,
            name: ev.categoryId.name,
            color: ev.categoryId.color,
            icon: ev.categoryId.icon,
          };
        } else {
          catIdStr = String(ev.categoryId);
          catObj = {
            id: catIdStr,
            name: "Category",
            color: "#801E0F",
            icon: "sparkles",
          };
        }
      }

      const recurrence = ev.recurrence || "none";
      const notes = ev.notes ?? "";
      const daysOfWeek = ev.daysOfWeek ?? [];

      if (recurrence === "none") {
        const evStart = ev.startDate;
        const evEnd = ev.endDate && ev.endDate >= evStart ? ev.endDate : evStart;

        // If single day:
        if (evStart === evEnd) {
          if (evStart >= startStr && evStart <= endStr) {
            instances.push({
              id: eventId,
              eventId,
              title: ev.title,
              startDate: evStart,
              endDate: evEnd,
              startTime: ev.startTime,
              endTime: ev.endTime,
              categoryId: catIdStr,
              category: catObj,
              notes,
              recurrence,
              daysOfWeek,
              isRecurringInstance: false,
            });
          }
        } else {
          // Multi-day span:
          let d = evStart;
          while (d <= evEnd) {
            if (d >= startStr && d <= endStr) {
              instances.push({
                id: `${eventId}_${d}`,
                eventId,
                title: ev.title,
                startDate: d,
                endDate: evEnd,
                startTime: ev.startTime,
                endTime: ev.endTime,
                categoryId: catIdStr,
                category: catObj,
                notes,
                recurrence,
                daysOfWeek,
                isRecurringInstance: d !== evStart,
              });
            }
            d = addDays(d, 1);
            if (d > endStr) break;
          }
        }
      } else if (recurrence === "daily") {
        for (const d of dateList) {
          if (d >= ev.startDate && (!ev.endDate || d <= ev.endDate)) {
            instances.push({
              id: `${eventId}_${d}`,
              eventId,
              title: ev.title,
              startDate: d,
              endDate: d,
              startTime: ev.startTime,
              endTime: ev.endTime,
              categoryId: catIdStr,
              category: catObj,
              notes,
              recurrence,
              daysOfWeek,
              isRecurringInstance: true,
            });
          }
        }
      } else if (recurrence === "weekdays") {
        for (const d of dateList) {
          const dow = parseDate(d).getUTCDay(); // 0=Sun .. 6=Sat
          if (
            dow >= 1 &&
            dow <= 5 &&
            d >= ev.startDate &&
            (!ev.endDate || d <= ev.endDate)
          ) {
            instances.push({
              id: `${eventId}_${d}`,
              eventId,
              title: ev.title,
              startDate: d,
              endDate: d,
              startTime: ev.startTime,
              endTime: ev.endTime,
              categoryId: catIdStr,
              category: catObj,
              notes,
              recurrence,
              daysOfWeek,
              isRecurringInstance: true,
            });
          }
        }
      } else if (recurrence === "weekly") {
        const allowedDows =
          daysOfWeek.length > 0
            ? daysOfWeek
            : [parseDate(ev.startDate).getUTCDay()];

        for (const d of dateList) {
          const dow = parseDate(d).getUTCDay();
          if (
            allowedDows.includes(dow) &&
            d >= ev.startDate &&
            (!ev.endDate || d <= ev.endDate)
          ) {
            instances.push({
              id: `${eventId}_${d}`,
              eventId,
              title: ev.title,
              startDate: d,
              endDate: d,
              startTime: ev.startTime,
              endTime: ev.endTime,
              categoryId: catIdStr,
              category: catObj,
              notes,
              recurrence,
              daysOfWeek: allowedDows,
              isRecurringInstance: true,
            });
          }
        }
      }
    }

    // Sort instances chronologically by date, then startTime ascending
    instances.sort((a, b) => {
      if (a.startDate !== b.startDate) {
        return a.startDate.localeCompare(b.startDate);
      }
      return a.startTime.localeCompare(b.startTime);
    });

    res.json({ events: instances });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch calendar events";
    res.status(500).json({ error: message });
  }
}

/**
 * POST /api/calendar/events
 * Creates a new calendar schedule event.
 */
export async function createEvent(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const {
      title,
      startDate,
      endDate,
      startTime,
      endTime,
      categoryId,
      notes,
      recurrence = "none",
      daysOfWeek,
    } = req.body as {
      title?: string;
      startDate?: string;
      endDate?: string;
      startTime?: string;
      endTime?: string;
      categoryId?: string | null;
      notes?: string;
      recurrence?: "none" | "daily" | "weekly" | "weekdays";
      daysOfWeek?: number[];
    };

    if (!title?.trim()) {
      res.status(400).json({ error: "Event title is required." });
      return;
    }

    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      res.status(400).json({ error: "Valid startDate (YYYY-MM-DD) is required." });
      return;
    }

    if (!startTime || !isValidTime(startTime)) {
      res.status(400).json({ error: "Valid startTime (HH:mm) is required." });
      return;
    }

    if (!endTime || !isValidTime(endTime)) {
      res.status(400).json({ error: "Valid endTime (HH:mm) is required." });
      return;
    }

    if (!isEndAfterStart(startTime, endTime)) {
      res.status(400).json({ error: "endTime must be after startTime." });
      return;
    }

    const validRecurrence = ["none", "daily", "weekly", "weekdays"].includes(
      recurrence
    )
      ? recurrence
      : "none";

    let resolvedDaysOfWeek: number[] = [];
    if (validRecurrence === "weekly") {
      if (Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
        resolvedDaysOfWeek = Array.from(new Set(daysOfWeek.filter((d) => d >= 0 && d <= 6)));
      } else {
        resolvedDaysOfWeek = [parseDate(startDate).getUTCDay()];
      }
    }

    let parsedCategoryId: mongoose.Types.ObjectId | null = null;
    let populatedCategory: any = null;

    if (categoryId && typeof categoryId === "string" && categoryId.trim()) {
      if (mongoose.Types.ObjectId.isValid(categoryId)) {
        parsedCategoryId = new mongoose.Types.ObjectId(categoryId);
        if (isDatabaseConnected()) {
          const cat = await CategoryModel.findOne({
            _id: parsedCategoryId,
            userId,
          }).lean();
          if (cat) {
            populatedCategory = {
              id: String(cat._id),
              name: cat.name,
              color: cat.color,
              icon: cat.icon,
            };
          }
        }
      }
    }

    if (isDatabaseConnected()) {
      const doc = await CalendarEvent.create({
        userId,
        title: title.trim(),
        startDate,
        endDate: endDate && endDate >= startDate ? endDate : undefined,
        startTime,
        endTime,
        categoryId: parsedCategoryId,
        notes: notes?.trim() ?? "",
        recurrence: validRecurrence,
        daysOfWeek: resolvedDaysOfWeek,
      });

      const populated = await CalendarEvent.findById(doc._id)
        .populate("categoryId", "name color icon")
        .lean();

      res.status(201).json({ event: populated });
    } else {
      const now = new Date();
      const memEv: MemoryCalendarEvent = {
        _id: new mongoose.Types.ObjectId().toString(),
        userId,
        title: title.trim(),
        startDate,
        endDate: endDate && endDate >= startDate ? endDate : undefined,
        startTime,
        endTime,
        categoryId: parsedCategoryId ? String(parsedCategoryId) : null,
        notes: notes?.trim() ?? "",
        recurrence: validRecurrence,
        daysOfWeek: resolvedDaysOfWeek,
        createdAt: now,
        updatedAt: now,
      };
      memCalendarEvents(userId).push(memEv);

      res.status(201).json({
        event: {
          ...memEv,
          category: populatedCategory,
        },
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create calendar event";
    res.status(500).json({ error: message });
  }
}

/**
 * PUT /api/calendar/events/:id
 * Updates an existing calendar schedule event.
 */
export async function updateEvent(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: "Event ID is required." });
      return;
    }

    const updates = req.body as Partial<{
      title: string;
      startDate: string;
      endDate?: string;
      startTime: string;
      endTime: string;
      categoryId: string | null;
      notes: string;
      recurrence: "none" | "daily" | "weekly" | "weekdays";
      daysOfWeek: number[];
    }>;

    if (updates.startTime && !isValidTime(updates.startTime)) {
      res.status(400).json({ error: "Invalid startTime format (HH:mm)." });
      return;
    }

    if (updates.endTime && !isValidTime(updates.endTime)) {
      res.status(400).json({ error: "Invalid endTime format (HH:mm)." });
      return;
    }

    if (updates.startTime && updates.endTime) {
      if (!isEndAfterStart(updates.startTime, updates.endTime)) {
        res.status(400).json({ error: "endTime must be after startTime." });
        return;
      }
    }

    if (isDatabaseConnected()) {
      const existing = await CalendarEvent.findOne({ _id: id, userId });
      if (!existing) {
        res.status(404).json({ error: "Calendar event not found." });
        return;
      }

      if (updates.title !== undefined) existing.title = updates.title.trim();
      if (updates.startDate !== undefined) existing.startDate = updates.startDate;
      if (updates.endDate !== undefined) existing.endDate = updates.endDate || undefined;
      if (updates.startTime !== undefined) existing.startTime = updates.startTime;
      if (updates.endTime !== undefined) existing.endTime = updates.endTime;
      if (updates.notes !== undefined) existing.notes = updates.notes;
      if (updates.recurrence !== undefined) existing.recurrence = updates.recurrence;
      if (updates.daysOfWeek !== undefined) existing.daysOfWeek = updates.daysOfWeek;

      if (updates.categoryId !== undefined) {
        if (updates.categoryId && mongoose.Types.ObjectId.isValid(updates.categoryId)) {
          existing.categoryId = new mongoose.Types.ObjectId(updates.categoryId);
        } else {
          existing.categoryId = null;
        }
      }

      // Check cross-validation if only one time updated
      if (!isEndAfterStart(existing.startTime, existing.endTime)) {
        res.status(400).json({ error: "endTime must be after startTime." });
        return;
      }

      await existing.save();

      const populated = await CalendarEvent.findById(existing._id)
        .populate("categoryId", "name color icon")
        .lean();

      res.json({ event: populated });
    } else {
      const list = memCalendarEvents(userId);
      const ev = list.find((e) => e._id === id);
      if (!ev) {
        res.status(404).json({ error: "Calendar event not found." });
        return;
      }

      if (updates.title !== undefined) ev.title = updates.title.trim();
      if (updates.startDate !== undefined) ev.startDate = updates.startDate;
      if (updates.endDate !== undefined) ev.endDate = updates.endDate || undefined;
      if (updates.startTime !== undefined) ev.startTime = updates.startTime;
      if (updates.endTime !== undefined) ev.endTime = updates.endTime;
      if (updates.notes !== undefined) ev.notes = updates.notes;
      if (updates.recurrence !== undefined) ev.recurrence = updates.recurrence;
      if (updates.daysOfWeek !== undefined) ev.daysOfWeek = updates.daysOfWeek;
      if (updates.categoryId !== undefined) ev.categoryId = updates.categoryId;
      ev.updatedAt = new Date();

      res.json({ event: ev });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update calendar event";
    res.status(500).json({ error: message });
  }
}

/**
 * DELETE /api/calendar/events/:id
 * Deletes a calendar schedule event.
 */
export async function deleteEvent(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: "Event ID is required." });
      return;
    }

    if (isDatabaseConnected()) {
      const result = await CalendarEvent.findOneAndDelete({ _id: id, userId });
      if (!result) {
        res.status(404).json({ error: "Calendar event not found." });
        return;
      }
      res.json({ success: true, deletedId: id });
    } else {
      const list = memCalendarEvents(userId);
      const idx = list.findIndex((e) => e._id === id);
      if (idx === -1) {
        res.status(404).json({ error: "Calendar event not found." });
        return;
      }
      list.splice(idx, 1);
      res.json({ success: true, deletedId: id });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete calendar event";
    res.status(500).json({ error: message });
  }
}
