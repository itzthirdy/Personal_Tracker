import mongoose, { Schema, type Model } from "mongoose";
import type {
  DayOfWeek,
  DayRoutineTemplate,
  HabitCategory,
  TemplateChecklistItem,
} from "../config/defaultSchedule";

export type IRoutineTemplate = DayRoutineTemplate;

const TemplateItemSchema = new Schema<TemplateChecklistItem>(
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
    order: { type: Number, required: true },
  },
  { _id: false }
);

const RoutineTemplateSchema = new Schema<IRoutineTemplate>(
  {
    dayOfWeek: {
      type: String,
      required: true,
      unique: true,
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
    dayIndex: { type: Number, required: true, min: 0, max: 6 },
    label: { type: String, required: true },
    items: { type: [TemplateItemSchema], default: [] },
  },
  { timestamps: true }
);

export const RoutineTemplateModel: Model<IRoutineTemplate> =
  (mongoose.models.RoutineTemplate as Model<IRoutineTemplate>) ||
  mongoose.model<IRoutineTemplate>("RoutineTemplate", RoutineTemplateSchema);
