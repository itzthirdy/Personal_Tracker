#!/usr/bin/env bash
set -e

# Ensure Bun is available in PATH
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Name of your root monorepo directory
PROJECT_NAME="Personal_Tracker"

echo "Initializing monorepo directory: $PROJECT_NAME..."


# 1. Initialize root Git repository
git init -b main

# 2. Setup Frontend (Next.js with Bun)
echo "Scaffolding Next.js frontend..."
bun create next-app@latest frontend --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-bun
rm -rf frontend/.git

# 3. Setup Backend (Bun + Express + TypeScript)
echo "Scaffolding Express + TypeScript backend..."
mkdir -p backend/src/{config,routes,controllers,services,models,middleware}
cd backend

# Initialize backend package.json
bun init -y
rm -f index.ts

# Install backend dependencies
bun add express mongoose cors
bun add -d @types/express @types/cors typescript

# Configure package.json
cat << 'EOF' > package.json
{
  "name": "backend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/server.ts",
    "start": "bun src/server.ts",
    "typecheck": "tsc --noEmit"
  }
}
EOF

# Create src/app.ts
cat << 'EOF' > src/app.ts
import express from "express";
import cors from "cors";

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
  credentials: true,
}));

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

export default app;
EOF

# Create src/config/database.ts
cat << 'EOF' > src/config/database.ts
import mongoose from "mongoose";

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is required");
  }

  await mongoose.connect(uri);
  console.log("MongoDB connected");
}
EOF

# Create src/server.ts
cat << 'EOF' > src/server.ts
import app from "./app";
import { connectDatabase } from "./config/database";

const port = Number(process.env.PORT ?? 8000);

try {
  await connectDatabase();

  app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
  });
} catch (error) {
  console.error("Failed to start backend:", error);
  process.exit(1);
}
EOF

# Create backend .env and .env.example
cat << 'EOF' > .env
PORT=8000
FRONTEND_ORIGIN=http://localhost:3000
MONGODB_URI=mongodb://127.0.0.1:27017/audrolics
EOF

cp .env .env.example

# Create backend .gitignore
cat << 'EOF' > .gitignore
node_modules/
.env
dist/
EOF

cd ..

# 4. Root Repository Configuration
cat << 'EOF' > .gitignore
node_modules/
.env
.env.local
.DS_Store
dist/
.next/
EOF

cat << 'EOF' > README.md
# Audrolics Monorepo

## Structure
- \`frontend/\`: Next.js (App Router, Tailwind CSS, TypeScript)
- \`backend/\`: Express.js, TypeScript, Mongoose, Bun runtime

## Development

### Frontend
```bash
cd frontend
bun run dev
