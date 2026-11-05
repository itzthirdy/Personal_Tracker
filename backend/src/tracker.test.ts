import { describe, expect, test } from "bun:test";
import { Duplex } from "node:stream";
import { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";

// Force deterministic in-memory storage & heuristic coach in unit tests (no external network calls).
delete process.env.MONGODB_URI;
delete process.env.GEMINI_API_KEY;

interface TestRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

interface TestResponse<T = any> {
  status: number;
  body: T;
}

/**
 * Dispatches an HTTP request directly into the Express `app` pipeline
 * without binding a network socket (routes, middleware, controllers, services).
 */
async function requestApp<T = any>(
  path: string,
  options: TestRequestOptions = {}
): Promise<TestResponse<T>> {
  return new Promise((resolve, reject) => {
    const socket = new Duplex({
      read() {},
      write(_chunk, _encoding, callback) {
        callback();
      },
    });

    const req = new IncomingMessage(socket as any);
    req.url = path;
    req.method = options.method ?? "GET";

    const rawBody =
      options.body !== undefined ? JSON.stringify(options.body) : "";

    const headers: Record<string, string> = {};
    if (options.headers) {
      for (const [k, v] of Object.entries(options.headers)) {
        headers[k.toLowerCase()] = v;
      }
    }
    if (rawBody) {
      headers["content-type"] = headers["content-type"] ?? "application/json";
      headers["content-length"] = String(Buffer.byteLength(rawBody));
    }
    req.headers = headers;

    const res = new ServerResponse(req);
    const chunks: Buffer[] = [];

    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);

    res.write = ((chunk: any, ...args: any[]) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return origWrite(chunk, ...args);
    }) as any;

    res.end = ((chunk: any, ...args: any[]) => {
      if (chunk && typeof chunk !== "function") {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      origEnd(chunk, ...args);
      const text = Buffer.concat(chunks).toString("utf8");
      let parsed: any = text;
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        // leave as string
      }
      resolve({ status: res.statusCode, body: parsed });
      return res;
    }) as any;

    try {
      app(req as any, res as any);
      if (rawBody) {
        req.push(rawBody);
      }
      req.push(null);
    } catch (err) {
      reject(err);
    }
  });
}

interface TestUser {
  token: string;
  id: string;
  auth: { Authorization: string };
}

async function registerTestUser(name: string): Promise<TestUser> {
  const res = await requestApp<{ token: string; user: { id: string } }>(
    "/api/auth/register",
    {
      method: "POST",
      body: {
        username: name,
        email: `${name}@example.com`,
        password: "password123",
      },
    }
  );
  expect(res.status).toBe(201);
  return {
    token: res.body.token,
    id: res.body.user.id,
    auth: { Authorization: `Bearer ${res.body.token}` },
  };
}

const TODAY = new Date().toISOString().slice(0, 10);

