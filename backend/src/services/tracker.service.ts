import { isDatabaseConnected } from "../config/database";
import {
  DAYS_OF_WEEK,
  DEFAULT_WEEKLY_SCHEDULE,
  GITHUB_GREEN_SHADES,
  calculateGithubShade,
  type DayOfWeek,
  type DayRoutineTemplate,
  type HabitCategory,
  type TemplateChecklistItem,
} from "../config/defaultSchedule";
import { DailyLogModel, type IDailyChecklistItem, type IDailyLog } from "../models/DailyLog";
import { RoutineTemplateModel } from "../models/RoutineTemplate";

// In-memory fallback store when MongoDB is not yet configured/running
const memoryTemplates = new Map<DayOfWeek, DayRoutineTemplate>();
const memoryDailyLogs = new Map<string, IDailyLog>();

function initMemoryTemplates(forceReset = false) {
  if (memoryTemplates.size > 0 && !forceReset) return;
  memoryTemplates.clear();
  for (const tpl of DEFAULT_WEEKLY_SCHEDULE) {
    memoryTemplates.set(tpl.dayOfWeek, structuredClone(tpl));
  }
}

initMemoryTemplates();

export function parseDateToDayOfWeek(dateStr: string): DayOfWeek {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
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

  const dayIdx = utcDate.getUTCDay();
  const dayOfWeek = DAYS_OF_WEEK[dayIdx];
  if (!dayOfWeek) {
    throw new Error(`Unable to determine day of week for "${dateStr}".`);
  }
  return dayOfWeek;
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

export async function seedDefaultRoutines(forceReset = false): Promise<DayRoutineTemplate[]> {
  initMemoryTemplates(forceReset);

  if (isDatabaseConnected()) {
    if (forceReset) {
      await RoutineTemplateModel.deleteMany({});
    }
    const existingCount = await RoutineTemplateModel.countDocuments();
    if (existingCount === 0) {
      await RoutineTemplateModel.insertMany(DEFAULT_WEEKLY_SCHEDULE);
    }
    const docs = await RoutineTemplateModel.find().lean();
    return docs.map((d) => ({
      dayOfWeek: d.dayOfWeek,
      dayIndex: d.dayIndex,
      label: d.label,
      items: d.items,
    }));
  }

  return Array.from(memoryTemplates.values());
}

export async function getWeeklyTemplates(): Promise<DayRoutineTemplate[]> {
  if (isDatabaseConnected()) {
    const docs = await RoutineTemplateModel.find().lean();
    if (docs.length === 0) {
      return seedDefaultRoutines(false);
    }
    // Sort Monday (1) -> Saturday (6), then Sunday (0)
    return docs
      .map((d) => ({
        dayOfWeek: d.dayOfWeek,
        dayIndex: d.dayIndex,
        label: d.label,
        items: d.items,
      }))
      .sort((a, b) => {
        const orderA = a.dayIndex === 0 ? 7 : a.dayIndex;
        const orderB = b.dayIndex === 0 ? 7 : b.dayIndex;
        return orderA - orderB;
      });
  }

  return Array.from(memoryTemplates.values()).sort((a, b) => {
    const orderA = a.dayIndex === 0 ? 7 : a.dayIndex;
    const orderB = b.dayIndex === 0 ? 7 : b.dayIndex;
    return orderA - orderB;
  });
}

export async function getTemplateByDay(dayOfWeek: DayOfWeek): Promise<DayRoutineTemplate> {
  if (isDatabaseConnected()) {
    let doc = await RoutineTemplateModel.findOne({ dayOfWeek }).lean();
    if (!doc) {
      await seedDefaultRoutines(false);
      doc = await RoutineTemplateModel.findOne({ dayOfWeek }).lean();
    }
    if (doc) {
      return {
        dayOfWeek: doc.dayOfWeek,
        dayIndex: doc.dayIndex,
        label: doc.label,
        items: doc.items,
      };
    }
  }

  const tpl = memoryTemplates.get(dayOfWeek);
  if (!tpl) {
    throw new Error(`Routine template not found for day: ${dayOfWeek}`);
  }
  return structuredClone(tpl);
}

export async function updateTemplateForDay(
  dayOfWeek: DayOfWeek,
  items: Omit<TemplateChecklistItem, "id" | "order">[]
): Promise<DayRoutineTemplate> {
  const prefix = dayOfWeek.slice(0, 3);
  const formattedItems: TemplateChecklistItem[] = items.map((item, idx) => ({
    id: `${prefix}-${idx + 1}`,
    title: item.title.trim(),
    category: item.category ?? "routine",
    order: idx + 1,
  }));

  if (isDatabaseConnected()) {
    const existing = await getTemplateByDay(dayOfWeek);
    const updated = await RoutineTemplateModel.findOneAndUpdate(
      { dayOfWeek },
      { $set: { items: formattedItems, dayIndex: existing.dayIndex, label: existing.label } },
      { new: true, upsert: true }
    ).lean();

    if (updated) {
      return {
        dayOfWeek: updated.dayOfWeek,
        dayIndex: updated.dayIndex,
        label: updated.label,
        items: updated.items,
      };
    }
  }

  const current = await getTemplateByDay(dayOfWeek);
  const updatedTpl: DayRoutineTemplate = {
    ...current,
    items: formattedItems,
  };
  memoryTemplates.set(dayOfWeek, updatedTpl);
  return structuredClone(updatedTpl);
}

export async function getOrCreateDailyLog(date: string): Promise<IDailyLog> {
  const dayOfWeek = parseDateToDayOfWeek(date);

  if (isDatabaseConnected()) {
    const existing = await DailyLogModel.findOne({ date }).lean();
    if (existing) {
      return {
        date: existing.date,
        dayOfWeek: existing.dayOfWeek,
        items: existing.items,
        completedCount: existing.completedCount,
        totalCount: existing.totalCount,
        completionPercentage: existing.completionPercentage,
        shadeLevel: existing.shadeLevel,
        shadeColor: existing.shadeColor,
        shadeLabel: existing.shadeLabel,
        notes: existing.notes ?? "",
      };
    }

    const template = await getTemplateByDay(dayOfWeek);
    const initialItems: IDailyChecklistItem[] = template.items.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      completed: false,
      completedAt: null,
      order: item.order,
    }));

    const newLog = recomputeLogMetrics({
      date,
      dayOfWeek,
      items: initialItems,
      completedCount: 0,
      totalCount: initialItems.length,
      completionPercentage: 0,
      shadeLevel: 0,
      shadeColor: GITHUB_GREEN_SHADES[0].color,
      shadeLabel: GITHUB_GREEN_SHADES[0].label,
      notes: "",
    });

    const created = await DailyLogModel.create(newLog);
    return {
      date: created.date,
      dayOfWeek: created.dayOfWeek,
      items: created.items,
      completedCount: created.completedCount,
      totalCount: created.totalCount,
      completionPercentage: created.completionPercentage,
      shadeLevel: created.shadeLevel,
      shadeColor: created.shadeColor,
      shadeLabel: created.shadeLabel,
      notes: created.notes ?? "",
    };
  }

  const memLog = memoryDailyLogs.get(date);
  if (memLog) {
    return structuredClone(memLog);
  }

  const template = await getTemplateByDay(dayOfWeek);
  const initialItems: IDailyChecklistItem[] = template.items.map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    completed: false,
    completedAt: null,
    order: item.order,
  }));

  const newLog = recomputeLogMetrics({
    date,
    dayOfWeek,
    items: initialItems,
    completedCount: 0,
    totalCount: initialItems.length,
    completionPercentage: 0,
    shadeLevel: 0,
    shadeColor: GITHUB_GREEN_SHADES[0].color,
    shadeLabel: GITHUB_GREEN_SHADES[0].label,
    notes: "",
  });

  memoryDailyLogs.set(date, newLog);
  return structuredClone(newLog);
}

