import type { CategoryInfo } from "../config/defaultSchedule";
import {
  addDays,
  getDayIndex,
  getMergedLogsForDates,
  mondayOnOrBefore,
  todayUtcDateString,
} from "./tracker.service";

export interface HabitInsight {
  habitId: string;
  habitTitle: string;
  category: CategoryInfo;
  scheduledDaysCount: number;
  completedDaysCount: number;
  consistencyRate: number; // 0-100
  feedback: string;
}

export type CoachSource = "gemini-ai" | "rule-based";

export interface WeeklyInsights {
  weekStart: string; // Monday
  weekEnd: string; // Sunday
  daysElapsed: number; // 7 days in the target Mon-Sun week
  disciplineScore: number; // overall % across all habits
  totalScheduled: number;
  totalCompleted: number;
  bestHabit: { title: string; consistencyRate: number } | null;
  weakestHabit: { title: string; consistencyRate: number } | null;
  habits: HabitInsight[];
  source: CoachSource;
  insightText: string;
  coach: {
    source: CoachSource;
    summary: string;
    insightText: string;
    fallbackReason?: string;
  };
}

// ------------------------------------------------------------
// Server-Side Insight Cache (Keyed by `${userId}:${startDate}`)
// ------------------------------------------------------------

interface CachedInsightEntry {
  signature: string;
  insightText: string;
  source: "gemini-ai" | "rule-based";
  timestamp: number;
}

const weeklyInsightCache = new Map<string, CachedInsightEntry>();
const inFlightGeminiRequests = new Map<string, Promise<string>>();

// ------------------------------------------------------------
// Deterministic heuristic engine (always available)
// ------------------------------------------------------------

function habitFeedback(
  title: string,
  completed: number,
  scheduled: number,
  rate: number
): string {
  const stat = `${completed}/${scheduled} days (${rate}%)`;
  if (rate < 50) {
    const target = Math.min(scheduled, completed + 1);
    return `${title}: ${stat} — this one is slipping. Anchor it to a fixed time and aim for at least ${target} completion${target === 1 ? "" : "s"} next week.`;
  }
  if (rate < 80) {
    return `${title}: ${stat} — solid momentum. One more completion per week would push it past 80%.`;
  }
  return `${title}: ${stat} — excellent consistency. Keep the streak alive.`;
}

function heuristicSummary(
  insights: Omit<WeeklyInsights, "coach" | "source" | "insightText">
): string {
  if (insights.habits.length === 0) {
    return "No routines were scheduled for this week yet. Add your first habit in the Routine Manager or Quick Add panel to start tracking your consistency.";
  }

  const score = insights.disciplineScore;
  const opener =
    score >= 80
      ? `Outstanding week (${insights.weekStart} to ${insights.weekEnd}) — a ${score}% discipline score (${insights.totalCompleted}/${insights.totalScheduled} check-ins).`
      : score >= 50
        ? `Decent momentum (${insights.weekStart} to ${insights.weekEnd}) — a ${score}% discipline score (${insights.totalCompleted}/${insights.totalScheduled} check-ins).`
        : `Building momentum (${insights.weekStart} to ${insights.weekEnd}) — a ${score}% discipline score (${insights.totalCompleted}/${insights.totalScheduled} check-ins); every check-in counts.`;

  const parts = [opener];
  if (insights.bestHabit) {
    parts.push(
      `Strongest habit: ${insights.bestHabit.title} at ${insights.bestHabit.consistencyRate}%.`
    );
  }
  if (
    insights.weakestHabit &&
    insights.weakestHabit.title !== insights.bestHabit?.title
  ) {
    parts.push(
      `Focus next on ${insights.weakestHabit.title} (${insights.weakestHabit.consistencyRate}%): pick one fixed time slot for it and protect it.`
    );
  }
  return parts.join(" ");
}

// ------------------------------------------------------------
// Gemini coach (Multi-Model Cascade & 15s Timeout Resilience)
// ------------------------------------------------------------

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-flash-latest",
] as const;

const GEMINI_TIMEOUT_MS = 15_000;

