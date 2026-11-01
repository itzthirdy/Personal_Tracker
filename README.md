# Personal Tracker 📅⚡

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

---

## 📁 Repository Structure

```text
Personal_Tracker/
├── backend/
│   ├── src/
│   │   ├── config/          # Database connection & Atlas client
│   │   ├── controllers/     # Habit & DailyLog business logic
│   │   ├── models/          # RoutineTemplate & DailyLog schemas
│   │   ├── routes/          # Express API endpoints
│   │   ├── app.ts           # Express application configuration
│   │   └── server.ts        # Server entry point
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router (page.tsx, layout.tsx)
│   │   └── components/      # HeatmapCalendar, DailyChecklist, SummaryBanner
│   ├── package.json
│   └── tailwind.config.ts
├── websetup.sh              # Project scaffolding automation script
└── README.md