async function saveDailyLog(log: IDailyLog): Promise<IDailyLog> {
  const updated = recomputeLogMetrics(log);

  if (isDatabaseConnected()) {
    await DailyLogModel.findOneAndUpdate(
      { date: updated.date },
      { $set: updated },
      { new: true, upsert: true }
    );
  } else {
    memoryDailyLogs.set(updated.date, structuredClone(updated));
  }

  return structuredClone(updated);
}

export async function toggleChecklistItem(
  date: string,
  itemId: string,
  completed?: boolean
): Promise<IDailyLog> {
  const log = await getOrCreateDailyLog(date);
  const item = log.items.find((i) => i.id === itemId);

  if (!item) {
    throw new Error(`Checklist item "${itemId}" not found on ${date}.`);
  }

  const nextCompleted = completed !== undefined ? completed : !item.completed;
  item.completed = nextCompleted;
  item.completedAt = nextCompleted ? new Date().toISOString() : null;

  return saveDailyLog(log);
}

export async function setAllChecklistItems(
  date: string,
  completed: boolean
): Promise<IDailyLog> {
  const log = await getOrCreateDailyLog(date);
  const now = completed ? new Date().toISOString() : null;

  for (const item of log.items) {
    item.completed = completed;
    item.completedAt = now;
  }

  return saveDailyLog(log);
}

export async function addCustomChecklistItem(
  date: string,
  title: string,
  category: HabitCategory = "custom"
): Promise<IDailyLog> {
  const log = await getOrCreateDailyLog(date);
  const nextOrder =
    log.items.reduce((maxOrder, i) => Math.max(maxOrder, i.order), 0) + 1;

  const newItem: IDailyChecklistItem = {
    id: `custom-${Date.now()}`,
    title: title.trim(),
    category,
    completed: false,
    completedAt: null,
    order: nextOrder,
  };

  log.items.push(newItem);
  return saveDailyLog(log);
}

