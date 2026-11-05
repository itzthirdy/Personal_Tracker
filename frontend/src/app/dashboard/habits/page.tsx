"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import HeatmapCalendar from "@/components/HeatmapCalendar";
import DailyChecklist from "@/components/DailyChecklist";
import RoutineManagerModal from "@/components/RoutineManagerModal";
import WeeklyInsightsCard from "@/components/WeeklyInsightsCard";
import { dayIndexOf, mondayOf } from "@/lib/categories";
import {
  apiCreateCategory,
  apiCreateRoutine,
  apiDeleteCategory,
  apiRemoveHabitItem,
  apiSetAllHabitItems,
  apiToggleHabitItem,
  buildFallbackCalendar,
  buildFallbackDailyLog,
  fetchCategories,
  fetchDailyLog,
  fetchMonthlyCalendar,
  fetchStats,
  getStoredUser,
} from "@/lib/api";
import {
  computeGithubShade,
  type AuthUser,
  type CategoryInfo,
  type CategoryRecord,
  type ConsistencyStats,
  type DailyLog,
  type MonthlyCalendarResponse,
} from "@/types/tracker";

// Static initial date constant so Next.js 16 cacheComponents never sees `new Date()` during render
const INITIAL_FALLBACK_DATE = "2026-11-03";

function getClientTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function HabitsInsideWindowPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [year, setYear] = useState<number>(2026);
  const [month, setMonth] = useState<number>(11);
  const [selectedDate, setSelectedDate] = useState<string>(
    INITIAL_FALLBACK_DATE
  );

  const [calendar, setCalendar] = useState<MonthlyCalendarResponse>(() =>
    buildFallbackCalendar(2026, 11)
  );
  const [dailyLog, setDailyLog] = useState<DailyLog>(() =>
    buildFallbackDailyLog(INITIAL_FALLBACK_DATE)
  );
  const [stats, setStats] = useState<ConsistencyStats | null>(null);
  const [backendConnected, setBackendConnected] = useState<boolean>(true);
  const [loadingLog, setLoadingLog] = useState<boolean>(false);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [managerOpen, setManagerOpen] = useState<boolean>(false);
  const [insightsSignal, setInsightsSignal] = useState<number>(0);

  // Sync client's real current date and user session inside useEffect (after mount)
  useEffect(() => {
    setUser(getStoredUser());
    const today = getClientTodayDateString();
    setYear(Number(today.slice(0, 4)));
    setMonth(Number(today.slice(5, 7)));
    setSelectedDate(today);
  }, []);

  const syncLogIntoCalendar = useCallback((updatedLog: DailyLog) => {
    setCalendar((prev) => {
      const [logYear, logMonth, logDay] = updatedLog.date.split("-").map(Number);
      if (prev.year !== logYear || prev.month !== logMonth) {
        return prev;
      }

      const updatedDays = prev.days.map((d) => {
        if (d.dayOfMonth !== logDay) return d;
        return {
          ...d,
          completedCount: updatedLog.completedCount,
          totalCount: updatedLog.totalCount,
          completionPercentage: updatedLog.completionPercentage,
          shadeLevel: updatedLog.shadeLevel,
          shadeColor: updatedLog.shadeColor,
          shadeLabel: updatedLog.shadeLabel,
          isFullyCompleted:
            updatedLog.totalCount > 0 &&
            updatedLog.completedCount === updatedLog.totalCount,
        };
      });

      const perfectDays = updatedDays.filter((d) => d.isFullyCompleted).length;
      const activeDays = updatedDays.filter((d) => d.completedCount > 0).length;
      const totalCompleted = updatedDays.reduce(
        (acc, d) => acc + d.completedCount,
        0
      );
      const totalScheduled = updatedDays.reduce(
        (acc, d) => acc + d.totalCount,
        0
      );

      return {
        ...prev,
        summary: {
          perfectDays,
          activeDays,
          monthlyCompletionPercentage:
            totalScheduled > 0
              ? Math.round((totalCompleted / totalScheduled) * 100)
              : 0,
        },
        days: updatedDays,
      };
    });
  }, []);

  // Load calendar & stats whenever year/month changes
  useEffect(() => {
    let active = true;
    async function loadMonthAndStats() {
      try {
        const [calData, statsData] = await Promise.all([
          fetchMonthlyCalendar(year, month),
          fetchStats(),
        ]);
        if (!active) return;
        setCalendar(calData);
        setStats(statsData);
        setBackendConnected(true);
      } catch {
        if (!active) return;
        setBackendConnected(false);
        setCalendar(buildFallbackCalendar(year, month));
      }
    }
    loadMonthAndStats();
    return () => {
      active = false;
    };
  }, [year, month]);

  // Load daily checklist whenever selectedDate changes
  useEffect(() => {
    let active = true;
    async function loadSelectedDay() {
      setLoadingLog(true);
      try {
        const log = await fetchDailyLog(selectedDate);
        if (!active) return;
        setDailyLog(log);
        syncLogIntoCalendar(log);
        setBackendConnected(true);
      } catch {
        if (!active) return;
        setBackendConnected(false);
        const fallback = buildFallbackDailyLog(selectedDate);
        setDailyLog(fallback);
      } finally {
        if (active) setLoadingLog(false);
      }
    }
    loadSelectedDay();
    return () => {
      active = false;
    };
  }, [selectedDate, syncLogIntoCalendar]);

  const refreshStats = useCallback(async () => {
    try {
      const s = await fetchStats();
      setStats(s);
    } catch {
      // ignore if offline
    }
  }, []);

  const handleToggleItem = useCallback(
    async (itemId: string, nextCompleted: boolean) => {
      const optimisticItems = dailyLog.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              completed: nextCompleted,
              completedAt: nextCompleted ? "completed" : null,
            }
          : item
      );
      const completedCount = optimisticItems.filter((i) => i.completed).length;
      const totalCount = optimisticItems.length;
      const shade = computeGithubShade(completedCount, totalCount);

      const optimisticLog: DailyLog = {
        ...dailyLog,
        items: optimisticItems,
        completedCount,
        totalCount,
        completionPercentage: shade.percentage,
        shadeLevel: shade.level,
        shadeColor: shade.color,
        shadeLabel: shade.label,
      };

      setDailyLog(optimisticLog);
      syncLogIntoCalendar(optimisticLog);

      try {
        const serverLog = await apiToggleHabitItem(
          selectedDate,
          itemId,
          nextCompleted
        );
        setDailyLog(serverLog);
        syncLogIntoCalendar(serverLog);
        setBackendConnected(true);
        refreshStats();
        setInsightsSignal((n) => n + 1);
      } catch {
        setBackendConnected(false);
      }
    },
    [dailyLog, selectedDate, syncLogIntoCalendar, refreshStats]
  );

  const handleSetAllItems = useCallback(
    async (completed: boolean) => {
      const optimisticItems = dailyLog.items.map((item) => ({
        ...item,
        completed,
        completedAt: completed ? "completed" : null,
      }));
      const completedCount = completed ? optimisticItems.length : 0;
      const totalCount = optimisticItems.length;
      const shade = computeGithubShade(completedCount, totalCount);

      const optimisticLog: DailyLog = {
        ...dailyLog,
        items: optimisticItems,
        completedCount,
        totalCount,
        completionPercentage: shade.percentage,
        shadeLevel: shade.level,
        shadeColor: shade.color,
        shadeLabel: shade.label,
      };

      setDailyLog(optimisticLog);
      syncLogIntoCalendar(optimisticLog);

      try {
        const serverLog = await apiSetAllHabitItems(selectedDate, completed);
        setDailyLog(serverLog);
        syncLogIntoCalendar(serverLog);
        setBackendConnected(true);
        refreshStats();
        setInsightsSignal((n) => n + 1);
      } catch {
        setBackendConnected(false);
      }
    },
    [dailyLog, selectedDate, syncLogIntoCalendar, refreshStats]
  );

  // Reload the selected day + month heatmap from the server (after schedule changes)
  const reloadDay = useCallback(async () => {
    try {
      const [log, cal] = await Promise.all([
        fetchDailyLog(selectedDate),
        fetchMonthlyCalendar(year, month),
      ]);
      setDailyLog(log);
      setCalendar(cal);
      setBackendConnected(true);
      refreshStats();
    } catch {
      setBackendConnected(false);
    }
    setInsightsSignal((n) => n + 1);
  }, [selectedDate, year, month, refreshStats]);

  // Load the user's custom genres once
  useEffect(() => {
    let active = true;
    fetchCategories()
      .then((list) => {
        if (active) setCategories(list);
      })
      .catch(() => {
        // offline: keep empty list
      });
    return () => {
      active = false;
    };
  }, []);

  const handleCreateCategory = useCallback(
    async (input: CategoryInfo): Promise<CategoryRecord> => {
      const created = await apiCreateCategory(input);
      setCategories((prev) => [...prev, created]);
      return created;
    },
    []
  );

  const handleDeleteCategory = useCallback(
    async (idOrName: string, categoryName: string) => {
      const targetLower = categoryName.toLowerCase();
      if (targetLower === "general") return;

      // Optimistically remove the custom genre pill and fall back matching items to General
      setCategories((prev) =>
        prev.filter(
          (c) => c.id !== idOrName && c.name.toLowerCase() !== targetLower
        )
      );
      setDailyLog((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.category.name.toLowerCase() === targetLower
            ? {
                ...item,
                category: {
                  name: "General",
                  color: "#801E0F",
                  icon: "sparkles",
                },
              }
            : item
        ),
      }));

      try {
        await apiDeleteCategory(idOrName);
      } catch {
        // resync below
      }
      await reloadDay();
    },
    [reloadDay]
  );

  const handleCreateRoutine = useCallback(
    async (input: {
      title: string;
      category: CategoryInfo | null;
      repeat: boolean;
    }) => {
      await apiCreateRoutine({
        title: input.title,
        category: input.category,
        ...(input.repeat
          ? {
              daysOfWeek: [dayIndexOf(selectedDate)],
              startDate: mondayOf(selectedDate),
            }
          : { specificDate: selectedDate }),
      });
      await reloadDay();
    },
    [selectedDate, reloadDay]
  );

  const handleRemoveItem = useCallback(
    async (itemId: string) => {
      // Optimistic removal; the server decides what is deleted vs. preserved.
      const nextItems = dailyLog.items.filter((i) => i.id !== itemId);
      const completedCount = nextItems.filter((i) => i.completed).length;
      const shade = computeGithubShade(completedCount, nextItems.length);
      const optimisticLog: DailyLog = {
        ...dailyLog,
        items: nextItems,
        completedCount,
        totalCount: nextItems.length,
        completionPercentage: shade.percentage,
        shadeLevel: shade.level,
        shadeColor: shade.color,
        shadeLabel: shade.label,
      };
      setDailyLog(optimisticLog);
      syncLogIntoCalendar(optimisticLog);

      try {
        await apiRemoveHabitItem(selectedDate, itemId);
      } catch {
        // fall through to reload to resync with the server
      }
      await reloadDay();
    },
    [dailyLog, selectedDate, syncLogIntoCalendar, reloadDay]
  );

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const handleGoToToday = () => {
    const today = getClientTodayDateString();
    setYear(Number(today.slice(0, 4)));
    setMonth(Number(today.slice(5, 7)));
    setSelectedDate(today);
  };

  const bannerMetrics = useMemo(() => {
    const currentStreak =
      stats?.currentStreak ?? (dailyLog.completedCount > 0 ? 1 : 0);

    const weeklyRate =
      stats && stats.totalDaysTracked > 0
        ? stats.weeklyCompletionRate
        : dailyLog.completionPercentage;

    const bestDay =
      stats && stats.bestDayOfWeek && stats.bestDayOfWeek !== "—"
        ? stats.bestDayOfWeek
        : dailyLog.completedCount > 0
          ? dailyLog.dayOfWeek.charAt(0).toUpperCase() +
            dailyLog.dayOfWeek.slice(1)
          : "Monday";

    return {
      currentStreak,
      weeklyRate,
      bestDay,
    };
  }, [stats, dailyLog]);

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#f0f6fc]">
      {/* Top Breadcrumb Bar (Back to My Dashboard Window Hub) */}
      <header className="border-b border-[#30363d] bg-[#161b22]/85 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#21262d] hover:bg-[#30363d] text-gray-200 border border-[#30363d] transition-colors flex items-center gap-1.5"
            >
              <span>←</span>
              <span>My Dashboard</span>
            </Link>

            <span className="text-gray-600">/</span>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#39d353] flex items-center justify-center text-[#090d16] font-extrabold text-xs shadow-[0_0_10px_rgba(57,211,83,0.45)]">
                ✓
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Routine &amp; Habit Tracker
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <span className="text-xs text-gray-400 hidden sm:inline">
                @{user.username}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                backendConnected
                  ? "bg-[#0e4429]/50 text-[#39d353] border-[#26a641]/40"
                  : "bg-[#801E0F]/40 text-amber-300 border-[#991b1b]"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  backendConnected ? "bg-[#39d353]" : "bg-amber-400"
                }`}
              />
              {backendConnected ? "API Connected" : "Local Preview Mode"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 1. Top Summary Banner (3 Cards) */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Current Streak
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                {bannerMetrics.currentStreak}{" "}
                <span className="text-base font-semibold text-gray-400">
                  {bannerMetrics.currentStreak === 1 ? "day" : "days"}
                </span>{" "}
                🔥
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Keep checking off daily habits to build momentum
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#801E0F]/30 border border-[#991b1b]/60 flex items-center justify-center text-xl">
              🔥
            </div>
          </div>

          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Weekly Completion Rate
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#39d353] mt-1">
                {bannerMetrics.weeklyRate}%
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                {calendar.summary.activeDays} active{" "}
                {calendar.summary.activeDays === 1 ? "day" : "days"} this month
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#0e4429]/60 border border-[#26a641]/40 flex items-center justify-center text-xl">
              📈
            </div>
          </div>

          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Best Day of the Week
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                {bannerMetrics.bestDay}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Highest routine completion consistency
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#21262d] border border-[#30363d] flex items-center justify-center text-xl">
              🏆
            </div>
          </div>
        </section>

        {/* 2. Split View Grid: Left Heatmap Calendar | Right Daily Checklist */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7">
            <HeatmapCalendar
              calendar={calendar}
              selectedDate={selectedDate}
              onSelectDate={(date) => setSelectedDate(date)}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onGoToToday={handleGoToToday}
            />
          </div>

          <div className="lg:col-span-5">
            <DailyChecklist
              log={dailyLog}
              loading={loadingLog}
              categories={categories}
              onToggleItem={handleToggleItem}
              onSetAllItems={handleSetAllItems}
              onCreateRoutine={handleCreateRoutine}
              onCreateCategory={handleCreateCategory}
              onDeleteCategory={handleDeleteCategory}
              onRemoveItem={handleRemoveItem}
              onOpenManager={() => setManagerOpen(true)}
            />
          </div>
        </section>

        {/* 3. Weekly Consistency & AI Coach */}
        <WeeklyInsightsCard
          weekAnchorDate={selectedDate}
          refreshSignal={insightsSignal}
          onSelectWeekDate={(mondayDate) => {
            setSelectedDate(mondayDate);
            setYear(Number(mondayDate.slice(0, 4)));
            setMonth(Number(mondayDate.slice(5, 7)));
          }}
        />
      </main>

      {managerOpen && (
        <RoutineManagerModal
          open
          onClose={() => setManagerOpen(false)}
          categories={categories}
          onCreateCategory={handleCreateCategory}
          onDeleteCategory={handleDeleteCategory}
          startDate={mondayOf(selectedDate)}
          onChanged={reloadDay}
        />
      )}
    </div>
  );
}

