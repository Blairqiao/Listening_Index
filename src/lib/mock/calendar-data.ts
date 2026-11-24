import type { CalendarData, CalendarDay } from "@/lib/calendar";
import { localDateKey } from "@/lib/range";

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getMockCalendar(
  tz: string,
  now = new Date()
): CalendarData {
  const rand = mulberry32(42);
  const today = localDateKey(now, tz);
  const [endY, endM, endD] = today.split("-").map(Number);
  const endDate = new Date(Date.UTC(endY, endM - 1, endD));
  const curDate = new Date(Date.UTC(2024, 0, 1)); // 2024-01-01

  const days: CalendarDay[] = [];

  while (curDate <= endDate) {
    const y = curDate.getUTCFullYear();
    const m = curDate.getUTCMonth() + 1;
    const d = curDate.getUTCDate();
    const dayOfWeek = curDate.getUTCDay(); // 0 is Sunday, 6 is Saturday

    const dateStr = `${y}-${m < 10 ? `0${m}` : m}-${d < 10 ? `0${d}` : d}`;

    let count = 0;
    // 15% zero days
    if (rand() >= 0.15) {
      // Base seasonal shape (higher in winter/autumn, slight dip in summer)
      const dayOfYear = Math.floor(
        (curDate.getTime() - new Date(Date.UTC(y, 0, 1)).getTime()) / 86400000
      );
      const seasonal =
        1.0 + 0.25 * Math.cos(((dayOfYear - 20) / 365) * 2 * Math.PI);

      // Weekly shape (weekends / Fri slightly higher)
      let weeklyMultiplier = 1.0;
      if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
        weeklyMultiplier = 1.25;
      } else if (dayOfWeek === 1) {
        weeklyMultiplier = 0.9;
      }

      // Noise
      const noise = 0.6 + rand() * 0.8; // 0.6 to 1.4

      const basePlays = 32;
      const calculated = Math.round(
        basePlays * seasonal * weeklyMultiplier * noise
      );
      count = Math.max(1, calculated);
    }

    if (count > 0) {
      days.push({
        date: dateStr,
        count,
      });
    }

    curDate.setUTCDate(curDate.getUTCDate() + 1);
  }

  return {
    days,
    firstDate: days[0]?.date ?? null,
    today,
    timezone: tz,
  };
}
