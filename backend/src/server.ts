import app from "./app";
import { connectDatabase } from "./config/database";
import { seedDefaultRoutines } from "./services/tracker.service";

const port = Number(process.env.PORT ?? 8000);

try {
  await connectDatabase();
  await seedDefaultRoutines(false);

  app.listen(port, () => {
    console.log(`🚀 Habit & Routine Tracker API running on http://localhost:${port}`);
  });
} catch (error) {
  console.error("Failed to start backend:", error);
  process.exit(1);
}
