import React, { useState, useEffect, useMemo } from "react";

/* ============================================================
   물놀이 시설 작업 분배 · 현황 대시보드 — 인터랙티브 프로토타입
   - 평일 로직(확정분)을 실제로 계산하여 동작
   - 출석 → 대시보드 → 대타 캘린더 화면 전환
   - 가짜(데모) 데이터 기반, 인메모리 상태
   ============================================================ */

// ---- 고정 직원 (이름 = ID) ----
const EMPLOYEES = [
  { id: "e1", name: "김하준" },
  { id: "e2", name: "이서연" },
  { id: "e3", name: "박지후" },
  { id: "e4", name: "최유나" },
  { id: "e5", name: "정도윤" },
  { id: "e6", name: "강민서" },
  { id: "e7", name: "윤채원" },
];

// ---- 평일 시간표 (확정) ----
// type: prep/entry/operation/cleanup/close, round: 운영 회차
const WEEKDAY_TIMETABLE = [
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

// ---- 주말·공휴일 시간표 (확정) — 4회차 ----
const WEEKEND_TIMETABLE = [
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

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const fmt = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// 운영 110분을 [50 운영 / 10 휴식 / 50 운영]으로 분해해 타임 슬롯 생성
function buildTimeSlots(timetable) {
  const slots = [];
  let timeIndex = 0; // T1..T6 (운영 타임 전역 인덱스)
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

const SLOTS = buildTimeSlots(WEEKDAY_TIMETABLE);
const WEEKEND_SLOTS = buildTimeSlots(WEEKEND_TIMETABLE);
const SLOTS_BY_TYPE = { weekday: SLOTS, weekend: WEEKEND_SLOTS };
const TIMETABLE_BY_TYPE = { weekday: WEEKDAY_TIMETABLE, weekend: WEEKEND_TIMETABLE };

// ---- 2026년 대한민국 공휴일 (대체공휴일 포함, 근로자의날 제외) ----
// 공휴일은 주말과 동일하게 "weekend"(4회차) 운영으로 취급
const HOLIDAYS_2026 = {
  "2026-01-01": "신정",
  "2026-02-16": "설날 연휴", "2026-02-17": "설날", "2026-02-18": "설날 연휴",
  "2026-03-01": "삼일절", "2026-03-02": "대체공휴일(삼일절)",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날", "2026-05-25": "대체공휴일(부처님오신날)",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절", "2026-08-17": "대체공휴일(광복절)",
  "2026-09-24": "추석 연휴", "2026-09-25": "추석", "2026-09-26": "추석 연휴",
  "2026-10-03": "개천절", "2026-10-05": "대체공휴일(개천절)",
  "2026-10-09": "한글날",
  "2026-12-25": "크리스마스",
};

const ymd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// 날짜 → { dayType, reason }. 공휴일/일요일 → weekend, 평일 → weekday
// (이 시설은 월~일 운영이며 토요일도 주말 운영 시간표를 따름)
function classifyDate(d) {
  const key = ymd(d);
  if (HOLIDAYS_2026[key]) return { dayType: "weekend", reason: HOLIDAYS_2026[key], isHoliday: true };
  const wd = d.getDay(); // 0=일 ... 6=토
  if (wd === 0 || wd === 6) return { dayType: "weekend", reason: wd === 0 ? "일요일" : "토요일", isHoliday: false };
  return { dayType: "weekday", reason: "평일", isHoliday: false };
}

const opposite = (r) => (r === "문진" ? "현장" : "문진");

// 특정 타임(t=1..6)에서 번호별 역할 계산
// assignment: { firstRoundARole } , A조=1,2,3 / B조=4,5,6 / 7=대행
function rolesForTime(timeIndex, firstRoundARole) {
  // 회차 = ceil(t/2). 회차 홀수면 A=firstRoundARole, 짝수면 반대
  const round = Math.ceil(timeIndex / 2);
  const aRole = round % 2 === 1 ? firstRoundARole : opposite(firstRoundARole);
  const bRole = opposite(aRole);
  const restingNumber = ((timeIndex - 1) % 6) + 1; // 1→6 순서

  const result = {};
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

// 주말 8타임 역할 계산. busyTime=바쁜 타임(1~8): 전원 근무(7번 문진 보강), 나머지 7타임에 1~7번 순서 휴식
function weekendRolesForTime(timeIndex, firstRoundARole, busyTime) {
  const round = Math.ceil(timeIndex / 2);
  const aRole = round % 2 === 1 ? firstRoundARole : opposite(firstRoundARole);
  const bRole = opposite(aRole);
  const isBusy = timeIndex === busyTime;

  let restingNumber = null;
  if (!isBusy) {
    let restNo = 1;
    for (let t = 1; t < timeIndex; t++) if (t !== busyTime) restNo++;
    restingNumber = restNo;
  }

  const result = {};
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
      const restRole = restingNumber <= 3 ? aRole : bRole;
      result[n] = { role: restRole, group: "대행", coveringFor: restingNumber };
    }
  }
  return { round, aRole, bRole, restingNumber, isBusy, result };
}

// 현재 시각이 속한 슬롯 찾기
function currentSlot(nowMin, dayType = "weekday") {
  return SLOTS_BY_TYPE[dayType].find((s) => nowMin >= toMin(s.start) && nowMin < toMin(s.end));
}

// ---- 색상 토큰 ----
const C = {
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

const roleColor = (role) =>
  role === "문진" ? C.munjin : role === "현장" ? C.hyunjang : C.rest;

export default function App() {
  const [screen, setScreen] = useState("attendance"); // attendance | dashboard | calendar
  const [me, setMe] = useState(null); // employeeId
  const [attendance, setAttendance] = useState({}); // empId -> { time, isSub, subName }
  const [subPlans, setSubPlans] = useState([
    // 데모용 기존 대타 예약: 오늘 e5(정도윤) 자리에 대타
  ]);

  // 선택 날짜(데모: 오늘 기준) → 평일/주말 자동 판별
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const dateInfo = useMemo(() => classifyDate(selectedDate), [selectedDate]);
  const dayType = dateInfo.dayType;
  const [busyTime, setBusyTime] = useState(3);

  // 데모용 시계: 슬라이더로 하루를 돌려볼 수 있게
  const dayEnd = dayType === "weekend" ? "20:00" : "18:00";
  const realNow = new Date();
  const realMin = realNow.getHours() * 60 + realNow.getMinutes();
  const [demoMin, setDemoMin] = useState(
    realMin >= toMin("09:00") && realMin <= toMin("18:00") ? realMin : toMin("10:25")
  );

  // 오늘 배정 (데모: 고정 시드 — 실제론 하루 1회 랜덤 생성)
  const assignment = useMemo(
    () => ({
      numberToEmployee: { 1: "e3", 2: "e1", 3: "e6", 4: "e2", 5: "e5", 6: "e7", 7: "e4" },
      firstRoundARole: "문진",
    }),
    []
  );
  const employeeToNumber = useMemo(() => {
    const m = {};
    Object.entries(assignment.numberToEmployee).forEach(([num, eid]) => (m[eid] = Number(num)));
    return m;
  }, [assignment]);

  const empById = (id) => EMPLOYEES.find((e) => e.id === id);
  const todaySubFor = (empId) => subPlans.find((p) => p.employeeId === empId);

  const slot = currentSlot(demoMin, dayType);
  const live =
    slot && slot.kind === "work"
      ? dayType === "weekend"
        ? weekendRolesForTime(slot.timeIndex, assignment.firstRoundARole, busyTime)
        : rolesForTime(slot.timeIndex, assignment.firstRoundARole)
      : null;

  // 출석 처리
  const checkIn = (empId, sub) => {
    setAttendance((a) => {
      if (a[empId]) { const n = { ...a }; delete n[empId]; return n; } // 다시 누르면 취소
      return { ...a, [empId]: { time: fmt(demoMin), isSub: !!sub, subName: sub?.substituteName || null } };
    });
    if (!me) setMe(empId);
  };

  // 바쁜 타임 변경 이력 (데모: 마지막 변경자/시각)
  const [busyMeta, setBusyMeta] = useState(null);
  const changeBusyTime = (t) => {
    setBusyTime(t);
    setBusyMeta({ by: me ? empById(me)?.name : "익명", at: fmt(demoMin) });
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink,
      fontFamily: "'Inter','Pretendard',system-ui,sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; }
        @media (prefers-reduced-motion: reduce){ *{animation:none!important;transition:none!important} }
        .tab:focus-visible,.btn:focus-visible,.name:focus-visible{outline:2px solid ${C.teal};outline-offset:2px}
        .fade{animation:fade .35s ease}
        @keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
      `}</style>

      <Header screen={screen} setScreen={setScreen} me={me} empById={empById}
        meNumber={me ? employeeToNumber[me] : null} />

      <main style={{ maxWidth: 920, margin: "0 auto", padding: "20px 18px 64px" }}>
        {/* 평일/주말 모드 토글 */}
        <ModeBar selectedDate={selectedDate} setSelectedDate={setSelectedDate}
          dateInfo={dateInfo} busyTime={busyTime} setBusyTime={changeBusyTime} busyMeta={busyMeta} />

        {/* 데모 시계 컨트롤 */}
        <DemoClock demoMin={demoMin} setDemoMin={setDemoMin} slot={slot} dayEnd={dayEnd} />

        {screen === "attendance" && (
          <Attendance
            employees={EMPLOYEES} attendance={attendance} me={me}
            employeeToNumber={employeeToNumber} todaySubFor={todaySubFor}
            checkIn={checkIn} goDash={() => setScreen("dashboard")}
          />
        )}

        {screen === "dashboard" && (
          <Dashboard
            me={me} empById={empById} employeeToNumber={employeeToNumber}
            assignment={assignment} slot={slot} live={live}
            attendance={attendance} todaySubFor={todaySubFor} dayType={dayType} busyTime={busyTime}
          />
        )}

        {screen === "calendar" && (
          <Calendar
            employees={EMPLOYEES} subPlans={subPlans} setSubPlans={setSubPlans}
            empById={empById}
          />
        )}

        {screen === "timetable" && (
          <Timetable
            timetable={TIMETABLE_BY_TYPE[dayType]} slots={SLOTS_BY_TYPE[dayType]}
            demoMin={demoMin} firstRoundARole={assignment.firstRoundARole}
            dayType={dayType} busyTime={busyTime}
          />
        )}
      </main>
    </div>
  );
}

function ModeBar({ selectedDate, setSelectedDate, dateInfo, busyTime, setBusyTime, busyMeta }) {
  const isWeekend = dateInfo.dayType === "weekend";
  const slots = SLOTS_BY_TYPE.weekend.filter((s) => s.kind === "work");
  const wdName = ["일", "월", "화", "수", "목", "금", "토"][selectedDate.getDay()];
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
      <input type="date" value={ymd(selectedDate)}
        onChange={(e) => { const [y,m,d]=e.target.value.split("-").map(Number); setSelectedDate(new Date(y,m-1,d)); }}
        style={{ padding: "8px 12px", borderRadius: 9, border: `1px solid ${C.line}`,
          fontSize: 13, background: "#fff", fontWeight: 600, color: C.ink }} />
      <span style={{ fontSize: 13, fontWeight: 700, padding: "6px 12px", borderRadius: 8,
        background: isWeekend ? "#FBF4E6" : C.tealSoft,
        color: isWeekend ? C.amber : C.teal }}>
        {wdName}요일 · {isWeekend ? "주말·공휴일 운영(4회차)" : "평일 운영(3회차)"}
        {dateInfo.isHoliday ? ` · ${dateInfo.reason}` : ""}
      </span>
      {isWeekend && (
        <label style={{ fontSize: 12, color: C.sub, fontWeight: 600, display: "flex",
          alignItems: "center", gap: 8 }}>
          바쁜 타임
          <select value={busyTime} onChange={(e) => setBusyTime(Number(e.target.value))}
            style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.line}`,
              fontSize: 13, background: "#fff", fontWeight: 600, color: C.ink }}>
            {slots.map((s) => (
              <option key={s.timeIndex} value={s.timeIndex}>
                T{s.timeIndex} · {s.round}회 {s.timeIndex % 2 === 1 ? "전반" : "후반"}
              </option>
            ))}
          </select>
        </label>
      )}
      {isWeekend && (
        <span style={{ fontSize: 11.5, color: C.sub, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: C.teal }} />
          전원 공유 · 실시간 반영
          {busyMeta ? ` · 마지막 변경 ${busyMeta.by} (${busyMeta.at})` : ""}
        </span>
      )}
    </div>
  );
}

