import mongoose from "mongoose";
import { isDatabaseConnected } from "../config/database";
import {
  DAYS_OF_WEEK,
  DEFAULT_CATEGORY,
  GITHUB_GREEN_SHADES,
  calculateGithubShade,
  normalizeCategory,
  type CategoryInfo,
  type DayOfWeek,
} from "../config/defaultSchedule";
import { CategoryModel, type IUserCategory } from "../models/Category";
import {
  DailyLogModel,
  type IDailyChecklistItem,
  type IDailyLog,
} from "../models/DailyLog";
import {
  RoutineTemplateModel,
  type IRoutineTemplate,
} from "../models/RoutineTemplate";

// ============================================================
// Types
// ============================================================

export interface RoutineRecord {
  id: string;
  title: string;
  category: CategoryInfo;
  daysOfWeek: number[]; // 0 = Sunday .. 6 = Saturday
  specificDate: string | null; // one-off task (YYYY-MM-DD)
  startDate: string; // recurring routines never apply before this date
  active: boolean;
}

export interface CategoryRecord extends CategoryInfo {
  id: string;
}

// In-memory fallback stores keyed by userId (used when MongoDB isn't connected)
const memoryRoutinesByUser = new Map<string, RoutineRecord[]>();
const memoryCategoriesByUser = new Map<string, CategoryRecord[]>();
const memoryDailyLogsByUser = new Map<string, Map<string, IDailyLog>>();

function memRoutines(userId: string): RoutineRecord[] {
  let list = memoryRoutinesByUser.get(userId);
  if (!list) {
    list = [];
    memoryRoutinesByUser.set(userId, list);
  }
  return list;
}

function memCategories(userId: string): CategoryRecord[] {
  let list = memoryCategoriesByUser.get(userId);
  if (!list) {
    list = [];
    memoryCategoriesByUser.set(userId, list);
  }
  return list;
}

function memLogs(userId: string): Map<string, IDailyLog> {
  let logs = memoryDailyLogsByUser.get(userId);
  if (!logs) {
    logs = new Map<string, IDailyLog>();
    memoryDailyLogsByUser.set(userId, logs);
  }
  return logs;
}

function newId(): string {
  return new mongoose.Types.ObjectId().toString();
}

// ============================================================
// Date helpers
// ============================================================

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Validates YYYY-MM-DD and returns the day index (0 = Sunday .. 6 = Saturday). */
export function getDayIndex(dateStr: string): number {
  const match = DATE_RE.exec(dateStr);
  if (!match) {
    throw new Error(`Invalid date format "${dateStr}". Expected YYYY-MM-DD.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date "${dateStr}".`);
  }
  return utcDate.getUTCDay();
}

export function parseDateToDayOfWeek(dateStr: string): DayOfWeek {
  const idx = getDayIndex(dateStr);
  const dayOfWeek = DAYS_OF_WEEK[idx];
  if (!dayOfWeek) {
    throw new Error(`Unable to determine day of week for "${dateStr}".`);
  }
  return dayOfWeek;
}

export function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(dateStr: string, days: number): string {
  getDayIndex(dateStr);
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function mondayOnOrBefore(dateStr: string): string {
  const idx = getDayIndex(dateStr);
  const offset = idx === 0 ? 6 : idx - 1;
  return addDays(dateStr, -offset);
}

// ============================================================
// Categories (user-defined genres)
// ============================================================

function toCategoryRecord(doc: IUserCategory): CategoryRecord {
  return {
    id: String(doc._id),
    name: doc.name,
    color: doc.color,
    icon: doc.icon,
  };
}

export async function listCategories(userId: string): Promise<CategoryRecord[]> {
  if (isDatabaseConnected()) {
    const docs = await CategoryModel.find({ userId }).sort({ _id: 1 }).lean();
    return docs.map(toCategoryRecord);
  }
  return structuredClone(memCategories(userId));
}

export async function createCategory(
  userId: string,
  input: { name?: unknown; color?: unknown; icon?: unknown }
): Promise<CategoryRecord> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) {
    throw new Error("Category `name` is required.");
  }
  const normalized = normalizeCategory({
    name,
    color: input.color,
    icon: input.icon,
  });
  const nameKey = normalized.name.toLowerCase();

  if (isDatabaseConnected()) {
    const existing = await CategoryModel.findOne({ userId, nameKey }).lean();
    if (existing) {
      throw new Error(`Category "${normalized.name}" already exists.`);
    }
    const created = await CategoryModel.create({
      userId,
      name: normalized.name,
      nameKey,
      color: normalized.color,
      icon: normalized.icon,
    });
    return toCategoryRecord(created.toObject());
  }

  const list = memCategories(userId);
  if (list.some((c) => c.name.toLowerCase() === nameKey)) {
    throw new Error(`Category "${normalized.name}" already exists.`);
  }
  const record: CategoryRecord = { id: newId(), ...normalized };
  list.push(record);
  return structuredClone(record);
}

