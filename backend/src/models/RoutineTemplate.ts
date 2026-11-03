import mongoose, { Schema, type Model, type Types } from "mongoose";
import type {
  DayOfWeek,
  DayRoutineTemplate,
  HabitCategory,
  TemplateChecklistItem,
} from "../config/defaultSchedule";

export interface IRoutineTemplate extends DayRoutineTemplate {
  _id?: Types.ObjectId | string;
  userId: Types.ObjectId | string;
}

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
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
    dayIndex: { type: Number, required: true, min: 0, max: 6 },
    label: { type: String, required: true },
    items: { type: [TemplateItemSchema], default: [] },
  },
  { timestamps: true }
);

// Compound unique index scoped per user and dayOfWeek
RoutineTemplateSchema.index({ userId: 1, dayOfWeek: 1 }, { unique: true });

export const RoutineTemplateModel: Model<IRoutineTemplate> =
  (mongoose.models.RoutineTemplate as Model<IRoutineTemplate>) ||
  mongoose.model<IRoutineTemplate>("RoutineTemplate", RoutineTemplateSchema);
