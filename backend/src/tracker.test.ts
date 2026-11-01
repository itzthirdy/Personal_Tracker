import { describe, expect, test } from "bun:test";
import {
  addCustomChecklistItem,
  getConsistencyStats,
  getMonthlyCalendar,
  getOrCreateDailyLog,
  getTemplateByDay,
  getWeeklyTemplates,
  setAllChecklistItems,
  toggleChecklistItem,
} from "./services/tracker.service";

describe("Habit & Routine Tracker Backend", () => {
  test("1. Loads all 7 days of the weekly schedule (Monday - Sunday)", async () => {
    const routines = await getWeeklyTemplates();
    expect(routines.length).toBe(7);

    const sunday = await getTemplateByDay("sunday");
    expect(sunday.items.map((i) => i.title)).toEqual([
      "Work - Grab",
      "Ironing clothes",
      "Washing Clothes",
      "Cooking meal prep",
      "Prepare for next week",
    ]);
  });

  test("2. Generates Nov 23, 2026 (Monday) checklist and updates GitHub green shade as items are checked", async () => {
    // Initial state: 0/10 checked -> Level 0 (#21262d)
    let log = await getOrCreateDailyLog("2026-11-23");
    expect(log.dayOfWeek).toBe("monday");
    expect(log.totalCount).toBe(10);
    expect(log.completedCount).toBe(0);
    expect(log.shadeLevel).toBe(0);
    expect(log.shadeColor).toBe("#21262d");

    // Check 2 items (20%) -> Level 1 (#0e4429 darkest green)
    await toggleChecklistItem("2026-11-23", "mon-1", true);
    log = await toggleChecklistItem("2026-11-23", "mon-2", true);
    expect(log.completedCount).toBe(2);
    expect(log.completionPercentage).toBe(20);
    expect(log.shadeLevel).toBe(1);
    expect(log.shadeColor).toBe("#0e4429");

    // Check 3 more items (5/10 = 50%) -> Level 2 (#006d32 medium-dark green)
    await toggleChecklistItem("2026-11-23", "mon-3", true);
    await toggleChecklistItem("2026-11-23", "mon-4", true);
    log = await toggleChecklistItem("2026-11-23", "mon-5", true);
    expect(log.completedCount).toBe(5);
    expect(log.completionPercentage).toBe(50);
    expect(log.shadeLevel).toBe(2);
    expect(log.shadeColor).toBe("#006d32");

    // Check 2 more items (7/10 = 70%) -> Level 3 (#26a641 medium-light green)
    await toggleChecklistItem("2026-11-23", "mon-6", true);
    log = await toggleChecklistItem("2026-11-23", "mon-7", true);
    expect(log.completedCount).toBe(7);
    expect(log.completionPercentage).toBe(70);
    expect(log.shadeLevel).toBe(3);
    expect(log.shadeColor).toBe("#26a641");

    // Check all items (10/10 = 100%) -> Level 4 (#39d353 bright light green!)
    log = await setAllChecklistItems("2026-11-23", true);
    expect(log.completedCount).toBe(10);
    expect(log.completionPercentage).toBe(100);
    expect(log.shadeLevel).toBe(4);
    expect(log.shadeColor).toBe("#39d353");
  });

  test("3. Supports adding custom items to a day and recalculates shade", async () => {
    // Adding an 11th uncompleted item to Nov 23 drops completion from 100% (10/10) to 91% (10/11) -> Level 3
    const log = await addCustomChecklistItem("2026-11-23", "Wash dishes", "chores");
    expect(log.totalCount).toBe(11);
    expect(log.completedCount).toBe(10);
    expect(log.shadeLevel).toBe(3);
  });

  test("4. Returns November 2026 monthly calendar with per-day GitHub shades and stats", async () => {
    const calendar = await getMonthlyCalendar(2026, 11);
    expect(calendar.monthName).toBe("November");
    expect(calendar.daysInMonth).toBe(30);

    const nov23 = calendar.days.find((d) => d.dayOfMonth === 23);
    expect(nov23?.date).toBe("2026-11-23");
    expect(nov23?.shadeLevel).toBe(3);

    const stats = await getConsistencyStats();
    expect(stats.totalDaysTracked).toBeGreaterThanOrEqual(1);
  });
});