export async function deleteCategory(
  userId: string,
  categoryIdOrName: string
): Promise<{
  deletedId: string;
  deletedName: string;
  fallbackCategory: CategoryInfo;
}> {
  const rawParam = decodeURIComponent(categoryIdOrName ?? "").trim();
  if (!rawParam) {
    throw new Error("Category not found.");
  }

  if (rawParam.toLowerCase() === "general") {
    throw new Error("The default General category cannot be deleted.");
  }

  let deletedId = "";
  let deletedName = "";

  if (isDatabaseConnected()) {
    let deletedDoc: IUserCategory | null = null;
    if (mongoose.isValidObjectId(rawParam)) {
      deletedDoc = await CategoryModel.findOneAndDelete({
        _id: rawParam,
        userId,
      }).lean();
    }
    if (!deletedDoc) {
      deletedDoc = await CategoryModel.findOneAndDelete({
        userId,
        nameKey: rawParam.toLowerCase(),
      }).lean();
    }
    if (!deletedDoc) {
      throw new Error("Category not found.");
    }
    if (deletedDoc.nameKey === "general") {
      throw new Error("The default General category cannot be deleted.");
    }
    deletedId = String(deletedDoc._id);
    deletedName = deletedDoc.name;

    // Cascade referential integrity in MongoDB: reassign routines & daily log items to General
    const escaped = deletedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nameRegex = new RegExp(`^${escaped}$`, "i");

    await RoutineTemplateModel.updateMany(
      { userId, "category.name": nameRegex },
      { $set: { category: { ...DEFAULT_CATEGORY } } }
    );

    const logsToUpdate = await DailyLogModel.find({
      userId,
      "items.category.name": nameRegex,
    });
    const targetLower = deletedName.toLowerCase();
    for (const logDoc of logsToUpdate) {
      let changed = false;
      for (const item of logDoc.items) {
        if (
          item.category?.name &&
          item.category.name.toLowerCase() === targetLower
        ) {
          item.category = { ...DEFAULT_CATEGORY };
          changed = true;
        }
      }
      if (changed) {
        logDoc.markModified("items");
        await logDoc.save();
      }
    }
  } else {
    const list = memCategories(userId);
    const idx = list.findIndex(
      (c) =>
        c.id === rawParam || c.name.toLowerCase() === rawParam.toLowerCase()
    );
    if (idx === -1) throw new Error("Category not found.");
    const found = list[idx]!;
    if (found.name.toLowerCase() === "general") {
      throw new Error("The default General category cannot be deleted.");
    }
    list.splice(idx, 1);
    deletedId = found.id;
    deletedName = found.name;
  }

  // Cascade referential integrity in memory store as well
  const targetLower = deletedName.toLowerCase();
  for (const r of memRoutines(userId)) {
    if (r.category.name.toLowerCase() === targetLower) {
      r.category = { ...DEFAULT_CATEGORY };
    }
  }
  for (const log of memLogs(userId).values()) {
    for (const item of log.items) {
      if (item.category.name.toLowerCase() === targetLower) {
        item.category = { ...DEFAULT_CATEGORY };
      }
    }
  }

  return {
    deletedId,
    deletedName,
    fallbackCategory: { ...DEFAULT_CATEGORY },
  };
}

