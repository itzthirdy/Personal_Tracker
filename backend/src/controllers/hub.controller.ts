import type { Request, Response } from "express";
import type {
  WorkspaceCardStatus,
  WorkspaceModuleKey,
} from "../models/WorkspaceCard";
import {
  createWorkspaceCard,
  deleteWorkspaceCard,
  getUserWorkspaceHub,
  updateWorkspaceCard,
} from "../services/hub.service";

export async function handleGetWorkspaceHub(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const cards = await getUserWorkspaceHub(userId);
    res.json({ cards });
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch workspace hub cards",
    });
  }
}

export async function handleCreateWorkspaceCard(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { title, moduleKey, icon, coverImage, route, order, status } =
      req.body as {
        title?: string;
        moduleKey?: WorkspaceModuleKey;
        icon?: string;
        coverImage?: string;
        route?: string;
        order?: number;
        status?: WorkspaceCardStatus;
      };

    if (!title || !title.trim()) {
      res.status(400).json({ error: "`title` is required to create a card." });
      return;
    }

    const card = await createWorkspaceCard(userId, {
      title,
      moduleKey,
      icon,
      coverImage,
      route,
      order,
      status,
    });

    res.status(201).json({ card });
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to create workspace card",
    });
  }
}

export async function handleUpdateWorkspaceCard(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const cardId = String(req.params.id ?? "");
    const { title, coverImage, icon, order, status, route } = req.body as {
      title?: string;
      coverImage?: string;
      icon?: string;
      order?: number;
      status?: WorkspaceCardStatus;
      route?: string;
    };

    const card = await updateWorkspaceCard(userId, cardId, {
      title,
      coverImage,
      icon,
      order,
      status,
      route,
    });

    res.json({ card });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update workspace card";
    const status = message.includes("not found") ? 404 : 400;
    res.status(status).json({ error: message });
  }
}

export async function handleDeleteWorkspaceCard(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const cardId = String(req.params.id ?? "");
    const result = await deleteWorkspaceCard(userId, cardId);
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to delete workspace card";
    const status = message.includes("not found") ? 404 : 400;
    res.status(status).json({ error: message });
  }
}

