import mongoose, { Schema, type Model, type Types } from "mongoose";
import {
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  type CategoryInfo,
} from "../config/defaultSchedule";

/**
 * Master Recurring Entity. One document = one habit/routine that can repeat on
 * several weekdays (`daysOfWeek`, 0 = Sunday .. 6 = Saturday) or occur once on
 * `specificDate`. `startDate` stops a new routine from rewriting past history.
 *
 * NOTE: legacy per-day template documents (with `dayOfWeek`/`items`) may still
 * exist in older databases; they have no `title` and are ignored by queries.
 */
export interface IRoutineTemplate {
  _id?: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  title: string;
  category: CategoryInfo;
  daysOfWeek: number[];
  specificDate?: string | null;
  startDate: string;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const CategorySubSchema = new Schema<CategoryInfo>(
  {
    name: { type: String, required: true, trim: true },
    color: { type: String, default: DEFAULT_CATEGORY_COLOR, trim: true },
    icon: { type: String, default: DEFAULT_CATEGORY_ICON, trim: true },
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
    title: { type: String, required: true, trim: true },
    category: { type: CategorySubSchema, required: true },
    daysOfWeek: {
      type: [Number],
      default: [],
      validate: {
        validator: (v: number[]) =>
          v.every((n) => Number.isInteger(n) && n >= 0 && n <= 6),
        message: "daysOfWeek entries must be integers between 0 and 6",
      },
    },
    specificDate: { type: String, default: null },
    startDate: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

RoutineTemplateSchema.index({ userId: 1, active: 1 });

export const RoutineTemplateModel: Model<IRoutineTemplate> =
  (mongoose.models.RoutineTemplate as Model<IRoutineTemplate>) ||
  mongoose.model<IRoutineTemplate>("RoutineTemplate", RoutineTemplateSchema);