function readGeminiApiKey(): string | undefined {
  const raw = process.env.GEMINI_API_KEY;
  if (!raw) return undefined;
  const cleaned = raw.trim().replace(/^["']|["']$/g, "").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function buildModelEndpoint(model: string, apiKey: string): string {
  if (apiKey.startsWith("AQ.")) {
    return `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;
  }
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;
}

async function generateGeminiSummary(
  apiKey: string,
  habitMetrics: Record<string, unknown>,
  hasHabits: boolean
): Promise<string> {
  const prompt = [
    "You are an encouraging, concise personal habit and routine coach.",
    "Below are the user's weekly habit adherence metrics as JSON for the selected week.",
    "Write a motivating coaching analysis of 2-3 sentences in plain text (no markdown, no bullet points).",
    hasHabits
      ? "Reference specific habits and their numbers (e.g. 'Gym 2/5 days is 40% efficiency') and finish with one actionable suggestion for improving consistency."
      : "The user has no habits scheduled for this week yet; encourage them warmly and suggest one simple daily keystone habit to add.",
    "",
    JSON.stringify(habitMetrics),
  ].join("\n");

  let lastError: Error | null = null;

  for (const model of GEMINI_MODELS) {
    try {
      const endpoint = buildModelEndpoint(model, apiKey);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
          },
        }),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      });

      if (!res.ok) {
        let errDetail = "";
        try {
          const errBody = await res.text();
          errDetail = errBody ? ` — ${errBody.slice(0, 240)}` : "";
        } catch {
          // ignore body parse failure
        }
        throw new Error(
          `HTTP ${res.status}${errDetail}`
        );
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("")
        .trim();

      if (!text) {
        throw new Error("Empty response from Gemini");
      }

      return text;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      lastError = error instanceof Error ? error : new Error(msg);
      console.warn(
        `⚠️ [Gemini AI Coach] Model "${model}" failed (${msg}) — failing over to next model...`
      );
      continue;
    }
  }

  throw lastError ?? new Error("All Gemini models in cascade failed");
}

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

export async function getWeeklyInsights(
  userId: string,
  startDate?: string,
  forceRefresh = false
): Promise<WeeklyInsights> {
  const anchor =
    startDate && startDate.trim() ? startDate.trim() : todayUtcDateString();
  getDayIndex(anchor); // validates YYYY-MM-DD format

  const weekStart = mondayOnOrBefore(anchor);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = weekDates[6] as string;

  // Evaluate all 7 days (Mon-Sun) of the selected week so past, current, and future weeks all work
  const views = await getMergedLogsForDates(userId, weekDates);

  const byHabit = new Map<
    string,
    { title: string; category: CategoryInfo; scheduled: number; completed: number }
  >();

  for (const view of views) {
    for (const item of view.items) {
      const key = item.routineId ?? item.id;
      const entry = byHabit.get(key) ?? {
        title: item.title,
        category: item.category,
        scheduled: 0,
        completed: 0,
      };
      entry.scheduled += 1;
      if (item.completed) entry.completed += 1;
      byHabit.set(key, entry);
    }
  }

  const habits: HabitInsight[] = Array.from(byHabit.entries())
    .map(([habitId, h]) => {
      const rate =
        h.scheduled > 0 ? Math.round((h.completed / h.scheduled) * 100) : 0;
      return {
        habitId,
        habitTitle: h.title,
        category: h.category,
        scheduledDaysCount: h.scheduled,
        completedDaysCount: h.completed,
        consistencyRate: rate,
        feedback: habitFeedback(h.title, h.completed, h.scheduled, rate),
      };
    })
    .sort(
      (a, b) =>
        b.consistencyRate - a.consistencyRate ||
        b.scheduledDaysCount - a.scheduledDaysCount
    );

  const totalScheduled = habits.reduce((s, h) => s + h.scheduledDaysCount, 0);
  const totalCompleted = habits.reduce((s, h) => s + h.completedDaysCount, 0);
  const disciplineScore =
    totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;

  const best = habits[0];
  const weakest = habits[habits.length - 1];

  const base: Omit<WeeklyInsights, "coach" | "source" | "insightText"> = {
    weekStart,
    weekEnd,
    daysElapsed: weekDates.length,
    disciplineScore,
    totalScheduled,
    totalCompleted,
    bestHabit: best
      ? { title: best.habitTitle, consistencyRate: best.consistencyRate }
      : null,
    weakestHabit: weakest
      ? { title: weakest.habitTitle, consistencyRate: weakest.consistencyRate }
      : null,
    habits,
  };

  const habitMetrics = {
    weekStart,
    weekEnd,
    disciplineScore,
    totalCompleted,
    totalScheduled,
    habits: habits.map((h) => ({
      habit: h.habitTitle,
      category: h.category.name,
      scheduledDays: h.scheduledDaysCount,
      completedDays: h.completedDaysCount,
      consistencyRate: h.consistencyRate,
    })),
  };

  const cacheKey = `${userId}:${weekStart}`;
  const signature = JSON.stringify(habitMetrics);

  const apiKey = readGeminiApiKey();
  if (apiKey) {
    // 1. Return cached "gemini-ai" insight in 0ms when signature matches and forceRefresh is false
    if (!forceRefresh) {
      const cached = weeklyInsightCache.get(cacheKey);
      if (
        cached &&
        cached.source === "gemini-ai" &&
        cached.signature === signature
      ) {
        return {
          ...base,
          source: "gemini-ai",
          insightText: cached.insightText,
          coach: {
            source: "gemini-ai",
            summary: cached.insightText,
            insightText: cached.insightText,
          },
        };
      }
    }

    // 2. Deduplicate concurrent in-flight requests for the same cacheKey + signature
    const inFlightKey = `${cacheKey}:${signature}`;
    try {
      let pending = !forceRefresh
        ? inFlightGeminiRequests.get(inFlightKey)
        : undefined;
      if (!pending) {
        pending = generateGeminiSummary(
          apiKey,
          habitMetrics,
          habits.length > 0
        ).finally(() => {
          inFlightGeminiRequests.delete(inFlightKey);
        });
        inFlightGeminiRequests.set(inFlightKey, pending);
      }

      const summary = await pending;
      weeklyInsightCache.set(cacheKey, {
        signature,
        insightText: summary,
        source: "gemini-ai",
        timestamp: Date.now(),
      });

      return {
        ...base,
        source: "gemini-ai",
        insightText: summary,
        coach: {
          source: "gemini-ai",
          summary,
          insightText: summary,
        },
      };
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Gemini request failed";
      console.error(
        `❌ [Gemini AI Coach] All models failed for week ${weekStart}; falling back to rule-based coach:`,
        reason
      );
      const fallback = heuristicSummary(base);
      return {
        ...base,
        source: "rule-based",
        insightText: fallback,
        coach: {
          source: "rule-based",
          summary: fallback,
          insightText: fallback,
          fallbackReason: reason,
        },
      };
    }
  }

  const fallback = heuristicSummary(base);
  return {
    ...base,
    source: "rule-based",
    insightText: fallback,
    coach: {
      source: "rule-based",
      summary: fallback,
      insightText: fallback,
    },
  };
}