function Header({ screen, setScreen, me, empById, meNumber }) {
  const tabs = [
    ["attendance", "출석"],
    ["dashboard", "대시보드"],
    ["timetable", "시간표"],
    ["calendar", "대타 캘린더"],
  ];
  return (
    <header style={{ background: C.surface, borderBottom: `1px solid ${C.line}` }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "14px 18px",
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Wave />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em" }}>물놀이 근무 보드</div>
            <div style={{ fontSize: 12, color: C.sub }}>오늘 · 평일 운영</div>
          </div>
        </div>
        <nav style={{ display: "flex", gap: 4, marginLeft: "auto",
          background: C.bg, padding: 4, borderRadius: 10 }}>
          {tabs.map(([id, label]) => (
            <button key={id} className="tab" onClick={() => setScreen(id)}
              style={{
                border: "none", cursor: "pointer", padding: "7px 13px", borderRadius: 7,
                fontSize: 13, fontWeight: 600,
                background: screen === id ? C.surface : "transparent",
                color: screen === id ? C.ink : C.sub,
                boxShadow: screen === id ? "0 1px 3px rgba(0,0,0,.08)" : "none",
              }}>
              {label}
            </button>
          ))}
        </nav>
        {me && (
          <div style={{ display: "flex", alignItems: "center", gap: 8,
            paddingLeft: 12, borderLeft: `1px solid ${C.line}` }}>
            <span style={{ fontSize: 13, color: C.sub }}>나</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{empById(me)?.name}</span>
            {meNumber && <NumBadge n={meNumber} />}
          </div>
        )}
      </div>
    </header>
  );
}

function DemoClock({ demoMin, setDemoMin, slot, dayEnd = "18:00" }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12,
      padding: "12px 16px", marginBottom: 18, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ fontSize: 12, color: C.sub, fontWeight: 600, whiteSpace: "nowrap" }}>
        데모 시계
      </div>
      <input type="range" min={toMin("09:00")} max={toMin(dayEnd)} value={demoMin}
        onChange={(e) => setDemoMin(Number(e.target.value))}
        style={{ flex: 1, accentColor: C.teal }} aria-label="데모 시각 조절" />
      <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 18,
        minWidth: 58, textAlign: "right" }}>{fmt(demoMin)}</div>
      <div style={{ fontSize: 12, color: C.teal, fontWeight: 600, minWidth: 96, textAlign: "right" }}>
        {slot ? slot.label : "운영 외"}
      </div>
    </div>
  );
}

