"use client";

import React, { useMemo, useState } from "react";
import {
  GITHUB_SHADE_COLORS,
  type DailyChecklistItem,
  type DailyLog,
  type HabitCategory,
} from "@/types/tracker";

interface DailyChecklistProps {
  log: DailyLog;
  loading?: boolean;
  onToggleItem: (itemId: string, nextCompleted: boolean) => void;
  onSetAllItems: (completed: boolean) => void;
  onAddCustomItem: (title: string, category: HabitCategory) => Promise<void>;
  onRemoveItem: (itemId: string) => void;
}

interface CategoryGroupConfig {
  id: string;
  label: string;
  defaultCategory: HabitCategory;
  matchCategories: HabitCategory[];
}

const CATEGORY_GROUPS: CategoryGroupConfig[] = [
  {
    id: "academics",
    label: "📚 Academics / School",
    defaultCategory: "school",
    matchCategories: ["school", "study"],
  },
  {
    id: "fitness",
    label: "🏋️ Fitness / Workout",
    defaultCategory: "workout",
    matchCategories: ["workout"],
  },
  {
    id: "chores",
    label: "🧹 Chores & Lifestyle",
    defaultCategory: "chores",
    matchCategories: ["chores", "work"],
  },
  {
    id: "general",
    label: "⚡ General",
    defaultCategory: "routine",
    matchCategories: ["routine", "custom"],
  },
];

function formatFullDateHeading(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function DailyChecklist({
  log,
  loading = false,
  onToggleItem,
  onSetAllItems,
  onAddCustomItem,
  onRemoveItem,
}: DailyChecklistProps) {
  const [newTitle, setNewTitle] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<HabitCategory>("routine");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const groupedItems = useMemo(() => {
    return CATEGORY_GROUPS.map((group) => {
      const items = log.items.filter((item) =>
        group.matchCategories.includes(item.category)
      );
      return {
        ...group,
        items,
      };
    }).filter((g) => g.items.length > 0);
  }, [log.items]);

  const allChecked =
    log.totalCount > 0 && log.completedCount === log.totalCount;

  const progressBarColor =
    log.shadeLevel === 0
      ? "#30363d"
      : GITHUB_SHADE_COLORS[log.shadeLevel]?.color ?? "#39d353";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onAddCustomItem(trimmed, selectedCategory);
      setNewTitle("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 shadow-xl flex flex-col justify-between">
      <div>
        {/* Header: Selected Date & Check All Button */}
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

        {/* Instant Progress Bar & Counter */}
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

        {/* Categorized Checklist Sections */}
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
          <div className="text-center py-10 bg-[#0d1117]/60 rounded-xl border border-dashed border-[#30363d]">
            <p className="text-sm text-gray-400">
              No habits scheduled for this day yet.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Use the form below to add a routine or habit!
            </p>
          </div>
        ) : (
          <div className="space-y-5 max-h-[430px] overflow-y-auto pr-1">
            {groupedItems.map((group) => {
              const groupCompleted = group.items.filter(
                (i) => i.completed
              ).length;

              return (
                <div key={group.id} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                      {group.label}
                    </h3>
                    <span className="text-[11px] font-medium text-gray-500">
                      {groupCompleted}/{group.items.length}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {group.items.map((item: DailyChecklistItem) => (
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
                        className={`group flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border transition-all duration-150 cursor-pointer select-none ${
                          item.completed
                            ? "bg-[#0e4429]/30 border-[#26a641]/40 text-gray-300"
                            : "bg-[#0d1117] border-[#30363d] hover:border-gray-500 text-white"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Custom Checkbox */}
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

                        {/* Remove item button */}
                        <button
                          type="button"
                          aria-label={`Remove ${item.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveItem(item.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-500 hover:text-red-400 hover:bg-[#21262d] transition-opacity cursor-pointer"
                          title="Remove from today's checklist"
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
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inline "Add Routine / Habit" Form */}
      <form
        onSubmit={handleSubmit}
        className="mt-6 pt-4 border-t border-[#30363d]"
      >
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
          Quick Add Routine / Habit
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g., Wash clothes, Read 20 pages..."
            className="flex-1 bg-[#0d1117] border border-[#30363d] focus:border-[#991b1b] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none transition-colors"
          />

          <select
            value={selectedCategory}
            onChange={(e) =>
              setSelectedCategory(e.target.value as HabitCategory)
            }
            className="bg-[#0d1117] border border-[#30363d] focus:border-[#991b1b] rounded-lg px-2.5 py-2 text-xs font-medium text-gray-200 outline-none cursor-pointer"
          >
            <option value="school">📚 Academics / School</option>
            <option value="workout">🏋️ Fitness / Workout</option>
            <option value="chores">🧹 Chores & Lifestyle</option>
            <option value="routine">⚡ General</option>
          </select>

          <button
            type="submit"
            disabled={!newTitle.trim() || isSubmitting}
            className="bg-[#801E0F] hover:bg-[#991b1b] disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            {isSubmitting ? "Adding..." : "+ Add"}
          </button>
        </div>
      </form>
    </div>
  );
}

