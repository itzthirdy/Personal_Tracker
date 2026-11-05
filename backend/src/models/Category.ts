import mongoose, { Schema, type Model, type Types } from "mongoose";
import {
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
} from "../config/defaultSchedule";

/** User-defined genre ("CategoryPalette" entry), scoped per user. */
export interface IUserCategory {
  _id?: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  name: string;
  nameKey: string; // lowercase name, used for per-user uniqueness
  color: string;
  icon: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const CategorySchema = new Schema<IUserCategory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true },
    color: { type: String, default: DEFAULT_CATEGORY_COLOR, trim: true },
    icon: { type: String, default: DEFAULT_CATEGORY_ICON, trim: true },
  },
  { timestamps: true }
);

CategorySchema.index({ userId: 1, nameKey: 1 }, { unique: true });

export const CategoryModel: Model<IUserCategory> =
  (mongoose.models.Category as Model<IUserCategory>) ||
  mongoose.model<IUserCategory>("Category", CategorySchema);

