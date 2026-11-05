import mongoose from "mongoose";

interface GlobalMongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  migrated: boolean;
}

declare global {
  var __personalTrackerMongoose: GlobalMongooseCache | undefined;
}

const cached: GlobalMongooseCache = globalThis.__personalTrackerMongoose ?? {
  conn: null,
  promise: null,
  migrated: false,
};

globalThis.__personalTrackerMongoose = cached;

export function isDatabaseConnected(): boolean {
  return Boolean(cached.conn) && mongoose.connection.readyState === 1;
}

/**
 * Before multi-user support, `routinetemplates.dayOfWeek` and `dailylogs.date`
 * had GLOBAL unique indexes. They must be dropped so uniqueness can be scoped
 * per user ({ userId, dayOfWeek } / { userId, date }). Only these legacy
 * indexes are dropped (no documents are touched), then current indexes are built.
 */
async function migrateLegacyIndexes(): Promise<void> {
  if (cached.migrated) return;

  const legacy: Array<{ collection: string; index: string }> = [
    { collection: "routinetemplates", index: "dayOfWeek_1" },
    { collection: "dailylogs", index: "date_1" },
    { collection: "routinetemplates", index: "userId_1_dayOfWeek_1" },
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
    cached.migrated = true;
  } catch (error) {
    console.warn(
      "⚠️  Could not build indexes:",
      error instanceof Error ? error.message : error
    );
  }
}

export async function connectDatabase(): Promise<boolean> {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return true;
  }

  const uri = process.env.MONGODB_URI?.trim();

  if (!uri) {
    cached.conn = null;
    cached.promise = null;
    return false;
  }

  try {
    if (!cached.promise) {
      cached.promise = mongoose
        .connect(uri, {
          dbName: "personal_tracker",
          serverSelectionTimeoutMS: 10000,
          bufferCommands: false,
        })
        .then(async (m) => {
          cached.conn = m;
          await migrateLegacyIndexes();
          const maskedUri = uri.replace(
            /:\/\/([^:]+):([^@]+)@/,
            "://$1:****@"
          );
          console.log("✅ MongoDB connected:", maskedUri);
          return m;
        })
        .catch((err) => {
          cached.promise = null;
          cached.conn = null;
          throw err;
        });
    }

    await cached.promise;
    return true;
  } catch (error) {
    cached.conn = null;
    cached.promise = null;
    const reason = error instanceof Error ? error.message : String(error);
    console.warn("⚠️  Could not connect to MongoDB:", reason);
    console.warn("   Falling back to in-memory storage.");
    return false;
  }
}
