import express from "express";
import cors from "cors";
import { isDatabaseConnected } from "./config/database";
import authRoutes from "./routes/auth.routes";
import hubRoutes from "./routes/hub.routes";
import trackerRoutes from "./routes/tracker.routes";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    database: isDatabaseConnected() ? "mongodb" : "in-memory-fallback",
  });
});

// Authentication & User Management routes
app.use("/api/auth", authRoutes);

// Customizable Workspace Hub Cards routes
app.use("/api/hub", hubRoutes);

// Multi-Tenant Habit & Routine Tracker routes
app.use("/api/tracker", trackerRoutes);
app.use("/api/habits", trackerRoutes);
app.use("/api", trackerRoutes);

export default app;