export async function removeChecklistItem(
  date: string,
  itemId: string
): Promise<IDailyLog> {
  const log = await getOrCreateDailyLog(date);
  const prevLen = log.items.length;
  log.items = log.items.filter((i) => i.id !== itemId);

  if (log.items.length === prevLen) {
    throw new Error(`Checklist item "${itemId}" not found on ${date}.`);
  }

  return saveDailyLog(log);
}

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
  firstDayIndex: number; // 0 = Sunday .. 6 = Saturday (for calendar grid alignment)
  palette: typeof GITHUB_GREEN_SHADES;
  summary: {
    perfectDays: number;
    activeDays: number;
    monthlyCompletionPercentage: number;
  };
  days: CalendarDaySummary[];
}

export async function getMonthlyCalendar(
  year: number,
  month: number
): Promise<MonthlyCalendarResponse> {
  if (month < 1 || month > 12) {
    throw new Error("Month must be between 1 and 12.");
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDayIndex = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });

  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const loggedMap = new Map<string, IDailyLog>();

  if (isDatabaseConnected()) {
    const logs = await DailyLogModel.find({
      date: { $regex: `^${prefix}` },
    }).lean();
    for (const l of logs) {
      loggedMap.set(l.date, l);
    }
  } else {
    for (const [dateKey, l] of memoryDailyLogs.entries()) {
      if (dateKey.startsWith(prefix)) {
        loggedMap.set(dateKey, l);
      }
    }
  }

  const templates = await getWeeklyTemplates();
  const templateByDay = new Map<DayOfWeek, DayRoutineTemplate>();
  for (const t of templates) {
    templateByDay.set(t.dayOfWeek, t);
  }

  const days: CalendarDaySummary[] = [];
  let perfectDays = 0;
  let activeDays = 0;
  let totalCompletedTasks = 0;
  let totalScheduledTasks = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${prefix}${String(d).padStart(2, "0")}`;
    const dayOfWeek = parseDateToDayOfWeek(dateStr);
    const existingLog = loggedMap.get(dateStr);

    if (existingLog) {
      const isFullyCompleted =
        existingLog.totalCount > 0 &&
        existingLog.completedCount === existingLog.totalCount;
      if (isFullyCompleted) perfectDays++;
      if (existingLog.completedCount > 0) activeDays++;
      totalCompletedTasks += existingLog.completedCount;
      totalScheduledTasks += existingLog.totalCount;

      days.push({
        date: dateStr,
        dayOfMonth: d,
        dayOfWeek,
        completedCount: existingLog.completedCount,
        totalCount: existingLog.totalCount,
        completionPercentage: existingLog.completionPercentage,
        shadeLevel: existingLog.shadeLevel,
        shadeColor: existingLog.shadeColor,
        shadeLabel: existingLog.shadeLabel,
        isFullyCompleted,
      });
    } else {
      const tpl = templateByDay.get(dayOfWeek);
      const totalCount = tpl ? tpl.items.length : 0;
      totalScheduledTasks += totalCount;

      days.push({
        date: dateStr,
        dayOfMonth: d,
        dayOfWeek,
        completedCount: 0,
        totalCount,
        completionPercentage: 0,
        shadeLevel: 0,
        shadeColor: GITHUB_GREEN_SHADES[0].color,
        shadeLabel: GITHUB_GREEN_SHADES[0].label,
        isFullyCompleted: false,
      });
    }
  }

  const monthlyCompletionPercentage =
    totalScheduledTasks > 0
      ? Math.round((totalCompletedTasks / totalScheduledTasks) * 100)
      : 0;

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
      monthlyCompletionPercentage,
    },
    days,
  };
}

export async function getConsistencyStats() {
  let allLogs: IDailyLog[] = [];

  if (isDatabaseConnected()) {
    allLogs = await DailyLogModel.find().sort({ date: 1 }).lean();
  } else {
    allLogs = Array.from(memoryDailyLogs.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }

  const totalDaysTracked = allLogs.length;
  const perfectDays = allLogs.filter(
    (l) => l.totalCount > 0 && l.completedCount === l.totalCount
  ).length;
  const activeDays = allLogs.filter((l) => l.completedCount > 0).length;

  const totalTasksCompleted = allLogs.reduce((sum, l) => sum + l.completedCount, 0);
  const totalTasksAssigned = allLogs.reduce((sum, l) => sum + l.totalCount, 0);
  const overallCompletionPercentage =
    totalTasksAssigned > 0
      ? Math.round((totalTasksCompleted / totalTasksAssigned) * 100)
      : 0;

  return {
    storageMode: isDatabaseConnected() ? "mongodb" : "in-memory-fallback",
    totalDaysTracked,
    activeDays,
    perfectDays,
    totalTasksCompleted,
    totalTasksAssigned,
    overallCompletionPercentage,
    palette: GITHUB_GREEN_SHADES,
  };
}

