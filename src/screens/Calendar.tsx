// 대타 캘린더: 날짜+맡기는 직원+대타 이름 예약 등록/조회/삭제 + 이력

import { useCallback, useEffect, useState } from "react";
import { C } from "../ui/tokens";
import { SectionTitle, SubTag, Empty } from "../components/common";
import { supabase } from "../lib/supabase";
import type { Employee, SubstitutePlan } from "../lib/types";

export function Calendar({ employees, empById, today }: { employees: Employee[]; empById: (id: string) => Employee | undefined; today: string }) {
  const [date, setDate] = useState(today);
  const [empId, setEmpId] = useState(employees[0]?.id ?? "");
  const [subName, setSubName] = useState("");
  const [plans, setPlans] = useState<SubstitutePlan[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data } = await supabase.from("substitute_plans").select("*").order("date", { ascending: false });
    setPlans((data as SubstitutePlan[]) ?? []);
  }, []);

  useEffect(() => {
    reload();
    // 다른 기기의 대타 등록/삭제도 즉시 반영
    const channel = supabase
      .channel("calendar-subplans")
      .on("postgres_changes", { event: "*", schema: "public", table: "substitute_plans" }, () => reload())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload]);

  const add = async () => {
    if (!subName.trim() || !empId) return;
    setBusy(true);
    setMsg(null);
    // 한 자리에 예약 1건(UNIQUE date+employee) — upsert로 갱신
    const { error } = await supabase
      .from("substitute_plans")
      .upsert({ date, employee_id: empId, substitute_name: subName.trim() }, { onConflict: "date,employee_id" });
    setBusy(false);
    if (error) {
      setMsg(`등록 실패: ${error.message}`);
      return;
    }
    setSubName("");
    await reload();
  };

  const remove = async (id: string) => {
    await supabase.from("substitute_plans").delete().eq("id", id);
    await reload();
  };

  const upcoming = plans.filter((p) => p.date >= today);
  const history = plans.filter((p) => p.date < today);

  const PlanRow = ({ p }: { p: SubstitutePlan }) => (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 11, padding: "13px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <SubTag />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {empById(p.employee_id)?.name ?? "?"} 자리 → {p.substitute_name}
        </div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{p.date}</div>
      </div>
      <button
        onClick={() => remove(p.id)}
        style={{ border: `1px solid ${C.line}`, background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: C.sub, cursor: "pointer" }}
      >
        삭제
      </button>
    </div>
  );

  return (
    <section className="fade">
      <SectionTitle
        eyebrow="대타 캘린더"
        title="대타 예약"
        desc="결근하는 직원 자리에 누가 대타로 오는지 날짜별로 미리 등록합니다. 그 번호의 역할 계산은 그대로 유지됩니다."
      />

      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>
          날짜
          <br />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ marginTop: 6, padding: "9px 12px", borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 14, background: "#fff" }}
          />
        </label>
        <label style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>
          맡기는 직원
          <br />
          <select
            value={empId}
            onChange={(e) => setEmpId(e.target.value)}
            style={{ marginTop: 6, padding: "9px 12px", borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 14, minWidth: 130, background: "#fff" }}
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12, color: C.sub, fontWeight: 600, flex: 1, minWidth: 160 }}>
          대타 이름
          <br />
          <input
            value={subName}
            onChange={(e) => setSubName(e.target.value)}
            placeholder="예) 한지민"
            style={{ marginTop: 6, width: "100%", padding: "9px 12px", borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 14 }}
          />
        </label>
        <button
          className="btn"
          onClick={add}
          disabled={busy}
          style={{ padding: "10px 18px", borderRadius: 9, border: "none", background: C.teal, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1 }}
        >
          예약 추가
        </button>
      </div>
      {msg && <div style={{ marginBottom: 12, fontSize: 13, color: "#8A2A2A" }}>{msg}</div>}

      <div style={{ fontSize: 13, fontWeight: 700, margin: "4px 0 10px" }}>예정된 대타</div>
      {upcoming.length === 0 ? (
        <Empty title="예정된 대타가 없습니다" desc="위에서 날짜·직원·대타 이름을 정해 예약을 추가하세요." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {upcoming.map((p) => (
            <PlanRow key={p.id} p={p} />
          ))}
        </div>
      )}

      {history.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, margin: "22px 0 10px", color: C.sub }}>지난 대타 이력</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: 0.85 }}>
            {history.map((p) => (
              <PlanRow key={p.id} p={p} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
