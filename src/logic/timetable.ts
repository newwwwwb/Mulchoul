// 평일/주말 운영 시간표 상수와 타임 슬롯 분해 로직 (프로토타입에서 이식)

export type DayType = "weekday" | "weekend";

// 시간표 구간 세부 종류. 명세서 8.6의 운영 판별은 type==='operation' 만 사용한다.
export type SegmentType = "prep" | "entry" | "operation" | "cleanup" | "close";

export interface Segment {
  label: string;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  type: SegmentType;
  round?: number; // 운영 회차
}

// 운영 110분을 50/10/50으로 분해한 단위. kind로 work/switch/common 구분.
export interface Slot {
  label: string;
  start: string;
  end: string;
  type: SegmentType | "switch";
  round?: number;
  timeIndex?: number; // 운영 타임 전역 인덱스 T1..(6 또는 8)
  kind: "work" | "switch" | "common";
}

// ---- 평일 시간표 (확정, 명세서 6.1) ----
export const WEEKDAY_TIMETABLE: Segment[] = [
  { label: "개장 준비", start: "09:00", end: "09:30", type: "prep" },
  { label: "1회 입장", start: "09:30", end: "10:00", type: "entry" },
  { label: "1회 운영", start: "10:00", end: "11:50", type: "operation", round: 1 },
  { label: "정리 · 점심", start: "11:50", end: "12:50", type: "cleanup" },
  { label: "2회 입장", start: "12:50", end: "13:15", type: "entry" },
  { label: "2회 운영", start: "13:15", end: "15:05", type: "operation", round: 2 },
  { label: "정리", start: "15:05", end: "15:25", type: "cleanup" },
  { label: "3회 입장", start: "15:25", end: "15:50", type: "entry" },
  { label: "3회 운영", start: "15:50", end: "17:40", type: "operation", round: 3 },
  { label: "마감", start: "17:40", end: "18:00", type: "close" },
];

// ---- 주말·공휴일 시간표 (확정, 명세서 6.2) — 4회차 ----
export const WEEKEND_TIMETABLE: Segment[] = [
  { label: "개장 준비", start: "09:00", end: "09:30", type: "prep" },
  { label: "1회 입장", start: "09:30", end: "09:50", type: "entry" },
  { label: "1회 운영", start: "09:50", end: "11:40", type: "operation", round: 1 },
  { label: "정리 · 점심", start: "11:40", end: "12:40", type: "cleanup" },
  { label: "2회 입장", start: "12:40", end: "13:00", type: "entry" },
  { label: "2회 운영", start: "13:00", end: "14:50", type: "operation", round: 2 },
  { label: "정리", start: "14:50", end: "15:05", type: "cleanup" },
  { label: "3회 입장", start: "15:05", end: "15:25", type: "entry" },
  { label: "3회 운영", start: "15:25", end: "17:15", type: "operation", round: 3 },
  { label: "마감", start: "17:15", end: "17:30", type: "close" },
  { label: "4회 입장", start: "17:30", end: "17:50", type: "entry" },
  { label: "4회 운영", start: "17:50", end: "19:40", type: "operation", round: 4 },
  { label: "마감", start: "19:40", end: "20:00", type: "close" },
];

export const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const fmt = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// 운영 110분을 [50 운영 / 10 휴식 / 50 운영]으로 분해해 타임 슬롯 생성
export function buildTimeSlots(timetable: Segment[]): Slot[] {
  const slots: Slot[] = [];
  let timeIndex = 0; // T1.. (운영 타임 전역 인덱스)
  for (const seg of timetable) {
    if (seg.type !== "operation") {
      slots.push({ ...seg, kind: "common" });
      continue;
    }
    const s = toMin(seg.start);
    slots.push({
      label: `${seg.round}회 운영 · 전반`,
      start: fmt(s),
      end: fmt(s + 50),
      type: "operation",
      round: seg.round,
      timeIndex: ++timeIndex,
      kind: "work",
    });
    slots.push({
      label: `${seg.round}회 휴식 전환`,
      start: fmt(s + 50),
      end: fmt(s + 60),
      type: "switch",
      round: seg.round,
      kind: "switch",
    });
    slots.push({
      label: `${seg.round}회 운영 · 후반`,
      start: fmt(s + 60),
      end: fmt(s + 110),
      type: "operation",
      round: seg.round,
      timeIndex: ++timeIndex,
      kind: "work",
    });
  }
  return slots;
}

export const WEEKDAY_SLOTS = buildTimeSlots(WEEKDAY_TIMETABLE);
export const WEEKEND_SLOTS = buildTimeSlots(WEEKEND_TIMETABLE);
export const SLOTS_BY_TYPE: Record<DayType, Slot[]> = {
  weekday: WEEKDAY_SLOTS,
  weekend: WEEKEND_SLOTS,
};
export const TIMETABLE_BY_TYPE: Record<DayType, Segment[]> = {
  weekday: WEEKDAY_TIMETABLE,
  weekend: WEEKEND_TIMETABLE,
};

// 현재 시각(분)이 속한 슬롯 찾기
export function currentSlot(nowMin: number, dayType: DayType = "weekday"): Slot | undefined {
  return SLOTS_BY_TYPE[dayType].find((s) => nowMin >= toMin(s.start) && nowMin < toMin(s.end));
}
