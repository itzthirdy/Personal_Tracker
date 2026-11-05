export type DayOfWeek =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export const DAYS_OF_WEEK: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/**
 * User-defined genre/category. Fully dynamic: there is no hardcoded list.
 * `icon` is a Lucide-style identifier (e.g. "book", "dumbbell", "code", "sparkles").
 */
export interface CategoryInfo {
  name: string;
  color: string;
  icon: string;
}

export const DEFAULT_CATEGORY_COLOR = "#801E0F";
export const DEFAULT_CATEGORY_ICON = "sparkles";

export const DEFAULT_CATEGORY: CategoryInfo = {
  name: "General",
  color: DEFAULT_CATEGORY_COLOR,
  icon: DEFAULT_CATEGORY_ICON,
};

const LEGACY_CATEGORY_MAP: Record<string, CategoryInfo> = {
  routine: DEFAULT_CATEGORY,
  custom: DEFAULT_CATEGORY,
  school: { name: "Academics", color: "#2563eb", icon: "book" },
  study: { name: "Study", color: "#7c3aed", icon: "book" },
  workout: { name: "Fitness", color: "#16a34a", icon: "dumbbell" },
  chores: { name: "Chores", color: "#d97706", icon: "home" },
  work: { name: "Work", color: "#0891b2", icon: "briefcase" },
};

function cleanString(value: unknown, fallback: string, maxLength = 40): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

/**
 * Accepts a CategoryInfo-like object, a legacy plain string ("school"), or
 * anything else, and always returns a valid CategoryInfo.
 */
export function normalizeCategory(input: unknown): CategoryInfo {
  if (typeof input === "string") {
    const key = input.trim().toLowerCase();
    if (!key) return { ...DEFAULT_CATEGORY };
    const legacy = LEGACY_CATEGORY_MAP[key];
    if (legacy) return { ...legacy };
    return { ...DEFAULT_CATEGORY, name: input.trim().slice(0, 40) };
  }

  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    return {
      name: cleanString(obj.name, DEFAULT_CATEGORY.name),
      color: cleanString(obj.color, DEFAULT_CATEGORY_COLOR),
      icon: cleanString(obj.icon, DEFAULT_CATEGORY_ICON),
    };
  }

  return { ...DEFAULT_CATEGORY };
}

export interface GithubShadeInfo {
  level: 0 | 1 | 2 | 3 | 4;
  color: string;
  label: string;
}

/**
 * GitHub-inspired contribution shade palette:
 * 100% completed -> bright neon green (level 4); fewer -> darker greens; 0% -> neutral.
 */
export const GITHUB_GREEN_SHADES: Record<0 | 1 | 2 | 3 | 4, GithubShadeInfo> = {
  0: { level: 0, color: "#21262d", label: "No habits completed" },
  1: { level: 1, color: "#0e4429", label: "Low consistency (darkest green)" },
  2: {
    level: 2,
    color: "#006d32",
    label: "Moderate consistency (medium-dark green)",
  },
  3: {
    level: 3,
    color: "#26a641",
    label: "High consistency (medium-light green)",
  },
  4: {
    level: 4,
    color: "#39d353",
    label: "All habits completed (bright light green)",
  },
};

export function calculateGithubShade(
  completedCount: number,
  totalCount: number
): GithubShadeInfo {
  if (totalCount <= 0 || completedCount <= 0) {
    return GITHUB_GREEN_SHADES[0];
  }

  if (completedCount >= totalCount) {
    return GITHUB_GREEN_SHADES[4];
  }

  const ratio = completedCount / totalCount;

  if (ratio >= 0.67) {
    return GITHUB_GREEN_SHADES[3];
  }
  if (ratio >= 0.34) {
    return GITHUB_GREEN_SHADES[2];
  }
  return GITHUB_GREEN_SHADES[1];
}
