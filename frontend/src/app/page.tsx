"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import HeatmapCalendar from "@/components/HeatmapCalendar";
import DailyChecklist from "@/components/DailyChecklist";
import {
  apiAddCustomHabitItem,
  apiRemoveHabitItem,
  apiSetAllHabitItems,
  apiToggleHabitItem,
  buildFallbackCalendar,
  buildFallbackDailyLog,
  fetchDailyLog,
  fetchMonthlyCalendar,
  fetchStats,
} from "@/lib/api";
import {
  computeGithubShade,
  type ConsistencyStats,
  type DailyLog,
  type HabitCategory,
  type MonthlyCalendarResponse,
} from "@/types/tracker";

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function TrackerDashboardPage() {
  const initialDate = useMemo(() => getTodayDateString(), []);
  const [year, setYear] = useState<number>(() =>
    Number(initialDate.slice(0, 4))
  );
  const [month, setMonth] = useState<number>(() =>
    Number(initialDate.slice(5, 7))
  );
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);

  const [calendar, setCalendar] = useState<MonthlyCalendarResponse>(() =>
    buildFallbackCalendar(
      Number(initialDate.slice(0, 4)),
      Number(initialDate.slice(5, 7))
    )
  );
  const [dailyLog, setDailyLog] = useState<DailyLog>(() =>
    buildFallbackDailyLog(initialDate)
  );
  const [stats, setStats] = useState<ConsistencyStats | null>(null);
  const [backendConnected, setBackendConnected] = useState<boolean>(true);
  const [loadingLog, setLoadingLog] = useState<boolean>(false);

  // Sync a DailyLog update into the current MonthlyCalendarResponse state
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

  // Optimistic toggle of a single habit item
  const handleToggleItem = useCallback(
    async (itemId: string, nextCompleted: boolean) => {
      const optimisticItems = dailyLog.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              completed: nextCompleted,
              completedAt: nextCompleted ? new Date().toISOString() : null,
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
      } catch {
        setBackendConnected(false);
      }
    },
    [dailyLog, selectedDate, syncLogIntoCalendar, refreshStats]
  );

  // Optimistic check-all / uncheck-all
  const handleSetAllItems = useCallback(
    async (completed: boolean) => {
      const now = completed ? new Date().toISOString() : null;
      const optimisticItems = dailyLog.items.map((item) => ({
        ...item,
        completed,
        completedAt: now,
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
      } catch {
        setBackendConnected(false);
      }
    },
    [dailyLog, selectedDate, syncLogIntoCalendar, refreshStats]
  );

  // Add custom routine/habit item
  const handleAddCustomItem = useCallback(
    async (title: string, category: HabitCategory) => {
      try {
        const serverLog = await apiAddCustomHabitItem(
          selectedDate,
          title,
          category
        );
        setDailyLog(serverLog);
        syncLogIntoCalendar(serverLog);
        setBackendConnected(true);
        refreshStats();
      } catch {
        // Offline optimistic add
        const nextOrder =
          dailyLog.items.reduce((max, i) => Math.max(max, i.order), 0) + 1;
        const nextItems = [
          ...dailyLog.items,
          {
            id: `custom-${Date.now()}`,
            title,
            category,
            completed: false,
            completedAt: null,
            order: nextOrder,
          },
        ];
        const shade = computeGithubShade(
          dailyLog.completedCount,
          nextItems.length
        );
        const optimisticLog: DailyLog = {
          ...dailyLog,
          items: nextItems,
          totalCount: nextItems.length,
          completionPercentage: shade.percentage,
          shadeLevel: shade.level,
          shadeColor: shade.color,
          shadeLabel: shade.label,
        };
        setDailyLog(optimisticLog);
        syncLogIntoCalendar(optimisticLog);
      }
    },
    [dailyLog, selectedDate, syncLogIntoCalendar, refreshStats]
  );

  // Remove habit item
  const handleRemoveItem = useCallback(
    async (itemId: string) => {
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
        const serverLog = await apiRemoveHabitItem(selectedDate, itemId);
        setDailyLog(serverLog);
        syncLogIntoCalendar(serverLog);
        refreshStats();
      } catch {
        // keep optimistic state if backend offline
      }
    },
    [dailyLog, selectedDate, syncLogIntoCalendar, refreshStats]
  );

  // Month Navigation handlers
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
    const today = getTodayDateString();
    setYear(Number(today.slice(0, 4)));
    setMonth(Number(today.slice(5, 7)));
    setSelectedDate(today);
  };

  // Compute live banner metrics combining server stats & active calendar state
  const bannerMetrics = useMemo(() => {
    const currentStreak =
      stats?.currentStreak ??
      (dailyLog.completedCount > 0 ? 1 : 0);

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
      {/* Top Navbar */}
      <header className="border-b border-[#30363d] bg-[#161b22]/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#39d353] flex items-center justify-center text-[#090d16] font-extrabold text-sm shadow-[0_0_12px_rgba(57,211,83,0.45)]">
              ✓
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Personal Routine &amp; Habit Tracker
              </h1>
              <p className="text-[11px] text-gray-400 hidden sm:block">
                GitHub-inspired consistency tracker • Monday to Sunday Schedule
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
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
          {/* Card 1: Current Streak */}
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

          {/* Card 2: Weekly Completion Rate */}
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

          {/* Card 3: Best Day of the Week */}
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
              onToggleItem={handleToggleItem}
              onSetAllItems={handleSetAllItems}
              onAddCustomItem={handleAddCustomItem}
              onRemoveItem={handleRemoveItem}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
