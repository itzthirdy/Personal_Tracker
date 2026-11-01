"use client";

import React, { useMemo, useState } from "react";
import {
  GITHUB_SHADE_COLORS,
  type CalendarDaySummary,
  type MonthlyCalendarResponse,
  type ShadeLevel,
} from "@/types/tracker";

interface HeatmapCalendarProps {
  calendar: MonthlyCalendarResponse;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onGoToToday: () => void;
}

type CalendarViewMode = "monthly" | "strip";

const WEEKDAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_SHORT_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatShortMonthDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function HeatmapCalendar({
  calendar,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onGoToToday,
}: HeatmapCalendarProps) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>("monthly");
  const [hoveredDay, setHoveredDay] = useState<CalendarDaySummary | null>(null);

  // Build leading and trailing padding days so the 7-column grid looks like a full calendar
  const { leadingPaddingDays, trailingPaddingDays, weeksForStrip } =
    useMemo(() => {
      const prevMonthLastDay = new Date(
        Date.UTC(calendar.year, calendar.month - 1, 0)
      ).getUTCDate();

      const leading: number[] = [];
      for (let i = calendar.firstDayIndex - 1; i >= 0; i--) {
        leading.push(prevMonthLastDay - i);
      }

      const totalFilled = leading.length + calendar.days.length;
      const remainder = totalFilled % 7;
      const trailingCount = remainder === 0 ? 0 : 7 - remainder;
      const trailing: number[] = [];
      for (let i = 1; i <= trailingCount; i++) {
        trailing.push(i);
      }

      // Group into 7-row columns (weeks) for the Commit Strip view
      type StripCell =
        | { kind: "padding"; dayNumber: number; key: string }
        | { kind: "active"; day: CalendarDaySummary; key: string };

      const allCells: StripCell[] = [
        ...leading.map((d, idx) => ({
          kind: "padding" as const,
          dayNumber: d,
          key: `lead-${idx}`,
        })),
        ...calendar.days.map((day) => ({
          kind: "active" as const,
          day,
          key: day.date,
        })),
        ...trailing.map((d, idx) => ({
          kind: "padding" as const,
          dayNumber: d,
          key: `trail-${idx}`,
        })),
      ];

      const weeks: StripCell[][] = [];
      for (let i = 0; i < allCells.length; i += 7) {
        weeks.push(allCells.slice(i, i + 7));
      }

      return {
        leadingPaddingDays: leading,
        trailingPaddingDays: trailing,
        weeksForStrip: weeks,
      };
    }, [calendar]);

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 shadow-xl flex flex-col justify-between">
      {/* Top Bar: Title & View Mode Toggle */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
              <span>Routine Heatmap</span>
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-[#21262d] text-gray-300 border border-[#30363d]">
                {calendar.summary.perfectDays} Perfect{" "}
                {calendar.summary.perfectDays === 1 ? "Day" : "Days"}
              </span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Click any date square to inspect or check off routines
            </p>
          </div>

          {/* View Toggle Switch */}
          <div className="inline-flex items-center bg-[#0d1117] p-1 rounded-lg border border-[#30363d]">
            <button
              type="button"
              onClick={() => setViewMode("monthly")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                viewMode === "monthly"
                  ? "bg-[#801E0F] text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Monthly View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("strip")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                viewMode === "strip"
                  ? "bg-[#801E0F] text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Commit Strip
            </button>
          </div>
        </div>

        {/* Month Navigation Header */}
        <div className="flex items-center justify-between bg-[#0d1117]/80 border border-[#30363d] rounded-lg px-4 py-2.5 mb-5">
          <button
            type="button"
            onClick={onPrevMonth}
            aria-label="Previous Month"
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#21262d] transition-colors cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <div className="flex items-center gap-3">
            <span className="text-base font-semibold text-white">
              {calendar.monthName} {calendar.year}
            </span>
            <button
              type="button"
              onClick={onGoToToday}
              className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#21262d] text-gray-300 hover:text-white hover:bg-[#30363d] border border-[#30363d] transition-colors cursor-pointer"
            >
              Today
            </button>
          </div>

          <button
            type="button"
            onClick={onNextMonth}
            aria-label="Next Month"
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#21262d] transition-colors cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        {/* View 1: Standard 7-Column Monthly Calendar Grid */}
        {viewMode === "monthly" ? (
          <div>
            {/* Weekday column labels */}
            <div className="grid grid-cols-7 gap-2.5 mb-2 text-center">
              {WEEKDAY_HEADERS.map((label, idx) => (
                <div
                  key={`header-${idx}`}
                  className="text-xs font-semibold text-gray-400 tracking-wider py-1"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* 7-column calendar cells */}
            <div className="grid grid-cols-7 gap-2.5">
              {/* Leading padding days (previous month) */}
              {leadingPaddingDays.map((dayNum, idx) => (
                <div
                  key={`prev-${idx}`}
                  className="aspect-square rounded-lg bg-[#21262d] border border-[#30363d]/50 flex items-center justify-center text-sm font-medium text-gray-500 opacity-25 pointer-events-none select-none"
                >
                  {String(dayNum).padStart(2, "0")}
                </div>
              ))}

              {/* Active month days */}
              {calendar.days.map((day) => {
                const isSelected = day.date === selectedDate;
                const isFull = day.shadeLevel === 4;
                const bgColor =
                  GITHUB_SHADE_COLORS[day.shadeLevel]?.color ?? "#21262d";

                return (
                  <div key={day.date} className="relative group">
                    <button
                      type="button"
                      onClick={() => onSelectDate(day.date)}
                      onMouseEnter={() => setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                      style={{
                        backgroundColor: bgColor,
                        boxShadow: isFull
                          ? "0 0 14px rgba(57, 211, 83, 0.45)"
                          : undefined,
                      }}
                      className={`w-full aspect-square rounded-lg flex flex-col items-center justify-center transition-all duration-150 cursor-pointer relative ${
                        isSelected
                          ? "ring-2 ring-[#991b1b] ring-offset-2 ring-offset-[#161b22] scale-[1.04] z-10"
                          : "hover:scale-[1.04] border border-[#30363d]/80 hover:border-gray-400/60"
                      }`}
                    >
                      <span
                        className={`text-sm font-bold ${
                          day.shadeLevel === 4
                            ? "text-[#090d16]"
                            : "text-white"
                        }`}
                      >
                        {String(day.dayOfMonth).padStart(2, "0")}
                      </span>

                      {/* Mini indicator dot for active selected date */}
                      {isSelected && (
                        <span className="mt-0.5 px-1.5 py-[1px] rounded-full text-[9px] font-semibold bg-[#801E0F] text-white leading-tight shadow">
                          Active
                        </span>
                      )}
                    </button>

                    {/* Floating Hover Popover Tooltip */}
                    {hoveredDay?.date === day.date && (
                      <div className="pointer-events-none absolute -top-11 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap rounded-md bg-[#090d16] border border-[#30363d] px-2.5 py-1.5 text-[11px] font-medium text-gray-100 shadow-2xl">
                        <span className="font-semibold text-white">
                          {formatShortMonthDay(day.date)}:
                        </span>{" "}
                        {day.completedCount}/{day.totalCount} habits done •{" "}
                        <span
                          className={
                            day.completionPercentage === 100
                              ? "text-[#39d353] font-bold"
                              : "text-gray-300"
                          }
                        >
                          {day.completionPercentage}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Trailing padding days (next month) */}
              {trailingPaddingDays.map((dayNum, idx) => (
                <div
                  key={`next-${idx}`}
                  className="aspect-square rounded-lg bg-[#21262d] border border-[#30363d]/50 flex items-center justify-center text-sm font-medium text-gray-500 opacity-25 pointer-events-none select-none"
                >
                  {String(dayNum).padStart(2, "0")}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* View 2: Horizontal Scrolling GitHub Commit Strip View */
          <div className="space-y-4">
            {/* Traditional GitHub Week-Columns Matrix */}
            <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4 overflow-x-auto">
              <div className="text-xs font-medium text-gray-400 mb-3 flex items-center justify-between">
                <span>GitHub Contribution Matrix ({calendar.monthName})</span>
                <span className="text-[11px] text-gray-500">
                  Scroll horizontally →
                </span>
              </div>

              <div className="flex items-start gap-3 min-w-max">
                {/* Day-of-week row labels */}
                <div className="grid grid-rows-7 gap-2 pr-1 text-[10px] font-medium text-gray-400">
                  {WEEKDAY_SHORT_LABELS.map((d) => (
                    <div key={d} className="h-8 flex items-center">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Week columns */}
                <div className="flex gap-2">
                  {weeksForStrip.map((week, wIdx) => (
                    <div key={`week-${wIdx}`} className="grid grid-rows-7 gap-2">
                      {week.map((cell) => {
                        if (cell.kind === "padding") {
                          return (
                            <div
                              key={cell.key}
                              className="w-8 h-8 rounded-md bg-[#21262d] border border-[#30363d]/40 flex items-center justify-center text-[10px] text-gray-500 opacity-25 pointer-events-none select-none"
                            >
                              {cell.dayNumber}
                            </div>
                          );
                        }

                        const { day } = cell;
                        const isSelected = day.date === selectedDate;
                        const isFull = day.shadeLevel === 4;
                        const bgColor =
                          GITHUB_SHADE_COLORS[day.shadeLevel]?.color ??
                          "#21262d";

                        return (
                          <div key={cell.key} className="relative">
                            <button
                              type="button"
                              onClick={() => onSelectDate(day.date)}
                              onMouseEnter={() => setHoveredDay(day)}
                              onMouseLeave={() => setHoveredDay(null)}
                              style={{
                                backgroundColor: bgColor,
                                boxShadow: isFull
                                  ? "0 0 10px rgba(57, 211, 83, 0.45)"
                                  : undefined,
                              }}
                              className={`w-8 h-8 rounded-md flex items-center justify-center text-[11px] font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? "ring-2 ring-[#991b1b] ring-offset-1 ring-offset-[#0d1117] scale-110 z-10"
                                  : "border border-[#30363d]/80 hover:scale-105"
                              } ${
                                isFull ? "text-[#090d16]" : "text-gray-100"
                              }`}
                            >
                              {day.dayOfMonth}
                            </button>

                            {hoveredDay?.date === day.date && (
                              <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap rounded-md bg-[#090d16] border border-[#30363d] px-2.5 py-1 text-[11px] font-medium text-gray-100 shadow-2xl">
                                {formatShortMonthDay(day.date)}:{" "}
                                {day.completedCount}/{day.totalCount} habits
                                done • {day.completionPercentage}%
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Linear Horizontal Day Strip for Quick Scanning */}
            <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4">
              <div className="text-xs font-medium text-gray-400 mb-2.5">
                Linear Daily Commit Strip (Day 01 – Day {calendar.daysInMonth})
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1">
                {calendar.days.map((day) => {
                  const isSelected = day.date === selectedDate;
                  const isFull = day.shadeLevel === 4;
                  const bgColor =
                    GITHUB_SHADE_COLORS[day.shadeLevel]?.color ?? "#21262d";

                  return (
                    <button
                      key={`strip-${day.date}`}
                      type="button"
                      onClick={() => onSelectDate(day.date)}
                      title={`${formatShortMonthDay(day.date)}: ${day.completedCount}/${day.totalCount} habits done • ${day.completionPercentage}%`}
                      style={{
                        backgroundColor: bgColor,
                        boxShadow: isFull
                          ? "0 0 10px rgba(57, 211, 83, 0.4)"
                          : undefined,
                      }}
                      className={`shrink-0 w-10 h-12 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? "ring-2 ring-[#991b1b] ring-offset-2 ring-offset-[#0d1117]"
                          : "border border-[#30363d]/70 hover:border-gray-400"
                      }`}
                    >
                      <span
                        className={`text-[10px] uppercase font-medium ${
                          isFull ? "text-[#090d16]/80" : "text-gray-400"
                        }`}
                      >
                        {day.dayOfWeek.slice(0, 3)}
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          isFull ? "text-[#090d16]" : "text-white"
                        }`}
                      >
                        {String(day.dayOfMonth).padStart(2, "0")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Legend: GitHub Contribution Shades & Selected Badge */}
      <div className="mt-6 pt-4 border-t border-[#30363d] flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm bg-[#801E0F] ring-1 ring-[#991b1b]" />
          <span>Selected Date</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-400 mr-1">Less</span>
          {([0, 1, 2, 3, 4] as ShadeLevel[]).map((lvl) => (
            <span
              key={lvl}
              title={GITHUB_SHADE_COLORS[lvl].label}
              style={{
                backgroundColor: GITHUB_SHADE_COLORS[lvl].color,
                boxShadow:
                  lvl === 4 ? "0 0 8px rgba(57, 211, 83, 0.5)" : undefined,
              }}
              className="w-4 h-4 rounded-[4px] border border-[#30363d]/80 inline-block"
            />
          ))}
          <span className="text-[11px] text-gray-400 ml-1">More (100%)</span>
        </div>
      </div>
    </div>
  );
}

