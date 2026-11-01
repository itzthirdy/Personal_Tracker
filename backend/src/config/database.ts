import mongoose from "mongoose";

let dbConnected = false;

export function isDatabaseConnected(): boolean {
  return dbConnected && mongoose.connection.readyState === 1;
}

export async function connectDatabase(): Promise<boolean> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn(
      "⚠️  MONGODB_URI is not set. Running with in-memory fallback storage until MongoDB is configured."
    );
    dbConnected = false;
    return false;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
    });
    dbConnected = true;
    console.log("✅ MongoDB connected:", uri);
    return true;
  } catch (error) {
    dbConnected = false;
    console.warn(
      "⚠️  Could not connect to MongoDB (database may not be set up or running yet). Falling back to in-memory storage."
    );
    return false;
  }
}
