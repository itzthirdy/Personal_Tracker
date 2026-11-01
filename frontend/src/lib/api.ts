import {
  computeGithubShade,
  type CalendarDaySummary,
  type ConsistencyStats,
  type DailyChecklistItem,
  type DailyLog,
  type DayOfWeek,
  type HabitCategory,
  type MonthlyCalendarResponse,
} from "@/types/tracker";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/tracker";

const DAYS_OF_WEEK: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

// Client-side fallback templates matching the backend schedule in case the backend isn't running yet
const FALLBACK_TEMPLATES: Record<
  DayOfWeek,
  Array<{ id: string; title: string; category: HabitCategory; order: number }>
> = {
  monday: [
    { id: "mon-1", title: "Wake up & Get ready", category: "routine", order: 1 },
    { id: "mon-2", title: "Gym", category: "workout", order: 2 },
    { id: "mon-3", title: "Go home, Bath & Get Ready", category: "routine", order: 3 },
    { id: "mon-4", title: "Commute to School", category: "routine", order: 4 },
    { id: "mon-5", title: "Adv. Machine Learning (501MB)", category: "school", order: 5 },
    { id: "mon-6", title: "Self Study in Library", category: "study", order: 6 },
    { id: "mon-7", title: "Dinner", category: "routine", order: 7 },
    { id: "mon-8", title: "Software Engineering 2 (501MB)", category: "school", order: 8 },
    { id: "mon-9", title: "Head Home", category: "routine", order: 9 },
    { id: "mon-10", title: "Bath & Sleep", category: "routine", order: 10 },
  ],
  tuesday: [
    { id: "tue-1", title: "Wake Up & Get ready", category: "routine", order: 1 },
    { id: "tue-2", title: "Gym", category: "workout", order: 2 },
    { id: "tue-3", title: "Go home, Bath & Get Ready", category: "routine", order: 3 },
    { id: "tue-4", title: "Commute to School", category: "routine", order: 4 },
    { id: "tue-5", title: "Adv. Machine Learning (408MB)", category: "school", order: 5 },
    { id: "tue-6", title: "Self Study in Library", category: "study", order: 6 },
    { id: "tue-7", title: "Dinner", category: "routine", order: 7 },
    { id: "tue-8", title: "Software Engineering 2 (408MB)", category: "school", order: 8 },
    { id: "tue-9", title: "Head Home", category: "routine", order: 9 },
    { id: "tue-10", title: "Bath & Sleep", category: "routine", order: 10 },
  ],
  wednesday: [
    { id: "wed-1", title: "Wake Up & Get ready", category: "routine", order: 1 },
    { id: "wed-2", title: "Commute to School", category: "routine", order: 2 },
    { id: "wed-3", title: "Self Study in Library", category: "study", order: 3 },
    { id: "wed-4", title: "App Dev & Emerging Tech (408MB)", category: "school", order: 4 },
    { id: "wed-5", title: "Info Assurance & Security (408MB)", category: "school", order: 5 },
    { id: "wed-6", title: "Head Home", category: "routine", order: 6 },
    { id: "wed-7", title: "Bath, Dinner & Sleep", category: "routine", order: 7 },
  ],
  thursday: [
    { id: "thu-1", title: "Wake Up & Get ready", category: "routine", order: 1 },
    { id: "thu-2", title: "Gym", category: "workout", order: 2 },
    { id: "thu-3", title: "Go home, Bath & Get Ready", category: "routine", order: 3 },
    { id: "thu-4", title: "Commute to School", category: "routine", order: 4 },
    { id: "thu-5", title: "Adv. Machine Learning (501MB)", category: "school", order: 5 },
    { id: "thu-6", title: "Self Study in Library", category: "study", order: 6 },
    { id: "thu-7", title: "Dinner", category: "routine", order: 7 },
    { id: "thu-8", title: "Software Engineering 2 (501MB)", category: "school", order: 8 },
    { id: "thu-9", title: "Head Home", category: "routine", order: 9 },
    { id: "thu-10", title: "Bath & Sleep", category: "routine", order: 10 },
  ],
  friday: [
    { id: "fri-1", title: "Wake Up & Get ready", category: "routine", order: 1 },
    { id: "fri-2", title: "Gym", category: "workout", order: 2 },
    { id: "fri-3", title: "Go home, Bath & Get Ready", category: "routine", order: 3 },
    { id: "fri-4", title: "Commute to School", category: "routine", order: 4 },
    { id: "fri-5", title: "Adv. Machine Learning (408MB)", category: "school", order: 5 },
    { id: "fri-6", title: "Self Study in Library", category: "study", order: 6 },
    { id: "fri-7", title: "Dinner", category: "routine", order: 7 },
    { id: "fri-8", title: "Software Engineering 2 (408MB)", category: "school", order: 8 },
    { id: "fri-9", title: "Head Home", category: "routine", order: 9 },
    { id: "fri-10", title: "Bath & Sleep", category: "routine", order: 10 },
  ],
  saturday: [
    { id: "sat-1", title: "Wake Up & Get ready", category: "routine", order: 1 },
    { id: "sat-2", title: "Commute to School", category: "routine", order: 2 },
    { id: "sat-3", title: "Self Study in Library", category: "study", order: 3 },
    { id: "sat-4", title: "Breakfast / Break", category: "routine", order: 4 },
    { id: "sat-5", title: "App Dev & Emerging Tech (501MB)", category: "school", order: 5 },
    { id: "sat-6", title: "Info Assurance & Security (501MB)", category: "school", order: 6 },
    { id: "sat-7", title: "Head Home", category: "routine", order: 7 },
    { id: "sat-8", title: "Bath, Dinner & Sleep", category: "routine", order: 8 },
  ],
  sunday: [
    { id: "sun-1", title: "Work - Grab", category: "work", order: 1 },
    { id: "sun-2", title: "Ironing clothes", category: "chores", order: 2 },
    { id: "sun-3", title: "Washing Clothes", category: "chores", order: 3 },
    { id: "sun-4", title: "Cooking meal prep", category: "chores", order: 4 },
    { id: "sun-5", title: "Prepare for next week", category: "routine", order: 5 },
  ],
};

