import { connectDatabase } from "../src/config/database";
import app from "../src/app";

// Pre-warm database connection for Vercel serverless environment
void connectDatabase();

export default app;