describe("Auth & zero-state onboarding", () => {
  test("register / login / me JWT flow, duplicate -> 409, protected routes -> 401", async () => {
    const user = await registerTestUser("alice_tracker");
    expect(user.token).toBeTruthy();

    const dup = await requestApp("/api/auth/register", {
      method: "POST",
      body: {
        username: "alice_tracker",
        email: "alice_tracker@example.com",
        password: "password123",
      },
    });
    expect(dup.status).toBe(409);

    const login = await requestApp<{ user: { id: string } }>("/api/auth/login", {
      method: "POST",
      body: { email: "alice_tracker@example.com", password: "password123" },
    });
    expect(login.status).toBe(200);
    expect(login.body.user.id).toBe(user.id);

    const me = await requestApp("/api/auth/me", { headers: user.auth });
    expect(me.status).toBe(200);

    expect((await requestApp("/api/auth/me")).status).toBe(401);
    expect((await requestApp(`/api/tracker/logs/${TODAY}`)).status).toBe(401);
    expect((await requestApp("/api/tracker/routines")).status).toBe(401);
    expect((await requestApp("/api/tracker/insights/weekly")).status).toBe(401);
  });

  test("new accounts start with 0 habits but keep the 3 default Hub cards", async () => {
    const user = await registerTestUser("zero_state");

    const routines = await requestApp<{ routines: unknown[] }>(
      "/api/tracker/routines",
      { headers: user.auth }
    );
    expect(routines.body.routines).toEqual([]);

    // Any date (even a Monday) is empty: no hardcoded Academics/Fitness/General habits.
    const log = await requestApp<{ log: { totalCount: number; items: unknown[] } }>(
      "/api/tracker/logs/2026-11-23",
      { headers: user.auth }
    );
    expect(log.body.log.totalCount).toBe(0);
    expect(log.body.log.items).toEqual([]);

    const categories = await requestApp<{ categories: unknown[] }>(
      "/api/tracker/categories",
      { headers: user.auth }
    );
    expect(categories.body.categories).toEqual([]);

    const hub = await requestApp<{ cards: Array<{ title: string }> }>("/api/hub", {
      headers: user.auth,
    });
    expect(hub.body.cards.map((c) => c.title)).toEqual([
      "Routine & Habit Tracker",
      "Finances",
      "Exercise",
    ]);
  });
});

describe("Custom categories", () => {
  test("create, list, reject duplicates, delete", async () => {
    const user = await registerTestUser("cat_user");

    const created = await requestApp<{
      category: { id: string; name: string; color: string; icon: string };
    }>("/api/tracker/categories", {
      method: "POST",
      headers: user.auth,
      body: { name: "  Cybersecurity ", color: "#2563eb", icon: "shield" },
    });
    expect(created.status).toBe(201);
    expect(created.body.category).toMatchObject({
      name: "Cybersecurity",
      color: "#2563eb",
      icon: "shield",
    });

    // defaults for color/icon
    const defaults = await requestApp<{ category: { color: string; icon: string } }>(
      "/api/tracker/categories",
      { method: "POST", headers: user.auth, body: { name: "Hobbies" } }
    );
    expect(defaults.status).toBe(201);
    expect(defaults.body.category.color).toBe("#801E0F");
    expect(defaults.body.category.icon).toBe("sparkles");

    const dup = await requestApp("/api/tracker/categories", {
      method: "POST",
      headers: user.auth,
      body: { name: "cybersecurity" },
    });
    expect(dup.status).toBe(409);

    const missingName = await requestApp("/api/tracker/categories", {
      method: "POST",
      headers: user.auth,
      body: { color: "#fff" },
    });
    expect(missingName.status).toBe(400);

    const list = await requestApp<{ categories: Array<{ name: string }> }>(
      "/api/tracker/categories",
      { headers: user.auth }
    );
    expect(list.body.categories.map((c) => c.name)).toEqual([
      "Cybersecurity",
      "Hobbies",
    ]);

    const del = await requestApp(
      `/api/tracker/categories/${created.body.category.id}`,
      { method: "DELETE", headers: user.auth }
    );
    expect(del.status).toBe(200);

    const delAgain = await requestApp(
      `/api/tracker/categories/${created.body.category.id}`,
      { method: "DELETE", headers: user.auth }
    );
    expect(delAgain.status).toBe(404);

    // Protect default General category from deletion
    const delGeneral = await requestApp("/api/tracker/categories/General", {
      method: "DELETE",
      headers: user.auth,
    });
    expect(delGeneral.status).toBe(400);
  });

  test("deleting a custom category cascades routines and daily log items back to General", async () => {
    const user = await registerTestUser("cat_cascade_user");

    const cat = await requestApp<{ category: { id: string; name: string } }>(
      "/api/tracker/categories",
      {
        method: "POST",
        headers: user.auth,
        body: { name: "Cybersecurity", color: "#2563eb", icon: "shield" },
      }
    );
    expect(cat.status).toBe(201);

    const routine = await requestApp<{ routine: { id: string } }>(
      "/api/tracker/routines",
      {
        method: "POST",
        headers: user.auth,
        body: {
          title: "Practice CTF",
          category: "Cybersecurity",
          daysOfWeek: [1, 3],
          startDate: "2026-11-02",
        },
      }
    );
    expect(routine.status).toBe(201);

    // Complete on Monday 2026-11-02 so it persists in DailyLog as well
    await requestApp(
      `/api/tracker/logs/2026-11-02/items/r-${routine.body.routine.id}`,
      {
        method: "PATCH",
        headers: user.auth,
        body: { completed: true },
      }
    );

    // Delete by name (or id)
    const delRes = await requestApp<{
      deletedName: string;
      fallbackCategory: { name: string };
    }>("/api/tracker/categories/Cybersecurity", {
      method: "DELETE",
      headers: user.auth,
    });
    expect(delRes.status).toBe(200);
    expect(delRes.body.deletedName).toBe("Cybersecurity");
    expect(delRes.body.fallbackCategory.name).toBe("General");

    // Routine category is now General
    const routinesAfter = await requestApp<{
      routines: Array<{ title: string; category: { name: string } }>;
    }>("/api/tracker/routines", { headers: user.auth });
    expect(routinesAfter.body.routines[0]!.category.name).toBe("General");

    // Stored DailyLog item category is also General
    const logAfter = await requestApp<{
      log: { items: Array<{ title: string; category: { name: string } }> };
    }>("/api/tracker/logs/2026-11-02", { headers: user.auth });
    expect(logAfter.body.log.items[0]!.category.name).toBe("General");
  });
});

