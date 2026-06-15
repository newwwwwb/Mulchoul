// 프로토타입 디자인 토큰(색상) 그대로 유지

import type { Role } from "../logic/roles";

export const C = {
  bg: "#F2F5F4",
  surface: "#FFFFFF",
  ink: "#15302E",
  sub: "#5B716E",
  line: "#DDE6E3",
  teal: "#0E8C84",
  tealSoft: "#E2F1EF",
  munjin: "#0E8C84", // 문진
  hyunjang: "#C2773E", // 현장
  rest: "#8A9B98", // 휴식
  amber: "#B8852A",
};

export const roleColor = (role: Role | string): string =>
  role === "문진" ? C.munjin : role === "현장" ? C.hyunjang : C.rest;
