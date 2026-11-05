"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import CategoryBadge from "@/components/CategoryBadge";
import CategoryPicker from "@/components/CategoryPicker";
import { WEEKDAY_PILLS, describeDays } from "@/lib/categories";
import {
  apiBulkDeleteRoutines,
  apiCreateRoutine,
  apiUpdateRoutine,
  fetchRoutines,
} from "@/lib/api";
import type {
  CategoryInfo,
  CategoryRecord,
  RoutineRecord,
} from "@/types/tracker";

interface RoutineManagerModalProps {
  open: boolean;
  onClose: () => void;
  categories: CategoryRecord[];
  onCreateCategory: (input: CategoryInfo) => Promise<CategoryRecord>;
  onDeleteCategory?: (
    idOrName: string,
    categoryName: string
  ) => Promise<void> | void;
  /** Default start date (YYYY-MM-DD) for newly created recurring routines. */
  startDate: string;
  /** Called after any create / update / delete so the dashboard can refresh. */
  onChanged: () => void;
}

function DayPills({
  selected,
  onToggle,
}: {
  selected: number[];
  onToggle: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {WEEKDAY_PILLS.map((p) => {
        const on = selected.includes(p.index);
        return (
          <button
            key={p.index}
            type="button"
            title={p.short}
            onClick={() => onToggle(p.index)}
            className={`w-9 h-9 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
              on
                ? "bg-[#801E0F] border-[#991b1b] text-white"
                : "bg-[#0d1117] border-[#30363d] text-gray-400 hover:text-white"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

export default function RoutineManagerModal({
  open,
  onClose,
  categories,
  onCreateCategory,
  onDeleteCategory,
  startDate,
  onChanged,
}: RoutineManagerModalProps) {
  const [routines, setRoutines] = useState<RoutineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create / edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CategoryInfo | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  // List filters + selection
  const [search, setSearch] = useState("");
  const [filterDay, setFilterDay] = useState<number | "all">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Delete confirmation
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"day" | "all">("day");
  const [deleteDays, setDeleteDays] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRoutines(await fetchRoutines());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load routines");
    } finally {
      setLoading(false);
    }
  }, []);

  // The modal is mounted only while open (see page), so state starts fresh each time.
  useEffect(() => {
    if (!open) return;
    let active = true;
    fetchRoutines()
      .then((list) => {
        if (active) setRoutines(list);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Could not load routines");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return routines.filter((r) => {
      if (q && !r.title.toLowerCase().includes(q) && !r.category.name.toLowerCase().includes(q)) {
        return false;
      }
      if (filterDay !== "all" && !r.daysOfWeek.includes(filterDay)) return false;
      return true;
    });
  }, [routines, search, filterDay]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((r) => selectedIds.includes(r.id));

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setCategory(null);
    setDays([]);
  }

  function toggleDay(index: number, list: number[], set: (d: number[]) => void) {
    set(list.includes(index) ? list.filter((d) => d !== index) : [...list, index]);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || days.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await apiUpdateRoutine(editingId, {
          title: trimmed,
          category,
          daysOfWeek: days,
        });
      } else {
        await apiCreateRoutine({
          title: trimmed,
          category,
          daysOfWeek: days,
          startDate,
        });
      }
      resetForm();
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save routine");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(r: RoutineRecord) {
    setEditingId(r.id);
    setTitle(r.title);
    setCategory(r.category);
    setDays(r.daysOfWeek);
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filtered.some((r) => r.id === id)));
    } else {
      setSelectedIds((prev) =>
        Array.from(new Set([...prev, ...filtered.map((r) => r.id)]))
      );
    }
  }

  async function handleConfirmDelete() {
    if (deleting || selectedIds.length === 0) return;
    setDeleting(true);
    setError(null);
    try {
      const selected = routines.filter((r) => selectedIds.includes(r.id));
      if (deleteMode === "all") {
        await apiBulkDeleteRoutines({ routineIds: selectedIds, mode: "all" });
      } else {
        const recurringIds = selected.filter((r) => !r.specificDate).map((r) => r.id);
        const oneOffIds = selected.filter((r) => r.specificDate).map((r) => r.id);
        for (const day of deleteDays) {
          if (recurringIds.length > 0) {
            await apiBulkDeleteRoutines({
              routineIds: recurringIds,
              mode: "day",
              dayOfWeek: day,
            });
          }
        }
        // One-off tasks don't repeat on weekdays, so they are removed entirely.
        if (oneOffIds.length > 0) {
          await apiBulkDeleteRoutines({ routineIds: oneOffIds, mode: "all" });
        }
      }
      setSelectedIds([]);
      setConfirmOpen(false);
      setDeleteDays([]);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete routines");
    } finally {
      setDeleting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[#30363d] bg-[#161b22]">
          <div>
            <h2 className="text-lg font-bold text-white">Routine Manager</h2>
            <p className="text-xs text-gray-400">
              Build your weekly schedule once; it repeats automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-[#21262d] cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="px-3.5 py-2.5 rounded-lg bg-[#801E0F]/30 border border-[#991b1b] text-xs text-red-200">
              {error}
            </div>
          )}

          {/* Create / edit form */}
          <form
            onSubmit={handleSave}
            className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {editingId ? "Edit routine" : "Create routine"}
              </h3>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-gray-400 hover:text-white cursor-pointer"
                >
                  Cancel edit
                </button>
              )}
            </div>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Routine title (e.g., Gym, Study algorithms)"
              className="w-full bg-[#161b22] border border-[#30363d] focus:border-[#991b1b] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none"
            />

            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">
                Genre
              </p>
              <CategoryPicker
                categories={categories}
                value={category}
                onChange={setCategory}
                onCreateCategory={onCreateCategory}
                onDeleteCategory={
                  onDeleteCategory
                    ? async (idOrName, catName) => {
                        await onDeleteCategory(idOrName, catName);
                        await load();
                      }
                    : undefined
                }
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">
                Repeat on
              </p>
              <DayPills
                selected={days}
                onToggle={(i) => toggleDay(i, days, setDays)}
              />
            </div>

            <button
              type="submit"
              disabled={!title.trim() || days.length === 0 || saving}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#801E0F] hover:bg-[#991b1b] text-white disabled:opacity-40 cursor-pointer"
            >
              {saving ? "Saving..." : editingId ? "Save changes" : "+ Create routine"}
            </button>
          </form>

          {/* Routine list */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search routines or genres..."
                className="flex-1 min-w-[160px] bg-[#0d1117] border border-[#30363d] focus:border-[#991b1b] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none"
              />
              <select
                value={filterDay}
                onChange={(e) =>
                  setFilterDay(e.target.value === "all" ? "all" : Number(e.target.value))
                }
                className="bg-[#0d1117] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-gray-200 outline-none cursor-pointer"
              >
                <option value="all">All days</option>
                {WEEKDAY_PILLS.map((p) => (
                  <option key={p.index} value={p.index}>
                    {p.short}
                  </option>
                ))}
              </select>
            </div>

            {/* Bulk action bar */}
            {selectedIds.length > 0 && (
              <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-lg bg-[#801E0F]/20 border border-[#801E0F]">
                <span className="text-xs text-red-100">
                  {selectedIds.length} selected
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmOpen((o) => !o)}
                  className="px-3 py-1 rounded-md text-xs font-semibold bg-[#801E0F] hover:bg-[#991b1b] text-white cursor-pointer"
                >
                  Delete Selected ({selectedIds.length})
                </button>
              </div>
            )}

            {confirmOpen && selectedIds.length > 0 && (
              <div className="bg-[#0d1117] border border-[#991b1b] rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-white">
                  How should these {selectedIds.length} routine
                  {selectedIds.length === 1 ? "" : "s"} be removed?
                </p>

                <label className="flex items-start gap-2 text-xs text-gray-200 cursor-pointer">
                  <input
                    type="radio"
                    checked={deleteMode === "day"}
                    onChange={() => setDeleteMode("day")}
                    className="mt-0.5"
                  />
                  <span>
                    Remove from specific days only
                    <span className="block text-gray-500">
                      Routines that no longer have any day left are deleted. One-time
                      tasks are always deleted.
                    </span>
                  </span>
                </label>
                {deleteMode === "day" && (
                  <div className="pl-5">
                    <DayPills
                      selected={deleteDays}
                      onToggle={(i) => toggleDay(i, deleteDays, setDeleteDays)}
                    />
                  </div>
                )}

                <label className="flex items-start gap-2 text-xs text-gray-200 cursor-pointer">
                  <input
                    type="radio"
                    checked={deleteMode === "all"}
                    onChange={() => setDeleteMode("all")}
                    className="mt-0.5"
                  />
                  <span>
                    Delete from the entire weekly schedule
                    <span className="block text-gray-500">
                      Past completed check-ins stay in your heatmap history.
                    </span>
                  </span>
                </label>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(false)}
                    className="px-3 py-1.5 rounded-md text-xs text-gray-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={deleting || (deleteMode === "day" && deleteDays.length === 0)}
                    className="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-[#991b1b] hover:bg-red-700 text-white disabled:opacity-40 cursor-pointer"
                  >
                    {deleting ? "Deleting..." : "Confirm delete"}
                  </button>
                </div>
              </div>
            )}

            <div className="border border-[#30363d] rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2 bg-[#0d1117] border-b border-[#30363d] text-[11px] uppercase tracking-wider text-gray-500">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  disabled={filtered.length === 0}
                  aria-label="Select all"
                  className="cursor-pointer"
                />
                <span className="flex-1">Select all ({filtered.length})</span>
                <span className="hidden sm:inline w-40">Days</span>
                <span className="w-12" />
              </div>

              {loading ? (
                <p className="px-4 py-6 text-xs text-gray-500 text-center">Loading...</p>
              ) : filtered.length === 0 ? (
                <p className="px-4 py-8 text-xs text-gray-500 text-center">
                  {routines.length === 0
                    ? "No routines yet. Create your first one above."
                    : "No routines match your filters."}
                </p>
              ) : (
                <ul className="divide-y divide-[#30363d]">
                  {filtered.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#0d1117]/60"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.id)}
                        onChange={() =>
                          setSelectedIds((prev) =>
                            prev.includes(r.id)
                              ? prev.filter((id) => id !== r.id)
                              : [...prev, r.id]
                          )
                        }
                        aria-label={`Select ${r.title}`}
                        className="cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-100 truncate">{r.title}</p>
                        <div className="mt-0.5">
                          <CategoryBadge category={r.category} size="xs" />
                        </div>
                      </div>
                      <span className="hidden sm:inline w-40 text-xs text-gray-400">
                        {r.specificDate
                          ? `One-time · ${r.specificDate}`
                          : describeDays(r.daysOfWeek)}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        disabled={!!r.specificDate}
                        title={
                          r.specificDate
                            ? "One-time tasks can't be edited here"
                            : "Edit routine"
                        }
                        className="w-12 text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                      >
                        Edit
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