function Attendance({ employees, attendance, me, employeeToNumber, todaySubFor, checkIn, goDash }) {
  const present = Object.keys(attendance).length;
  return (
    <section className="fade">
      <SectionTitle eyebrow="첫 화면" title="출석"
        desc="자기 이름을 누르면 출석 처리되고 출근 시각이 기록됩니다. 이름이 곧 본인 확인입니다." />
      <div style={{ display: "flex", gap: 8, marginBottom: 14, fontSize: 13, color: C.sub }}>
        <span>출석 <b style={{ color: C.ink }}>{present}</b> / {employees.length}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
        {employees.map((emp) => {
          const rec = attendance[emp.id];
          const sub = todaySubFor(emp.id);
          const n = employeeToNumber[emp.id];
          const checked = !!rec;
          return (
            <button key={emp.id} className="name" onClick={() => checkIn(emp.id, sub)}
              style={{
                textAlign: "left", cursor: "pointer", padding: "13px 14px", borderRadius: 12,
                border: `1px solid ${checked ? C.teal : C.line}`,
                background: checked ? C.tealSoft : C.surface,
                transition: "all .15s",
              }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  {emp.name}{rec?.isSub && <SubTag />}
                </span>
                <NumBadge n={n} />
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: checked ? C.teal : C.sub, fontWeight: 600 }}>
                {checked ? `출석 · ${rec.time} · 다시 눌러 취소` : sub ? `대타 예정 (${sub.substituteName})` : "미출석 · 누르기"}
              </div>
            </button>
          );
        })}
      </div>
      {me && (
        <button className="btn" onClick={goDash}
          style={{ marginTop: 20, padding: "12px 20px", borderRadius: 10, border: "none",
            background: C.teal, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          내 대시보드 보기 →
        </button>
      )}
    </section>
  );
}

function Dashboard({ me, empById, employeeToNumber, assignment, slot, live, attendance, todaySubFor, dayType, busyTime }) {
  if (!me) {
    return (
      <section className="fade">
        <Empty title="먼저 출석해 주세요"
          desc="출석 화면에서 이름을 누르면 번호와 역할이 표시됩니다." />
      </section>
    );
  }
  const isWeekend = dayType === "weekend";
  const myNum = employeeToNumber[me];
  // 오늘 내 타임별 역할 (T1~T6 평일 / T1~T8 주말)
  const myTimes = SLOTS_BY_TYPE[dayType].filter((s) => s.kind === "work").map((s) => {
    const r = isWeekend
      ? weekendRolesForTime(s.timeIndex, assignment.firstRoundARole, busyTime)
      : rolesForTime(s.timeIndex, assignment.firstRoundARole);
    const mine = r.result[myNum];
    return { slot: s, round: r.round, isBusy: r.isBusy, mine };
  });
  const baseGroup = myNum <= 3 ? "A" : myNum <= 6 ? "B" : "7";
  const myLive = live ? live.result[myNum] : null;
  // 부가 설명: 7번이 대행이면 "N번 자리 대행", 주말 보강이면 "문진 보강"
  const hint =
    myLive && myLive.coveringFor
      ? ` · ${myLive.coveringFor}번 자리 대행`
      : myLive && myLive.group === "보강"
        ? " · 문진 보강 (전원 근무)"
        : "";

  return (
    <section className="fade">
      {/* 현재 역할 — 히어로 */}
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16,
        padding: "22px 22px 24px", marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.sub, fontWeight: 700, letterSpacing: "0.04em",
          textTransform: "uppercase", marginBottom: 12 }}>지금 내 역할</div>
        {slot && slot.kind === "work" ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 46, fontWeight: 800, lineHeight: 1,
              color: roleColor(myLive.role), letterSpacing: "-0.02em" }}>
              {myLive.role}
            </span>
            <span style={{ fontSize: 14, color: C.sub }}>
              {slot.label} · {slot.start}–{slot.end}{hint}
            </span>
          </div>
        ) : slot && slot.kind === "switch" ? (
          <div style={{ fontSize: 30, fontWeight: 800, color: C.rest }}>
            전환 · 10분 휴식 <span style={{ fontSize: 14, color: C.sub, fontWeight: 500 }}>
              {slot.start}–{slot.end}</span>
          </div>
        ) : slot ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <span style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.02em" }}>{slot.label}</span>
            <span style={{ fontSize: 14, color: C.sub }}>{slot.start}–{slot.end} · 전원 공통</span>
          </div>
        ) : (
          <div style={{ fontSize: 30, fontWeight: 800, color: C.sub }}>운영 시간 외</div>
        )}
      </div>

      {/* 내 배정 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
        gap: 12, marginBottom: 16 }}>
        <InfoCard label="내 번호" value={`${myNum}번`} />
        <InfoCard label="내 조"
          value={baseGroup === "7" ? (isWeekend ? "7번" : "대행 (7번)") : `${baseGroup}조`} />
        <InfoCard label="출석" value={attendance[me]?.time || "—"}
          extra={attendance[me]?.isSub ? "대타" : null} />
      </div>

      {/* 오늘 내 타임별 역할 */}
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16,
        padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
          오늘 내 타임별 역할 <span style={{ color: C.sub, fontWeight: 500 }}>· {myNum}번</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(96px,1fr))", gap: 8 }}>
          {myTimes.map((t) => {
            const here = slot && slot.kind === "work" && slot.timeIndex === t.slot.timeIndex;
            const resting = t.mine.role === "휴식";
            return (
              <div key={t.slot.timeIndex} style={{
                border: `1px solid ${here ? C.teal : C.line}`,
                background: here ? C.tealSoft : "#fff",
                borderRadius: 10, padding: "9px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>
                  T{t.slot.timeIndex}{t.isBusy ? "·바쁨" : ""}
                </div>
                <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 10.5, color: C.sub, marginTop: 1 }}>
                  {t.slot.start}
                </div>
                <div style={{ marginTop: 5, fontWeight: 800, fontSize: 14,
                  color: resting ? C.rest : roleColor(t.mine.role) }}>
                  {t.mine.role}
                </div>
                {t.mine.coveringFor && (
                  <div style={{ fontSize: 9.5, color: C.amber, marginTop: 1 }}>{t.mine.coveringFor}번대행</div>
                )}
                {t.mine.group === "보강" && (
                  <div style={{ fontSize: 9.5, color: C.amber, marginTop: 1 }}>보강</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 전체 현황 그리드 */}
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>전체 현황 · 지금 이 타임</div>
        {live ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(118px,1fr))", gap: 10 }}>
              {Array.from({ length: 7 }, (_, i) => i + 1).map((n) => {
                const r = live.result[n];
                const eid = assignment.numberToEmployee[n];
                const isMe = n === myNum;
                const sub = todaySubFor(eid);
                const absent = !attendance[eid];
                return (
                  <div key={n} style={{
                    border: `1px solid ${isMe ? C.teal : C.line}`,
                    background: isMe ? C.tealSoft : absent ? "#FAFAFA" : "#fff",
                    opacity: absent ? 0.7 : 1,
                    borderRadius: 11, padding: "11px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <NumBadge n={n} />
                      <span style={{ fontSize: 11, color: C.sub }}>{r.group}</span>
                    </div>
                    <div style={{ marginTop: 9, fontWeight: 800, fontSize: 16, color: roleColor(r.role) }}>
                      {r.role}
                    </div>
                    <div style={{ marginTop: 3, fontSize: 11.5, color: C.sub, whiteSpace: "nowrap",
                      overflow: "hidden", textOverflow: "ellipsis" }}>
                      {empById(eid)?.name}{sub && <SubTag small />}
                      {r.coveringFor ? ` ·${r.coveringFor}번` : ""}
                    </div>
                    {absent && (
                      <div style={{ marginTop: 4, fontSize: 10.5, fontWeight: 700, color: "#A3A3A3" }}>미출석</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 16, fontSize: 12, color: C.sub, flexWrap: "wrap" }}>
              <Legend c={C.munjin} t="문진" />
              <Legend c={C.hyunjang} t="현장" />
              <Legend c={C.rest} t="휴식" />
              <span>· 7번은 쉬는 사람 자리를 대행</span>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: C.sub }}>
            지금은 운영 타임이 아닙니다. 데모 시계를 운영 시간(10:00~)으로 옮겨보세요.
          </div>
        )}
      </div>
    </section>
  );
}

function Calendar({ employees, subPlans, setSubPlans, empById }) {
  const [empId, setEmpId] = useState(employees[0].id);
  const [subName, setSubName] = useState("");

  const add = () => {
    if (!subName.trim()) return;
    setSubPlans((p) => [
      ...p.filter((x) => x.employeeId !== empId),
      { employeeId: empId, substituteName: subName.trim(), createdAt: new Date().toLocaleString("ko-KR") },
    ]);
    setSubName("");
  };
  const remove = (eid) => setSubPlans((p) => p.filter((x) => x.employeeId !== eid));

  return (
    <section className="fade">
      <SectionTitle eyebrow="대타 캘린더" title="오늘 대타 예약"
        desc="결근하는 직원 자리에 누가 대타로 오는지 미리 등록합니다. 그 번호의 역할 계산은 그대로 유지됩니다." />

      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14,
        padding: 16, marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>
          맡기는 직원<br />
          <select value={empId} onChange={(e) => setEmpId(e.target.value)}
            style={{ marginTop: 6, padding: "9px 12px", borderRadius: 9, border: `1px solid ${C.line}`,
              fontSize: 14, minWidth: 130, background: "#fff" }}>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, color: C.sub, fontWeight: 600, flex: 1, minWidth: 160 }}>
          대타 이름<br />
          <input value={subName} onChange={(e) => setSubName(e.target.value)}
            placeholder="예) 한지민"
            style={{ marginTop: 6, width: "100%", padding: "9px 12px", borderRadius: 9,
              border: `1px solid ${C.line}`, fontSize: 14 }} />
        </label>
        <button className="btn" onClick={add}
          style={{ padding: "10px 18px", borderRadius: 9, border: "none", background: C.teal,
            color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          예약 추가
        </button>
      </div>

      {subPlans.length === 0 ? (
        <Empty title="등록된 대타가 없습니다" desc="위에서 직원과 대타 이름을 정해 예약을 추가하세요." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {subPlans.map((p) => (
            <div key={p.employeeId} style={{ background: C.surface, border: `1px solid ${C.line}`,
              borderRadius: 11, padding: "13px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <SubTag />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {empById(p.employeeId)?.name} 자리 → {p.substituteName}
                </div>
                <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>등록 {p.createdAt}</div>
              </div>
              <button onClick={() => remove(p.employeeId)}
                style={{ border: `1px solid ${C.line}`, background: "#fff", borderRadius: 8,
                  padding: "6px 12px", fontSize: 12, color: C.sub, cursor: "pointer" }}>
                삭제
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---- 시간표 (조회용) ---- */
function Timetable({ timetable, slots, demoMin, firstRoundARole, dayType, busyTime }) {
  const isWeekend = dayType === "weekend";
  const segTypeLabel = {
    prep: "준비", entry: "입장", operation: "운영", cleanup: "정리", close: "마감",
  };
  const segTint = {
    prep: "#EAF1F0", entry: "#F0EFE6", operation: C.tealSoft, cleanup: "#F0EFE6", close: "#F3ECEC",
  };
  const inSeg = (s) => demoMin >= toMin(s.start) && demoMin < toMin(s.end);

  // 운영 타임만 뽑아 역할 흐름 표 만들기
  const workSlots = slots.filter((s) => s.kind === "work");

  return (
    <section className="fade">
      <SectionTitle eyebrow={isWeekend ? "시간표 · 주말·공휴일" : "시간표 · 평일"}
        title={isWeekend ? "주말·공휴일 운영 시간표" : "평일 운영 시간표"}
        desc={isWeekend
          ? "토·일 기준 4회차 운영(8타임). 바쁜 타임 1개는 전원 근무(현장 3·문진 4), 나머지 7타임은 1~7번이 순서대로 한 번씩 쉽니다(현장 3·문진 3)."
          : "수·목·금·월 기준 3회차 운영. 회차당 운영 110분은 50분 + 휴식 10분 + 50분으로 나뉘어 T1~T6 타임이 됩니다."} />

      {/* 시간표 본표 */}
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14,
        overflow: "hidden", marginBottom: 20 }}>
        {timetable.map((seg, i) => {
          const active = inSeg(seg);
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
              borderTop: i === 0 ? "none" : `1px solid ${C.line}`,
              background: active ? C.tealSoft : "transparent" }}>
              <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 13.5, fontWeight: 700,
                minWidth: 104, color: active ? C.teal : C.ink }}>
                {seg.start}–{seg.end}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.sub, background: segTint[seg.type],
                padding: "3px 9px", borderRadius: 6, minWidth: 44, textAlign: "center" }}>
                {segTypeLabel[seg.type]}
              </span>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{seg.label}</div>
              {active && <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700,
                color: C.teal }}>지금</span>}
            </div>
          );
        })}
      </div>

      {/* 타임 분해 + 역할 흐름 */}
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
        운영 타임 분해 · 역할 흐름 <span style={{ color: C.sub, fontWeight: 500 }}>(1회차 A조 = {firstRoundARole} 예시)</span>
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10 }}>
          {workSlots.map((s) => {
            const r = isWeekend
              ? weekendRolesForTime(s.timeIndex, firstRoundARole, busyTime)
              : rolesForTime(s.timeIndex, firstRoundARole);
            const active = inSeg(s);
            const busy = isWeekend && r.isBusy;
            return (
              <div key={s.timeIndex} style={{
                border: `1px solid ${active ? C.teal : busy ? C.amber : C.line}`,
                background: active ? C.tealSoft : busy ? "#FBF4E6" : "#fff",
                borderRadius: 11, padding: "12px 13px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>T{s.timeIndex}</span>
                  <span style={{ fontSize: 11, color: C.sub }}>{r.round}회차</span>
                </div>
                <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, color: C.sub, marginTop: 3 }}>
                  {s.start}–{s.end}
                </div>
                <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5 }}>
                  <RoleRow label="A조 (1·2·3)" role={r.aRole} />
                  <RoleRow label="B조 (4·5·6)" role={r.bRole} />
                  <div style={{ fontSize: 11.5, color: busy ? C.amber : C.sub, marginTop: 2, fontWeight: busy ? 700 : 400 }}>
                    {busy
                      ? "전원 근무 · 7번 문진 보강"
                      : isWeekend
                        ? (r.restingNumber === 7
                            ? "쉼 7번 · 대행 없음"
                            : `쉼 ${r.restingNumber}번 · 7번이 대행`)
                        : `쉼 ${r.restingNumber}번 · 7번이 대행`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 16, fontSize: 12, color: C.sub, flexWrap: "wrap" }}>
          <Legend c={C.munjin} t="문진" />
          <Legend c={C.hyunjang} t="현장" />
          <span>· 회차가 바뀔 때마다 A조·B조 역할이 스위칭됩니다</span>
        </div>
      </div>

      <p style={{ fontSize: 12.5, color: C.sub, marginTop: 16, lineHeight: 1.6 }}>
        {isWeekend
          ? "상단의 '바쁜 타임'을 바꾸면 휴식 순서가 자동으로 다시 배치됩니다. 바쁜 타임은 공정성을 위해 하루 1개만 지정합니다."
          : "평일은 모든 타임이 현장 3 · 문진 3으로 유지되며, 7번은 쉬지 않고 매 타임 쉬는 사람의 자리를 대행합니다."}
      </p>
    </section>
  );
}

function RoleRow({ label, role }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ color: C.sub }}>{label}</span>
      <span style={{ fontWeight: 800, color: roleColor(role) }}>{role}</span>
    </div>
  );
}