async function resolveCategory(
  userId: string,
  input: unknown
): Promise<CategoryInfo> {
  if (typeof input === "string" && input.trim()) {
    const key = input.trim().toLowerCase();
    const saved = (await listCategories(userId)).find(
      (c) => c.name.toLowerCase() === key
    );
    if (saved) {
      return { name: saved.name, color: saved.color, icon: saved.icon };
    }
  }
  return normalizeCategory(input);
}

// ============================================================
// Routines (Master Recurring Entities)
// ============================================================

function toRoutineRecord(doc: IRoutineTemplate): RoutineRecord {
  return {
    id: String(doc._id),
    title: doc.title,
    category: normalizeCategory(doc.category),
    daysOfWeek: [...(doc.daysOfWeek ?? [])],
    specificDate: doc.specificDate ?? null,
    startDate:
      doc.startDate ??
      (doc.createdAt ? doc.createdAt.toISOString().slice(0, 10) : "1970-01-01"),
    active: doc.active !== false,
  };
}

function validateDaysOfWeek(value: unknown): number[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error("`daysOfWeek` must be an array of integers between 0 and 6.");
  }
  const days = value.map((v) => Number(v));
  if (days.some((n) => !Number.isInteger(n) || n < 0 || n > 6)) {
    throw new Error("`daysOfWeek` must be an array of integers between 0 and 6.");
  }
  return Array.from(new Set(days)).sort((a, b) => a - b);
}

function isScheduledOn(r: RoutineRecord, date: string, dayIdx: number): boolean {
  if (!r.active) return false;
  if (r.specificDate) return r.specificDate === date;
  return r.daysOfWeek.includes(dayIdx) && date >= r.startDate;
}

export async function listRoutines(userId: string): Promise<RoutineRecord[]> {
  if (isDatabaseConnected()) {
    // `title: { $exists: true }` skips legacy per-day template documents.
    const docs = await RoutineTemplateModel.find({
      userId,
      title: { $exists: true },
      active: { $ne: false },
    })
      .sort({ _id: 1 })
      .lean();
    return docs.map(toRoutineRecord);
  }
  return structuredClone(memRoutines(userId).filter((r) => r.active));
}

export interface CreateRoutineInput {
  title?: unknown;
  category?: unknown;
  daysOfWeek?: unknown;
  specificDate?: unknown;
  startDate?: unknown;
}

export async function createRoutine(
  userId: string,
  input: CreateRoutineInput
): Promise<RoutineRecord> {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) {
    throw new Error("Routine `title` is required.");
  }

  const daysOfWeek = validateDaysOfWeek(input.daysOfWeek);
  let specificDate: string | null = null;
  if (typeof input.specificDate === "string" && input.specificDate.trim()) {
    specificDate = input.specificDate.trim();
    getDayIndex(specificDate);
  }

  if (!specificDate && daysOfWeek.length === 0) {
    throw new Error(
      "Provide `daysOfWeek` (integers 0–6) for a recurring routine or `specificDate` (YYYY-MM-DD) for a one-off task."
    );
  }

  let startDate = mondayOnOrBefore(todayUtcDateString());
  if (specificDate) {
    startDate = specificDate;
  } else if (typeof input.startDate === "string" && input.startDate.trim()) {
    startDate = input.startDate.trim();
    getDayIndex(startDate);
  }

  const category = await resolveCategory(userId, input.category);

  if (isDatabaseConnected()) {
    const created = await RoutineTemplateModel.create({
      userId,
      title,
      category,
      daysOfWeek: specificDate ? [] : daysOfWeek,
      specificDate,
      startDate,
      active: true,
    });
    return toRoutineRecord(created.toObject());
  }

  const record: RoutineRecord = {
    id: newId(),
    title,
    category,
    daysOfWeek: specificDate ? [] : daysOfWeek,
    specificDate,
    startDate,
    active: true,
  };
  memRoutines(userId).push(record);
  return structuredClone(record);
}

