import mongoose, { Schema, type Model, type Types } from "mongoose";
import type { CategoryInfo, DayOfWeek } from "../config/defaultSchedule";

export interface IDailyChecklistItem {
  id: string;
  routineId?: string;
  title: string;
  category: CategoryInfo;
  completed: boolean;
  completedAt: string | null;
  order: number;
}

export interface IDailyLog {
  _id?: Types.ObjectId | string;
  userId?: Types.ObjectId | string;
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

// `category` is Mixed (no enum): it holds a user-defined { name, color, icon }
// (or a legacy plain string in older documents, normalized on read).
const DailyChecklistItemSchema = new Schema<IDailyChecklistItem>(
  {
    id: { type: String, required: true },
    routineId: { type: String },
    title: { type: String, required: true, trim: true },
    category: { type: Schema.Types.Mixed, default: null },
    completed: { type: Boolean, default: false },
    completedAt: { type: String, default: null },
    order: { type: Number, required: true },
  },
  { _id: false }
);

const DailyLogSchema = new Schema<IDailyLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
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
    shadeColor: { type: String, default: "#21262d" },
    shadeLabel: { type: String, default: "No habits completed" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

// Compound unique index scoped per user and date
DailyLogSchema.index({ userId: 1, date: 1 }, { unique: true });

export const DailyLogModel: Model<IDailyLog> =
  (mongoose.models.DailyLog as Model<IDailyLog>) ||
  mongoose.model<IDailyLog>("DailyLog", DailyLogSchema);
