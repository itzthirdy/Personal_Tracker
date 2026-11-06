import {
  computeGithubShade,
  type AuthResponse,
  type AuthUser,
  type CalendarDaySummary,
  type CalendarEventInput,
  type CalendarEventItem,
  type CategoryInfo,
  type CategoryRecord,
  type ConsistencyStats,
  type DailyLog,
  type DayOfWeek,
  type MonthlyCalendarResponse,
  type RoutineRecord,
  type WeeklyInsights,
  type WorkspaceCard,
  type WorkspaceCardStatus,
  type WorkspaceModuleKey,
} from "@/types/tracker";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const TRACKER_API = `${API_BASE_URL}/tracker`;

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
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
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
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
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
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
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
      id: "fallback-calendar",
      userId: "local",
      title: "Calendar",
      moduleKey: "calendar",
      icon: "calendar",
      coverImage:
        "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=1200&q=80",
      route: "/dashboard/calendar",
      order: 2,
      status: "active",
      livePreview: { subtitle: "Schedule & Events" },
    },
    {
      id: "fallback-finance",
      userId: "local",
      title: "Finance",
      moduleKey: "finance",
      icon: "wallet",
      coverImage:
        "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80",
      route: "/dashboard/finance",
      order: 3,
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
      order: 4,
      status: "coming_soon",
      livePreview: { subtitle: "Coming Soon" },
    },
  ];
}

