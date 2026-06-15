// 시간표(조회용): 평일/주말 시간표 + 타임 분해 + 역할 흐름

import { C, roleColor } from "../ui/tokens";
import { SectionTitle, Legend } from "../components/common";
import { TIMETABLE_BY_TYPE, SLOTS_BY_TYPE, toMin } from "../logic/timetable";
import type { DayType } from "../logic/timetable";
import { rolesForTime, weekendRolesForTime } from "../logic/roles";
import type { Role } from "../logic/roles";

function RoleRow({ label, role }: { label: string; role: Role }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ color: C.sub }}>{label}</span>
      <span style={{ fontWeight: 800, color: roleColor(role) }}>{role}</span>
    </div>
  );
}

export function TimetableView({
  nowMin,
  firstRoundARole,
  dayType,
  busyTime,
}: {
  nowMin: number;
  firstRoundARole: Role;
  dayType: DayType;
  busyTime: number;
}) {
  const timetable = TIMETABLE_BY_TYPE[dayType];
  const slots = SLOTS_BY_TYPE[dayType];
  const isWeekend = dayType === "weekend";
  const segTypeLabel: Record<string, string> = { prep: "준비", entry: "입장", operation: "운영", cleanup: "정리", close: "마감" };
  const segTint: Record<string, string> = { prep: "#EAF1F0", entry: "#F0EFE6", operation: C.tealSoft, cleanup: "#F0EFE6", close: "#F3ECEC" };
  const inSeg = (s: { start: string; end: string }) => nowMin >= toMin(s.start) && nowMin < toMin(s.end);
  const workSlots = slots.filter((s) => s.kind === "work");

  return (
    <section className="fade">
      <SectionTitle
        eyebrow={isWeekend ? "시간표 · 주말·공휴일" : "시간표 · 평일"}
        title={isWeekend ? "주말·공휴일 운영 시간표" : "평일 운영 시간표"}
        desc={
          isWeekend
            ? "토·일·공휴일 기준 4회차 운영(8타임). 바쁜 타임 1개는 전원 근무(현장 3·문진 4), 나머지 7타임은 1~7번이 순서대로 한 번씩 쉽니다(현장 3·문진 3)."
            : "월~금 기준 3회차 운영. 회차당 운영 110분은 50분 + 휴식 10분 + 50분으로 나뉘어 T1~T6 타임이 됩니다."
        }
      />

      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
        {timetable.map((seg, i) => {
          const active = inSeg(seg);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 16px",
                borderTop: i === 0 ? "none" : `1px solid ${C.line}`,
                background: active ? C.tealSoft : "transparent",
              }}
            >
              <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 13.5, fontWeight: 700, minWidth: 104, color: active ? C.teal : C.ink }}>
                {seg.start}–{seg.end}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.sub, background: segTint[seg.type], padding: "3px 9px", borderRadius: 6, minWidth: 44, textAlign: "center" }}>
                {segTypeLabel[seg.type]}
              </span>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{seg.label}</div>
              {active && <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: C.teal }}>지금</span>}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
        운영 타임 분해 · 역할 흐름 <span style={{ color: C.sub, fontWeight: 500 }}>(1회차 A조 = {firstRoundARole})</span>
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10 }}>
          {workSlots.map((s) => {
            const r = isWeekend ? weekendRolesForTime(s.timeIndex!, firstRoundARole, busyTime) : rolesForTime(s.timeIndex!, firstRoundARole);
            const active = inSeg(s);
            const busy = isWeekend && r.isBusy;
            return (
              <div
                key={s.timeIndex}
                style={{
                  border: `1px solid ${active ? C.teal : busy ? C.amber : C.line}`,
                  background: active ? C.tealSoft : busy ? "#FBF4E6" : "#fff",
                  borderRadius: 11,
                  padding: "12px 13px",
                }}
              >
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
                        ? r.restingNumber === 7
                          ? "쉼 7번 · 대행 없음"
                          : `쉼 ${r.restingNumber}번 · 7번이 대행`
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
