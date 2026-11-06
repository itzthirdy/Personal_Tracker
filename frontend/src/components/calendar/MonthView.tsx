"use client";

import React, { useMemo } from "react";
import type { CalendarEventItem } from "@/types/tracker";

interface MonthViewProps {
  year: number;
  month: number; // 1-12
  events: CalendarEventItem[];
  todayDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  onSelectEvent: (event: CalendarEventItem) => void;
}

interface CalendarCell {
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MonthView({
  year,
  month,
  events,
  todayDate,
  onSelectDate,
  onSelectEvent,
}: MonthViewProps) {
  const cells: CalendarCell[] = useMemo(() => {
    const list: CalendarCell[] = [];
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const firstDayIndex = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();

    // Previous month overflow
    const prevMonthDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const dateStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(
        dayNum
      ).padStart(2, "0")}`;
      list.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayDate,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(
        d
      ).padStart(2, "0")}`;
      list.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayDate,
      });
    }

    // Next month overflow
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const totalSlots = Math.ceil(list.length / 7) * 7;
    const trailingCount = totalSlots - list.length;

    for (let d = 1; d <= trailingCount; d++) {
      const dateStr = `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(
        d
      ).padStart(2, "0")}`;
      list.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayDate,
      });
    }

    return list;
  }, [year, month, todayDate]);

  // Index events by date for O(1) cell lookups
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    for (const ev of events) {
      const date = ev.startDate;
      const existing = map.get(date);
      if (existing) {
        existing.push(ev);
      } else {
        map.set(date, [ev]);
      }
    }
    // Sort each day's events by startTime ascending
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [events]);

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl shadow-xl overflow-hidden flex flex-col">
      {/* 7-Column Day Header Row */}
      <div className="grid grid-cols-7 border-b border-[#30363d] bg-[#0d1117]/80 text-center">
        {WEEKDAY_HEADERS.map((day, idx) => (
          <div
            key={day}
            className={`py-3 text-xs font-semibold uppercase tracking-wider ${
              idx === 0 || idx === 6 ? "text-gray-500" : "text-gray-300"
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 auto-rows-fr bg-[#0d1117] divide-x divide-y divide-[#30363d]/60">
        {cells.map((cell) => {
          const dayEvents = eventsByDate.get(cell.dateStr) || [];
          const visibleEvents = dayEvents.slice(0, 3);
          const hiddenCount = dayEvents.length - visibleEvents.length;

          return (
            <div
              key={cell.dateStr}
              onClick={() => onSelectDate(cell.dateStr)}
              className={`min-h-[110px] sm:min-h-[128px] p-2 flex flex-col transition-colors cursor-pointer group ${
                cell.isCurrentMonth
                  ? "bg-[#161b22] hover:bg-[#1c2129]"
                  : "bg-[#0d1117]/60 hover:bg-[#161b22]/50 opacity-45"
              }`}
            >
              {/* Day Number Header */}
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`inline-flex items-center justify-center text-xs font-semibold rounded-full w-6 h-6 transition-all ${
                    cell.isToday
                      ? "bg-[#801E0F] text-white shadow-[0_0_10px_rgba(128,30,15,0.4)] font-bold ring-2 ring-[#801E0F]/50"
                      : cell.isCurrentMonth
                      ? "text-gray-200 group-hover:text-white"
                      : "text-gray-500"
                  }`}
                >
                  {cell.dayNumber}
                </span>

                {dayEvents.length > 0 && (
                  <span className="text-[10px] text-gray-500 font-mono hidden sm:inline">
                    {dayEvents.length} {dayEvents.length === 1 ? "item" : "items"}
                  </span>
                )}
              </div>

              {/* Event Pills List */}
              <div className="flex-1 space-y-1 overflow-hidden">
                {visibleEvents.map((ev) => {
                  const catColor = ev.category?.color || "#801E0F";

                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(ev);
                      }}
                      style={{
                        borderLeftColor: catColor,
                        backgroundColor: `${catColor}22`,
                      }}
                      className="w-full text-left px-1.5 py-0.5 rounded text-[11px] font-medium border-l-2 truncate block hover:brightness-125 transition-all cursor-pointer text-gray-100"
                      title={`${ev.startTime} - ${ev.endTime}: ${ev.title}${
                        ev.recurrence !== "none" ? " (Recurring)" : ""
                      }`}
                    >
                      <span className="font-mono text-[10px] text-gray-300 mr-1 opacity-80">
                        {ev.startTime}
                      </span>
                      <span className="truncate">{ev.title}</span>
                      {ev.recurrence !== "none" && (
                        <span className="ml-1 text-[10px] opacity-70">↻</span>
                      )}
                    </button>
                  );
                })}

                {hiddenCount > 0 && (
                  <div className="text-[10px] font-semibold text-gray-400 hover:text-white px-1 pt-0.5">
                    +{hiddenCount} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