export interface UpdateRoutineInput {
  title?: unknown;
  category?: unknown;
  daysOfWeek?: unknown;
  specificDate?: unknown;
}

export async function updateRoutine(
  userId: string,
  routineId: string,
  updates: UpdateRoutineInput
): Promise<RoutineRecord> {
  const current = (await listRoutines(userId)).find((r) => r.id === routineId);
  if (!current) {
    throw new Error("Routine not found.");
  }

  const next: RoutineRecord = { ...current };

  if (updates.title !== undefined) {
    const title = typeof updates.title === "string" ? updates.title.trim() : "";
    if (!title) throw new Error("Routine `title` cannot be empty.");
    next.title = title;
  }

  if (updates.category !== undefined) {
    next.category = await resolveCategory(userId, updates.category);
  }

  if (updates.daysOfWeek !== undefined) {
    const days = validateDaysOfWeek(updates.daysOfWeek);
    if (days.length === 0) {
      throw new Error("A recurring routine needs at least one day in `daysOfWeek`.");
    }
    next.daysOfWeek = days;
    next.specificDate = null; // converted to a recurring routine
  } else if (
    typeof updates.specificDate === "string" &&
    updates.specificDate.trim()
  ) {
    getDayIndex(updates.specificDate.trim());
    next.specificDate = updates.specificDate.trim();
    next.startDate = next.specificDate;
    next.daysOfWeek = [];
  }

  if (isDatabaseConnected()) {
    const updated = await RoutineTemplateModel.findOneAndUpdate(
      { _id: routineId, userId },
      {
        $set: {
          title: next.title,
          category: next.category,
          daysOfWeek: next.daysOfWeek,
          specificDate: next.specificDate,
          startDate: next.startDate,
        },
      },
      { new: true }
    ).lean();
    if (!updated) throw new Error("Routine not found.");
    return toRoutineRecord(updated);
  }

  const list = memRoutines(userId);
  const idx = list.findIndex((r) => r.id === routineId);
  if (idx === -1) throw new Error("Routine not found.");
  list[idx] = next;
  return structuredClone(next);
}

export interface BulkDeleteInput {
  routineIds?: unknown;
  mode?: unknown;
  dayOfWeek?: unknown;
  specificDate?: unknown;
}

export interface BulkDeleteResult {
  mode: "all" | "day";
  requestedCount: number;
  deletedCount: number;
  updatedCount: number;
  skippedCount: number;
}

async function deleteRoutineDocs(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  if (isDatabaseConnected()) {
    await RoutineTemplateModel.deleteMany({
      _id: { $in: ids.filter((id) => mongoose.isValidObjectId(id)) },
      userId,
    });
    return;
  }
  const list = memRoutines(userId);
  const idSet = new Set(ids);
  for (let i = list.length - 1; i >= 0; i--) {
    if (idSet.has(list[i]!.id)) list.splice(i, 1);
  }
}

async function setRoutineDays(
  userId: string,
  routineId: string,
  daysOfWeek: number[]
): Promise<void> {
  if (isDatabaseConnected()) {
    await RoutineTemplateModel.updateOne(
      { _id: routineId, userId },
      { $set: { daysOfWeek } }
    );
    return;
  }
  const record = memRoutines(userId).find((r) => r.id === routineId);
  if (record) record.daysOfWeek = daysOfWeek;
}

/**
 * Bulk delete / unschedule routines. Only routines owned by `userId` are touched.
 * Completed history in DailyLog is never modified here.
 */