describe("Master recurring routines, history preservation & bulk delete", () => {
  test("multi-day daysOfWeek scheduling merges into daily logs", async () => {
    const user = await registerTestUser("sched_user");

    // Mon/Wed/Fri routine with a custom category object
    const gym = await requestApp<{
      routine: { id: string; daysOfWeek: number[]; category: { name: string } };
    }>("/api/tracker/routines", {
      method: "POST",
      headers: user.auth,
      body: {
        title: "Gym",
        category: { name: "Fitness", color: "#16a34a", icon: "dumbbell" },
        daysOfWeek: [5, 1, 3, 3],
        startDate: "2026-09-28",
      },
    });
    expect(gym.status).toBe(201);
    expect(gym.body.routine.daysOfWeek).toEqual([1, 3, 5]); // sorted + deduped
    expect(gym.body.routine.category.name).toBe("Fitness");

    // One-off Quick Add on Tuesday 2026-10-06
    const oneOff = await requestApp<{ routine: { id: string } }>(
      "/api/tracker/routines",
      {
        method: "POST",
        headers: user.auth,
        body: { title: "Dentist", specificDate: "2026-10-06" },
      }
    );
    expect(oneOff.status).toBe(201);

    const validation = await requestApp("/api/tracker/routines", {
      method: "POST",
      headers: user.auth,
      body: { title: "No schedule" },
    });
    expect(validation.status).toBe(400);
    const badDay = await requestApp("/api/tracker/routines", {
      method: "POST",
      headers: user.auth,
      body: { title: "Bad", daysOfWeek: [7] },
    });
    expect(badDay.status).toBe(400);

    const mon = await requestApp<{ log: { items: Array<{ title: string; category: { name: string } }> } }>(
      "/api/tracker/logs/2026-10-05",
      { headers: user.auth }
    );
    expect(mon.body.log.items.map((i) => i.title)).toEqual(["Gym"]);
    expect(mon.body.log.items[0]!.category.name).toBe("Fitness");

    const tue = await requestApp<{ log: { items: Array<{ title: string }> } }>(
      "/api/tracker/logs/2026-10-06",
      { headers: user.auth }
    );
    expect(tue.body.log.items.map((i) => i.title)).toEqual(["Dentist"]);

    // Before startDate the recurring routine does not rewrite history
    const early = await requestApp<{ log: { totalCount: number } }>(
      "/api/tracker/logs/2026-09-21",
      { headers: user.auth }
    );
    expect(early.body.log.totalCount).toBe(0);

    // PUT: update title + days
    const updated = await requestApp<{ routine: { title: string; daysOfWeek: number[] } }>(
      `/api/tracker/routines/${gym.body.routine.id}`,
      {
        method: "PUT",
        headers: user.auth,
        body: { title: "Gym Session", daysOfWeek: [1, 2, 3] },
      }
    );
    expect(updated.status).toBe(200);
    expect(updated.body.routine.title).toBe("Gym Session");
    expect(updated.body.routine.daysOfWeek).toEqual([1, 2, 3]);

    const missing = await requestApp("/api/tracker/routines/000000000000000000000000", {
      method: "PUT",
      headers: user.auth,
      body: { title: "x" },
    });
    expect(missing.status).toBe(404);
  });

  test("bulk-delete 'day' pulls a weekday, 'all' wipes routines, history is preserved", async () => {
    const user = await registerTestUser("bulk_user");

    const create = async (title: string, daysOfWeek: number[]) =>
      (
        await requestApp<{ routine: { id: string } }>("/api/tracker/routines", {
          method: "POST",
          headers: user.auth,
          body: { title, daysOfWeek, startDate: "2026-09-28" },
        })
      ).body.routine.id;

    const read = await create("Read", [1, 3, 5]);
    const code = await create("Code", [3]);
    const walk = await create("Walk", [0, 6]);

    // Complete Read on Mon 2026-10-05 (history)
    const log = await requestApp<{ log: { items: Array<{ id: string; title: string }> } }>(
      "/api/tracker/logs/2026-10-05",
      { headers: user.auth }
    );
    const readItem = log.body.log.items.find((i) => i.title === "Read")!;
    const toggled = await requestApp<{ log: { completedCount: number; shadeLevel: number } }>(
      `/api/tracker/logs/2026-10-05/items/${readItem.id}`,
      { method: "PATCH", headers: user.auth, body: { completed: true } }
    );
    expect(toggled.body.log.completedCount).toBe(1);
    expect(toggled.body.log.shadeLevel).toBe(4);

    // mode "day" (Wednesday = 3): Read keeps [1,5]; Code (only Wed) is deleted
    const dayRes = await requestApp<{ deletedCount: number; updatedCount: number }>(
      "/api/tracker/routines/bulk-delete",
      {
        method: "POST",
        headers: user.auth,
        body: { routineIds: [read, code], mode: "day", dayOfWeek: 3 },
      }
    );
    expect(dayRes.status).toBe(200);
    expect(dayRes.body.deletedCount).toBe(1);
    expect(dayRes.body.updatedCount).toBe(1);

    const routines = await requestApp<{
      routines: Array<{ id: string; daysOfWeek: number[] }>;
    }>("/api/tracker/routines", { headers: user.auth });
    expect(routines.body.routines.find((r) => r.id === read)!.daysOfWeek).toEqual([1, 5]);
    expect(routines.body.routines.some((r) => r.id === code)).toBe(false);

    // validation
    const badMode = await requestApp("/api/tracker/routines/bulk-delete", {
      method: "POST",
      headers: user.auth,
      body: { routineIds: [read], mode: "nope" },
    });
    expect(badMode.status).toBe(400);
    const noDay = await requestApp("/api/tracker/routines/bulk-delete", {
      method: "POST",
      headers: user.auth,
      body: { routineIds: [read], mode: "day" },
    });
    expect(noDay.status).toBe(400);

    // mode "all": wipe Read + Walk everywhere
    const allRes = await requestApp<{ deletedCount: number }>(
      "/api/tracker/routines/bulk-delete",
      {
        method: "POST",
        headers: user.auth,
        body: { routineIds: [read, walk], mode: "all" },
      }
    );
    expect(allRes.body.deletedCount).toBe(2);

    const after = await requestApp<{ routines: unknown[] }>("/api/tracker/routines", {
      headers: user.auth,
    });
    expect(after.body.routines).toEqual([]);

    // History preserved: Mon 2026-10-05 still shows the completed "Read" entry
    const history = await requestApp<{
      log: { totalCount: number; completedCount: number; shadeLevel: number; items: Array<{ title: string }> };
    }>("/api/tracker/logs/2026-10-05", { headers: user.auth });
    expect(history.body.log.items.map((i) => i.title)).toEqual(["Read"]);
    expect(history.body.log.completedCount).toBe(1);

    const calendar = await requestApp<{
      days: Array<{ dayOfMonth: number; completedCount: number; totalCount: number; shadeLevel: number }>;
    }>("/api/tracker/calendar?year=2026&month=10", { headers: user.auth });
    const day5 = calendar.body.days.find((d) => d.dayOfMonth === 5)!;
    expect(day5).toMatchObject({ completedCount: 1, totalCount: 1, shadeLevel: 4 });
    // Uncompleted past days of the deleted routines vanish (no phantom red/empty history)
    const day12 = calendar.body.days.find((d) => d.dayOfMonth === 12)!;
    expect(day12.totalCount).toBe(0);
  });
});

