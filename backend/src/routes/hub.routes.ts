import { Router } from "express";
import {
  handleCreateWorkspaceCard,
  handleDeleteWorkspaceCard,
  handleGetWorkspaceHub,
  handleUpdateWorkspaceCard,
} from "../controllers/hub.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);

router.get("/", handleGetWorkspaceHub);
router.post("/cards", handleCreateWorkspaceCard);
router.patch("/cards/:id", handleUpdateWorkspaceCard);
router.delete("/cards/:id", handleDeleteWorkspaceCard);

export default router;

