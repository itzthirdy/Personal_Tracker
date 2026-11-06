import { Router } from "express";
import {
  createEvent,
  deleteEvent,
  getEvents,
  updateEvent,
} from "../controllers/calendar.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

// Protect all calendar schedule routes
router.use(requireAuth);

router.get("/events", getEvents);
router.get("/", getEvents);
router.post("/events", createEvent);
router.post("/", createEvent);
router.put("/events/:id", updateEvent);
router.patch("/events/:id", updateEvent);
router.delete("/events/:id", deleteEvent);

export default router;

