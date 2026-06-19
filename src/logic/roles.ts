// 타임별 번호별 역할(문진/현장/휴식) 계산 순수 함수 (프로토타입 로직 그대로 이식)

export type Role = "문진" | "현장" | "휴식";

export interface PersonRole {
  role: Role;
  group: "A" | "B" | "대행" | "보강" | "—";
  coveringFor?: number; // 7번이 대행 중인 휴식자 번호
}

export interface TimeRoles {
  round: number;
  aRole: Role;
  bRole: Role;
  restingNumber: number | null;
  isBusy?: boolean;
  result: Record<number, PersonRole>;
}

export const opposite = (r: Role): Role => (r === "문진" ? "현장" : "문진");

// 평일: 특정 타임(t=1..6)에서 번호별 역할 계산
// A조=1,2,3 / B조=4,5,6 / 7=대행. 회차=ceil(t/2), 회차 홀수면 A=firstRoundARole.
export function rolesForTime(timeIndex: number, firstRoundARole: Role): TimeRoles {
  const round = Math.ceil(timeIndex / 2);
  const aRole = round % 2 === 1 ? firstRoundARole : opposite(firstRoundARole);
  const bRole = opposite(aRole);
  const restingNumber = ((timeIndex - 1) % 6) + 1; // 1→6 순서

  const result: Record<number, PersonRole> = {};
  for (let n = 1; n <= 7; n++) {
    if (n === restingNumber) {
      result[n] = { role: "휴식", group: n <= 3 ? "A" : "B" };
    } else if (n <= 3) {
      result[n] = { role: aRole, group: "A" };
    } else if (n <= 6) {
      result[n] = { role: bRole, group: "B" };
    } else {
      // 7번: 쉬는 사람 조의 역할 대행
      const restRole = restingNumber <= 3 ? aRole : bRole;
      result[n] = { role: restRole, group: "대행", coveringFor: restingNumber };
    }
  }
  return { round, aRole, bRole, restingNumber, result };
}

// 주말 8타임 역할 계산. busyTime=바쁜 타임(1~8): 전원 근무(7번 문진 보강),
// 나머지 7타임에 1~7번 순서로 휴식.
export function weekendRolesForTime(
  timeIndex: number,
  firstRoundARole: Role,
  busyTime: number
): TimeRoles {
  // DB 손상·범위 밖 값 방어: 바쁜 타임은 1~8만 유효, 아니면 기본 3.
  if (!Number.isInteger(busyTime) || busyTime < 1 || busyTime > 8) busyTime = 3;
  const round = Math.ceil(timeIndex / 2);
  const aRole = round % 2 === 1 ? firstRoundARole : opposite(firstRoundARole);
  const bRole = opposite(aRole);
  const isBusy = timeIndex === busyTime;

  let restingNumber: number | null = null;
  if (!isBusy) {
    let restNo = 1;
    for (let t = 1; t < timeIndex; t++) if (t !== busyTime) restNo++;
    restingNumber = restNo;
  }

  const result: Record<number, PersonRole> = {};
  for (let n = 1; n <= 7; n++) {
    if (isBusy) {
      if (n <= 3) result[n] = { role: aRole, group: "A" };
      else if (n <= 6) result[n] = { role: bRole, group: "B" };
      else result[n] = { role: "문진", group: "보강" };
    } else if (n === restingNumber) {
      result[n] = { role: "휴식", group: n <= 3 ? "A" : n <= 6 ? "B" : "—" };
    } else if (n <= 3) {
      result[n] = { role: aRole, group: "A" };
    } else if (n <= 6) {
      result[n] = { role: bRole, group: "B" };
    } else {
      const restRole = restingNumber! <= 3 ? aRole : bRole;
      result[n] = { role: restRole, group: "대행", coveringFor: restingNumber! };
    }
  }
  return { round, aRole, bRole, restingNumber, isBusy, result };
}
