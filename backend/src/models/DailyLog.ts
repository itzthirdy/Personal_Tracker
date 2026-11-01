import mongoose, { Schema, type Model } from "mongoose";
import type { DayOfWeek, HabitCategory } from "../config/defaultSchedule";

export interface IDailyChecklistItem {
  id: string;
  title: string;
  category: HabitCategory;
  completed: boolean;
  completedAt: string | null;
  order: number;
}

export interface IDailyLog {
  date: string; // YYYY-MM-DD
  dayOfWeek: DayOfWeek;
  items: IDailyChecklistItem[];
  completedCount: number;
  totalCount: number;
  completionPercentage: number;
  shadeLevel: 0 | 1 | 2 | 3 | 4;
  shadeColor: string;
  shadeLabel: string;
  notes?: string;
}

const DailyChecklistItemSchema = new Schema<IDailyChecklistItem>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: [
        "routine",
        "workout",
        "school",
        "study",
        "chores",
        "work",
        "custom",
      ] satisfies HabitCategory[],
      default: "routine",
    },
    completed: { type: Boolean, default: false },
    completedAt: { type: String, default: null },
    order: { type: Number, required: true },
  },
  { _id: false }
);

const DailyLogSchema = new Schema<IDailyLog>(
  {
    date: {
      type: String,
      required: true,
      unique: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    dayOfWeek: {
      type: String,
      required: true,
      enum: [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ] satisfies DayOfWeek[],
    },
    items: { type: [DailyChecklistItemSchema], default: [] },
    completedCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
    completionPercentage: { type: Number, default: 0 },
    shadeLevel: { type: Number, enum: [0, 1, 2, 3, 4], default: 0 },
    shadeColor: { type: String, default: "#161b22" },
    shadeLabel: { type: String, default: "No habits completed" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export const DailyLogModel: Model<IDailyLog> =
  (mongoose.models.DailyLog as Model<IDailyLog>) ||
  mongoose.model<IDailyLog>("DailyLog", DailyLogSchema);
