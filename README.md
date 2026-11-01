# Personal Tracker 📅⚡

<<<<<<< HEAD
A full-stack habit and routine tracking dashboard inspired by the GitHub contribution heatmap. Designed to build daily discipline by converting recurring schedules into visual heatmaps and dynamic progress insights.

---

## 🌟 Key Features

- **GitHub-Inspired Heatmap Calendar:** Visualizes daily completion intensity using classic GitHub green shades (`0%` dark gray up to `100%` vibrant neon green).
- **Dual-Schema Architecture:** Supports day-of-the-week recurring schedule templates (Monday–Sunday) and specific calendar snapshot logs (`YYYY-MM-DD`).
- **Split-View Dashboard:** Side-by-side desktop layout featuring the interactive calendar on the left and selected daily checklists on the right.
- **View Toggle:** Seamlessly switch between a standard **Monthly Calendar View** and a rolling **GitHub Commit Strip**.
- **Categorized Routine Management:** Organize habits under dedicated categories (*Academics / School*, *Fitness / Workout*, *Chores & Lifestyle*, *General*).
- **Instant Optimistic Updates:** Toggling a habit updates daily completion bars and recalculates the calendar square's shade in real time.
- **Summary Metrics Banner:** Tracks current streak count, weekly average completion percentage, and peak productive days.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js (App Router)
- **Library:** React 19
- **Styling:** Tailwind CSS (Modern Dark Theme)
- **Icons & UI:** Lucide React

### Backend & Database
- **Runtime:** Bun
- **Server Framework:** Express.js (TypeScript)
- **Database:** MongoDB Atlas
- **ODM:** Mongoose
- **CORS & Middleware:** JSON body parsing & origin security
=======
A full-stack habit and routine tracking dashboard inspired by the GitHub contribution heatmap. Designed to build daily discipline by converting recurring weekly schedules (Monday–Sunday) into interactive checklists, visual green-shade heatmaps, and real-time consistency insights.

---

## 🌟 Key Features

- **GitHub-Inspired Heatmap Calendar:** Visualizes daily completion intensity using GitHub green shades (`0%` dark neutral up to `100%` vibrant neon green with a glowing accent).
- **Dual-Schema Architecture:** Supports recurring day-of-the-week schedule templates (`Monday`–`Sunday`) and date-specific snapshot logs (`YYYY-MM-DD`) that auto-populate from that weekday's template.
- **Automatic Database Fallback:** Connects to **MongoDB Atlas** via Mongoose when configured, and seamlessly falls back to an **in-memory store** if MongoDB is offline or not yet set up—ensuring zero-crash development.
- **Split-View Dashboard:** Responsive side-by-side layout featuring the interactive heatmap calendar on the left and the selected day's categorized checklist on the right.
- **View Toggle (`Monthly View` & `Commit Strip`):** Seamlessly switch between a standard 7-column monthly calendar grid (with dimmed padding dates and floating hover tooltips) and a horizontal scrolling GitHub contribution matrix + linear daily commit strip.
- **Categorized Routine Management:** Automatically groups habits under four clean sections:
  - 📚 **Academics / School** (`school`, `study`)
  - 🏋️ **Fitness / Workout** (`workout`)
  - 🧹 **Chores & Lifestyle** (`chores`, `work`)
  - ⚡ **General** (`routine`, `custom`)
- **Instant Optimistic Updates:** Checking/unchecking a habit, clicking **Check All / Uncheck All**, adding custom routines, or removing items immediately updates the progress bar, recalculates the date square's green shade on the calendar, and updates the top summary banner.
- **Summary Metrics Banner:** Tracks **Current Streak (days 🔥)**, **Weekly Completion Rate (%)**, and **Best Day of the Week (🏆)**.

---

## 🎨 Color Palette & GitHub Shade Scale

- **App Canvas:** `#0d1117` / `#090d16`
- **Cards & Surfaces:** `#161b22` with `#30363d` borders
- **Active Selected Date Accent:** Deep Crimson (`#801E0F` / `#991b1b`)

