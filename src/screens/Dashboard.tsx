// 대시보드: 지금 내 역할(대형), 내 번호·조·출석, 오늘 타임별 역할표, 전체 현황 그리드

import { C, roleColor } from "../ui/tokens";
import { InfoCard, NumBadge, SubTag, Legend, Empty } from "../components/common";
import { SLOTS_BY_TYPE } from "../logic/timetable";
import type { DayType, Slot } from "../logic/timetable";
import { rolesForTime, weekendRolesForTime } from "../logic/roles";
import type { Role, TimeRoles } from "../logic/roles";
import type { Employee, Attendance as AttRow, SubstitutePlan } from "../lib/types";
import { kstNow } from "../logic/kst";

export function Dashboard({
  me,
  empById,
  employeeToNumber,
  numberToEmployee,
  firstRoundARole,
  slot,
  live,
  attendance,
  subPlanFor,
  dayType,
  busyTime,
}: {
  me: string | null;
  empById: (id: string) => Employee | undefined;
  employeeToNumber: Record<string, number>;
  numberToEmployee: Record<number, string>;
  firstRoundARole: Role;
  slot: Slot | undefined;
  live: TimeRoles | null;
  attendance: AttRow[];
  subPlanFor: (empId: string) => SubstitutePlan | undefined;
  dayType: DayType;
  busyTime: number;
}) {
  if (!me) {
    return (
      <section className="fade">
        <Empty title="먼저 출석해 주세요" desc="출석 화면에서 이름을 누르면 번호와 역할이 표시됩니다." />
      </section>
    );
  }
  const attByEmp = new Map(attendance.map((a) => [a.employee_id, a]));
  const isWeekend = dayType === "weekend";
  const myNum = employeeToNumber[me];
  const myAtt = attByEmp.get(me);

  // 오늘 내 타임별 역할 (평일 T1~T6 / 주말 T1~T8)
  const myTimes = SLOTS_BY_TYPE[dayType]
    .filter((s) => s.kind === "work")
    .map((s) => {
      const r = isWeekend
        ? weekendRolesForTime(s.timeIndex!, firstRoundARole, busyTime)
        : rolesForTime(s.timeIndex!, firstRoundARole);
      return { slot: s, round: r.round, isBusy: r.isBusy, mine: r.result[myNum] };
    });

  const baseGroup = myNum <= 3 ? "A" : myNum <= 6 ? "B" : "7";
  const myLive = live ? live.result[myNum] : null;
  const hint =
    myLive && myLive.coveringFor
      ? ` · ${myLive.coveringFor}번 자리 대행`
      : myLive && myLive.group === "보강"
        ? " · 문진 보강 (전원 근무)"
        : "";

  return (
    <section className="fade">
      {/* 현재 역할 — 히어로 */}
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: "22px 22px 24px", marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.sub, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 12 }}>
          지금 내 역할
        </div>
        {slot && slot.kind === "work" && myLive ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 46, fontWeight: 800, lineHeight: 1, color: roleColor(myLive.role), letterSpacing: "-0.02em" }}>
              {myLive.role}
            </span>
            <span style={{ fontSize: 14, color: C.sub }}>
              {slot.label} · {slot.start}–{slot.end}
              {hint}
            </span>
          </div>
        ) : slot && slot.kind === "switch" ? (
          <div style={{ fontSize: 30, fontWeight: 800, color: C.rest }}>
            전환 · 10분 휴식{" "}
            <span style={{ fontSize: 14, color: C.sub, fontWeight: 500 }}>
              {slot.start}–{slot.end}
            </span>
          </div>
        ) : slot ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <span style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.02em" }}>{slot.label}</span>
            <span style={{ fontSize: 14, color: C.sub }}>
              {slot.start}–{slot.end} · 전원 공통
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 30, fontWeight: 800, color: C.sub }}>운영 시간 외</div>
        )}
      </div>

      {/* 내 배정 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
        <InfoCard label="내 번호" value={`${myNum}번`} />
        <InfoCard label="내 조" value={baseGroup === "7" ? (isWeekend ? "7번" : "대행 (7번)") : `${baseGroup}조`} />
        <InfoCard label="출석" value={myAtt ? kstNow(new Date(myAtt.check_in_at)).hhmm : "—"} extra={myAtt?.is_substitute ? "대타" : null} />
      </div>

      {/* 오늘 내 타임별 역할 */}
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
          오늘 내 타임별 역할 <span style={{ color: C.sub, fontWeight: 500 }}>· {myNum}번</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(96px,1fr))", gap: 8 }}>
          {myTimes.map((t) => {
            const here = slot && slot.kind === "work" && slot.timeIndex === t.slot.timeIndex;
            const resting = t.mine.role === "휴식";
            return (
              <div
                key={t.slot.timeIndex}
                style={{
                  border: `1px solid ${here ? C.teal : C.line}`,
                  background: here ? C.tealSoft : "#fff",
                  borderRadius: 10,
                  padding: "9px 10px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>
                  T{t.slot.timeIndex}
                  {t.isBusy ? "·바쁨" : ""}
                </div>
                <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 10.5, color: C.sub, marginTop: 1 }}>{t.slot.start}</div>
                <div style={{ marginTop: 5, fontWeight: 800, fontSize: 14, color: resting ? C.rest : roleColor(t.mine.role) }}>{t.mine.role}</div>
                {t.mine.coveringFor && <div style={{ fontSize: 9.5, color: C.amber, marginTop: 1 }}>{t.mine.coveringFor}번대행</div>}
                {t.mine.group === "보강" && <div style={{ fontSize: 9.5, color: C.amber, marginTop: 1 }}>보강</div>}
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
                const eid = numberToEmployee[n];
                const isMe = n === myNum;
                const sub = eid ? subPlanFor(eid) : undefined;
                const absent = !eid || !attByEmp.has(eid);
                return (
                  <div
                    key={n}
                    style={{
                      border: `1px solid ${isMe ? C.teal : C.line}`,
                      background: isMe ? C.tealSoft : absent ? "#FAFAFA" : "#fff",
                      opacity: absent ? 0.7 : 1,
                      borderRadius: 11,
                      padding: "11px 12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <NumBadge n={n} />
                      <span style={{ fontSize: 11, color: C.sub }}>{r.group}</span>
                    </div>
                    <div style={{ marginTop: 9, fontWeight: 800, fontSize: 16, color: roleColor(r.role) }}>{r.role}</div>
                    <div style={{ marginTop: 3, fontSize: 11.5, color: C.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {eid ? empById(eid)?.name : "—"}
                      {sub && <SubTag small />}
                      {r.coveringFor ? ` ·${r.coveringFor}번` : ""}
                    </div>
                    {absent && <div style={{ marginTop: 4, fontSize: 10.5, fontWeight: 700, color: "#A3A3A3" }}>미출석</div>}
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
          <div style={{ fontSize: 13, color: C.sub }}>지금은 운영 타임이 아닙니다. 운영 시간(평일 10:00~ / 주말 09:50~)에 역할이 표시됩니다.</div>
        )}
      </div>
    </section>
  );
}
