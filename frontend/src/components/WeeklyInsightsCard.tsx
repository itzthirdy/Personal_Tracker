"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import CategoryBadge from "@/components/CategoryBadge";
import { fetchWeeklyInsights } from "@/lib/api";
import { addDaysToDate, formatMonthDay, mondayOf } from "@/lib/categories";
import type { WeeklyInsights } from "@/types/tracker";

interface WeeklyInsightsCardProps {
  /** Any YYYY-MM-DD date; the card analyses that date's Monday–Sunday week. */
  weekAnchorDate: string;
  /** Increment to force a re-fetch (e.g. after routines or checkboxes change). */
  refreshSignal: number;
  /** Optional callback to sync the parent dashboard's selectedDate when navigating weeks. */
  onSelectWeekDate?: (mondayDate: string) => void;
}

function rateColor(rate: number): string {
  if (rate >= 80) return "#39d353";
  if (rate >= 50) return "#26a641";
  return "#d97706";
}

export default function WeeklyInsightsCard({
  weekAnchorDate,
  refreshSignal,
  onSelectWeekDate,
}: WeeklyInsightsCardProps) {
  // Derived weekStart that automatically resets to mondayOf(weekAnchorDate) whenever weekAnchorDate changes
  const [weekOverride, setWeekOverride] = useState<{
    anchor: string;
    monday: string;
  } | null>(null);

  const weekStart = useMemo(() => {
    if (weekOverride && weekOverride.anchor === weekAnchorDate) {
      return weekOverride.monday;
    }
    return mondayOf(weekAnchorDate);
  }, [weekAnchorDate, weekOverride]);

  const computedWeekEnd = useMemo(
    () => addDaysToDate(weekStart, 6),
    [weekStart]
  );

  const [insights, setInsights] = useState<WeeklyInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual force-refresh (bypasses server cache and requests fresh Gemini AI response)
  const handleForceRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const fresh = await fetchWeeklyInsights(weekStart, true);
      setInsights(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh insights");
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, [weekStart]);

  const handleShiftWeek = useCallback(
    (deltaDays: number) => {
      const nextMonday = addDaysToDate(weekStart, deltaDays);
      setWeekOverride({ anchor: weekAnchorDate, monday: nextMonday });
      setLoading(true);
      onSelectWeekDate?.(nextMonday);
    },
    [weekStart, weekAnchorDate, onSelectWeekDate]
  );

  // Auto-load on mount, when weekStart changes, or when refreshSignal increments (debounced by 400ms)
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      fetchWeeklyInsights(weekStart, false)
        .then((data) => {
          if (!active) return;
          setInsights(data);
          setError(null);
        })
        .catch((err) => {
          if (active) {
            setError(
              err instanceof Error ? err.message : "Could not load insights"
            );
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [weekStart, refreshSignal]);

  const isGemini =
    insights?.source === "gemini-ai" ||
    insights?.coach?.source === "gemini-ai" ||
    insights?.coach?.source === "gemini";

  const coachSummary =
    insights?.insightText ??
    insights?.coach?.insightText ??
    insights?.coach?.summary ??
    "No analysis available yet.";

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-white tracking-tight">
            Weekly Consistency &amp; AI Coach
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <button
              type="button"
              onClick={() => handleShiftWeek(-7)}
              className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#0d1117] hover:bg-[#21262d] text-gray-300 hover:text-white border border-[#30363d] transition-colors cursor-pointer"
              title="Previous Week"
            >
              &lt; Prev Week
            </button>
            <span className="text-xs font-medium text-gray-300 px-1">
              Week of {formatMonthDay(weekStart)} –{" "}
              {formatMonthDay(insights?.weekEnd ?? computedWeekEnd)}
            </span>
            <button
              type="button"
              onClick={() => handleShiftWeek(7)}
              className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#0d1117] hover:bg-[#21262d] text-gray-300 hover:text-white border border-[#30363d] transition-colors cursor-pointer"
              title="Next Week"
            >
              Next Week &gt;
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {insights && (
            <span className="text-xs text-gray-400">
              Discipline score{" "}
              <strong
                className="text-base font-extrabold"
                style={{ color: rateColor(insights.disciplineScore) }}
              >
                {insights.disciplineScore}%
              </strong>
            </span>
          )}
          <button
            type="button"
            onClick={handleForceRefresh}
            disabled={loading || isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#21262d] hover:bg-[#30363d] text-gray-200 border border-[#30363d] disabled:opacity-50 cursor-pointer transition-colors"
          >
            <span className={isRefreshing ? " inline-block animate-spin" : ""}>
              ↻
            </span>
            <span>
              {isRefreshing || loading ? "Analyzing..." : "Refresh Analysis"}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-[#801E0F]/30 border border-[#991b1b] text-xs text-red-200">
          {error}
        </div>
      )}

      {/* AI Coach callout */}
      <div className="mb-5 rounded-xl border border-[#801E0F]/60 bg-[#801E0F]/10 p-4">
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-200">
            🤖 Coach insight
          </span>
          {insights && (
            <span
              className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                isGemini
                  ? "bg-[#0e4429]/60 border-[#39d353]/50 text-[#39d353]"
                  : "bg-[#21262d] border-[#30363d] text-gray-400"
              }`}
              title={
                insights.coach.fallbackReason
                  ? `Fallback note: ${insights.coach.fallbackReason}`
                  : undefined
              }
            >
              {isGemini ? "✨ Gemini AI Coach" : "Rule-based coach"}
            </span>
          )}
        </div>
        {loading && !insights ? (
          <div className="h-10 rounded bg-[#21262d] animate-pulse" />
        ) : (
          <p className="text-sm text-gray-200 leading-relaxed">{coachSummary}</p>
        )}
      </div>

      {/* Per-habit progress */}
      {insights && insights.habits.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-4">
          No habits scheduled this week. Add routines to see per-habit progress.
        </p>
      ) : (
        <div className="space-y-3.5">
          {insights?.habits.map((h) => (
            <div key={h.habitId}>
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-gray-100 truncate">
                    {h.habitTitle}
                  </span>
                  <CategoryBadge category={h.category} size="xs" />
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {h.completedDaysCount} / {h.scheduledDaysCount} days completed ·{" "}
                  <strong style={{ color: rateColor(h.consistencyRate) }}>
                    {h.consistencyRate}% Efficiency
                  </strong>
                </span>
              </div>
              <div className="w-full h-2 bg-[#21262d] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${h.consistencyRate}%`,
                    backgroundColor: rateColor(h.consistencyRate),
                  }}
                />
              </div>
              <p className="mt-1 text-[11px] text-gray-500">{h.feedback}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
