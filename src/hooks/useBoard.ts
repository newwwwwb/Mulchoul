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
  // 출석 토글 진행 중인 직원 — 연타/중복 요청 방지(in-flight 가드)
  const pendingAtt = useRef<Set<string>>(new Set());

  // 실시간 시계: 분 경계(:00초)에 정렬해 갱신 → 슬롯 전환이 최대 1분 늦게 보이던 문제 제거
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const tick = () => setNow(kstNow());
    const msToNextMinute = 60000 - (Date.now() % 60000);
    const timeoutId = setTimeout(() => {
      tick();
      intervalId = setInterval(tick, 60 * 1000);
    }, msToNextMinute);
    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
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
      // 진행 중이면 무시: 연타 시 stale 상태로 분기가 두 번 결정되는 것을 차단
      if (pendingAtt.current.has(employeeId)) return;
      pendingAtt.current.add(employeeId);
      try {
        const existing = attendance.find((a) => a.employee_id === employeeId);
        if (existing) {
          // 취소: 행 삭제
          setAttendance((prev) => prev.filter((a) => a.employee_id !== employeeId));
          const { error: e } = await supabase.from("attendance").delete().eq("id", existing.id);
          if (e) console.error("[attendance] delete 실패", e);
        } else {
          // 출석: 낙관적 추가 (key 충돌 방지를 위해 고유 임시 id)
          const optimistic: Attendance = {
            id: `tmp-${crypto.randomUUID()}`,
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
          if (e) console.error("[attendance] insert 실패", e);
        }
        // insert/delete 모두 끝에서 서버 상태로 수렴(대칭). Realtime echo와 충돌해도 진실로 정렬.
        await reloadToday(today);
      } finally {
        pendingAtt.current.delete(employeeId);
      }
    },
    [attendance, today, reloadToday]
  );

  // ---- 액션: 바쁜 타임 변경 (낙관적 업데이트) ----
  const changeBusyTime = useCallback(
    async (t: number, byName: string) => {
      const at = new Date().toISOString();
      setRecord((prev) => (prev ? { ...prev, busy_time: t, busy_time_by: byName, busy_time_at: at } : prev));
      // busy_time 외 컬럼 위조를 막기 위해 전용 RPC 경유(직접 UPDATE 정책 제거됨). 시각은 서버 now()로 확정.
      const { error: e } = await supabase.rpc("set_busy_time", { p_date: today, p_busy: t, p_by: byName });
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