describe("Weekly insights engine", () => {
  test("computes per-habit adherence and heuristic coaching", async () => {
    const user = await registerTestUser("insights_user");

    const gym = await requestApp<{ routine: { id: string } }>("/api/tracker/routines", {
      method: "POST",
      headers: user.auth,
      body: {
        title: "Gym",
        category: { name: "Fitness", color: "#16a34a", icon: "dumbbell" },
        daysOfWeek: [1, 3, 5],
        startDate: "2026-09-28",
      },
    });
    const study = await requestApp<{ routine: { id: string } }>("/api/tracker/routines", {
      method: "POST",
      headers: user.auth,
      body: { title: "Study", daysOfWeek: [1], startDate: "2026-09-28" },
    });
    expect(gym.status).toBe(201);
    expect(study.status).toBe(201);

    // Complete Gym on Mon (10-05) and Wed (10-07), skip Fri; complete Study on Mon
    for (const date of ["2026-10-05", "2026-10-07"]) {
      await requestApp(`/api/tracker/logs/${date}/items/r-${gym.body.routine.id}`, {
        method: "PATCH",
        headers: user.auth,
        body: { completed: true },
      });
    }
    await requestApp(`/api/tracker/logs/2026-10-05/items/r-${study.body.routine.id}`, {
      method: "PATCH",
      headers: user.auth,
      body: { completed: true },
    });

    // Any date inside the week snaps to Monday
    const res = await requestApp<any>(
      "/api/tracker/insights/weekly?startDate=2026-10-07",
      { headers: user.auth }
    );
    expect(res.status).toBe(200);
    expect(res.body.weekStart).toBe("2026-10-05");
    expect(res.body.weekEnd).toBe("2026-10-11");
    expect(res.body.daysElapsed).toBe(7);

    const gymInsight = res.body.habits.find((h: any) => h.habitTitle === "Gym");
    expect(gymInsight).toMatchObject({
      scheduledDaysCount: 3,
      completedDaysCount: 2,
      consistencyRate: 67,
    });
    expect(gymInsight.category.name).toBe("Fitness");
    expect(gymInsight.feedback).toContain("2/3");

    const studyInsight = res.body.habits.find((h: any) => h.habitTitle === "Study");
    expect(studyInsight).toMatchObject({ scheduledDaysCount: 1, completedDaysCount: 1, consistencyRate: 100 });

    // (2 + 1) / (3 + 1) = 75%
    expect(res.body.disciplineScore).toBe(75);
    expect(res.body.bestHabit.title).toBe("Study");
    expect(res.body.weakestHabit.title).toBe("Gym");
    expect(res.body.source).toBe("rule-based");
    expect(res.body.coach.source).toBe("rule-based");
    expect(res.body.coach.summary.length).toBeGreaterThan(10);

    // Future week (e.g. Nov 9-15, 2026) also calculates all 7 days of that week
    const futureRes = await requestApp<any>(
      "/api/tracker/insights/weekly?startDate=2026-11-11&forceRefresh=true",
      { headers: user.auth }
    );
    expect(futureRes.status).toBe(200);
    expect(futureRes.body.weekStart).toBe("2026-11-09");
    expect(futureRes.body.weekEnd).toBe("2026-11-15");
    expect(futureRes.body.daysElapsed).toBe(7);
    expect(futureRes.body.totalScheduled).toBe(4);

    const badDate = await requestApp("/api/tracker/insights/weekly?startDate=nope", {
      headers: user.auth,
    });
    expect(badDate.status).toBe(400);

    // Empty account still returns rich, non-crashing output
    const empty = await registerTestUser("insights_empty");
    const emptyRes = await requestApp<any>("/api/tracker/insights/weekly", {
      headers: empty.auth,
    });
    expect(emptyRes.status).toBe(200);
    expect(emptyRes.body.habits).toEqual([]);
    expect(emptyRes.body.coach.summary).toContain("Routine Manager");
  });

  test("multi-model cascade fails over on 503/timeout and caches AI insight until signature changes or forceRefresh", async () => {
    const user = await registerTestUser("insights_cascade_user");
    await requestApp("/api/tracker/routines", {
      method: "POST",
      headers: user.auth,
      body: {
        title: "Morning Run",
        daysOfWeek: [1, 3, 5],
        startDate: "2026-11-02",
      },
    });

    const originalFetch = globalThis.fetch;
    const calledUrls: string[] = [];

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      calledUrls.push(url);
      if (url.includes("gemini-3.5-flash-lite:")) {
        return new Response("High Demand", { status: 503 });
      }
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: "Great consistency on Morning Run!" }],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    process.env.GEMINI_API_KEY = "AIzaSyTestKeyForCascade123";

    try {
      const first = await requestApp<any>(
        "/api/tracker/insights/weekly?startDate=2026-11-02",
        { headers: user.auth }
      );
      expect(first.status).toBe(200);
      expect(first.body.source).toBe("gemini-ai");
      expect(first.body.insightText).toBe("Great consistency on Morning Run!");
      // Tried gemini-3.5-flash-lite (503), succeeded on gemini-3.8-flash
      expect(calledUrls.length).toBe(2);
      expect(calledUrls[1]).toContain("gemini-3.8-flash:generateContent");

      // Second call with identical metrics hits server-side cache (0 external fetch calls)
      const second = await requestApp<any>(
        "/api/tracker/insights/weekly?startDate=2026-11-04",
        { headers: user.auth }
      );
      expect(second.status).toBe(200);
      expect(second.body.source).toBe("gemini-ai");
      expect(calledUrls.length).toBe(2);

      // Explicit forceRefresh=true bypasses cache and calls Gemini cascade again
      const forced = await requestApp<any>(
        "/api/tracker/insights/weekly?startDate=2026-11-02&forceRefresh=true",
        { headers: user.auth }
      );
      expect(forced.status).toBe(200);
      expect(forced.body.source).toBe("gemini-ai");
      expect(calledUrls.length).toBe(4);
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.GEMINI_API_KEY;
    }
  });
});

