import {
  computeGithubShade,
  type AuthResponse,
  type AuthUser,
  type CalendarDaySummary,
  type ConsistencyStats,
  type DailyChecklistItem,
  type DailyLog,
  type DayOfWeek,
  type HabitCategory,
  type MonthlyCalendarResponse,
  type WorkspaceCard,
  type WorkspaceCardStatus,
  type WorkspaceModuleKey,
} from "@/types/tracker";

const API_ROOT =
  process.env.NEXT_PUBLIC_API_ROOT ?? "http://localhost:8000/api";
const TRACKER_API = `${API_ROOT}/tracker`;

const TOKEN_STORAGE_KEY = "personal_tracker_jwt";
const USER_STORAGE_KEY = "personal_tracker_user";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function saveAuthSession(token: string, user: AuthUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
}

function getAuthHeaders(extraHeaders?: Record<string, string>): HeadersInit {
  const token = getStoredToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
}

// ==========================================
// 1. Auth API
// ==========================================

export async function apiRegister(
  username: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_ROOT}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Registration failed");
  }
  saveAuthSession(data.token, data.user);
  return data as AuthResponse;
}

export async function apiLogin(
  identifier: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_ROOT}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Login failed");
  }
  saveAuthSession(data.token, data.user);
  return data as AuthResponse;
}

export async function apiGetMe(): Promise<AuthUser> {
  const res = await fetch(`${API_ROOT}/auth/me`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Unauthorized");
  }
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

// ==========================================
// 2. Workspace Hub API (Notion-style Cards)
// ==========================================

export function getFallbackWorkspaceCards(): WorkspaceCard[] {
  return [
    {
      id: "fallback-habits",
      userId: "local",
      title: "Routine & Habit Tracker",
      moduleKey: "habits",
      icon: "target",
      coverImage:
        "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=1200&q=80",
      route: "/dashboard/habits",
      order: 1,
      status: "active",
      livePreview: {
        consistencyScore: 0,
        currentStreak: 0,
        todayProgress: {
          completedCount: 0,
          totalCount: 10,
          completionPercentage: 0,
        },
      },
    },
    {
      id: "fallback-finances",
      userId: "local",
      title: "Finances",
      moduleKey: "finances",
      icon: "wallet",
      coverImage:
        "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80",
      route: "/dashboard/finances",
      order: 2,
      status: "coming_soon",
      livePreview: { subtitle: "Coming Soon" },
    },
    {
      id: "fallback-exercise",
      userId: "local",
      title: "Exercise",
      moduleKey: "exercise",
      icon: "dumbbell",
      coverImage:
        "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80",
      route: "/dashboard/exercise",
      order: 3,
      status: "coming_soon",
      livePreview: { subtitle: "Coming Soon" },
    },
  ];
}

export async function fetchWorkspaceHub(): Promise<WorkspaceCard[]> {
  const res = await fetch(`${API_ROOT}/hub`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch workspace hub: ${res.status}`);
  }
  const data = (await res.json()) as { cards: WorkspaceCard[] };
  return data.cards;
}

export async function apiCreateWorkspaceCard(input: {
  title: string;
  icon?: string;
  coverImage?: string;
  route?: string;
  moduleKey?: WorkspaceModuleKey;
  status?: WorkspaceCardStatus;
}): Promise<WorkspaceCard> {
  const res = await fetch(`${API_ROOT}/hub/cards`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Failed to create workspace card: ${res.status}`);
  }
  const data = (await res.json()) as { card: WorkspaceCard };
  return data.card;
}

export async function apiUpdateWorkspaceCard(
  cardId: string,
  updates: Partial<{
    title: string;
    icon: string;
    coverImage: string;
    order: number;
    status: WorkspaceCardStatus;
  }>
): Promise<WorkspaceCard> {
  const res = await fetch(`${API_ROOT}/hub/cards/${cardId}`, {
    method: "PATCH",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    throw new Error(`Failed to update workspace card: ${res.status}`);
  }
  const data = (await res.json()) as { card: WorkspaceCard };
  return data.card;
}

export async function apiDeleteWorkspaceCard(cardId: string): Promise<void> {
  const res = await fetch(`${API_ROOT}/hub/cards/${cardId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Failed to delete workspace card: ${res.status}`);
  }
}

// ==========================================
// 3. Routine & Habit Tracker API
// ==========================================

const DAYS_OF_WEEK: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

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
  const res = await fetch(
    `${TRACKER_API}/calendar?year=${year}&month=${month}`,
    {
      headers: getAuthHeaders(),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch calendar: ${res.status}`);
  }
  return res.json();
}

export async function fetchDailyLog(date: string): Promise<DailyLog> {
  const res = await fetch(`${TRACKER_API}/logs/${date}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch daily log: ${res.status}`);
  }
  const data = (await res.json()) as { log: DailyLog };
  return data.log;
}

export async function fetchStats(): Promise<ConsistencyStats> {
  const res = await fetch(`${TRACKER_API}/stats`, {
    headers: getAuthHeaders(),
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
  const res = await fetch(`${TRACKER_API}/logs/${date}/items/${itemId}`, {
    method: "PATCH",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
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
  const res = await fetch(`${TRACKER_API}/logs/${date}/check-all`, {
    method: "PATCH",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
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
  const res = await fetch(`${TRACKER_API}/logs/${date}/items`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
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
  const res = await fetch(`${TRACKER_API}/logs/${date}/items/${itemId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Failed to delete item: ${res.status}`);
  }
  const data = (await res.json()) as { log: DailyLog };
  return data.log;
}