export async function bulkDeleteRoutines(
  userId: string,
  input: BulkDeleteInput
): Promise<BulkDeleteResult> {
  if (!Array.isArray(input.routineIds) || input.routineIds.length === 0) {
    throw new Error("`routineIds` must be a non-empty array of routine ids.");
  }
  const routineIds = Array.from(new Set(input.routineIds.map((id) => String(id))));

  if (input.mode !== "all" && input.mode !== "day") {
    throw new Error('`mode` must be either "all" or "day".');
  }

  const owned = (await listRoutines(userId)).filter((r) =>
    routineIds.includes(r.id)
  );

  if (input.mode === "all") {
    await deleteRoutineDocs(
      userId,
      owned.map((r) => r.id)
    );
    return {
      mode: "all",
      requestedCount: routineIds.length,
      deletedCount: owned.length,
      updatedCount: 0,
      skippedCount: routineIds.length - owned.length,
    };
  }

  // mode === "day"
  const hasDay = input.dayOfWeek !== undefined && input.dayOfWeek !== null;
  const dayOfWeek = hasDay ? Number(input.dayOfWeek) : null;
  if (hasDay && (!Number.isInteger(dayOfWeek) || dayOfWeek! < 0 || dayOfWeek! > 6)) {
    throw new Error("`dayOfWeek` must be an integer between 0 and 6.");
  }
  const specificDate =
    typeof input.specificDate === "string" && input.specificDate.trim()
      ? input.specificDate.trim()
      : null;
  if (specificDate) getDayIndex(specificDate);
  if (dayOfWeek === null && !specificDate) {
    throw new Error('mode "day" requires `dayOfWeek` (0–6) or `specificDate`.');
  }

  const toDelete: string[] = [];
  let updatedCount = 0;

  for (const r of owned) {
    if (r.specificDate) {
      if (specificDate && r.specificDate === specificDate) toDelete.push(r.id);
      continue;
    }
    if (dayOfWeek !== null && r.daysOfWeek.includes(dayOfWeek)) {
      const remaining = r.daysOfWeek.filter((d) => d !== dayOfWeek);
      if (remaining.length === 0) {
        toDelete.push(r.id);
      } else {
        await setRoutineDays(userId, r.id, remaining);
        updatedCount++;
      }
    }
  }

  await deleteRoutineDocs(userId, toDelete);

  return {
    mode: "day",
    requestedCount: routineIds.length,
    deletedCount: toDelete.length,
    updatedCount,
    skippedCount: routineIds.length - toDelete.length - updatedCount,
  };
}

// ============================================================
// Daily logs: merge master schedule + saved completion state
// ============================================================

function normalizeLogItems(items: unknown): IDailyChecklistItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw, idx) => {
    const i = (raw ?? {}) as Record<string, unknown>;
    return {
      id: String(i.id ?? `legacy-${idx}`),
      routineId: typeof i.routineId === "string" ? i.routineId : undefined,
      title: String(i.title ?? ""),
      category: normalizeCategory(i.category),
      completed: Boolean(i.completed),
      completedAt: typeof i.completedAt === "string" ? i.completedAt : null,
      order: typeof i.order === "number" ? i.order : idx + 1,
    };
  });
}

function toLogRecord(doc: IDailyLog): IDailyLog {
  return {
    date: doc.date,
    dayOfWeek: doc.dayOfWeek,
    items: normalizeLogItems(doc.items),
    completedCount: doc.completedCount,
    totalCount: doc.totalCount,
    completionPercentage: doc.completionPercentage,
    shadeLevel: doc.shadeLevel,
    shadeColor: doc.shadeColor,
    shadeLabel: doc.shadeLabel,
    notes: doc.notes ?? "",
  };
}

function recomputeLogMetrics(log: IDailyLog): IDailyLog {
  const totalCount = log.items.length;
  const completedCount = log.items.filter((item) => item.completed).length;
  const completionPercentage =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const shade = calculateGithubShade(completedCount, totalCount);

  log.completedCount = completedCount;
  log.totalCount = totalCount;
  log.completionPercentage = completionPercentage;
  log.shadeLevel = shade.level;
  log.shadeColor = shade.color;
  log.shadeLabel = shade.label;

  return log;
}

/**
 * Builds the checklist for one date:
 *   1. every active routine scheduled on that date (daysOfWeek / specificDate),
 *      carrying over the saved completion state, plus
 *   2. any COMPLETED item from the saved log that is no longer scheduled
 *      (deleted/modified routine) so history and heatmap squares stay intact.
 */
