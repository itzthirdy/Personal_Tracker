import express from "express";
import cors from "cors";
import { connectDatabase, isDatabaseConnected } from "./config/database";
import authRoutes from "./routes/auth.routes";
import hubRoutes from "./routes/hub.routes";
import trackerRoutes from "./routes/tracker.routes";

const app = express();

const allowedOrigins = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(",")
      .map((o) => o.trim())
      .filter(Boolean)
  : ["http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server, curl, or same-origin requests with no Origin header
      if (!origin) {
        callback(null, true);
        return;
      }
      if (
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(origin) ||
        /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)
      ) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);

app.use(express.json());

// Serverless DB readiness middleware: ensures Mongoose connects on cold starts before handling routes
app.use(async (_req, _res, next) => {
  if (!isDatabaseConnected() && process.env.MONGODB_URI) {
    await connectDatabase();
  }
  next();
});

app.get("/", (_req, res) => {
  res.json({
    service: "Personal Tracker API",
    status: "ok",
    database: isDatabaseConnected() ? "mongodb" : "in-memory-fallback",
  });
});

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
