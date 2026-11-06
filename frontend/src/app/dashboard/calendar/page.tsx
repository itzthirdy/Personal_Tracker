"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MonthView from "@/components/calendar/MonthView";
import WeekView from "@/components/calendar/WeekView";
import EventModal from "@/components/calendar/EventModal";
import { fetchCalendarEvents, fetchCategories, getStoredUser } from "@/lib/api";
import type {
  AuthUser,
  CalendarEventItem,
  CategoryRecord,
} from "@/types/tracker";

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(dateStr: string, days: number): string {
  const dt = parseDate(dateStr);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatDate(dt);
}

/** Returns the Sunday on/before the given YYYY-MM-DD date. */
function sundayOf(dateStr: string): string {
  const d = parseDate(dateStr);
  const idx = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - idx);
  return formatDate(d);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CalendarHubPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [view, setView] = useState<"month" | "week">("month");

  // Fallback initial date (Nov 3, 2026)
  const [todayDate, setTodayDate] = useState<string>("2026-11-03");
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(11); // 1-12
  const [activeWeekStart, setActiveWeekStart] = useState<string>("2026-11-01");

  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventItem | null>(null);
  const [modalDate, setModalDate] = useState<string>("2026-11-03");
  const [modalStartTime, setModalStartTime] = useState<string>("09:00");
  const [modalEndTime, setModalEndTime] = useState<string>("10:00");

  // Initialize with real client date and fetch categories on mount
  useEffect(() => {
    setUser(getStoredUser());
    const now = new Date();
    const yr = now.getFullYear();
    const mn = now.getMonth() + 1;
    const dy = now.getDate();
    const dateStr = `${yr}-${String(mn).padStart(2, "0")}-${String(dy).padStart(2, "0")}`;

    setTodayDate(dateStr);
    setCurrentYear(yr);
    setCurrentMonth(mn);
    setActiveWeekStart(sundayOf(dateStr));
    setModalDate(dateStr);

    fetchCategories()
      .then((cats) => setCategories(cats))
      .catch(() => {});
  }, []);

  // Compute date query range for current view
  const queryRange = useMemo(() => {
    if (view === "month") {
      // Fetch 35 days before first day of month to 35 days after last day of month
      const firstDay = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
      const lastDay = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(
        new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate()
      ).padStart(2, "0")}`;
      return {
        start: addDays(firstDay, -10),
        end: addDays(lastDay, 10),
      };
    } else {
      // Active week (Sunday to Saturday)
      return {
        start: activeWeekStart,
        end: addDays(activeWeekStart, 7),
      };
    }
  }, [view, currentYear, currentMonth, activeWeekStart]);

  // Load events for the current active range
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCalendarEvents(queryRange.start, queryRange.end);
      setEvents(data);
    } catch {
      // offline: keep existing
    } finally {
      setLoading(false);
    }
  }, [queryRange]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Navigation handlers
  const handlePrev = () => {
    if (view === "month") {
      if (currentMonth === 1) {
        setCurrentYear((y) => y - 1);
        setCurrentMonth(12);
      } else {
        setCurrentMonth((m) => m - 1);
      }
    } else {
      setActiveWeekStart((prev) => addDays(prev, -7));
    }
  };

  const handleNext = () => {
    if (view === "month") {
      if (currentMonth === 12) {
        setCurrentYear((y) => y + 1);
        setCurrentMonth(1);
      } else {
        setCurrentMonth((m) => m + 1);
      }
    } else {
      setActiveWeekStart((prev) => addDays(prev, 7));
    }
  };

  const handleToday = () => {
    const now = new Date();
    const yr = now.getFullYear();
    const mn = now.getMonth() + 1;
    const dy = now.getDate();
    const dateStr = `${yr}-${String(mn).padStart(2, "0")}-${String(dy).padStart(2, "0")}`;

    setCurrentYear(yr);
    setCurrentMonth(mn);
    setActiveWeekStart(sundayOf(dateStr));
  };

  // Header Title
  const headerDateLabel = useMemo(() => {
    if (view === "month") {
      const name = MONTH_NAMES[currentMonth - 1] ?? "Month";
      return `${name} ${currentYear}`;
    } else {
      const weekEnd = addDays(activeWeekStart, 6);
      const startParts = activeWeekStart.split("-").map(Number);
      const endParts = weekEnd.split("-").map(Number);
      const sMonth = MONTH_NAMES[(startParts[1] ?? 1) - 1]?.slice(0, 3);
      const eMonth = MONTH_NAMES[(endParts[1] ?? 1) - 1]?.slice(0, 3);

      if (sMonth === eMonth) {
        return `${sMonth} ${startParts[2]} – ${endParts[2]}, ${startParts[0]}`;
      }
      return `${sMonth} ${startParts[2]} – ${eMonth} ${endParts[2]}, ${endParts[0]}`;
    }
  }, [view, currentYear, currentMonth, activeWeekStart]);

  // Click handlers for creating / editing events
  const handleOpenCreateModal = (dateStr?: string, hourStr?: string) => {
    setEditingEvent(null);
    setModalDate(dateStr || todayDate);
    const start = hourStr || "09:00";
    setModalStartTime(start);
    const [h, m] = start.split(":").map(Number);
    const nextH = Math.min((h ?? 9) + 1, 23);
    setModalEndTime(`${String(nextH).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`);
    setModalOpen(true);
  };

  const handleOpenEditModal = (event: CalendarEventItem) => {
    setEditingEvent(event);
    setModalDate(event.startDate);
    setModalStartTime(event.startTime);
    setModalEndTime(event.endTime);
    setModalOpen(true);
  };

  const handleEventSaved = () => {
    loadEvents();
  };

  const handleEventDeleted = () => {
    loadEvents();
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#f0f6fc] flex flex-col">
      {/* Top Breadcrumb & Status Header */}
      <header className="border-b border-[#30363d] bg-[#161b22]/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#21262d] hover:bg-[#30363d] text-gray-200 border border-[#30363d] transition-colors flex items-center gap-1.5"
            >
              <span>←</span>
              <span>Workspace Hub</span>
            </Link>

            <span className="text-gray-600">/</span>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#801E0F] flex items-center justify-center text-white font-extrabold text-xs shadow-[0_0_10px_rgba(128,30,15,0.45)]">
                📅
              </div>
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Calendar &amp; Schedule
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <span className="text-xs text-gray-400 hidden sm:inline">
                @{user.username}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-[#0e4429]/50 text-[#39d353] border-[#26a641]/40">
              <span className="w-2 h-2 rounded-full bg-[#39d353]" />
              Schedule Engine Active
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 flex-1 flex flex-col">
        {/* Top Google Calendar Toolbar */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-4">
          {/* Left: Navigation Controls (<, >, Today, Date Title) */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center bg-[#0d1117] border border-[#30363d] rounded-lg p-0.5">
              <button
                type="button"
                onClick={handlePrev}
                title="Previous"
                className="w-8 h-8 rounded flex items-center justify-center text-gray-300 hover:text-white hover:bg-[#21262d] transition-colors cursor-pointer text-sm"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={handleNext}
                title="Next"
                className="w-8 h-8 rounded flex items-center justify-center text-gray-300 hover:text-white hover:bg-[#21262d] transition-colors cursor-pointer text-sm"
              >
                ›
              </button>
            </div>

            <button
              type="button"
              onClick={handleToday}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#21262d] hover:bg-[#30363d] text-gray-200 border border-[#30363d] transition-colors cursor-pointer"
            >
              Today
            </button>

            <span className="text-base sm:text-lg font-bold text-white tracking-tight ml-1 font-serif">
              {headerDateLabel}
            </span>
          </div>

          {/* Right: View Switcher (Month / Week) + Add Schedule Button */}
          <div className="flex items-center gap-3">
            {/* View Switcher Tabs */}
            <div className="grid grid-cols-2 bg-[#0d1117] border border-[#30363d] p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setView("month")}
                className={`px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
                  view === "month"
                    ? "bg-[#801E0F] text-white shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setView("week")}
                className={`px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
                  view === "week"
                    ? "bg-[#801E0F] text-white shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Week
              </button>
            </div>

            {/* "+ Add Schedule" Button */}
            <button
              type="button"
              onClick={() => handleOpenCreateModal()}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#801E0F] hover:bg-[#991b1b] text-white flex items-center gap-1.5 shadow-[0_0_12px_rgba(128,30,15,0.4)] transition-all cursor-pointer"
            >
              <span className="text-sm leading-none">+</span>
              <span>Add Schedule</span>
            </button>
          </div>
        </div>

        {/* Active Calendar View Container */}
        <div className="flex-1 min-h-[500px]">
          {loading && events.length === 0 ? (
            <div className="h-96 rounded-2xl bg-[#161b22] border border-[#30363d] animate-pulse flex items-center justify-center text-xs text-gray-500">
              Loading Schedule...
            </div>
          ) : view === "month" ? (
            <MonthView
              year={currentYear}
              month={currentMonth}
              events={events}
              todayDate={todayDate}
              onSelectDate={(dateStr) => handleOpenCreateModal(dateStr)}
              onSelectEvent={(ev) => handleOpenEditModal(ev)}
            />
          ) : (
            <WeekView
              activeWeekStart={activeWeekStart}
              events={events}
              todayDate={todayDate}
              onSelectSlot={(dateStr, hourStr) => handleOpenCreateModal(dateStr, hourStr)}
              onSelectEvent={(ev) => handleOpenEditModal(ev)}
            />
          )}
        </div>
      </main>

      {/* Schedule Item Modal */}
      <EventModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleEventSaved}
        onDeleted={handleEventDeleted}
        initialDate={modalDate}
        initialStartTime={modalStartTime}
        initialEndTime={modalEndTime}
        initialEvent={editingEvent}
        categories={categories}
      />
    </div>
  );
}

