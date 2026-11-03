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
import {
  DailyLogModel,
  type IDailyChecklistItem,
  type IDailyLog,
} from "../models/DailyLog";
import { RoutineTemplateModel } from "../models/RoutineTemplate";

// Multi-tenant in-memory fallback stores keyed by userId
const memoryTemplatesByUser = new Map<string, Map<DayOfWeek, DayRoutineTemplate>>();
const memoryDailyLogsByUser = new Map<string, Map<string, IDailyLog>>();

function getUserMemoryTemplates(
  userId: string,
  forceReset = false
): Map<DayOfWeek, DayRoutineTemplate> {
  let userMap = memoryTemplatesByUser.get(userId);
  if (!userMap || forceReset || userMap.size === 0) {
    userMap = new Map<DayOfWeek, DayRoutineTemplate>();
    for (const tpl of DEFAULT_WEEKLY_SCHEDULE) {
      userMap.set(tpl.dayOfWeek, structuredClone(tpl));
    }
    memoryTemplatesByUser.set(userId, userMap);
  }
  return userMap;
}

function getUserMemoryLogs(userId: string): Map<string, IDailyLog> {
  let userLogs = memoryDailyLogsByUser.get(userId);
  if (!userLogs) {
    userLogs = new Map<string, IDailyLog>();
    memoryDailyLogsByUser.set(userId, userLogs);
  }
  return userLogs;
}

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

export async function seedDefaultRoutines(
  userId: string,
  forceReset = false
): Promise<DayRoutineTemplate[]> {
  const userTemplates = getUserMemoryTemplates(userId, forceReset);

  if (isDatabaseConnected()) {
    if (forceReset) {
      await RoutineTemplateModel.deleteMany({ userId });
    }
    const existingCount = await RoutineTemplateModel.countDocuments({ userId });
    if (existingCount === 0) {
      await RoutineTemplateModel.insertMany(
        DEFAULT_WEEKLY_SCHEDULE.map((tpl) => ({
          ...tpl,
          userId,
        }))
      );
    }
    const docs = await RoutineTemplateModel.find({ userId }).lean();
    return docs.map((d) => ({
      dayOfWeek: d.dayOfWeek,
      dayIndex: d.dayIndex,
      label: d.label,
      items: d.items,
    }));
  }

  return Array.from(userTemplates.values());
}

