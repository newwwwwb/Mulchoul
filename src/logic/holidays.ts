// 2026년 한국 공휴일 목록과 날짜→평일/주말 자동 판별 (프로토타입에서 이식)

import type { DayType } from "./timetable";

// ---- 2026년 대한민국 공휴일 (대체공휴일 포함, 근로자의날 제외) ----
// 공휴일은 주말과 동일하게 "weekend"(4회차) 운영으로 취급
export const HOLIDAYS_2026: Record<string, string> = {
  "2026-01-01": "신정",
  "2026-02-16": "설날 연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설날 연휴",
  "2026-03-01": "삼일절",
  "2026-03-02": "대체공휴일(삼일절)",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날",
  "2026-05-25": "대체공휴일(부처님오신날)",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절",
  "2026-08-17": "대체공휴일(광복절)",
  "2026-09-24": "추석 연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",
  "2026-10-03": "개천절",
  "2026-10-05": "대체공휴일(개천절)",
  "2026-10-09": "한글날",
  "2026-12-25": "크리스마스",
};

export interface DateInfo {
  dayType: DayType;
  reason: string;
  isHoliday: boolean;
}

// "YYYY-MM-DD" 또는 KST 요일을 기반으로 판별.
// holidays: DB에서 동기화된 공휴일 맵(없으면 내장 2026 목록 사용).
export function classifyDate(
  dateStr: string,
  weekday: number, // 0=일 ... 6=토 (KST 기준)
  holidays: Record<string, string> = HOLIDAYS_2026
): DateInfo {
  if (holidays[dateStr]) {
    return { dayType: "weekend", reason: holidays[dateStr], isHoliday: true };
  }
  if (weekday === 0 || weekday === 6) {
    return { dayType: "weekend", reason: weekday === 0 ? "일요일" : "토요일", isHoliday: false };
  }
  return { dayType: "weekday", reason: "평일", isHoliday: false };
}