function buildDayView(
  date: string,
  routines: RoutineRecord[],
  stored: IDailyLog | null
): IDailyLog {
  const dayIdx = getDayIndex(date);
  const dayOfWeek = DAYS_OF_WEEK[dayIdx] as DayOfWeek;
  const prior = new Map((stored?.items ?? []).map((i) => [i.id, i]));
  const items: IDailyChecklistItem[] = [];
  const seen = new Set<string>();

  for (const r of routines) {
    if (!isScheduledOn(r, date, dayIdx)) continue;
    const id = `r-${r.id}`;
    const saved = prior.get(id);
    items.push({
      id,
      routineId: r.id,
      title: r.title,
      category: r.category,
      completed: saved?.completed ?? false,
      completedAt: saved?.completed ? (saved.completedAt ?? null) : null,
      order: items.length + 1,
    });
    seen.add(id);
  }

  for (const saved of stored?.items ?? []) {
    if (!saved.completed || seen.has(saved.id)) continue;
    items.push({ ...saved, order: items.length + 1 });
    seen.add(saved.id);
  }

  return recomputeLogMetrics({
    date,
    dayOfWeek,
    items,
    completedCount: 0,
    totalCount: 0,
    completionPercentage: 0,
    shadeLevel: 0,
    shadeColor: GITHUB_GREEN_SHADES[0].color,
    shadeLabel: GITHUB_GREEN_SHADES[0].label,
    notes: stored?.notes ?? "",
  });
}

async function fetchStoredLogs(
  userId: string,
  filter: { dates?: string[]; prefix?: string }
): Promise<Map<string, IDailyLog>> {
  const result = new Map<string, IDailyLog>();

  if (isDatabaseConnected()) {
    const query = filter.dates
      ? { userId, date: { $in: filter.dates } }
      : { userId, date: { $regex: `^${filter.prefix ?? ""}` } };
    const docs = await DailyLogModel.find(query).lean();
    for (const doc of docs) result.set(doc.date, toLogRecord(doc));
    return result;
  }

  for (const [date, log] of memLogs(userId).entries()) {
    if (filter.dates ? filter.dates.includes(date) : date.startsWith(filter.prefix ?? "")) {
      result.set(date, log);
    }
  }
  return result;
}

/** Returns the merged checklist view for one date. Viewing never persists anything. */
export async function getOrCreateDailyLog(
  userId: string,
  date: string
): Promise<IDailyLog> {
  getDayIndex(date);
  const [routines, stored] = await Promise.all([
    listRoutines(userId),
    fetchStoredLogs(userId, { dates: [date] }),
  ]);
  return structuredClone(buildDayView(date, routines, stored.get(date) ?? null));
}

/** Merged views for several dates (used by weekly insights). */
export async function getMergedLogsForDates(
  userId: string,
  dates: string[]
): Promise<IDailyLog[]> {
  if (dates.length === 0) return [];
  const [routines, stored] = await Promise.all([
    listRoutines(userId),
    fetchStoredLogs(userId, { dates }),
  ]);
  return dates.map((date) => buildDayView(date, routines, stored.get(date) ?? null));
}

async function saveDailyLog(userId: string, log: IDailyLog): Promise<IDailyLog> {
  const updated = recomputeLogMetrics({ ...log });

  if (isDatabaseConnected()) {
    await DailyLogModel.findOneAndUpdate(
      { userId, date: updated.date },
      { $set: { ...updated, userId } },
      { new: true, upsert: true }
    );
  } else {
    memLogs(userId).set(updated.date, structuredClone(updated));
  }

  return structuredClone(updated);
}

export async function toggleChecklistItem(
  userId: string,
  date: string,
  itemId: string,
  completed?: boolean
): Promise<IDailyLog> {
  const log = await getOrCreateDailyLog(userId, date);
  const item = log.items.find((i) => i.id === itemId);

  if (!item) {
    throw new Error(`Checklist item "${itemId}" not found on ${date}.`);
  }

  const nextCompleted = completed !== undefined ? completed : !item.completed;
  item.completed = nextCompleted;
  item.completedAt = nextCompleted ? new Date().toISOString() : null;

  return saveDailyLog(userId, log);
}