function getDayOfWeekFromDate(dateStr: string): DayOfWeek {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return DAYS_OF_WEEK[utc.getUTCDay()] ?? "monday";
}

export function buildFallbackDailyLog(date: string): DailyLog {
  const dayOfWeek = getDayOfWeekFromDate(date);
  const tpl = FALLBACK_TEMPLATES[dayOfWeek] ?? [];
  const items: DailyChecklistItem[] = tpl.map((item) => ({
    ...item,
    completed: false,
    completedAt: null,
  }));
  const shade = computeGithubShade(0, items.length);
  return {
    date,
    dayOfWeek,
    items,
    completedCount: 0,
    totalCount: items.length,
    completionPercentage: 0,
    shadeLevel: shade.level,
    shadeColor: shade.color,
    shadeLabel: shade.label,
  };
}

export function buildFallbackCalendar(
  year: number,
  month: number
): MonthlyCalendarResponse {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDayIndex = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString(
    "en-US",
    { month: "long", timeZone: "UTC" }
  );
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const days: CalendarDaySummary[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${prefix}${String(d).padStart(2, "0")}`;
    const dayOfWeek = getDayOfWeekFromDate(date);
    const totalCount = FALLBACK_TEMPLATES[dayOfWeek]?.length ?? 0;
    const shade = computeGithubShade(0, totalCount);
    days.push({
      date,
      dayOfMonth: d,
      dayOfWeek,
      completedCount: 0,
      totalCount,
      completionPercentage: 0,
      shadeLevel: shade.level,
      shadeColor: shade.color,
      shadeLabel: shade.label,
      isFullyCompleted: false,
    });
  }

  return {
    year,
    month,
    monthName,
    daysInMonth,
    firstDayIndex,
    summary: {
      perfectDays: 0,
      activeDays: 0,
      monthlyCompletionPercentage: 0,
    },
    days,
  };
}

export async function fetchMonthlyCalendar(
  year: number,
  month: number
): Promise<MonthlyCalendarResponse> {
  const res = await fetch(`${API_BASE}/calendar?year=${year}&month=${month}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch calendar: ${res.status}`);
  }
  return res.json();
}

export async function fetchDailyLog(date: string): Promise<DailyLog> {
  const res = await fetch(`${API_BASE}/logs/${date}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch daily log: ${res.status}`);
  }
  const data = (await res.json()) as { log: DailyLog };
  return data.log;
}

export async function fetchStats(): Promise<ConsistencyStats> {
  const res = await fetch(`${API_BASE}/stats`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch stats: ${res.status}`);
  }
  return res.json();
}

export async function apiToggleHabitItem(
  date: string,
  itemId: string,
  completed: boolean
): Promise<DailyLog> {
  const res = await fetch(`${API_BASE}/logs/${date}/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed }),
  });
  if (!res.ok) {
    throw new Error(`Failed to toggle habit item: ${res.status}`);
  }
  const data = (await res.json()) as { log: DailyLog };
  return data.log;
}

export async function apiSetAllHabitItems(
  date: string,
  completed: boolean
): Promise<DailyLog> {
  const res = await fetch(`${API_BASE}/logs/${date}/check-all`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed }),
  });
  if (!res.ok) {
    throw new Error(`Failed to set all items: ${res.status}`);
  }
  const data = (await res.json()) as { log: DailyLog };
  return data.log;
}

export async function apiAddCustomHabitItem(
  date: string,
  title: string,
  category: HabitCategory
): Promise<DailyLog> {
  const res = await fetch(`${API_BASE}/logs/${date}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, category }),
  });
  if (!res.ok) {
    throw new Error(`Failed to add custom item: ${res.status}`);
  }
  const data = (await res.json()) as { log: DailyLog };
  return data.log;
}

export async function apiRemoveHabitItem(
  date: string,
  itemId: string
): Promise<DailyLog> {
  const res = await fetch(`${API_BASE}/logs/${date}/items/${itemId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Failed to delete item: ${res.status}`);
  }
  const data = (await res.json()) as { log: DailyLog };
  return data.log;
}

