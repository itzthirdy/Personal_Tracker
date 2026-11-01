import express from "express";
import cors from "cors";
import { isDatabaseConnected } from "./config/database";
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

app.use("/api", trackerRoutes);
app.use("/api/tracker", trackerRoutes);

export default app;
