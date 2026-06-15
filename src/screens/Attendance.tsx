// 출석 화면(첫 화면): 7명 이름 클릭 출석/토글, 미출석·대타 표시

import { C } from "../ui/tokens";
import { SectionTitle, NumBadge, SubTag } from "../components/common";
import type { Employee, Attendance as AttRow, SubstitutePlan } from "../lib/types";
import { kstNow } from "../logic/kst";

export function Attendance({
  employees,
  attendance,
  me,
  employeeToNumber,
  subPlanFor,
  checkIn,
  goDash,
}: {
  employees: Employee[];
  attendance: AttRow[];
  me: string | null;
  employeeToNumber: Record<string, number>;
  subPlanFor: (empId: string) => SubstitutePlan | undefined;
  checkIn: (empId: string, sub?: SubstitutePlan) => void;
  goDash: () => void;
}) {
  const attByEmp = new Map(attendance.map((a) => [a.employee_id, a]));
  const present = attendance.length;

  const checkInTime = (iso: string) => {
    // 출석 시각을 KST HH:MM 으로 표시
    return kstNow(new Date(iso)).hhmm;
  };

  return (
    <section className="fade">
      <SectionTitle
        eyebrow="첫 화면"
        title="출석"
        desc="자기 이름을 누르면 출석 처리되고 출근 시각이 기록됩니다. 이름이 곧 본인 확인입니다."
      />
      <div style={{ display: "flex", gap: 8, marginBottom: 14, fontSize: 13, color: C.sub }}>
        <span>
          출석 <b style={{ color: C.ink }}>{present}</b> / {employees.length}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
        {employees.map((emp) => {
          const rec = attByEmp.get(emp.id);
          const sub = subPlanFor(emp.id);
          const n = employeeToNumber[emp.id];
          const checked = !!rec;
          return (
            <button
              key={emp.id}
              className="name"
              onClick={() => checkIn(emp.id, sub)}
              style={{
                textAlign: "left",
                cursor: "pointer",
                padding: "13px 14px",
                borderRadius: 12,
                border: `1px solid ${checked ? C.teal : C.line}`,
                background: checked ? C.tealSoft : C.surface,
                transition: "all .15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  {emp.name}
                  {rec?.is_substitute && <SubTag />}
                </span>
                <NumBadge n={n} />
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: checked ? C.teal : C.sub, fontWeight: 600 }}>
                {checked
                  ? `출석 · ${checkInTime(rec!.check_in_at)} · 다시 눌러 취소`
                  : sub
                    ? `대타 예정 (${sub.substitute_name})`
                    : "미출석 · 누르기"}
              </div>
            </button>
          );
        })}
      </div>
      {me && (
        <button
          className="btn"
          onClick={goDash}
          style={{ marginTop: 20, padding: "12px 20px", borderRadius: 10, border: "none", background: C.teal, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
        >
          내 대시보드 보기 →
        </button>
      )}
    </section>
  );
}
