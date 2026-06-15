-- 일일 배정 자동 생성 함수 + pg_cron 자정(KST) 스케줄

-- 그날 daily_records가 없으면 번호·firstRoundARole 완전 랜덤 생성, 주말이면 busy_time=3.
-- security definer: anon이 RPC로 호출해도 daily_number_assignments(쓰기 금지 테이블)에 insert 가능.
create or replace function public.generate_daily_record(target_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day_type text;
  v_first_role text;
  v_busy int;
  v_is_holiday bool;
  v_dow int;
begin
  -- 이미 있으면 아무것도 하지 않음 (날짜 단위 1회 고정)
  if exists (select 1 from daily_records where date = target_date) then
    return;
  end if;

  -- day_type 판별: 공휴일이거나 토(6)·일(0)이면 weekend
  select exists(select 1 from holidays where date = target_date) into v_is_holiday;
  v_dow := extract(dow from target_date)::int; -- 0=일 .. 6=토
  if v_is_holiday or v_dow = 0 or v_dow = 6 then
    v_day_type := 'weekend';
  else
    v_day_type := 'weekday';
  end if;

  -- firstRoundARole 랜덤
  v_first_role := case when random() < 0.5 then '문진' else '현장' end;
  -- 주말이면 busy_time 기본 3, 평일은 NULL
  v_busy := case when v_day_type = 'weekend' then 3 else null end;

  insert into daily_records (date, day_type, first_round_a_role, busy_time)
  values (target_date, v_day_type, v_first_role, v_busy);

  -- 번호 배정 완전 랜덤: 직원을 무작위 정렬해 1~7번 부여
  insert into daily_number_assignments (date, number, employee_id)
  select target_date, row_number() over (order by random()), id
  from employees;
end;
$$;

-- anon이 개장 전 사전 노출을 위해 즉석 호출 가능하도록 실행 권한 부여
grant execute on function public.generate_daily_record(date) to anon, authenticated;

-- ============================================================
-- pg_cron: 매일 KST 자정 = UTC 15:00 에 그날 배정 생성
-- (Supabase 대시보드 Database → Extensions 에서 pg_cron 활성화 필요)
-- ============================================================
create extension if not exists pg_cron;

-- KST 자정에 '오늘'(KST) 배정 생성. cron은 UTC 기준이므로 15:00 UTC = 00:00 KST.
select cron.schedule(
  'daily-assignment-kst-midnight',
  '0 15 * * *',
  $$ select public.generate_daily_record((now() at time zone 'Asia/Seoul')::date) $$
);
