export type HabitCategory =
  | "routine"
  | "workout"
  | "school"
  | "study"
  | "chores"
  | "work"
  | "custom";

export type DayOfWeek =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export type ShadeLevel = 0 | 1 | 2 | 3 | 4;

export interface DailyChecklistItem {
  id: string;
  title: string;
  category: HabitCategory;
  completed: boolean;
  completedAt: string | null;
  order: number;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  dayOfWeek: DayOfWeek;
  items: DailyChecklistItem[];
  completedCount: number;
  totalCount: number;
  completionPercentage: number;
  shadeLevel: ShadeLevel;
  shadeColor: string;
  shadeLabel: string;
  notes?: string;
}

export interface CalendarDaySummary {
  date: string;
  dayOfMonth: number;
  dayOfWeek: DayOfWeek;
  completedCount: number;
  totalCount: number;
  completionPercentage: number;
  shadeLevel: ShadeLevel;
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
  summary: {
    perfectDays: number;
    activeDays: number;
    monthlyCompletionPercentage: number;
  };
  days: CalendarDaySummary[];
}

export interface ConsistencyStats {
  storageMode: string;
  totalDaysTracked: number;
  activeDays: number;
  perfectDays: number;
  currentStreak: number;
  weeklyCompletionRate: number;
  bestDayOfWeek: string;
  totalTasksCompleted: number;
  totalTasksAssigned: number;
  overallCompletionPercentage: number;
}

export const GITHUB_SHADE_COLORS: Record<
  ShadeLevel,
  { color: string; label: string }
> = {
  0: { color: "#21262d", label: "No habits completed (0%)" },
  1: { color: "#0e4429", label: "Low consistency (1%–33%)" },
  2: { color: "#006d32", label: "Moderate consistency (34%–66%)" },
  3: { color: "#26a641", label: "High consistency (67%–99%)" },
  4: { color: "#39d353", label: "All habits completed (100%)" },
};

export function computeGithubShade(
  completedCount: number,
  totalCount: number
): { level: ShadeLevel; color: string; label: string; percentage: number } {
  if (totalCount <= 0 || completedCount <= 0) {
    return {
      level: 0,
      color: GITHUB_SHADE_COLORS[0].color,
      label: GITHUB_SHADE_COLORS[0].label,
      percentage: 0,
    };
  }

  const percentage = Math.round((completedCount / totalCount) * 100);

  if (completedCount >= totalCount) {
    return {
      level: 4,
      color: GITHUB_SHADE_COLORS[4].color,
      label: GITHUB_SHADE_COLORS[4].label,
      percentage: 100,
    };
  }

  const ratio = completedCount / totalCount;
  if (ratio >= 0.67) {
    return {
      level: 3,
      color: GITHUB_SHADE_COLORS[3].color,
      label: GITHUB_SHADE_COLORS[3].label,
      percentage,
    };
  }
  if (ratio >= 0.34) {
    return {
      level: 2,
      color: GITHUB_SHADE_COLORS[2].color,
      label: GITHUB_SHADE_COLORS[2].label,
      percentage,
    };
  }
  return {
    level: 1,
    color: GITHUB_SHADE_COLORS[1].color,
    label: GITHUB_SHADE_COLORS[1].label,
    percentage,
  };
}

