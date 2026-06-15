// 오늘(KST) 보드 데이터 로딩 · Realtime 구독 · 출석/바쁜타임 액션을 묶은 중심 훅

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { kstNow } from "../logic/kst";
import type { KstNow } from "../logic/kst";
import type { Employee, DailyRecord, NumberAssignment, Attendance, SubstitutePlan } from "../lib/types";

export interface BoardState {
  ready: boolean;
  error: string | null;
  configured: boolean;
  now: KstNow;
  today: string;
  employees: Employee[];
  record: DailyRecord | null;
  assignments: NumberAssignment[];
  attendance: Attendance[];
  subPlans: SubstitutePlan[]; // 오늘 대타 예약
  holidays: Record<string, string>;
}

export function useBoard() {
  // 1분마다 갱신되는 KST 현재시각 (데모 슬라이더 대체)
  const [now, setNow] = useState<KstNow>(() => kstNow());
  const today = now.dateStr;
  const todayRef = useRef(today);
  todayRef.current = today;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [record, setRecord] = useState<DailyRecord | null>(null);
  const [assignments, setAssignments] = useState<NumberAssignment[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [subPlans, setSubPlans] = useState<SubstitutePlan[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 실시간 시계: 1분마다 갱신
  useEffect(() => {
    const tick = () => setNow(kstNow());
    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // 오늘 날짜에 종속된 데이터 다시 불러오기
  const reloadToday = useCallback(async (date: string) => {
    const [rec, asg, att, sub] = await Promise.all([
      supabase.from("daily_records").select("*").eq("date", date).maybeSingle(),
      supabase.from("daily_number_assignments").select("*").eq("date", date),
      supabase.from("attendance").select("*").eq("date", date),
      supabase.from("substitute_plans").select("*").eq("date", date),
    ]);
    if (asg.data) setAssignments(asg.data as NumberAssignment[]);
    if (att.data) setAttendance(att.data as Attendance[]);
    if (sub.data) setSubPlans(sub.data as SubstitutePlan[]);
    setRecord((rec.data as DailyRecord) ?? null);
    return rec.data as DailyRecord | null;
  }, []);

  // 초기 로딩 + 그날 배정이 없으면 RPC로 즉석 생성(개장 전 사전 노출 보장)
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError("Supabase 환경변수가 설정되지 않았습니다. .env 파일을 확인하세요.");
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [emp, hol] = await Promise.all([
          supabase.from("employees").select("*").order("sort_order"),
          supabase.from("holidays").select("*"),
        ]);
        if (cancelled) return;
        if (emp.error) throw emp.error;
        setEmployees((emp.data as Employee[]) ?? []);
        const hmap: Record<string, string> = {};
        (hol.data ?? []).forEach((h: { date: string; name: string }) => (hmap[h.date] = h.name));
        setHolidays(hmap);

        let rec = await reloadToday(today);
        if (!rec) {
          // 자정 cron이 아직 안 돌았거나 신규 환경 → 즉석 생성
          await supabase.rpc("generate_daily_record", { target_date: today });
          if (!cancelled) await reloadToday(today);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // today가 바뀌면(자정 경과) 다시 로딩
  }, [today, reloadToday]);

  // Realtime 구독: 오늘 데이터 변경 시 재로딩
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel("board-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_records" }, () => reloadToday(todayRef.current))
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_number_assignments" }, () => reloadToday(todayRef.current))
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, () => reloadToday(todayRef.current))
      .on("postgres_changes", { event: "*", schema: "public", table: "substitute_plans" }, () => reloadToday(todayRef.current))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [reloadToday]);

  // ---- 액션: 출석 토글 (낙관적 업데이트) ----
  const toggleAttendance = useCallback(
    async (employeeId: string, sub?: SubstitutePlan) => {
      const existing = attendance.find((a) => a.employee_id === employeeId);
      if (existing) {
        // 취소: 행 삭제
        setAttendance((prev) => prev.filter((a) => a.employee_id !== employeeId));
        const { error: e } = await supabase.from("attendance").delete().eq("id", existing.id);
        if (e) await reloadToday(today);
      } else {
        // 출석: 낙관적 추가
        const optimistic: Attendance = {
          id: `tmp-${employeeId}`,
          date: today,
          employee_id: employeeId,
          check_in_at: new Date().toISOString(),
          is_substitute: !!sub,
          substitute_name: sub?.substitute_name ?? null,
        };
        setAttendance((prev) => [...prev, optimistic]);
        const { error: e } = await supabase.from("attendance").insert({
          date: today,
          employee_id: employeeId,
          is_substitute: !!sub,
          substitute_name: sub?.substitute_name ?? null,
        });
        if (e) await reloadToday(today);
        else await reloadToday(today);
      }
    },
    [attendance, today, reloadToday]
  );

  // ---- 액션: 바쁜 타임 변경 (낙관적 업데이트) ----
  const changeBusyTime = useCallback(
    async (t: number, byName: string) => {
      const at = new Date().toISOString();
      setRecord((prev) => (prev ? { ...prev, busy_time: t, busy_time_by: byName, busy_time_at: at } : prev));
      const { error: e } = await supabase
        .from("daily_records")
        .update({ busy_time: t, busy_time_by: byName, busy_time_at: at })
        .eq("date", today);
      if (e) await reloadToday(today);
    },
    [today, reloadToday]
  );

  return {
    state: { ready, error, configured: isSupabaseConfigured, now, today, employees, record, assignments, attendance, subPlans, holidays } as BoardState,
    toggleAttendance,
    changeBusyTime,
  };
}
