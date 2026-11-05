import React from "react";
import { iconEmoji, softBackground } from "@/lib/categories";
import type { CategoryInfo } from "@/types/tracker";

export default function CategoryBadge({
  category,
  size = "sm",
}: {
  category: CategoryInfo;
  size?: "sm" | "xs";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap ${
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"
      }`}
      style={{
        color: category.color,
        borderColor: `${category.color}66`,
        backgroundColor: softBackground(category.color),
      }}
    >
      <span>{iconEmoji(category.icon)}</span>
      <span>{category.name}</span>
    </span>
  );
}

