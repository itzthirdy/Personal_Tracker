import app from "./app";
import { connectDatabase } from "./config/database";

// Pre-warm database connection for Vercel serverless environment
void connectDatabase();

export default app;

