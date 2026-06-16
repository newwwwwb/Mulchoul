// 화면 라우팅 · 오늘 배정 파생값 계산 · 실시간 시계 기반 현재 역할 산출의 최상위 컴포넌트

import { useEffect, useMemo, useState } from "react";
import { useBoard } from "./hooks/useBoard";
import { classifyDate } from "./logic/holidays";
import { currentSlot } from "./logic/timetable";
import { rolesForTime, weekendRolesForTime } from "./logic/roles";
import type { Role } from "./logic/roles";
import { C } from "./ui/tokens";
import { NumBadge } from "./components/common";
import logoUrl from "./assets/intro_logo.png";
import { Attendance } from "./screens/Attendance";
import { Dashboard } from "./screens/Dashboard";
import { TimetableView } from "./screens/Timetable";
import { Calendar } from "./screens/Calendar";

type Screen = "attendance" | "dashboard" | "timetable" | "calendar";

export default function App() {
  const { state, toggleAttendance, changeBusyTime } = useBoard();
  const [screen, setScreen] = useState<Screen>("attendance");

  // 본인 식별(이름 클릭). 같은 날 새로고침해도 유지되도록 localStorage 저장.
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("mulnori-me");
      if (raw) {
        const { date, id } = JSON.parse(raw);
        if (date === state.today) setMe(id);
        else localStorage.removeItem("mulnori-me");
      }
    } catch {
      /* noop */
    }
  }, [state.today]);
  const identify = (id: string) => {
    setMe(id);
    localStorage.setItem("mulnori-me", JSON.stringify({ date: state.today, id }));
  };

  // 번호 ↔ 직원 매핑
  const numberToEmployee = useMemo(() => {
    const m: Record<number, string> = {};
    state.assignments.forEach((a) => (m[a.number] = a.employee_id));
    return m;
  }, [state.assignments]);
  const employeeToNumber = useMemo(() => {
    const m: Record<string, number> = {};
    state.assignments.forEach((a) => (m[a.employee_id] = a.number));
    return m;
  }, [state.assignments]);

  const empById = (id: string) => state.employees.find((e) => e.id === id);
  const subPlanFor = (empId: string) => state.subPlans.find((p) => p.employee_id === empId);

  // 날짜 자동 판별 + 오늘 배정값
  const dateInfo = classifyDate(state.today, state.now.weekday, state.holidays);
  const dayType = state.record?.day_type ?? dateInfo.dayType;
  const firstRoundARole: Role = state.record?.first_round_a_role ?? "문진";
  const busyTime = state.record?.busy_time ?? 3;

  // 현재 슬롯 + 지금 역할
  const slot = currentSlot(state.now.minutes, dayType);
  const live =
    slot && slot.kind === "work"
      ? dayType === "weekend"
        ? weekendRolesForTime(slot.timeIndex!, firstRoundARole, busyTime)
        : rolesForTime(slot.timeIndex!, firstRoundARole)
      : null;

  const checkIn = (empId: string, sub?: ReturnType<typeof subPlanFor>) => {
    if (!me) identify(empId);
    toggleAttendance(empId, sub ?? undefined);
  };

  const meNumber = me ? employeeToNumber[me] ?? null : null;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "'Inter','Pretendard',system-ui,sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        @media (prefers-reduced-motion: reduce){ *{animation:none!important;transition:none!important} }
        .tab:focus-visible,.btn:focus-visible,.name:focus-visible{outline:2px solid ${C.teal};outline-offset:2px}
        .fade{animation:fade .35s ease}
        @keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
      `}</style>

      <Header screen={screen} setScreen={setScreen} me={me} empById={empById} meNumber={meNumber} dateInfo={dateInfo} />

      <main style={{ maxWidth: 920, margin: "0 auto", padding: "20px 18px 64px" }}>
        {!state.ready ? (
          <div style={{ padding: 40, textAlign: "center", color: C.sub }}>불러오는 중…</div>
        ) : state.error ? (
          <div style={{ background: "#FBEEEE", border: "1px solid #E6BcBc", borderRadius: 12, padding: 20, color: "#8A2A2A" }}>
            데이터를 불러오지 못했습니다: {state.error}
          </div>
        ) : (
          <>
            <ModeBar
              today={state.today}
              weekdayName={["일", "월", "화", "수", "목", "금", "토"][state.now.weekday]}
              hhmm={state.now.hhmm}
              dateInfo={dateInfo}
              dayType={dayType}
              busyTime={busyTime}
              busyMeta={state.record?.busy_time_by ? { by: state.record.busy_time_by, at: state.record.busy_time_at } : null}
              onChangeBusy={(t) => changeBusyTime(t, me ? empById(me)?.name ?? "익명" : "익명")}
              slotLabel={slot ? slot.label : "운영 시간 외"}
            />

            {screen === "attendance" && (
              <Attendance
                employees={state.employees}
                attendance={state.attendance}
                me={me}
                employeeToNumber={employeeToNumber}
                subPlanFor={subPlanFor}
                checkIn={checkIn}
                goDash={() => setScreen("dashboard")}
              />
            )}

            {screen === "dashboard" && (
              <Dashboard
                me={me}
                empById={empById}
                employeeToNumber={employeeToNumber}
                numberToEmployee={numberToEmployee}
                firstRoundARole={firstRoundARole}
                slot={slot}
                live={live}
                attendance={state.attendance}
                subPlanFor={subPlanFor}
                dayType={dayType}
                busyTime={busyTime}
              />
            )}

            {screen === "timetable" && (
              <TimetableView nowMin={state.now.minutes} firstRoundARole={firstRoundARole} dayType={dayType} busyTime={busyTime} />
            )}

            {screen === "calendar" && <Calendar employees={state.employees} empById={empById} today={state.today} />}
          </>
        )}
      </main>
    </div>
  );
}

function Header({
  screen,
  setScreen,
  me,
  empById,
  meNumber,
  dateInfo,
}: {
  screen: Screen;
  setScreen: (s: Screen) => void;
  me: string | null;
  empById: (id: string) => { name: string } | undefined;
  meNumber: number | null;
  dateInfo: { dayType: string };
}) {
  const tabs: [Screen, string][] = [
    ["attendance", "출석"],
    ["dashboard", "대시보드"],
    ["timetable", "시간표"],
    ["calendar", "대타 캘린더"],
  ];
  return (
    <header style={{ background: C.surface, borderBottom: `1px solid ${C.line}` }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "14px 18px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={logoUrl} alt="참진주" style={{ height: 34, width: "auto", display: "block" }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em" }}>물초울 근무 보드</div>
            <div style={{ fontSize: 12, color: C.sub }}>오늘 · {dateInfo.dayType === "weekend" ? "주말·공휴일 운영" : "평일 운영"}</div>
          </div>
        </div>
        <nav style={{ display: "flex", gap: 4, marginLeft: "auto", background: C.bg, padding: 4, borderRadius: 10 }}>
          {tabs.map(([id, label]) => (
            <button
              key={id}
              className="tab"
              onClick={() => setScreen(id)}
              style={{
                border: "none",
                cursor: "pointer",
                padding: "7px 13px",
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 600,
                background: screen === id ? C.surface : "transparent",
                color: screen === id ? C.ink : C.sub,
                boxShadow: screen === id ? "0 1px 3px rgba(0,0,0,.08)" : "none",
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        {me && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 12, borderLeft: `1px solid ${C.line}` }}>
            <span style={{ fontSize: 13, color: C.sub }}>나</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{empById(me)?.name}</span>
            {meNumber && <NumBadge n={meNumber} />}
          </div>
        )}
      </div>
    </header>
  );
}

function ModeBar({
  today,
  weekdayName,
  hhmm,
  dateInfo,
  dayType,
  busyTime,
  busyMeta,
  onChangeBusy,
  slotLabel,
}: {
  today: string;
  weekdayName: string;
  hhmm: string;
  dateInfo: { isHoliday: boolean; reason: string };
  dayType: string;
  busyTime: number;
  busyMeta: { by: string; at: string | null } | null;
  onChangeBusy: (t: number) => void;
  slotLabel: string;
}) {
  const isWeekend = dayType === "weekend";
  // 주말 운영 타임 8개 옵션
  const workTimes = isWeekend ? Array.from({ length: 8 }, (_, i) => i + 1) : [];
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
      <span style={{ padding: "8px 12px", borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 13, background: "#fff", fontWeight: 700, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
        {today} ({weekdayName})
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          padding: "6px 12px",
          borderRadius: 8,
          background: isWeekend ? "#FBF4E6" : C.tealSoft,
          color: isWeekend ? C.amber : C.teal,
        }}
      >
        {isWeekend ? "주말·공휴일 운영(4회차)" : "평일 운영(3회차)"}
        {dateInfo.isHoliday ? ` · ${dateInfo.reason}` : ""}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, fontVariantNumeric: "tabular-nums" }}>🕐 {hhmm}</span>
      <span style={{ fontSize: 12, color: C.sub }}>· {slotLabel}</span>

      {isWeekend && (
        <label style={{ fontSize: 12, color: C.sub, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          바쁜 타임
          <select
            value={busyTime}
            onChange={(e) => onChangeBusy(Number(e.target.value))}
            style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, background: "#fff", fontWeight: 600, color: C.ink }}
          >
            {workTimes.map((t) => (
              <option key={t} value={t}>
                T{t} · {Math.ceil(t / 2)}회 {t % 2 === 1 ? "전반" : "후반"}
              </option>
            ))}
          </select>
        </label>
      )}
      {isWeekend && (
        <span style={{ fontSize: 11.5, color: C.sub, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: C.teal }} />
          전원 공유 · 실시간 반영
          {busyMeta ? ` · 마지막 변경 ${busyMeta.by}${busyMeta.at ? ` (${busyMeta.at.slice(11, 16)})` : ""}` : ""}
        </span>
      )}
    </div>
  );
}
