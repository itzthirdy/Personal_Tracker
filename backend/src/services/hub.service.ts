import mongoose from "mongoose";
import { isDatabaseConnected } from "../config/database";
import {
  WorkspaceCardModel,
  type EnrichedWorkspaceCard,
  type IWorkspaceCard,
  type WorkspaceCardLivePreview,
  type WorkspaceCardStatus,
  type WorkspaceModuleKey,
} from "../models/WorkspaceCard";
import {
  getConsistencyStats,
  getOrCreateDailyLog,
} from "./tracker.service";

// Multi-tenant in-memory store for Workspace Hub cards keyed by userId
const memoryHubCardsByUser = new Map<string, IWorkspaceCard[]>();

function buildDefaultWorkspaceCards(userId: string): IWorkspaceCard[] {
  const now = new Date();
  return [
    {
      _id: new mongoose.Types.ObjectId().toString(),
      userId,
      title: "Routine & Habit Tracker",
      moduleKey: "habits",
      icon: "target",
      coverImage:
        "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=1200&q=80",
      route: "/dashboard/habits",
      order: 1,
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new mongoose.Types.ObjectId().toString(),
      userId,
      title: "Calendar",
      moduleKey: "calendar",
      icon: "calendar",
      coverImage:
        "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=1200&q=80",
      route: "/dashboard/calendar",
      order: 2,
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new mongoose.Types.ObjectId().toString(),
      userId,
      title: "Finance",
      moduleKey: "finance",
      icon: "wallet",
      coverImage:
        "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80",
      route: "/dashboard/finance",
      order: 3,
      status: "coming_soon",
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new mongoose.Types.ObjectId().toString(),
      userId,
      title: "Exercise",
      moduleKey: "exercise",
      icon: "dumbbell",
      coverImage:
        "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80",
      route: "/dashboard/exercise",
      order: 4,
      status: "coming_soon",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function getTodayUtcDateString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function computeLivePreviewForCard(
  userId: string,
  moduleKey: WorkspaceModuleKey
): Promise<WorkspaceCardLivePreview> {
  if (moduleKey === "habits") {
    const todayStr = getTodayUtcDateString();
    const [stats, todayLog] = await Promise.all([
      getConsistencyStats(userId),
      getOrCreateDailyLog(userId, todayStr),
    ]);

    return {
      consistencyScore: stats.overallCompletionPercentage,
      currentStreak: stats.currentStreak,
      todayProgress: {
        completedCount: todayLog.completedCount,
        totalCount: todayLog.totalCount,
        completionPercentage: todayLog.completionPercentage,
      },
    };
  }

  if (moduleKey === "calendar") {
    return {
      subtitle: "Schedule & Events",
    };
  }

  return {
    subtitle: "Coming Soon",
  };
}

async function enrichCards(
  userId: string,
  cards: IWorkspaceCard[]
): Promise<EnrichedWorkspaceCard[]> {
  const sorted = [...cards].sort((a, b) => a.order - b.order);
  const enriched: EnrichedWorkspaceCard[] = [];

  for (const card of sorted) {
    const livePreview = await computeLivePreviewForCard(userId, card.moduleKey);
    enriched.push({
      id: String(card._id),
      userId: String(card.userId),
      title: card.title,
      moduleKey: card.moduleKey,
      icon: card.icon,
      coverImage: card.coverImage,
      route: card.route,
      order: card.order,
      status: card.status,
      livePreview,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    });
  }

  return enriched;
}

export async function seedDefaultWorkspaceCards(
  userId: string,
  forceReset = false
): Promise<IWorkspaceCard[]> {
  if (isDatabaseConnected()) {
    if (forceReset) {
      await WorkspaceCardModel.deleteMany({ userId });
    }
    const existingCount = await WorkspaceCardModel.countDocuments({ userId });
    if (existingCount === 0) {
      const defaults = buildDefaultWorkspaceCards(userId).map(
        ({ _id: _omitId, ...rest }) => rest
      );
      await WorkspaceCardModel.insertMany(defaults);
    }
    return WorkspaceCardModel.find({ userId }).sort({ order: 1 }).lean();
  }

  let userCards = memoryHubCardsByUser.get(userId);
  if (!userCards || forceReset || userCards.length === 0) {
    userCards = buildDefaultWorkspaceCards(userId);
    memoryHubCardsByUser.set(userId, userCards);
  }
  return structuredClone(userCards);
}

export async function getUserWorkspaceHub(
  userId: string
): Promise<EnrichedWorkspaceCard[]> {
  if (isDatabaseConnected()) {
    let cards: IWorkspaceCard[] = await WorkspaceCardModel.find({ userId })
      .sort({ order: 1 })
      .lean();
    if (cards.length === 0) {
      cards = await seedDefaultWorkspaceCards(userId, false);
    }
    return enrichCards(userId, cards);
  }

  const cards = await seedDefaultWorkspaceCards(userId, false);
  return enrichCards(userId, cards);
}

export interface CreateWorkspaceCardInput {
  title: string;
  moduleKey?: WorkspaceModuleKey;
  icon?: string;
  coverImage?: string;
  route?: string;
  order?: number;
  status?: WorkspaceCardStatus;
}

export async function createWorkspaceCard(
  userId: string,
  input: CreateWorkspaceCardInput
): Promise<EnrichedWorkspaceCard> {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Card `title` is required.");
  }

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const moduleKey: WorkspaceModuleKey = input.moduleKey ?? "custom";
  const icon = input.icon?.trim() || "file-text";
  const coverImage =
    input.coverImage?.trim() ||
    "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80";
  const route = input.route?.trim() || `/dashboard/${slug || "custom"}`;
  const status: WorkspaceCardStatus = input.status ?? "active";

  if (isDatabaseConnected()) {
    const existingCards = await WorkspaceCardModel.find({ userId })
      .sort({ order: -1 })
      .limit(1)
      .lean();
    const maxOrder = existingCards[0]?.order ?? 0;
    const order = input.order ?? maxOrder + 1;

    const created = await WorkspaceCardModel.create({
      userId,
      title,
      moduleKey,
      icon,
      coverImage,
      route,
      order,
      status,
    });

    const [enriched] = await enrichCards(userId, [created.toObject()]);
    if (!enriched) {
      throw new Error("Failed to enrich created workspace card");
    }
    return enriched;
  }

  const userCards = await seedDefaultWorkspaceCards(userId, false);
  const maxOrder = userCards.reduce((max, c) => Math.max(max, c.order), 0);
  const order = input.order ?? maxOrder + 1;
  const now = new Date();

  const newCard: IWorkspaceCard = {
    _id: new mongoose.Types.ObjectId().toString(),
    userId,
    title,
    moduleKey,
    icon,
    coverImage,
    route,
    order,
    status,
    createdAt: now,
    updatedAt: now,
  };

  userCards.push(newCard);
  memoryHubCardsByUser.set(userId, userCards);

  const [enriched] = await enrichCards(userId, [newCard]);
  if (!enriched) {
    throw new Error("Failed to enrich created workspace card");
  }
  return enriched;
}

export interface UpdateWorkspaceCardInput {
  title?: string;
  coverImage?: string;
  icon?: string;
  order?: number;
  status?: WorkspaceCardStatus;
  route?: string;
}

export async function updateWorkspaceCard(
  userId: string,
  cardId: string,
  updates: UpdateWorkspaceCardInput
): Promise<EnrichedWorkspaceCard> {
  const sanitizedUpdates: Partial<IWorkspaceCard> = {};
  if (typeof updates.title === "string" && updates.title.trim()) {
    sanitizedUpdates.title = updates.title.trim();
  }
  if (typeof updates.coverImage === "string") {
    sanitizedUpdates.coverImage = updates.coverImage.trim();
  }
  if (typeof updates.icon === "string" && updates.icon.trim()) {
    sanitizedUpdates.icon = updates.icon.trim();
  }
  if (typeof updates.order === "number" && !Number.isNaN(updates.order)) {
    sanitizedUpdates.order = updates.order;
  }
  if (updates.status === "active" || updates.status === "coming_soon") {
    sanitizedUpdates.status = updates.status;
  }
  if (typeof updates.route === "string" && updates.route.trim()) {
    sanitizedUpdates.route = updates.route.trim();
  }

  if (isDatabaseConnected()) {
    const updated = await WorkspaceCardModel.findOneAndUpdate(
      { _id: cardId, userId },
      { $set: sanitizedUpdates },
      { new: true }
    ).lean();

    if (!updated) {
      throw new Error("Workspace card not found or unauthorized");
    }

    const [enriched] = await enrichCards(userId, [updated]);
    if (!enriched) {
      throw new Error("Failed to enrich updated workspace card");
    }
    return enriched;
  }

  const userCards = await seedDefaultWorkspaceCards(userId, false);
  const idx = userCards.findIndex(
    (c) => String(c._id) === cardId && String(c.userId) === userId
  );

  if (idx === -1) {
    throw new Error("Workspace card not found or unauthorized");
  }

  const current = userCards[idx]!;
  const updatedCard: IWorkspaceCard = {
    ...current,
    ...sanitizedUpdates,
    updatedAt: new Date(),
  };
  userCards[idx] = updatedCard;
  memoryHubCardsByUser.set(userId, userCards);

  const [enriched] = await enrichCards(userId, [updatedCard]);
  if (!enriched) {
    throw new Error("Failed to enrich updated workspace card");
  }
  return enriched;
}

export async function deleteWorkspaceCard(
  userId: string,
  cardId: string
): Promise<{ deletedId: string }> {
  if (isDatabaseConnected()) {
    const deleted = await WorkspaceCardModel.findOneAndDelete({
      _id: cardId,
      userId,
    }).lean();

    if (!deleted) {
      throw new Error("Workspace card not found or unauthorized");
    }
    return { deletedId: String(deleted._id) };
  }

  const userCards = await seedDefaultWorkspaceCards(userId, false);
  const idx = userCards.findIndex(
    (c) => String(c._id) === cardId && String(c.userId) === userId
  );

  if (idx === -1) {
    throw new Error("Workspace card not found or unauthorized");
  }

  userCards.splice(idx, 1);
  memoryHubCardsByUser.set(userId, userCards);
  return { deletedId: cardId };
}