describe("Hub + multi-tenant isolation", () => {
  test("hub live preview reflects habits; custom card CRUD works", async () => {
    const user = await registerTestUser("hub_user");

    // Zero-state: nothing scheduled today yet
    const emptyHub = await requestApp<{ cards: Array<{ livePreview: any }> }>("/api/hub", {
      headers: user.auth,
    });
    expect(emptyHub.body.cards[0]!.livePreview).toMatchObject({
      consistencyScore: 0,
      currentStreak: 0,
      todayProgress: { totalCount: 0 },
    });

    // One-off Quick Add for today, then check everything
    await requestApp("/api/tracker/routines", {
      method: "POST",
      headers: user.auth,
      body: { title: "Drink water", specificDate: TODAY },
    });
    const checkAll = await requestApp(`/api/tracker/logs/${TODAY}/check-all`, {
      method: "PATCH",
      headers: user.auth,
      body: { completed: true },
    });
    expect(checkAll.status).toBe(200);

    const hub = await requestApp<{ cards: Array<{ moduleKey: string; status: string; livePreview: any }> }>(
      "/api/hub",
      { headers: user.auth }
    );
    expect(hub.body.cards[0]!.livePreview).toMatchObject({
      consistencyScore: 100,
      currentStreak: 1,
      todayProgress: { completionPercentage: 100 },
    });
    expect(hub.body.cards[1]!.livePreview).toEqual({ subtitle: "Coming Soon" });

    const created = await requestApp<{ card: { id: string; order: number } }>(
      "/api/hub/cards",
      {
        method: "POST",
        headers: user.auth,
        body: { title: "Academics", icon: "book-open" },
      }
    );
    expect(created.status).toBe(201);
    expect(created.body.card.order).toBe(4);

    const patched = await requestApp<{ card: { title: string } }>(
      `/api/hub/cards/${created.body.card.id}`,
      { method: "PATCH", headers: user.auth, body: { title: "Planning & Goals" } }
    );
    expect(patched.body.card.title).toBe("Planning & Goals");

    const del = await requestApp(`/api/hub/cards/${created.body.card.id}`, {
      method: "DELETE",
      headers: user.auth,
    });
    expect(del.status).toBe(200);
  });

  test("User A cannot see, toggle, edit or delete User B's data", async () => {
    const a = await registerTestUser("tenant_a");
    const b = await registerTestUser("tenant_b");

    await requestApp("/api/tracker/categories", {
      method: "POST",
      headers: a.auth,
      body: { name: "A-Secret" },
    });
    const aRoutine = await requestApp<{ routine: { id: string } }>(
      "/api/tracker/routines",
      {
        method: "POST",
        headers: a.auth,
        body: { title: "Alice Private Habit", daysOfWeek: [1], startDate: "2026-09-28" },
      }
    );
    const routineId = aRoutine.body.routine.id;

    // B sees nothing of A's
    const bRoutines = await requestApp<{ routines: unknown[] }>("/api/tracker/routines", {
      headers: b.auth,
    });
    expect(bRoutines.body.routines).toEqual([]);
    const bCategories = await requestApp<{ categories: unknown[] }>(
      "/api/tracker/categories",
      { headers: b.auth }
    );
    expect(bCategories.body.categories).toEqual([]);
    const bLog = await requestApp<{ log: { totalCount: number } }>(
      "/api/tracker/logs/2026-10-05",
      { headers: b.auth }
    );
    expect(bLog.body.log.totalCount).toBe(0);

    // B cannot toggle, edit or delete A's routine
    const toggle = await requestApp(`/api/tracker/logs/2026-10-05/items/r-${routineId}`, {
      method: "PATCH",
      headers: b.auth,
      body: { completed: true },
    });
    expect(toggle.status).toBe(400);

    const edit = await requestApp(`/api/tracker/routines/${routineId}`, {
      method: "PUT",
      headers: b.auth,
      body: { title: "hacked" },
    });
    expect(edit.status).toBe(404);

    const bulk = await requestApp<{ deletedCount: number }>(
      "/api/tracker/routines/bulk-delete",
      {
        method: "POST",
        headers: b.auth,
        body: { routineIds: [routineId], mode: "all" },
      }
    );
    expect(bulk.body.deletedCount).toBe(0);

    // A's routine is intact
    const aAfter = await requestApp<{ routines: Array<{ title: string }> }>(
      "/api/tracker/routines",
      { headers: a.auth }
    );
    expect(aAfter.body.routines.map((r) => r.title)).toEqual(["Alice Private Habit"]);
  });
});
