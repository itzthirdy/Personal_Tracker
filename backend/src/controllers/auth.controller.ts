import type { Request, Response } from "express";
import {
  getUserProfileById,
  loginUser,
  registerUser,
} from "../services/auth.service";

export async function handleRegister(req: Request, res: Response) {
  try {
    const { username, email, password } = req.body as {
      username?: string;
      email?: string;
      password?: string;
    };

    const result = await registerUser({
      username: String(username ?? ""),
      email: String(email ?? ""),
      password: String(password ?? ""),
    });

    res.status(201).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to register user";
    const status = message.includes("already registered") ? 409 : 400;
    res.status(status).json({ error: message });
  }
}

export async function handleLogin(req: Request, res: Response) {
  try {
    const { email, username, identifier, password } = req.body as {
      email?: string;
      username?: string;
      identifier?: string;
      password?: string;
    };

    const loginIdentifier = identifier ?? email ?? username ?? "";

    const result = await loginUser({
      identifier: String(loginIdentifier),
      password: String(password ?? ""),
    });

    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to authenticate user";
    const status = message === "Invalid credentials." ? 401 : 400;
    res.status(status).json({ error: message });
  }
}

export async function handleGetMe(req: Request, res: Response) {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await getUserProfileById(req.user.userId);
    res.json({ user });
  } catch (error) {
    res.status(404).json({
      error: error instanceof Error ? error.message : "User not found",
    });
  }
}