export async function setAllChecklistItems(
  userId: string,
  date: string,
  completed: boolean
): Promise<IDailyLog> {
  const log = await getOrCreateDailyLog(userId, date);
  const now = completed ? new Date().toISOString() : null;

  for (const item of log.items) {
    item.completed = completed;
    item.completedAt = now;
  }

  return saveDailyLog(userId, log);
}

/** Quick-add helper: creates a one-off routine on `date`. */
export async function addCustomChecklistItem(
  userId: string,
  date: string,
  title: string,
  category?: unknown
): Promise<IDailyLog> {
  await createRoutine(userId, { title, category, specificDate: date });
  return getOrCreateDailyLog(userId, date);
}

/**
 * Removes an item from the checklist of `date`:
 *  - one-off routine on that date -> routine deleted
 *  - recurring routine -> that weekday is pulled out of its `daysOfWeek`
 * Completed history for dates before today is always preserved.
 */
export async function removeChecklistItem(
  userId: string,
  date: string,
  itemId: string
): Promise<IDailyLog> {
  const log = await getOrCreateDailyLog(userId, date);
  const item = log.items.find((i) => i.id === itemId);

  if (!item) {
    throw new Error(`Checklist item "${itemId}" not found on ${date}.`);
  }

  if (item.routineId) {
    const routine = (await listRoutines(userId)).find(
      (r) => r.id === item.routineId
    );
    if (routine) {
      if (routine.specificDate) {
        await bulkDeleteRoutines(userId, {
          routineIds: [routine.id],
          mode: "all",
        });
      } else {
        await bulkDeleteRoutines(userId, {
          routineIds: [routine.id],
          mode: "day",
          dayOfWeek: getDayIndex(date),
        });
      }
    }
  }

  // Today/future aren't history yet: drop the saved entry. Past dates keep it.
  if (date >= todayUtcDateString() || !item.completed) {
    log.items = log.items.filter((i) => i.id !== itemId);
    await saveDailyLog(userId, log);
  }

  return getOrCreateDailyLog(userId, date);
}

// ============================================================
// Calendar & stats
// ============================================================

export interface CalendarDaySummary {
  date: string;
  dayOfMonth: number;
  dayOfWeek: DayOfWeek;
  completedCount: number;
  totalCount: number;
  completionPercentage: number;
  shadeLevel: 0 | 1 | 2 | 3 | 4;
  shadeColor: string;
  shadeLabel: string;
  isFullyCompleted: boolean;
}

export interface MonthlyCalendarResponse {
  year: number;
  month: number;
  monthName: string;
  daysInMonth: number;
  firstDayIndex: number; // 0 = Sunday .. 6 = Saturday (calendar grid alignment)
  palette: typeof GITHUB_GREEN_SHADES;
  summary: {
    perfectDays: number;
    activeDays: number;
    monthlyCompletionPercentage: number;
  };
  days: CalendarDaySummary[];
}

