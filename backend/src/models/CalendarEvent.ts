import mongoose, { Schema, Document } from "mongoose";

export interface ICalendarEvent extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  startDate: string; // "YYYY-MM-DD"
  endDate?: string; // "YYYY-MM-DD" for multi-day spans
  startTime: string; // "HH:mm" (24-hour format, e.g., "09:00")
  endTime: string; // "HH:mm" (24-hour format, e.g., "10:30")
  categoryId?: mongoose.Types.ObjectId | null;
  notes?: string;
  recurrence: "none" | "daily" | "weekly" | "weekdays";
  daysOfWeek?: number[]; // [0 = Sunday, 1 = Monday, ... 6 = Saturday]
  createdAt: Date;
  updatedAt: Date;
}

const CalendarEventSchema = new Schema<ICalendarEvent>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    startDate: { type: String, required: true, index: true },
    endDate: { type: String },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    notes: { type: String, default: "" },
    recurrence: {
      type: String,
      enum: ["none", "daily", "weekly", "weekdays"],
      default: "none",
    },
    daysOfWeek: [{ type: Number }],
  },
  { timestamps: true }
);

export const CalendarEvent =
  (mongoose.models.CalendarEvent as mongoose.Model<ICalendarEvent>) ||
  mongoose.model<ICalendarEvent>("CalendarEvent", CalendarEventSchema);

