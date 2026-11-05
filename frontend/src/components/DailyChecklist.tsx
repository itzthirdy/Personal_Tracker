"use client";

import React, { useMemo, useRef, useState } from "react";
import CategoryBadge from "@/components/CategoryBadge";
import CategoryPicker from "@/components/CategoryPicker";
import {
  WEEKDAY_NAMES,
  dayIndexOf,
  formatMonthDay,
  iconEmoji,
} from "@/lib/categories";
import {
  GITHUB_SHADE_COLORS,
  type CategoryInfo,
  type CategoryRecord,
  type DailyChecklistItem,
  type DailyLog,
} from "@/types/tracker";

interface DailyChecklistProps {
  log: DailyLog;
  loading?: boolean;
  categories: CategoryRecord[];
  onToggleItem: (itemId: string, nextCompleted: boolean) => void;
  onSetAllItems: (completed: boolean) => void;
  onCreateRoutine: (input: {
    title: string;
    category: CategoryInfo | null;
    repeat: boolean;
  }) => Promise<void>;
  onCreateCategory: (input: CategoryInfo) => Promise<CategoryRecord>;
  onDeleteCategory?: (
    idOrName: string,
    categoryName: string
  ) => Promise<void> | void;
  onRemoveItem: (itemId: string) => void;
  onOpenManager: () => void;
}