export async function getMonthlyCalendar(
  userId: string,
  year: number,
  month: number
): Promise<MonthlyCalendarResponse> {
  if (!Number.isInteger(year) || month < 1 || month > 12) {
    throw new Error("Month must be between 1 and 12.");
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDayIndex = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString(
    "en-US",
    { month: "long", timeZone: "UTC" }
  );

  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const [routines, stored] = await Promise.all([
    listRoutines(userId),
    fetchStoredLogs(userId, { prefix }),
  ]);

  const days: CalendarDaySummary[] = [];
  let perfectDays = 0;
  let activeDays = 0;
  let totalCompletedTasks = 0;
  let totalScheduledTasks = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${prefix}${String(d).padStart(2, "0")}`;
    const view = buildDayView(dateStr, routines, stored.get(dateStr) ?? null);
    const isFullyCompleted =
      view.totalCount > 0 && view.completedCount === view.totalCount;

    if (isFullyCompleted) perfectDays++;
    if (view.completedCount > 0) activeDays++;
    totalCompletedTasks += view.completedCount;
    totalScheduledTasks += view.totalCount;

    days.push({
      date: dateStr,
      dayOfMonth: d,
      dayOfWeek: view.dayOfWeek,
      completedCount: view.completedCount,
      totalCount: view.totalCount,
      completionPercentage: view.completionPercentage,
      shadeLevel: view.shadeLevel,
      shadeColor: view.shadeColor,
      shadeLabel: view.shadeLabel,
      isFullyCompleted,
    });
  }

  return {
    year,
    month,
    monthName,
    daysInMonth,
    firstDayIndex,
    palette: GITHUB_GREEN_SHADES,
    summary: {
      perfectDays,
      activeDays,
      monthlyCompletionPercentage:
        totalScheduledTasks > 0
          ? Math.round((totalCompletedTasks / totalScheduledTasks) * 100)
          : 0,
    },
    days,
  };
}

export async function getConsistencyStats(userId: string) {
  let allLogs: IDailyLog[] = [];

  if (isDatabaseConnected()) {
    const docs = await DailyLogModel.find({ userId }).sort({ date: 1 }).lean();
    allLogs = docs.map(toLogRecord);
  } else {
    allLogs = Array.from(memLogs(userId).values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }

  const totalDaysTracked = allLogs.length;
  const perfectDays = allLogs.filter(
    (l) => l.totalCount > 0 && l.completedCount === l.totalCount
  ).length;
  const activeDays = allLogs.filter((l) => l.completedCount > 0).length;

  const totalTasksCompleted = allLogs.reduce((s, l) => s + l.completedCount, 0);
  const totalTasksAssigned = allLogs.reduce((s, l) => s + l.totalCount, 0);
  const overallCompletionPercentage =
    totalTasksAssigned > 0
      ? Math.round((totalTasksCompleted / totalTasksAssigned) * 100)
      : 0;

  const activeDatesDesc = allLogs
    .filter((l) => l.completedCount > 0)
    .map((l) => l.date)
    .sort((a, b) => b.localeCompare(a));

  let currentStreak = 0;
  if (activeDatesDesc.length > 0) {
    currentStreak = 1;
    for (let i = 0; i < activeDatesDesc.length - 1; i++) {
      const curr = new Date(`${activeDatesDesc[i]}T00:00:00Z`).getTime();
      const prev = new Date(`${activeDatesDesc[i + 1]}T00:00:00Z`).getTime();
      const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  const recentLogs = allLogs.slice(-7);
  const recentCompleted = recentLogs.reduce((s, l) => s + l.completedCount, 0);
  const recentTotal = recentLogs.reduce((s, l) => s + l.totalCount, 0);
  const weeklyCompletionRate =
    recentTotal > 0 ? Math.round((recentCompleted / recentTotal) * 100) : 0;

  const dayStats = new Map<DayOfWeek, { totalPct: number; count: number }>();
  for (const log of allLogs) {
    if (log.completedCount > 0) {
      const entry = dayStats.get(log.dayOfWeek) ?? { totalPct: 0, count: 0 };
      entry.totalPct += log.completionPercentage;
      entry.count += 1;
      dayStats.set(log.dayOfWeek, entry);
    }
  }

  let bestDayOfWeek = "—";
  let bestAvg = -1;
  for (const [day, stat] of dayStats.entries()) {
    const avg = stat.totalPct / stat.count;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestDayOfWeek = day.charAt(0).toUpperCase() + day.slice(1);
    }
  }

  return {
    storageMode: isDatabaseConnected() ? "mongodb" : "in-memory-fallback",
    totalDaysTracked,
    activeDays,
    perfectDays,
    currentStreak,
    weeklyCompletionRate,
    bestDayOfWeek,
    totalTasksCompleted,
    totalTasksAssigned,
    overallCompletionPercentage,
    palette: GITHUB_GREEN_SHADES,
  };
}
