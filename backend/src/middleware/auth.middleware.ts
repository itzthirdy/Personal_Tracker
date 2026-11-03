import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedUserPayload {
  userId: string;
  email: string;
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUserPayload;
    }
  }
}

const DEFAULT_JWT_SECRET = "dev-personal-tracker-jwt-secret-key-2026";

export function getJwtSecret(): string {
  return process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0
    ? process.env.JWT_SECRET.trim()
    : DEFAULT_JWT_SECRET;
}

export function signJwtToken(payload: AuthenticatedUserPayload): string {
  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      username: payload.username,
    },
    getJwtSecret(),
    { expiresIn: "7d" }
  );
}

export function verifyJwtToken(token: string): AuthenticatedUserPayload {
  const decoded = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload &
    AuthenticatedUserPayload;

  if (!decoded || !decoded.userId || !decoded.email || !decoded.username) {
    throw new Error("Invalid token payload");
  }

  return {
    userId: String(decoded.userId),
    email: String(decoded.email),
    username: String(decoded.username),
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Unauthorized: Missing or malformed Authorization Bearer token",
    });
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({
      error: "Unauthorized: Empty Bearer token",
    });
    return;
  }

  try {
    const payload = verifyJwtToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({
      error: "Unauthorized: Invalid or expired token",
    });
  }
}

