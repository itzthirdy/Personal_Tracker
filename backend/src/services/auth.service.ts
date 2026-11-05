import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import { isDatabaseConnected } from "../config/database";
import { signJwtToken } from "../middleware/auth.middleware";
import { UserModel, type IUser, type PublicUserProfile } from "../models/User";
import { seedDefaultWorkspaceCards } from "./hub.service";

// In-memory fallback store for users when MongoDB is not connected
const memoryUsersById = new Map<string, IUser>();

// Portable password hashing using Node/Bun built-in node:crypto (works identically on Vercel Node.js and Bun)
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith("scrypt$")) {
    const parts = storedHash.split("$");
    const salt = parts[1];
    const keyHex = parts[2];
    if (!salt || !keyHex) return false;
    const keyBuffer = Buffer.from(keyHex, "hex");
    const derivedBuffer = scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedBuffer.length) return false;
    return timingSafeEqual(keyBuffer, derivedBuffer);
  }

  // Fallback for legacy $argon2 / $2b hashes created under Bun locally
  const g = globalThis as unknown as {
    Bun?: { password?: { verify: (pw: string, hash: string) => Promise<boolean> } };
  };
  if (g.Bun?.password?.verify) {
    return g.Bun.password.verify(password, storedHash);
  }
  return false;
}

function toPublicProfile(user: IUser): PublicUserProfile {
  return {
    id: String(user._id),
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  };
}

export interface RegisterUserInput {
  username: string;
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: PublicUserProfile;
}

export async function registerUser(
  input: RegisterUserInput
): Promise<AuthResult> {
  const username = input.username?.trim();
  const email = input.email?.trim().toLowerCase();
  const password = input.password;

  if (!username || !email || !password) {
    throw new Error("username, email, and password are required.");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  const passwordHash = hashPassword(password);

  let createdUser: IUser;

  if (isDatabaseConnected()) {
    const existing = await UserModel.findOne({
      $or: [{ email }, { username }],
    }).lean();

    if (existing) {
      throw new Error("Username or email is already registered.");
    }

    const doc = await UserModel.create({
      username,
      email,
      passwordHash,
    });
    createdUser = doc.toObject();
  } else {
    for (const u of memoryUsersById.values()) {
      if (
        u.email === email ||
        u.username.toLowerCase() === username.toLowerCase()
      ) {
        throw new Error("Username or email is already registered.");
      }
    }

    const now = new Date();
    createdUser = {
      _id: new mongoose.Types.ObjectId().toString(),
      username,
      email,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    };
    memoryUsersById.set(String(createdUser._id), createdUser);
  }

  const userId = String(createdUser._id);

  // Zero-state onboarding: only the 3 default Workspace Hub cards are seeded.
  // The user's habit/routine list starts completely empty.
  await seedDefaultWorkspaceCards(userId, false);

  const userProfile = toPublicProfile(createdUser);
  const token = signJwtToken({
    userId: userProfile.id,
    email: userProfile.email,
    username: userProfile.username,
  });

  return {
    token,
    user: userProfile,
  };
}

export interface LoginUserInput {
  identifier: string; // email or username
  password: string;
}

export async function loginUser(input: LoginUserInput): Promise<AuthResult> {
  const identifier = input.identifier?.trim();
  const password = input.password;

  if (!identifier || !password) {
    throw new Error("Email/username and password are required.");
  }

  const normalizedEmail = identifier.toLowerCase();
  let foundUser: IUser | null = null;

  if (isDatabaseConnected()) {
    foundUser = await UserModel.findOne({
      $or: [{ email: normalizedEmail }, { username: identifier }],
    }).lean();
  } else {
    for (const u of memoryUsersById.values()) {
      if (
        u.email === normalizedEmail ||
        u.username.toLowerCase() === identifier.toLowerCase()
      ) {
        foundUser = u;
        break;
      }
    }
  }

  if (!foundUser) {
    throw new Error("Invalid credentials.");
  }

  const isValid = await verifyPassword(password, foundUser.passwordHash);
  if (!isValid) {
    throw new Error("Invalid credentials.");
  }

  const userProfile = toPublicProfile(foundUser);
  const token = signJwtToken({
    userId: userProfile.id,
    email: userProfile.email,
    username: userProfile.username,
  });

  return {
    token,
    user: userProfile,
  };
}

export async function getUserProfileById(
  userId: string
): Promise<PublicUserProfile> {
  if (isDatabaseConnected()) {
    const doc = await UserModel.findById(userId).lean();
    if (!doc) {
      throw new Error("User not found.");
    }
    return toPublicProfile(doc);
  }

  const memUser = memoryUsersById.get(userId);
  if (!memUser) {
    throw new Error("User not found.");
  }
  return toPublicProfile(memUser);
}

