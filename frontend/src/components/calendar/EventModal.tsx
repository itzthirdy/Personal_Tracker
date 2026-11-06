"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  apiCreateCalendarEvent,
  apiDeleteCalendarEvent,
  apiUpdateCalendarEvent,
} from "@/lib/api";
import { iconEmoji } from "@/lib/categories";
import type {
  CalendarEventInput,
  CalendarEventItem,
  CalendarRecurrence,
  CategoryRecord,
} from "@/types/tracker";

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (savedEvent: CalendarEventItem) => void;
  onDeleted?: (deletedId: string) => void;
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialEvent?: CalendarEventItem | null;
  categories: CategoryRecord[];
}

const TIME_OPTIONS = (() => {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      options.push(`${hh}:${mm}`);
    }
  }
  return options;
})();

const WEEKDAYS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

export default function EventModal({
  isOpen,
  onClose,
  onSaved,
  onDeleted,
  initialDate,
  initialStartTime,
  initialEndTime,
  initialEvent,
  categories,
}: EventModalProps) {
  const isEditing = Boolean(initialEvent);

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(
    initialDate || new Date().toISOString().slice(0, 10)
  );
  const [startTime, setStartTime] = useState(initialStartTime || "09:00");
  const [endTime, setEndTime] = useState(initialEndTime || "10:00");
  const [categoryId, setCategoryId] = useState<string>("");
  const [recurrence, setRecurrence] = useState<CalendarRecurrence>("none");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialEvent) {
      setTitle(initialEvent.title);
      setStartDate(initialEvent.startDate);
      setStartTime(initialEvent.startTime);
      setEndTime(initialEvent.endTime);
      setCategoryId(initialEvent.categoryId ? String(initialEvent.categoryId) : "");
      setRecurrence(initialEvent.recurrence || "none");
      setDaysOfWeek(
        initialEvent.daysOfWeek && initialEvent.daysOfWeek.length > 0
          ? initialEvent.daysOfWeek
          : [new Date(initialEvent.startDate).getUTCDay()]
      );
      setNotes(initialEvent.notes || "");
    } else {
      setTitle("");
      setStartDate(initialDate || new Date().toISOString().slice(0, 10));
      setStartTime(initialStartTime || "09:00");
      setEndTime(initialEndTime || "10:00");
      setCategoryId(categories[0]?.id || "");
      setRecurrence("none");
      const d = initialDate
        ? new Date(Date.UTC(
            Number(initialDate.slice(0, 4)),
            Number(initialDate.slice(5, 7)) - 1,
            Number(initialDate.slice(8, 10))
          )).getUTCDay()
        : new Date().getUTCDay();
      setDaysOfWeek([d]);
      setNotes("");
    }
    setError(null);
  }, [initialEvent, initialDate, initialStartTime, initialEndTime, categories]);

  if (!isOpen) return null;

  function toggleDay(dayVal: number) {
    setDaysOfWeek((prev) =>
      prev.includes(dayVal)
        ? prev.length > 1
          ? prev.filter((d) => d !== dayVal)
          : prev
        : [...prev, dayVal].sort((a, b) => a - b)
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Please provide an event title.");
      return;
    }

    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    if ((sh ?? 0) * 60 + (sm ?? 0) >= (eh ?? 0) * 60 + (em ?? 0)) {
      setError("End time must be strictly after start time.");
      return;
    }

    setLoading(true);

    const payload: CalendarEventInput = {
      title: trimmedTitle,
      startDate,
      startTime,
      endTime,
      categoryId: categoryId || null,
      notes: notes.trim(),
      recurrence,
      daysOfWeek: recurrence === "weekly" ? daysOfWeek : undefined,
    };

    try {
      if (isEditing && initialEvent) {
        const targetId = initialEvent.eventId || initialEvent.id;
        const updated = await apiUpdateCalendarEvent(targetId, payload);
        onSaved(updated);
      } else {
        const created = await apiCreateCalendarEvent(payload);
        onSaved(created);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save calendar event");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!initialEvent) return;
    if (!window.confirm(`Delete "${initialEvent.title}"?`)) return;

    setLoading(true);
    setError(null);

    try {
      const targetId = initialEvent.eventId || initialEvent.id;
      await apiDeleteCalendarEvent(targetId);
      if (onDeleted) onDeleted(targetId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl p-6 text-[#f0f6fc] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#30363d]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#801E0F] flex items-center justify-center text-white text-xs font-bold shadow-[0_0_10px_rgba(128,30,15,0.4)]">
              📅
            </div>
            <h2 className="text-base font-bold text-white">
              {isEditing ? "Edit Schedule Item" : "Create Schedule Item"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-md text-sm transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 px-3.5 py-2.5 rounded-lg bg-[#801E0F]/30 border border-[#991b1b] text-xs text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Title <span className="text-[#801E0F]">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Software Engineering 2, Gym Session, Machine Learning"
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[#801E0F] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors"
            />
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[#801E0F] rounded-lg px-3 py-2 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Start Time
              </label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[#801E0F] rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={`start-${t}`} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                End Time
              </label>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[#801E0F] rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={`end-${t}`} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[#801E0F] rounded-lg px-3.5 py-2.5 text-xs text-white outline-none cursor-pointer"
            >
              <option value="">(No Category / Default)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {iconEmoji(c.icon)} {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Recurrence */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Repeat
            </label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as CalendarRecurrence)}
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[#801E0F] rounded-lg px-3.5 py-2.5 text-xs text-white outline-none cursor-pointer"
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="weekdays">Every Weekday (Mon–Fri)</option>
            </select>
          </div>

          {/* If weekly recurrence: Day selection pills */}
          {recurrence === "weekly" && (
            <div className="p-3 bg-[#0d1117] rounded-lg border border-[#30363d]">
              <label className="block text-[11px] font-semibold text-gray-400 mb-2">
                Repeat on Days of Week:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((w) => {
                  const selected = daysOfWeek.includes(w.value);
                  return (
                    <button
                      key={w.value}
                      type="button"
                      onClick={() => toggleDay(w.value)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        selected
                          ? "bg-[#801E0F] text-white shadow"
                          : "bg-[#21262d] text-gray-400 hover:text-white"
                      }`}
                    >
                      {w.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes / Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Notes / Description (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add room numbers, links, or reminders..."
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[#801E0F] rounded-lg px-3.5 py-2 text-xs text-white placeholder-gray-500 outline-none resize-none"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-[#30363d] flex items-center justify-between gap-3">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 transition-colors cursor-pointer"
              >
                Delete Event
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#21262d] hover:bg-[#30363d] text-gray-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-[#801E0F] hover:bg-[#991b1b] text-white shadow-[0_0_12px_rgba(128,30,15,0.4)] disabled:opacity-50 transition-all cursor-pointer"
              >
                {loading ? "Saving..." : isEditing ? "Save Changes" : "Create Schedule"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

