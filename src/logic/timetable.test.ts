// 시간표 슬롯 분해·경계 판별 단위 테스트 (명세 6장 시각, 110=50+10+50 구조)

import { describe, it, expect } from "vitest";
import { WEEKDAY_SLOTS, WEEKEND_SLOTS, currentSlot, toMin, buildTimeSlots, WEEKDAY_TIMETABLE } from "./timetable";

describe("buildTimeSlots 분해", () => {
  it("평일: 운영 타임(work) 6개, 휴식 전환(switch) 3개", () => {
    expect(WEEKDAY_SLOTS.filter((s) => s.kind === "work").length).toBe(6);
    expect(WEEKDAY_SLOTS.filter((s) => s.kind === "switch").length).toBe(3);
  });

  it("주말: 운영 타임(work) 8개, 휴식 전환(switch) 4개", () => {
    expect(WEEKEND_SLOTS.filter((s) => s.kind === "work").length).toBe(8);
    expect(WEEKEND_SLOTS.filter((s) => s.kind === "switch").length).toBe(4);
  });

  it("timeIndex가 1..N으로 순서대로 부여된다", () => {
    const idx = WEEKDAY_SLOTS.filter((s) => s.kind === "work").map((s) => s.timeIndex);
    expect(idx).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("운영 110분이 50/10/50으로 분해된다 (평일 1회 운영 10:00~11:50)", () => {
    const slots = buildTimeSlots(WEEKDAY_TIMETABLE).filter((s) => s.round === 1 && s.kind !== "common");
    // 전반 50분
    expect(toMin(slots[0].end) - toMin(slots[0].start)).toBe(50);
    // 휴식 전환 10분
    expect(toMin(slots[1].end) - toMin(slots[1].start)).toBe(10);
    // 후반 50분
    expect(toMin(slots[2].end) - toMin(slots[2].start)).toBe(50);
    expect(slots[0].start).toBe("10:00");
    expect(slots[2].end).toBe("11:50");
  });
});

describe("currentSlot 경계 (start 포함, end 배제)", () => {
  it("평일 10:00은 T1 work", () => {
    const s = currentSlot(toMin("10:00"), "weekday");
    expect(s?.kind).toBe("work");
    expect(s?.timeIndex).toBe(1);
  });

  it("평일 10:50은 T1이 아니라 휴식 전환(switch)", () => {
    const s = currentSlot(toMin("10:50"), "weekday");
    expect(s?.kind).toBe("switch");
  });

  it("평일 11:00은 T2 work", () => {
    const s = currentSlot(toMin("11:00"), "weekday");
    expect(s?.timeIndex).toBe(2);
  });

  it("운영 시간 외(평일 08:00, 19:00)는 슬롯 없음", () => {
    expect(currentSlot(toMin("08:00"), "weekday")).toBeUndefined();
    expect(currentSlot(toMin("19:00"), "weekday")).toBeUndefined();
  });

  it("비운영 구간(09:00 개장 준비)은 common 슬롯", () => {
    expect(currentSlot(toMin("09:00"), "weekday")?.kind).toBe("common");
  });
});
