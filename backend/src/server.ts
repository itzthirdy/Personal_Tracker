import app from "./app";
import { connectDatabase } from "./config/database";

const port = Number(process.env.PORT ?? 8000);

async function startServer() {
  try {
    await connectDatabase();

    app.listen(port, () => {
      console.log(
        `🚀 Multi-User SaaS Personal Tracker API running on http://localhost:${port}`
      );
    });
  } catch (error) {
    console.error("Failed to start backend:", error);
    process.exit(1);
  }
}

void startServer();
