import { connectDatabase } from "../config/database";
import app from "../app";

// Pre-warm database connection for Vercel serverless environment
void connectDatabase();

export default app;
