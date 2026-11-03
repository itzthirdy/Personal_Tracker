import mongoose from "mongoose";

let dbConnected = false;

export function isDatabaseConnected(): boolean {
  return dbConnected && mongoose.connection.readyState === 1;
}

/**
 * Before multi-user support, `routinetemplates.dayOfWeek` and `dailylogs.date`
 * had GLOBAL unique indexes. They must be dropped so uniqueness can be scoped
 * per user ({ userId, dayOfWeek } / { userId, date }). Only these two legacy
 * indexes are dropped (no documents are touched), then current indexes are built.
 */
async function migrateLegacyIndexes(): Promise<void> {
  const legacy: Array<{ collection: string; index: string }> = [
    { collection: "routinetemplates", index: "dayOfWeek_1" },
    { collection: "dailylogs", index: "date_1" },
  ];

  const db = mongoose.connection.db;
  if (!db) return;

  for (const { collection, index } of legacy) {
    try {
      const col = db.collection(collection);
      const indexes = await col.indexes();
      if (indexes.some((i) => i.name === index)) {
        await col.dropIndex(index);
        console.log(`🔧 Dropped legacy index ${collection}.${index}`);
      }
    } catch (error) {
      console.warn(
        `⚠️  Could not migrate index ${collection}.${index}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  try {
    await Promise.all(
      Object.values(mongoose.models).map((model) => model.createIndexes())
    );
  } catch (error) {
    console.warn(
      "⚠️  Could not build indexes:",
      error instanceof Error ? error.message : error
    );
  }
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
      serverSelectionTimeoutMS: 10000,
    });
    dbConnected = true;
    await migrateLegacyIndexes();
    const maskedUri = uri.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:****@");
    console.log("✅ MongoDB connected:", maskedUri);
    return true;
  } catch (error) {
    dbConnected = false;
    const reason = error instanceof Error ? error.message : String(error);
    console.warn("⚠️  Could not connect to MongoDB:", reason);
    console.warn("   Falling back to in-memory storage.");
    return false;
  }
}