export async function getWeeklyTemplates(
  userId: string
): Promise<DayRoutineTemplate[]> {
  if (isDatabaseConnected()) {
    const docs = await RoutineTemplateModel.find({ userId }).lean();
    if (docs.length === 0) {
      return seedDefaultRoutines(userId, false);
    }
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

  const userTemplates = getUserMemoryTemplates(userId, false);
  return Array.from(userTemplates.values()).sort((a, b) => {
    const orderA = a.dayIndex === 0 ? 7 : a.dayIndex;
    const orderB = b.dayIndex === 0 ? 7 : b.dayIndex;
    return orderA - orderB;
  });
}

export async function getTemplateByDay(
  userId: string,
  dayOfWeek: DayOfWeek
): Promise<DayRoutineTemplate> {
  if (isDatabaseConnected()) {
    let doc = await RoutineTemplateModel.findOne({ userId, dayOfWeek }).lean();
    if (!doc) {
      await seedDefaultRoutines(userId, false);
      doc = await RoutineTemplateModel.findOne({ userId, dayOfWeek }).lean();
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

  const userTemplates = getUserMemoryTemplates(userId, false);
  const tpl = userTemplates.get(dayOfWeek);
  if (!tpl) {
    throw new Error(`Routine template not found for day: ${dayOfWeek}`);
  }
  return structuredClone(tpl);
}

export async function updateTemplateForDay(
  userId: string,
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
    const existing = await getTemplateByDay(userId, dayOfWeek);
    const updated = await RoutineTemplateModel.findOneAndUpdate(
      { userId, dayOfWeek },
      {
        $set: {
          userId,
          items: formattedItems,
          dayIndex: existing.dayIndex,
          label: existing.label,
        },
      },
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

  const userTemplates = getUserMemoryTemplates(userId, false);
  const current = await getTemplateByDay(userId, dayOfWeek);
  const updatedTpl: DayRoutineTemplate = {
    ...current,
    items: formattedItems,
  };
  userTemplates.set(dayOfWeek, updatedTpl);
  return structuredClone(updatedTpl);
}

export async function getOrCreateDailyLog(
  userId: string,
  date: string
): Promise<IDailyLog> {
  const dayOfWeek = parseDateToDayOfWeek(date);

  if (isDatabaseConnected()) {
    const existing = await DailyLogModel.findOne({ userId, date }).lean();
    if (existing) {
      return {
        userId: String(existing.userId),
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

    const template = await getTemplateByDay(userId, dayOfWeek);
    const initialItems: IDailyChecklistItem[] = template.items.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      completed: false,
      completedAt: null,
      order: item.order,
    }));

    const newLog = recomputeLogMetrics({
      userId,
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
      userId: String(created.userId),
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

  const userLogs = getUserMemoryLogs(userId);
  const memLog = userLogs.get(date);
  if (memLog) {
    return structuredClone(memLog);
  }

  const template = await getTemplateByDay(userId, dayOfWeek);
  const initialItems: IDailyChecklistItem[] = template.items.map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    completed: false,
    completedAt: null,
    order: item.order,
  }));

  const newLog = recomputeLogMetrics({
    userId,
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

  userLogs.set(date, newLog);
  return structuredClone(newLog);
}

async function saveDailyLog(userId: string, log: IDailyLog): Promise<IDailyLog> {
  const updated = recomputeLogMetrics({ ...log, userId });

  if (isDatabaseConnected()) {
    await DailyLogModel.findOneAndUpdate(
      { userId, date: updated.date },
      { $set: updated },
      { new: true, upsert: true }
    );
  } else {
    const userLogs = getUserMemoryLogs(userId);
    userLogs.set(updated.date, structuredClone(updated));
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

export async function addCustomChecklistItem(
  userId: string,
  date: string,
  title: string,
  category: HabitCategory = "custom"
): Promise<IDailyLog> {
  const log = await getOrCreateDailyLog(userId, date);
  const nextOrder =
    log.items.reduce((maxOrder, i) => Math.max(maxOrder, i.order), 0) + 1;

  const newItem: IDailyChecklistItem = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: title.trim(),
    category,
    completed: false,
    completedAt: null,
    order: nextOrder,
  };

  log.items.push(newItem);
  return saveDailyLog(userId, log);
}

export async function removeChecklistItem(
  userId: string,
  date: string,
  itemId: string
): Promise<IDailyLog> {
  const log = await getOrCreateDailyLog(userId, date);
  const prevLen = log.items.length;
  log.items = log.items.filter((i) => i.id !== itemId);

  if (log.items.length === prevLen) {
    throw new Error(`Checklist item "${itemId}" not found on ${date}.`);
  }

  return saveDailyLog(userId, log);
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
  firstDayIndex: number;
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
  if (month < 1 || month > 12) {
    throw new Error("Month must be between 1 and 12.");
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDayIndex = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString(
    "en-US",
    {
      month: "long",
      timeZone: "UTC",
    }
  );

  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const loggedMap = new Map<string, IDailyLog>();

  if (isDatabaseConnected()) {
    const logs = await DailyLogModel.find({
      userId,
      date: { $regex: `^${prefix}` },
    }).lean();
    for (const l of logs) {
      loggedMap.set(l.date, l);
    }
  } else {
    const userLogs = getUserMemoryLogs(userId);
    for (const [dateKey, l] of userLogs.entries()) {
      if (dateKey.startsWith(prefix)) {
        loggedMap.set(dateKey, l);
      }
    }
  }

  const templates = await getWeeklyTemplates(userId);
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

export async function getConsistencyStats(userId: string) {
  let allLogs: IDailyLog[] = [];

  if (isDatabaseConnected()) {
    allLogs = await DailyLogModel.find({ userId }).sort({ date: 1 }).lean();
  } else {
    const userLogs = getUserMemoryLogs(userId);
    allLogs = Array.from(userLogs.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }

  const totalDaysTracked = allLogs.length;
  const perfectDays = allLogs.filter(
    (l) => l.totalCount > 0 && l.completedCount === l.totalCount
  ).length;
  const activeDays = allLogs.filter((l) => l.completedCount > 0).length;

  const totalTasksCompleted = allLogs.reduce(
    (sum, l) => sum + l.completedCount,
    0
  );
  const totalTasksAssigned = allLogs.reduce((sum, l) => sum + l.totalCount, 0);
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
  const recentCompleted = recentLogs.reduce(
    (sum, l) => sum + l.completedCount,
    0
  );
  const recentTotal = recentLogs.reduce((sum, l) => sum + l.totalCount, 0);
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