export async function fetchWorkspaceHub(): Promise<WorkspaceCard[]> {
  const res = await fetch(`${API_BASE_URL}/hub`, {
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
  const res = await fetch(`${API_BASE_URL}/hub/cards`, {
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
  const res = await fetch(`${API_BASE_URL}/hub/cards/${cardId}`, {
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
  const res = await fetch(`${API_BASE_URL}/hub/cards/${cardId}`, {
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

function getDayOfWeekFromDate(dateStr: string): DayOfWeek {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return DAYS_OF_WEEK[utc.getUTCDay()] ?? "monday";
}

/** Zero-state fallback used when the backend is unreachable: no hardcoded habits. */
export function buildFallbackDailyLog(date: string): DailyLog {
  const shade = computeGithubShade(0, 0);
  return {
    date,
    dayOfWeek: getDayOfWeekFromDate(date),
    items: [],
    completedCount: 0,
    totalCount: 0,
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
  const daysOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDayIndex = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString(
    "en-US",
    { month: "long", timeZone: "UTC" }
  );
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const shade = computeGithubShade(0, 0);
  const days: CalendarDaySummary[] = [];

  for (let d = 1; d <= daysOfMonth; d++) {
    const date = `${prefix}${String(d).padStart(2, "0")}`;
    days.push({
      date,
      dayOfMonth: d,
      dayOfWeek: getDayOfWeekFromDate(date),
      completedCount: 0,
      totalCount: 0,
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
    daysInMonth: daysOfMonth,
    firstDayIndex,
    summary: { perfectDays: 0, activeDays: 0, monthlyCompletionPercentage: 0 },
    days,
  };
}

async function trackerRequest<T>(
  path: string,
  init: RequestInit = {},
  json = false
): Promise<T> {
  const res = await fetch(`${TRACKER_API}${path}`, {
    cache: "no-store",
    ...init,
    headers: getAuthHeaders(
      json ? { "Content-Type": "application/json" } : undefined
    ),
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // no body
  }
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export function fetchMonthlyCalendar(
  year: number,
  month: number
): Promise<MonthlyCalendarResponse> {
  return trackerRequest(`/calendar?year=${year}&month=${month}`);
}

export async function fetchDailyLog(date: string): Promise<DailyLog> {
  const data = await trackerRequest<{ log: DailyLog }>(`/logs/${date}`);
  return data.log;
}

export function fetchStats(): Promise<ConsistencyStats> {
  return trackerRequest("/stats");
}

export async function apiToggleHabitItem(
  date: string,
  itemId: string,
  completed: boolean
): Promise<DailyLog> {
  const data = await trackerRequest<{ log: DailyLog }>(
    `/logs/${date}/items/${itemId}`,
    { method: "PATCH", body: JSON.stringify({ completed }) },
    true
  );
  return data.log;
}

export async function apiSetAllHabitItems(
  date: string,
  completed: boolean
): Promise<DailyLog> {
  const data = await trackerRequest<{ log: DailyLog }>(
    `/logs/${date}/check-all`,
    { method: "PATCH", body: JSON.stringify({ completed }) },
    true
  );
  return data.log;
}

export async function apiRemoveHabitItem(
  date: string,
  itemId: string
): Promise<DailyLog> {
  const data = await trackerRequest<{ log: DailyLog }>(
    `/logs/${date}/items/${itemId}`,
    { method: "DELETE" }
  );
  return data.log;
}

// ----- Categories -----

export async function fetchCategories(): Promise<CategoryRecord[]> {
  const data = await trackerRequest<{ categories: CategoryRecord[] }>(
    "/categories"
  );
  return data.categories;
}

export async function apiCreateCategory(
  input: CategoryInfo
): Promise<CategoryRecord> {
  const data = await trackerRequest<{ category: CategoryRecord }>(
    "/categories",
    { method: "POST", body: JSON.stringify(input) },
    true
  );
  return data.category;
}

export function apiDeleteCategory(
  idOrName: string
): Promise<{
  deletedId: string;
  deletedName?: string;
  fallbackCategory?: CategoryInfo;
}> {
  return trackerRequest(`/categories/${encodeURIComponent(idOrName)}`, {
    method: "DELETE",
  });
}

// ----- Routines (master recurring entities) -----

export async function fetchRoutines(): Promise<RoutineRecord[]> {
  const data = await trackerRequest<{ routines: RoutineRecord[] }>("/routines");
  return data.routines;
}

export interface RoutineInput {
  title: string;
  category?: CategoryInfo | null;
  daysOfWeek?: number[];
  specificDate?: string;
  startDate?: string;
}

export async function apiCreateRoutine(
  input: RoutineInput
): Promise<RoutineRecord> {
  const data = await trackerRequest<{ routine: RoutineRecord }>(
    "/routines",
    { method: "POST", body: JSON.stringify(input) },
    true
  );
  return data.routine;
}

export async function apiUpdateRoutine(
  id: string,
  updates: Partial<Pick<RoutineInput, "title" | "category" | "daysOfWeek">>
): Promise<RoutineRecord> {
  const data = await trackerRequest<{ routine: RoutineRecord }>(
    `/routines/${id}`,
    { method: "PUT", body: JSON.stringify(updates) },
    true
  );
  return data.routine;
}

export interface BulkDeleteResult {
  mode: "all" | "day";
  requestedCount: number;
  deletedCount: number;
  updatedCount: number;
  skippedCount: number;
}

export function apiBulkDeleteRoutines(payload: {
  routineIds: string[];
  mode: "all" | "day";
  dayOfWeek?: number;
  specificDate?: string;
}): Promise<BulkDeleteResult> {
  return trackerRequest(
    "/routines/bulk-delete",
    { method: "POST", body: JSON.stringify(payload) },
    true
  );
}

// ----- Weekly insights -----

export function fetchWeeklyInsights(
  startDate: string,
  forceRefresh = false
): Promise<WeeklyInsights> {
  const params = new URLSearchParams({ startDate });
  if (forceRefresh) {
    params.set("forceRefresh", "true");
    params.set("t", String(Date.now()));
  }
  return trackerRequest(`/insights/weekly?${params.toString()}`);
}

// ==========================================
// 4. Calendar & Schedule API
// ==========================================

const CALENDAR_API = `${API_BASE_URL}/calendar`;

export async function fetchCalendarEvents(
  start?: string,
  end?: string
): Promise<CalendarEventItem[]> {
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  const query = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(`${CALENDAR_API}/events${query}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch calendar events: ${res.status}`);
  }
  const data = (await res.json()) as { events: CalendarEventItem[] };
  return data.events || [];
}

export async function apiCreateCalendarEvent(
  input: CalendarEventInput
): Promise<CalendarEventItem> {
  const res = await fetch(`${CALENDAR_API}/events`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Failed to create event (${res.status})`);
  }
  return data.event as CalendarEventItem;
}

export async function apiUpdateCalendarEvent(
  id: string,
  updates: Partial<CalendarEventInput>
): Promise<CalendarEventItem> {
  const res = await fetch(`${CALENDAR_API}/events/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Failed to update event (${res.status})`);
  }
  return data.event as CalendarEventItem;
}

export async function apiDeleteCalendarEvent(id: string): Promise<void> {
  const res = await fetch(`${CALENDAR_API}/events/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `Failed to delete event (${res.status})`);
  }
}