/* ---- 작은 컴포넌트들 ---- */
function SectionTitle({ eyebrow, title, desc }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11.5, color: C.teal, fontWeight: 700, letterSpacing: "0.06em",
        textTransform: "uppercase" }}>{eyebrow}</div>
      <h1 style={{ margin: "4px 0 6px", fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>{title}</h1>
      {desc && <p style={{ margin: 0, fontSize: 13.5, color: C.sub, lineHeight: 1.5, maxWidth: 560 }}>{desc}</p>}
    </div>
  );
}
function NumBadge({ n }) {
  if (!n) return null;
  const seven = n === 7;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 24, height: 24, borderRadius: 7, fontSize: 12.5, fontWeight: 800,
      background: seven ? C.amber : C.ink, color: "#fff" }}>{n}</span>
  );
}
function SubTag({ small }) {
  return (
    <span style={{ marginLeft: 6, fontSize: small ? 10 : 11, fontWeight: 700, color: C.amber,
      background: "#FBF1DD", padding: small ? "1px 5px" : "2px 7px", borderRadius: 6 }}>대타</span>
  );
}
function InfoCard({ label, value, extra }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 13, padding: "14px 16px" }}>
      <div style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>{label}</div>
      <div style={{ marginTop: 5, fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>
        {value}{extra && <span style={{ fontSize: 12, color: C.amber, marginLeft: 6, fontWeight: 700 }}>{extra}</span>}
      </div>
    </div>
  );
}
function Legend({ c, t }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{t}
    </span>
  );
}
function Empty({ title, desc }) {
  return (
    <div style={{ background: C.surface, border: `1px dashed ${C.line}`, borderRadius: 14,
      padding: "40px 24px", textAlign: "center" }}>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 13, color: C.sub }}>{desc}</div>
    </div>
  );
}
function Wave() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden>
      <rect width="30" height="30" rx="8" fill={C.teal} />
      <path d="M5 18c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3" stroke="#fff"
        strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M5 12c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3" stroke="#fff"
        strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5" />
    </svg>
  );
}
