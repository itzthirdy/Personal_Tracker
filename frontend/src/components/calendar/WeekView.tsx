"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CalendarEventItem } from "@/types/tracker";
import { iconEmoji } from "@/lib/categories";

interface WeekViewProps {
  activeWeekStart: string; // Sunday (YYYY-MM-DD)
  events: CalendarEventItem[];
  todayDate: string; // YYYY-MM-DD
  onSelectSlot: (dateStr: string, hourStr: string) => void;
  onSelectEvent: (event: CalendarEventItem) => void;
}

const ROW_HEIGHT = 64; // pixels per 1 hour slot (h-16)

const HOUR_LABELS = [
  "12 AM", "1 AM", "2 AM", "3 AM", "4 AM", "5 AM", "6 AM",
  "7 AM", "8 AM", "9 AM", "10 AM", "11 AM", "12 PM",
  "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM",
  "7 PM", "8 PM", "9 PM", "10 PM", "11 PM",
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yr = dt.getUTCFullYear();
  const mn = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dy = String(dt.getUTCDate()).padStart(2, "0");
  return `${yr}-${mn}-${dy}`;
}

export default function WeekView({
  activeWeekStart,
  events,
  todayDate,
  onSelectSlot,
  onSelectEvent,
}: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState<number>(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  // Keep live time updated every minute
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
    };
    const timer = setInterval(updateTime, 60000);
    return () => clearInterval(timer);
  }, []);

  // Scroll to roughly 8:00 AM on initial view mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7.5 * ROW_HEIGHT;
    }
  }, []);

  // Compute the 7 days of the active week (Sunday to Saturday)
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const dateStr = addDays(activeWeekStart, i);
      const dayNum = Number(dateStr.slice(8, 10));
      return {
        dateStr,
        dayName: WEEKDAY_NAMES[i] ?? "",
        dayNumber: dayNum,
        isToday: dateStr === todayDate,
      };
    });
  }, [activeWeekStart, todayDate]);

  // Index events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    for (const ev of events) {
      const date = ev.startDate;
      const list = map.get(date);
      if (list) {
        list.push(ev);
      } else {
        map.set(date, [ev]);
      }
    }
    return map;
  }, [events]);

  const currentLineTop = (currentTimeMinutes / 60) * ROW_HEIGHT;

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl shadow-xl overflow-hidden flex flex-col">
      {/* Sticky Top Header: Day Names + Dates */}
      <div className="flex border-b border-[#30363d] bg-[#0d1117]/90 sticky top-0 z-10">
        {/* Time column gutter */}
        <div className="w-16 sm:w-20 shrink-0 border-r border-[#30363d] py-3 text-center text-[11px] font-mono text-gray-500">
          GMT
        </div>

        {/* 7 Columns Header */}
        <div className="flex-1 grid grid-cols-7 divide-x divide-[#30363d]/60">
          {weekDays.map((day) => (
            <div
              key={day.dateStr}
              className={`py-2.5 text-center flex flex-col items-center justify-center ${
                day.isToday ? "bg-[#801E0F]/10" : ""
              }`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {day.dayName}
              </span>
              <span
                className={`mt-1 inline-flex items-center justify-center text-xs font-bold rounded-full w-6 h-6 transition-all ${
                  day.isToday
                    ? "bg-[#801E0F] text-white shadow-[0_0_10px_rgba(128,30,15,0.4)] ring-2 ring-[#801E0F]/60"
                    : "text-gray-200"
                }`}
              >
                {day.dayNumber}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Hourly Scroll Area */}
      <div
        ref={scrollRef}
        className="overflow-y-auto max-h-[720px] relative select-none flex bg-[#0d1117]"
      >
        {/* Left Column: 24 Hour Labels */}
        <div className="w-16 sm:w-20 shrink-0 border-r border-[#30363d] bg-[#0d1117] relative">
          {HOUR_LABELS.map((label, hourIdx) => (
            <div
              key={label}
              style={{ height: `${ROW_HEIGHT}px` }}
              className="text-right pr-2.5 -mt-2.5 text-[11px] font-mono text-gray-400 select-none"
            >
              {label}
            </div>
          ))}
        </div>

        {/* 7 Day Hourly Columns */}
        <div className="flex-1 grid grid-cols-7 divide-x divide-[#30363d]/60 relative">
          {weekDays.map((day) => {
            const dayEvents = eventsByDate.get(day.dateStr) || [];

            return (
              <div
                key={day.dateStr}
                className="relative bg-[#161b22]/40"
                style={{ height: `${24 * ROW_HEIGHT}px` }}
              >
                {/* 24 Hourly Background Clickable Slots */}
                {Array.from({ length: 24 }, (_, hour) => {
                  const hourStr = `${String(hour).padStart(2, "0")}:00`;
                  return (
                    <div
                      key={hour}
                      onClick={() => onSelectSlot(day.dateStr, hourStr)}
                      style={{ height: `${ROW_HEIGHT}px` }}
                      className="border-b border-[#30363d]/40 hover:bg-[#801E0F]/10 transition-colors cursor-pointer"
                      title={`Click to schedule at ${hourStr} on ${day.dayName}`}
                    />
                  );
                })}

                {/* Live Current Time Red Line (Active Day Column) */}
                {day.isToday && (
                  <div
                    style={{ top: `${currentLineTop}px` }}
                    className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                  >
                    <div className="w-2.5 h-2.5 -ml-1 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                    <div className="flex-1 border-t-2 border-red-500" />
                  </div>
                )}

                {/* Absolutely Positioned Schedule Event Cards */}
                {dayEvents.map((ev) => {
                  const sParts = ev.startTime.split(":").map(Number);
                  const eParts = ev.endTime.split(":").map(Number);
                  const sh = sParts[0] ?? 0;
                  const sm = sParts[1] ?? 0;
                  const eh = eParts[0] ?? 0;
                  const em = eParts[1] ?? 0;

                  const startMinutesTotal = sh * 60 + sm;
                  const endMinutesTotal = eh * 60 + em;
                  const topOffset = (startMinutesTotal / 60) * ROW_HEIGHT;
                  const durationHeight = Math.max(
                    ((endMinutesTotal - startMinutesTotal) / 60) * ROW_HEIGHT,
                    26
                  );

                  const catColor = ev.category?.color || "#801E0F";
                  const catIcon = ev.category?.icon ? iconEmoji(ev.category.icon) : "";

                  return (
                    <div
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(ev);
                      }}
                      style={{
                        top: `${topOffset}px`,
                        height: `${durationHeight}px`,
                        borderLeftColor: catColor,
                        backgroundColor: `${catColor}33`,
                      }}
                      className="absolute left-1 right-1 rounded-lg border-l-4 px-2 py-1 overflow-hidden z-10 shadow-md cursor-pointer hover:brightness-125 transition-all group flex flex-col justify-start"
                      title={`${ev.startTime} - ${ev.endTime}: ${ev.title}${
                        ev.notes ? `\n${ev.notes}` : ""
                      }`}
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        {catIcon && (
                          <span className="text-[11px] shrink-0">{catIcon}</span>
                        )}
                        <span className="text-xs font-bold text-white truncate">
                          {ev.title}
                        </span>
                        {ev.recurrence !== "none" && (
                          <span className="text-[10px] text-gray-300 ml-auto shrink-0 opacity-80">
                            ↻
                          </span>
                        )}
                      </div>

                      {durationHeight > 34 && (
                        <div className="text-[10px] font-mono text-gray-300 opacity-90 truncate mt-0.5">
                          {ev.startTime} – {ev.endTime}
                        </div>
                      )}

                      {durationHeight > 56 && ev.notes && (
                        <div className="text-[10px] text-gray-400 truncate mt-0.5 italic">
                          {ev.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

