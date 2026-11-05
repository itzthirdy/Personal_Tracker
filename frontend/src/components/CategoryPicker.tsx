"use client";

import React, { useState } from "react";
import CategoryBadge from "@/components/CategoryBadge";
import {
  CATEGORY_ICON_IDS,
  COLOR_SWATCHES,
  iconEmoji,
  softBackground,
} from "@/lib/categories";
import type { CategoryInfo, CategoryRecord } from "@/types/tracker";

interface CategoryPickerProps {
  categories: CategoryRecord[];
  value: CategoryInfo | null;
  onChange: (category: CategoryInfo | null) => void;
  onCreateCategory: (input: CategoryInfo) => Promise<CategoryRecord>;
  onDeleteCategory?: (
    idOrName: string,
    categoryName: string
  ) => Promise<void> | void;
  popoverPlacement?: "top" | "bottom";
}

export default function CategoryPicker({
  categories,
  value,
  onChange,
  onCreateCategory,
  onDeleteCategory,
  popoverPlacement = "bottom",
}: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_SWATCHES[0] as string);
  const [icon, setIcon] = useState("sparkles");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const created = await onCreateCategory({ name: trimmed, color, icon });
      onChange({ name: created.name, color: created.color, icon: created.icon });
      setName("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create genre");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: CategoryRecord, e: React.MouseEvent) {
    e.stopPropagation();
    if (!onDeleteCategory || deletingKey) return;
    if (c.name.toLowerCase() === "general") return;

    const key = c.id || c.name;
    setDeletingKey(key);
    try {
      if (value?.name.toLowerCase() === c.name.toLowerCase()) {
        onChange(null);
      }
      await onDeleteCategory(key, c.name);
    } finally {
      setDeletingKey(null);
    }
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`px-2 py-0.5 rounded-full border text-[11px] font-medium cursor-pointer transition-colors ${
            value === null
              ? "border-gray-400 text-white bg-[#21262d]"
              : "border-[#30363d] text-gray-400 hover:text-gray-200"
          }`}
        >
          ✨ General
        </button>

        {categories.map((c) => {
          const selected = value?.name.toLowerCase() === c.name.toLowerCase();
          const isGeneral = c.name.toLowerCase() === "general";
          const isDeleting = deletingKey === (c.id || c.name);

          return (
            <div
              key={c.id || c.name}
              style={{
                borderColor: c.color,
                backgroundColor: softBackground(c.color),
                color: "#f0f6fc",
              }}
              className={`inline-flex items-center rounded-full border text-[11px] font-medium transition-opacity ${
                selected ? "ring-2 ring-white/60" : "opacity-80 hover:opacity-100"
              } ${isDeleting ? "opacity-40 pointer-events-none" : ""}`}
            >
              <button
                type="button"
                onClick={() =>
                  onChange({ name: c.name, color: c.color, icon: c.icon })
                }
                className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 cursor-pointer"
              >
                <span>{iconEmoji(c.icon)}</span>
                <span className="truncate max-w-[120px]">{c.name}</span>
              </button>

              {onDeleteCategory && !isGeneral && (
                <button
                  type="button"
                  onClick={(e) => handleDelete(c, e)}
                  title={`Delete "${c.name}" genre (tasks revert to General)`}
                  aria-label={`Delete ${c.name} genre`}
                  className="pr-2 pl-0.5 py-0.5 text-gray-400 hover:text-red-300 transition-colors cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="px-2 py-0.5 rounded-full border border-dashed border-[#30363d] text-[11px] font-medium text-gray-300 hover:text-white hover:border-gray-400 cursor-pointer"
        >
          + New Genre
        </button>
      </div>

      {open && (
        <div
          className={`absolute z-40 left-0 w-72 bg-[#0d1117] border border-[#30363d] rounded-xl p-3.5 shadow-2xl space-y-3 ${
            popoverPlacement === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
            placeholder="Genre name (e.g. Hobbies, Cybersecurity)"
            className="w-full bg-[#161b22] border border-[#30363d] focus:border-[#991b1b] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 outline-none"
          />

          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">
              Badge color
            </p>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-5 h-5 rounded-full cursor-pointer ${
                    color === c
                      ? "ring-2 ring-white ring-offset-2 ring-offset-[#0d1117]"
                      : ""
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">
              Icon
            </p>
            <div className="grid grid-cols-8 gap-1">
              {CATEGORY_ICON_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  title={id}
                  onClick={() => setIcon(id)}
                  className={`h-7 rounded-md text-sm cursor-pointer ${
                    icon === id
                      ? "bg-[#801E0F] ring-1 ring-[#991b1b]"
                      : "bg-[#161b22] hover:bg-[#21262d]"
                  }`}
                >
                  {iconEmoji(id)}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-[11px] text-red-300">{error}</p>}

          <div className="flex items-center justify-between gap-2">
            <CategoryBadge
              category={{ name: name.trim() || "Preview", color, icon }}
            />
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-2.5 py-1 rounded-md text-[11px] text-gray-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!name.trim() || saving}
                className="px-3 py-1 rounded-md text-[11px] font-semibold bg-[#801E0F] hover:bg-[#991b1b] text-white disabled:opacity-40 cursor-pointer"
              >
                {saving ? "Saving..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
