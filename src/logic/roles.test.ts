// 역할 계산 순수 함수 단위 테스트: 항상 현장 3 고정, 1~N번 공정 휴식 검증

import { describe, it, expect } from "vitest";
import { rolesForTime, weekendRolesForTime, opposite } from "./roles";
import type { Role } from "./roles";

const countRole = (result: Record<number, { role: Role }>, role: Role) =>
  Object.values(result).filter((r) => r.role === role).length;

describe("평일 rolesForTime", () => {
  for (const first of ["문진", "현장"] as Role[]) {
    it(`firstRoundARole=${first}: 모든 타임 현장 3 + 문진 3, 휴식 1`, () => {
      for (let t = 1; t <= 6; t++) {
        const { result } = rolesForTime(t, first);
        expect(countRole(result, "현장")).toBe(3);
        expect(countRole(result, "문진")).toBe(3);
        expect(countRole(result, "휴식")).toBe(1);
      }
    });

    it(`firstRoundARole=${first}: 6타임 동안 1~6번이 정확히 한 번씩 휴식, 7번은 안 쉼`, () => {
      const restCount: Record<number, number> = {};
      for (let t = 1; t <= 6; t++) {
        const { restingNumber } = rolesForTime(t, first);
        restCount[restingNumber!] = (restCount[restingNumber!] ?? 0) + 1;
      }
      for (let n = 1; n <= 6; n++) expect(restCount[n]).toBe(1);
      expect(restCount[7]).toBeUndefined();
    });
  }

  it("회차마다 A/B 역할 스위칭", () => {
    // 회차1(T1,T2)=A문진, 회차2(T3,T4)=A현장, 회차3(T5,T6)=A문진
    expect(rolesForTime(1, "문진").aRole).toBe("문진");
    expect(rolesForTime(3, "문진").aRole).toBe("현장");
    expect(rolesForTime(5, "문진").aRole).toBe("문진");
  });

  it("7번은 쉬는 사람 조의 역할을 대행", () => {
    // T3: 3번(A조) 쉼, 회차2 → A=현장. 7번은 A조 역할(현장) 대행
    const { result } = rolesForTime(3, "문진");
    expect(result[3].role).toBe("휴식");
    expect(result[7].role).toBe("현장");
    expect(result[7].coveringFor).toBe(3);
  });
});

describe("주말 weekendRolesForTime", () => {
  for (const busy of [1, 3, 5, 8]) {
    it(`busyTime=${busy}: 바쁜 타임은 현장3+문진4, 나머지는 현장3+문진3`, () => {
      for (let t = 1; t <= 8; t++) {
        const { result } = weekendRolesForTime(t, "문진", busy);
        expect(countRole(result, "현장")).toBe(3);
        if (t === busy) {
          expect(countRole(result, "문진")).toBe(4);
          expect(countRole(result, "휴식")).toBe(0);
        } else {
          expect(countRole(result, "문진")).toBe(3);
          expect(countRole(result, "휴식")).toBe(1);
        }
      }
    });

    it(`busyTime=${busy}: 7개 일반 타임에 1~7번이 정확히 한 번씩 휴식`, () => {
      const restCount: Record<number, number> = {};
      for (let t = 1; t <= 8; t++) {
        const { restingNumber, isBusy } = weekendRolesForTime(t, "문진", busy);
        if (isBusy) continue;
        restCount[restingNumber!] = (restCount[restingNumber!] ?? 0) + 1;
      }
      for (let n = 1; n <= 7; n++) expect(restCount[n]).toBe(1);
    });
  }

  it("바쁜 타임 7번은 문진 보강", () => {
    const { result } = weekendRolesForTime(3, "문진", 3);
    expect(result[7].role).toBe("문진");
    expect(result[7].group).toBe("보강");
  });
});

describe("opposite", () => {
  it("문진↔현장", () => {
    expect(opposite("문진")).toBe("현장");
    expect(opposite("현장")).toBe("문진");
  });
});
