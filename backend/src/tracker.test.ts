import { describe, expect, test } from "bun:test";
import { Duplex } from "node:stream";
import { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";

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
 * without binding a network socket, testing routes, middleware, controllers, and services.
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
      resolve({
        status: res.statusCode,
        body: parsed,
      });
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

describe("Multi-User SaaS Personal Tracker Backend", () => {
  let userAToken = "";
  let userAId = "";
  let userBToken = "";
  let userBId = "";

  test("1. User registration, login, and protected /api/auth/me JWT flow", async () => {
    // Register User A
    const regARes = await requestApp<{
      token: string;
      user: { id: string; username: string; email: string };
    }>("/api/auth/register", {
      method: "POST",
      body: {
        username: "alice_tracker",
        email: "alice@example.com",
        password: "password123",
      },
    });
    expect(regARes.status).toBe(201);
    expect(regARes.body.token).toBeTruthy();
    expect(regARes.body.user.username).toBe("alice_tracker");
    expect(regARes.body.user.email).toBe("alice@example.com");
    userAToken = regARes.body.token;
    userAId = regARes.body.user.id;

    // Duplicate registration should return 409 Conflict
    const dupRes = await requestApp("/api/auth/register", {
      method: "POST",
      body: {
        username: "alice_tracker",
        email: "alice@example.com",
        password: "password123",
      },
    });
    expect(dupRes.status).toBe(409);

    // Login User A with email & password
    const loginRes = await requestApp<{
      token: string;
      user: { id: string; username: string };
    }>("/api/auth/login", {
      method: "POST",
      body: {
        email: "alice@example.com",
        password: "password123",
      },
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.id).toBe(userAId);

    // Verify /api/auth/me with Bearer token
    const meRes = await requestApp<{
      user: { id: string; username: string; email: string };
    }>("/api/auth/me", {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.username).toBe("alice_tracker");

    // Verify /api/auth/me without token returns 401
    const unauthRes = await requestApp("/api/auth/me");
    expect(unauthRes.status).toBe(401);

    // Register User B for multi-tenant isolation tests
    const regBRes = await requestApp<{
      token: string;
      user: { id: string };
    }>("/api/auth/register", {
      method: "POST",
      body: {
        username: "bob_tracker",
        email: "bob@example.com",
        password: "securepassword",
      },
    });
    expect(regBRes.status).toBe(201);
    userBToken = regBRes.body.token;
    userBId = regBRes.body.user.id;
    expect(userBId).not.toBe(userAId);
  });

  test("2. Default Hub cards seeding, live habit stats preview, and custom card CRUD", async () => {
    // Complete all habits for today on User A so livePreview reflects active progress
    const todayStr = new Date().toISOString().slice(0, 10);
    const checkAllRes = await requestApp(
      `/api/tracker/logs/${todayStr}/check-all`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${userAToken}` },
        body: { completed: true },
      }
    );
    expect(checkAllRes.status).toBe(200);

    // Fetch User A's Workspace Hub
    const hubRes = await requestApp<{
      cards: Array<{
        id: string;
        title: string;
        moduleKey: string;
        status: string;
        route: string;
        order: number;
        livePreview: Record<string, unknown>;
      }>;
    }>("/api/hub", {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    expect(hubRes.status).toBe(200);

    // Verify 3 default cards seeded in order
    expect(hubRes.body.cards.length).toBe(3);
    expect(hubRes.body.cards.map((c) => c.title)).toEqual([
      "Routine & Habit Tracker",
      "Finances",
      "Exercise",
    ]);

    const habitsCard = hubRes.body.cards[0]!;
    expect(habitsCard.moduleKey).toBe("habits");
    expect(habitsCard.status).toBe("active");
    expect(habitsCard.route).toBe("/dashboard/habits");
    expect(habitsCard.livePreview).toMatchObject({
      consistencyScore: 100,
      currentStreak: 1,
      todayProgress: {
        completionPercentage: 100,
      },
    });

    const financesCard = hubRes.body.cards[1]!;
    expect(financesCard.moduleKey).toBe("finances");
    expect(financesCard.status).toBe("coming_soon");
    expect(financesCard.livePreview).toEqual({ subtitle: "Coming Soon" });

    // Create a custom card (+ New page)
    const createCardRes = await requestApp<{
      card: { id: string; title: string; icon: string; order: number };
    }>("/api/hub/cards", {
      method: "POST",
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        title: "Academics & Research",
        icon: "book-open",
        route: "/dashboard/academics",
      },
    });
    expect(createCardRes.status).toBe(201);
    expect(createCardRes.body.card.title).toBe("Academics & Research");
    expect(createCardRes.body.card.order).toBe(4);
    const customCardId = createCardRes.body.card.id;

    // Update the custom card
    const updateCardRes = await requestApp<{
      card: { id: string; title: string; order: number };
    }>(`/api/hub/cards/${customCardId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        title: "Planning & Goals",
        order: 10,
      },
    });
    expect(updateCardRes.status).toBe(200);
    expect(updateCardRes.body.card.title).toBe("Planning & Goals");
    expect(updateCardRes.body.card.order).toBe(10);

    // User B cannot delete User A's custom card
    const crossDeleteRes = await requestApp(`/api/hub/cards/${customCardId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    expect(crossDeleteRes.status).toBe(404);

    // User A deletes their custom card
    const deleteCardRes = await requestApp(`/api/hub/cards/${customCardId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    expect(deleteCardRes.status).toBe(200);
  });

  test("3. Strict multi-tenant isolation between User A and User B on habits & logs", async () => {
    const targetDate = "2026-11-23"; // Monday

    // User A checks all 10 Monday habits on 2026-11-23 and adds a custom habit
    const userACheckRes = await requestApp(
      `/api/tracker/logs/${targetDate}/check-all`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${userAToken}` },
        body: { completed: true },
      }
    );
    expect(userACheckRes.status).toBe(200);

    const userAAddRes = await requestApp<{
      log: {
        completedCount: number;
        totalCount: number;
        items: Array<{ id: string; title: string }>;
      };
    }>(`/api/tracker/logs/${targetDate}/items`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        title: "Alice Private Habit",
        category: "custom",
      },
    });
    expect(userAAddRes.status).toBe(201);
    expect(userAAddRes.body.log.totalCount).toBe(11);
    expect(userAAddRes.body.log.completedCount).toBe(10);
    const aliceCustomItem = userAAddRes.body.log.items.find(
      (i) => i.title === "Alice Private Habit"
    );
    expect(aliceCustomItem).toBeDefined();

    // User B fetches the exact same date (2026-11-23):
    // Must see their own untouched Monday checklist (0/10 completed) and NO "Alice Private Habit"
    const userBLogRes = await requestApp<{
      log: {
        completedCount: number;
        totalCount: number;
        shadeLevel: number;
        items: Array<{ id: string; title: string }>;
      };
    }>(`/api/tracker/logs/${targetDate}`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    expect(userBLogRes.status).toBe(200);
    expect(userBLogRes.body.log.totalCount).toBe(10);
    expect(userBLogRes.body.log.completedCount).toBe(0);
    expect(userBLogRes.body.log.shadeLevel).toBe(0);
    expect(
      userBLogRes.body.log.items.some((i) => i.title === "Alice Private Habit")
    ).toBe(false);

    // User B tries to toggle Alice's custom item ID -> returns 400 not found on User B's log
    const crossToggleRes = await requestApp(
      `/api/tracker/logs/${targetDate}/items/${aliceCustomItem!.id}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${userBToken}` },
        body: { completed: true },
      }
    );
    expect(crossToggleRes.status).toBe(400);

    // Unauthenticated request to /api/tracker/logs/:date returns 401
    const unauthTrackerRes = await requestApp(
      `/api/tracker/logs/${targetDate}`
    );
    expect(unauthTrackerRes.status).toBe(401);
  });
});