| Shade Level | Completion Range | Hex Color | Meaning |
| :---: | :---: | :---: | :--- |
| **Level 0** | `0%` | `#21262d` | No habits completed (empty dark slot) |
| **Level 1** | `1% – 33%` | `#0e4429` | Low consistency (darkest green) |
| **Level 2** | `34% – 66%` | `#006d32` | Moderate consistency (medium green) |
| **Level 3** | `67% – 99%` | `#26a641` | High consistency (bright green) |
| **Level 4** | `100%` | `#39d353` | All habits completed (vibrant neon green + glow) |

---

## 🗓️ Default Weekly Routine Schedule (Monday – Sunday)

All weekday checklists are seeded without rigid time slots so the focus stays on daily habit consistency:

- **Monday & Thursday (10 habits):**
  - Wake up & Get ready, Gym, Go home, Bath & Get Ready, Commute to School, Adv. Machine Learning (501MB), Self Study in Library, Dinner, Software Engineering 2 (501MB), Head Home, Bath & Sleep
- **Tuesday & Friday (10 habits):**
  - Wake Up & Get ready, Gym, Go home, Bath & Get Ready, Commute to School, Adv. Machine Learning (408MB), Self Study in Library, Dinner, Software Engineering 2 (408MB), Head Home, Bath & Sleep
- **Wednesday (7 habits):**
  - Wake Up & Get ready, Commute to School, Self Study in Library, App Dev & Emerging Tech (408MB), Info Assurance & Security (408MB), Head Home, Bath, Dinner & Sleep
- **Saturday (8 habits):**
  - Wake Up & Get ready, Commute to School, Self Study in Library, Breakfast / Break, App Dev & Emerging Tech (501MB), Info Assurance & Security (501MB), Head Home, Bath, Dinner & Sleep
- **Sunday (5 habits):**
  - Work - Grab, Ironing clothes, Washing Clothes, Cooking meal prep, Prepare for next week

---

## 🛠️ Tech Stack

### Frontend (`frontend/`)
- **Framework:** Next.js 16 (App Router, TypeScript)
- **Library:** React 19
- **Styling:** Tailwind CSS v4 (Custom Dark Theme)

### Backend & Database (`backend/`)
- **Runtime & Test Runner:** Bun (`bun run`, `bun test`)
- **Server Framework:** Express.js 5 (TypeScript)
- **Database:** MongoDB Atlas + Mongoose 9 (with automatic in-memory fallback)
- **Middleware:** CORS & JSON body parsing
>>>>>>> cc06482 (docs: update README with comprehensive project documentation and add atlas-credentials.env to backend gitignore)

---

## 📁 Repository Structure

```text
Personal_Tracker/
├── backend/
│   ├── src/
<<<<<<< HEAD
│   │   ├── config/          # Database connection & Atlas client
│   │   ├── controllers/     # Habit & DailyLog business logic
│   │   ├── models/          # RoutineTemplate & DailyLog schemas
│   │   ├── routes/          # Express API endpoints
│   │   ├── app.ts           # Express application configuration
│   │   └── server.ts        # Server entry point
=======
│   │   ├── config/
│   │   │   ├── database.ts          # MongoDB Atlas connection + in-memory fallback
│   │   │   └── defaultSchedule.ts   # Mon–Sun default checklists & GitHub shade logic
│   │   ├── controllers/
│   │   │   └── tracker.controller.ts # Request handlers for routines, logs, calendar & stats
│   │   ├── models/
│   │   │   ├── RoutineTemplate.ts   # Mongoose schema for weekly day templates
│   │   │   └── DailyLog.ts          # Mongoose schema for YYYY-MM-DD daily checklists
│   │   ├── routes/
│   │   │   └── tracker.routes.ts    # Express router (/routines, /logs, /calendar, /stats)
│   │   ├── services/
│   │   │   └── tracker.service.ts   # Core business logic, streak & heatmap calculations
│   │   ├── app.ts                   # Express app setup (/api & /api/tracker mounts)
│   │   ├── server.ts                # Server entry point & default schedule seeding
│   │   └── tracker.test.ts          # Automated Bun test suite
│   ├── .env                         # Backend environment variables (PORT, MONGODB_URI)
>>>>>>> cc06482 (docs: update README with comprehensive project documentation and add atlas-credentials.env to backend gitignore)
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
<<<<<<< HEAD
│   │   ├── app/             # Next.js App Router (page.tsx, layout.tsx)
│   │   └── components/      # HeatmapCalendar, DailyChecklist, SummaryBanner
│   ├── package.json
│   └── tailwind.config.ts
├── websetup.sh              # Project scaffolding automation script
└── README.md
=======
│   │   ├── app/
│   │   │   ├── globals.css          # Dark theme styling (#0d1117 canvas)
│   │   │   ├── layout.tsx           # Root HTML layout & metadata
│   │   │   └── page.tsx             # Main dashboard (Summary Banner + Split View + state sync)
│   │   ├── components/
│   │   │   ├── HeatmapCalendar.tsx  # Monthly View & Commit Strip toggle + hover tooltips
│   │   │   └── DailyChecklist.tsx   # Categorized habit checklist + Quick Add form
│   │   ├── lib/
│   │   │   └── api.ts               # Backend API client & offline preview fallback
│   │   └── types/
│   │       └── tracker.ts           # Shared TypeScript interfaces & shade helpers
│   ├── package.json
│   └── tsconfig.json
├── websetup.sh                      # Initial monorepo scaffolding script
└── README.md
```

