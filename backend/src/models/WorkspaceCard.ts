import mongoose, { Schema, type Model, type Types } from "mongoose";

export type WorkspaceModuleKey = "habits" | "finances" | "exercise" | "custom";
export type WorkspaceCardStatus = "active" | "coming_soon";

export interface IWorkspaceCard {
  _id?: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  title: string;
  moduleKey: WorkspaceModuleKey;
  icon: string;
  coverImage: string;
  route: string;
  order: number;
  status: WorkspaceCardStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface HabitsLivePreview {
  consistencyScore: number;
  currentStreak: number;
  todayProgress: {
    completedCount: number;
    totalCount: number;
    completionPercentage: number;
  };
}

export interface ComingSoonLivePreview {
  subtitle: string;
}

export type WorkspaceCardLivePreview = HabitsLivePreview | ComingSoonLivePreview;

export interface EnrichedWorkspaceCard {
  id: string;
  userId: string;
  title: string;
  moduleKey: WorkspaceModuleKey;
  icon: string;
  coverImage: string;
  route: string;
  order: number;
  status: WorkspaceCardStatus;
  livePreview: WorkspaceCardLivePreview;
  createdAt?: Date;
  updatedAt?: Date;
}

const WorkspaceCardSchema = new Schema<IWorkspaceCard>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    moduleKey: {
      type: String,
      enum: ["habits", "finances", "exercise", "custom"] satisfies WorkspaceModuleKey[],
      default: "custom",
    },
    icon: {
      type: String,
      default: "file-text",
      trim: true,
    },
    coverImage: {
      type: String,
      default: "",
      trim: true,
    },
    route: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "coming_soon"] satisfies WorkspaceCardStatus[],
      default: "active",
    },
  },
  { timestamps: true }
);

WorkspaceCardSchema.index({ userId: 1, order: 1 });

export const WorkspaceCardModel: Model<IWorkspaceCard> =
  (mongoose.models.WorkspaceCard as Model<IWorkspaceCard>) ||
  mongoose.model<IWorkspaceCard>("WorkspaceCard", WorkspaceCardSchema);

