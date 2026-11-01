export type DayOfWeek =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export type HabitCategory =
  | "routine"
  | "workout"
  | "school"
  | "study"
  | "chores"
  | "work"
  | "custom";

export interface TemplateChecklistItem {
  id: string;
  title: string;
  category: HabitCategory;
  order: number;
}

export interface DayRoutineTemplate {
  dayOfWeek: DayOfWeek;
  dayIndex: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  label: string;
  items: TemplateChecklistItem[];
}

export interface GithubShadeInfo {
  level: 0 | 1 | 2 | 3 | 4;
  color: string;
  label: string;
}

/**
 * GitHub-inspired contribution shade palette:
 * - If everything is checked (100%), it turns bright light green (level 4).
 * - As fewer items are checked, the green shade darkens (levels 3 -> 2 -> 1).
 * - If nothing is checked (0%), it stays dark neutral (level 0).
 */
export const GITHUB_GREEN_SHADES: Record<0 | 1 | 2 | 3 | 4, GithubShadeInfo> = {
  0: {
    level: 0,
    color: "#21262d",
    label: "No habits completed",
  },
  1: {
    level: 1,
    color: "#0e4429",
    label: "Low consistency (darkest green)",
  },
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

export const DAYS_OF_WEEK: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const DEFAULT_WEEKLY_SCHEDULE: DayRoutineTemplate[] = [
  {
    dayOfWeek: "monday",
    dayIndex: 1,
    label: "Monday",
    items: [
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
  },
  {
    dayOfWeek: "tuesday",
    dayIndex: 2,
    label: "Tuesday",
    items: [
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
  },
  {
    dayOfWeek: "wednesday",
    dayIndex: 3,
    label: "Wednesday",
    items: [
      { id: "wed-1", title: "Wake Up & Get ready", category: "routine", order: 1 },
      { id: "wed-2", title: "Commute to School", category: "routine", order: 2 },
      { id: "wed-3", title: "Self Study in Library", category: "study", order: 3 },
      { id: "wed-4", title: "App Dev & Emerging Tech (408MB)", category: "school", order: 4 },
      { id: "wed-5", title: "Info Assurance & Security (408MB)", category: "school", order: 5 },
      { id: "wed-6", title: "Head Home", category: "routine", order: 6 },
      { id: "wed-7", title: "Bath, Dinner & Sleep", category: "routine", order: 7 },
    ],
  },
  {
    dayOfWeek: "thursday",
    dayIndex: 4,
    label: "Thursday",
    items: [
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
  },
  {
    dayOfWeek: "friday",
    dayIndex: 5,
    label: "Friday",
    items: [
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
  },
  {
    dayOfWeek: "saturday",
    dayIndex: 6,
    label: "Saturday",
    items: [
      { id: "sat-1", title: "Wake Up & Get ready", category: "routine", order: 1 },
      { id: "sat-2", title: "Commute to School", category: "routine", order: 2 },
      { id: "sat-3", title: "Self Study in Library", category: "study", order: 3 },
      { id: "sat-4", title: "Breakfast / Break", category: "routine", order: 4 },
      { id: "sat-5", title: "App Dev & Emerging Tech (501MB)", category: "school", order: 5 },
      { id: "sat-6", title: "Info Assurance & Security (501MB)", category: "school", order: 6 },
      { id: "sat-7", title: "Head Home", category: "routine", order: 7 },
      { id: "sat-8", title: "Bath, Dinner & Sleep", category: "routine", order: 8 },
    ],
  },
  {
    dayOfWeek: "sunday",
    dayIndex: 0,
    label: "Sunday",
    items: [
      { id: "sun-1", title: "Work - Grab", category: "work", order: 1 },
      { id: "sun-2", title: "Ironing clothes", category: "chores", order: 2 },
      { id: "sun-3", title: "Washing Clothes", category: "chores", order: 3 },
      { id: "sun-4", title: "Cooking meal prep", category: "chores", order: 4 },
      { id: "sun-5", title: "Prepare for next week", category: "routine", order: 5 },
    ],
  },
];

