import { Router } from "express";
import {
  handleGetMe,
  handleLogin,
  handleRegister,
} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/register", handleRegister);
router.post("/login", handleLogin);
router.get("/me", requireAuth, handleGetMe);

export default router;