function formatFullDateHeading(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function DailyChecklist({
  log,
  loading = false,
  categories,
  onToggleItem,
  onSetAllItems,
  onCreateRoutine,
  onCreateCategory,
  onDeleteCategory,
  onRemoveItem,
  onOpenManager,
}: DailyChecklistProps) {
  const [newTitle, setNewTitle] = useState("");
  const [category, setCategory] = useState<CategoryInfo | null>(null);
  const [repeat, setRepeat] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const weekdayName = WEEKDAY_NAMES[dayIndexOf(log.date)] ?? "day";
  const shortDate = formatMonthDay(log.date);

  // Group dynamically by user-defined category name (first-seen order)
  const groupedItems = useMemo(() => {
    const groups = new Map<
      string,
      { category: CategoryInfo; items: DailyChecklistItem[] }
    >();
    for (const item of log.items) {
      const key = item.category.name.toLowerCase();
      const group = groups.get(key) ?? { category: item.category, items: [] };
      group.items.push(item);
      groups.set(key, group);
    }
    return Array.from(groups.entries()).map(([key, g]) => ({ key, ...g }));
  }, [log.items]);

  const allChecked =
    log.totalCount > 0 && log.completedCount === log.totalCount;

  const progressBarColor =
    log.shadeLevel === 0
      ? "#30363d"
      : (GITHUB_SHADE_COLORS[log.shadeLevel]?.color ?? "#39d353");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed || isSubmitting) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      await onCreateRoutine({ title: trimmed, category, repeat });
      setNewTitle("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not add habit");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 shadow-xl flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded bg-[#801E0F] text-white">
                {log.date}
              </span>
              {allChecked && (
                <span className="inline-block px-2 py-0.5 text-[11px] font-bold rounded bg-[#39d353]/20 text-[#39d353] border border-[#39d353]/40">
                  100% Complete ✨
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white mt-1.5">
              {formatFullDateHeading(log.date)}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenManager}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#801E0F] bg-[#801E0F]/20 text-red-200 hover:bg-[#801E0F] hover:text-white transition-colors cursor-pointer"
            >
              ⚙ Manage Routines
            </button>
            {log.totalCount > 0 && (
              <button
                type="button"
                onClick={() => onSetAllItems(!allChecked)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  allChecked
                    ? "bg-[#21262d] text-gray-300 border-[#30363d] hover:text-white hover:bg-[#30363d]"
                    : "bg-[#0e4429] text-[#39d353] border-[#26a641]/50 hover:bg-[#006d32] hover:text-white"
                }`}
              >
                {allChecked ? "Uncheck All" : "Check All"}
              </button>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3.5 mb-5">
          <div className="flex items-center justify-between text-xs font-medium mb-2">
            <span className="text-gray-300">
              <strong className="text-white font-semibold">
                {log.completedCount}
              </strong>{" "}
              of{" "}
              <strong className="text-white font-semibold">
                {log.totalCount}
              </strong>{" "}
              completed ({log.completionPercentage}%)
            </span>
            <span className="flex items-center gap-1.5 text-gray-400">
              <span
                className="w-2.5 h-2.5 rounded-sm inline-block border border-[#30363d]"
                style={{ backgroundColor: log.shadeColor }}
              />
              <span>Level {log.shadeLevel}/4</span>
            </span>
          </div>

          <div className="w-full h-2.5 bg-[#21262d] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${log.completionPercentage}%`,
                backgroundColor: progressBarColor,
                boxShadow:
                  log.shadeLevel === 4
                    ? "0 0 12px rgba(57, 211, 83, 0.7)"
                    : undefined,
              }}
            />
          </div>
        </div>

        {/* Checklist / skeleton / empty state */}
        {loading ? (
          <div className="space-y-3 py-6">
            {[1, 2, 3, 4].map((skeleton) => (
              <div
                key={skeleton}
                className="h-11 rounded-lg bg-[#21262d] animate-pulse border border-[#30363d]/60"
              />
            ))}
          </div>
        ) : groupedItems.length === 0 ? (
          <div className="text-center py-10 px-4 bg-[#0d1117]/60 rounded-xl border border-dashed border-[#30363d]">
            <div className="text-3xl mb-2">🌱</div>
            <p className="text-sm font-semibold text-gray-200">
              Nothing scheduled for {weekdayName}, {shortDate}
            </p>
            <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
              Start fresh: add a quick habit for this day, or build a full
              weekly schedule in the Routine Manager.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => titleInputRef.current?.focus()}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#801E0F] hover:bg-[#991b1b] text-white cursor-pointer"
              >
                ↓ Quick Add Below
              </button>
              <button
                type="button"
                onClick={onOpenManager}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#21262d] hover:bg-[#30363d] text-gray-200 border border-[#30363d] cursor-pointer"
              >
                Open Routine Manager
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 max-h-[430px] overflow-y-auto pr-1">
            {groupedItems.map((group) => {
              const groupCompleted = group.items.filter((i) => i.completed).length;

              return (
                <div key={group.key} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                      <span>{iconEmoji(group.category.icon)}</span>
                      <span style={{ color: group.category.color }}>
                        {group.category.name}
                      </span>
                    </h3>
                    <span className="text-[11px] font-medium text-gray-500">
                      {groupCompleted}/{group.items.length}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => onToggleItem(item.id, !item.completed)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onToggleItem(item.id, !item.completed);
                          }
                        }}
                        style={{ borderLeftColor: group.category.color }}
                        className={`group flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-l-4 transition-all duration-150 cursor-pointer select-none ${
                          item.completed
                            ? "bg-[#0e4429]/30 border-[#26a641]/40 text-gray-300"
                            : "bg-[#0d1117] border-[#30363d] hover:border-gray-500 text-white"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all duration-150 ${
                              item.completed
                                ? "bg-[#39d353] text-[#090d16] shadow-[0_0_8px_rgba(57,211,83,0.45)]"
                                : "bg-[#21262d] border border-[#30363d] group-hover:border-gray-400"
                            }`}
                          >
                            {item.completed && (
                              <svg
                                className="w-3.5 h-3.5 stroke-[3]"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </span>

                          <span
                            className={`text-sm font-medium truncate transition-all ${
                              item.completed
                                ? "line-through text-gray-400"
                                : "text-gray-100"
                            }`}
                          >
                            {item.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <CategoryBadge category={item.category} size="xs" />
                          <button
                            type="button"
                            aria-label={`Remove ${item.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveItem(item.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-500 hover:text-red-400 hover:bg-[#21262d] transition-opacity cursor-pointer"
                            title={`Remove from every ${weekdayName} (one-off tasks are deleted)`}
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Add */}
      <form
        onSubmit={handleSubmit}
        className="mt-6 pt-4 border-t border-[#30363d] space-y-3"
      >
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
          Quick Add Routine / Habit
        </label>

        <div className="flex gap-2">
          <input
            ref={titleInputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g., Wash clothes, Read 20 pages..."
            className="flex-1 bg-[#0d1117] border border-[#30363d] focus:border-[#991b1b] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!newTitle.trim() || isSubmitting}
            className="bg-[#801E0F] hover:bg-[#991b1b] disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            {isSubmitting ? "Adding..." : "+ Add"}
          </button>
        </div>

        <CategoryPicker
          categories={categories}
          value={category}
          onChange={setCategory}
          onCreateCategory={onCreateCategory}
          onDeleteCategory={onDeleteCategory}
          popoverPlacement="top"
        />

        {/* Recurrence micro-toggle */}
        <div className="inline-flex items-center bg-[#0d1117] p-0.5 rounded-full border border-[#30363d] text-[11px] font-medium">
          <button
            type="button"
            onClick={() => setRepeat(false)}
            className={`px-3 py-1 rounded-full transition-colors cursor-pointer ${
              !repeat ? "bg-[#801E0F] text-white" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            • Only Today ({shortDate})
          </button>
          <button
            type="button"
            onClick={() => setRepeat(true)}
            className={`px-3 py-1 rounded-full transition-colors cursor-pointer ${
              repeat ? "bg-[#801E0F] text-white" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            ↻ Repeat every {weekdayName}
          </button>
        </div>

        {formError && <p className="text-xs text-red-300">{formError}</p>}
      </form>
    </div>
  );
}