---

## 🔌 Backend API Endpoints

All routes are available under both `http://localhost:8000/api` and `http://localhost:8000/api/tracker`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Returns server status and active storage mode (`mongodb` or `in-memory-fallback`) |
| `GET` | `/api/routines` | Fetches all 7 weekly routine templates (`monday`–`sunday`) |
| `GET` | `/api/routines/:dayOfWeek` | Fetches the default checklist template for a specific weekday |
| `PUT` | `/api/routines/:dayOfWeek` | Updates the default checklist items for a specific weekday |
| `POST` | `/api/routines/reset` | Resets all weekly templates back to the default schedule |
| `GET` | `/api/logs/:date` | Gets (or auto-creates from the weekday template) the checklist for `YYYY-MM-DD` |
| `PATCH` | `/api/logs/:date/items/:itemId` | Toggles a single checklist item (`{ "completed": true }`) and recalculates shade |
| `PATCH` | `/api/logs/:date/check-all` | Checks or unchecks all items on `YYYY-MM-DD` (`{ "completed": true }`) |
| `POST` | `/api/logs/:date/items` | Adds a custom habit to `YYYY-MM-DD` (`{ "title": "...", "category": "chores" }`) |
| `DELETE` | `/api/logs/:date/items/:itemId` | Removes a checklist item from `YYYY-MM-DD` |
| `GET` | `/api/calendar?year=2026&month=11` | Returns the full month heatmap data with per-day completion % and GitHub shades |
| `GET` | `/api/stats` | Returns `currentStreak`, `weeklyCompletionRate`, `bestDayOfWeek`, and overall stats |

---

## 🚀 Getting Started & Running Locally

### 1. Configure Backend Environment (`backend/.env`)
```env
PORT=8000
FRONTEND_ORIGIN=http://localhost:3000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/personal_tracker?retryWrites=true&w=majority
```
*(If `MONGODB_URI` is omitted or unreachable, the backend automatically runs in `in-memory-fallback` mode.)*

### 2. Start the Backend Server (Port `8000`)
```bash
cd backend
bun run dev
```

### 3. Start the Frontend Dashboard (Port `3000`)
Open a second terminal:
```bash
cd frontend
bun run dev
```
Then open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🧪 Verification & Testing

### Automated Backend Test Suite
Run the automated Bun tests in [`backend/src/tracker.test.ts`](./backend/src/tracker.test.ts):
```bash
cd backend
bun test
```

### Quick CLI Verification (`curl`)
With `bun run dev` running in `backend/`:

```bash
# 1. Check health & database connection mode
curl http://localhost:8000/api/health

# 2. Fetch the checklist for Monday, Nov 23, 2026
curl http://localhost:8000/api/logs/2026-11-23

# 3. Toggle a habit item (e.g. "mon-2" Gym)
curl -X PATCH http://localhost:8000/api/logs/2026-11-23/items/mon-2 \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'

# 4. Complete all habits on Nov 23 (turns shadeLevel 4 / #39d353)
curl -X PATCH http://localhost:8000/api/logs/2026-11-23/check-all \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'

# 5. Inspect the November 2026 calendar heatmap
curl "http://localhost:8000/api/calendar?year=2026&month=11"
```
>>>>>>> cc06482 (docs: update README with comprehensive project documentation and add atlas-credentials.env to backend gitignore)
