-- ============================================================
-- 통합 설치 스크립트: Supabase SQL Editor 에 전체 붙여넣어 1회 실행
-- (개별 적용을 원하면 migrations/0001~0003 을 순서대로 실행해도 됨)
-- pg_cron 이 막히면 Database → Extensions 에서 먼저 활성화 후 재실행
-- ============================================================

-- 물초울 근무 보드 스키마 (명세서 8장). 모든 시각 timestamptz(UTC 저장), date는 KST 기준 일자.

-- 8.1 employees — 고정 7명
create table if not exists public.employees (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  int not null default 0
);

-- 8.2 daily_records — 날짜별 배정 (하루 1행)
create table if not exists public.daily_records (
  date               date primary key,
  day_type           text not null check (day_type in ('weekday', 'weekend')),
  first_round_a_role text not null check (first_round_a_role in ('문진', '현장')),
  busy_time          int  check (busy_time between 1 and 8),   -- 주말만, 평일 NULL
  busy_time_by       text,
  busy_time_at       timestamptz,
  created_at         timestamptz not null default now()
);

-- 8.3 daily_number_assignments — 번호 배정 (하루 7행)
create table if not exists public.daily_number_assignments (
  date        date not null references public.daily_records(date) on delete cascade,
  number      int  not null check (number between 1 and 7),
  employee_id uuid not null references public.employees(id),
  primary key (date, number),
  unique (date, employee_id)
);

-- 8.4 attendance — 출석 (출석 시 1행, 토글 취소 시 행 삭제)
create table if not exists public.attendance (
  id              uuid primary key default gen_random_uuid(),
  date            date not null references public.daily_records(date) on delete cascade,
  employee_id     uuid not null references public.employees(id),
  check_in_at     timestamptz not null default now(),
  is_substitute   bool not null default false,
  substitute_name text,
  unique (date, employee_id)
);

-- 8.5 substitute_plans — 대타 캘린더 (사전 예약)
create table if not exists public.substitute_plans (
  id              uuid primary key default gen_random_uuid(),
  date            date not null,
  employee_id     uuid not null references public.employees(id),
  substitute_name text not null,
  created_at      timestamptz not null default now(),
  unique (date, employee_id)
);

-- 8.6 timetables — 시간표 설정
create table if not exists public.timetables (
  day_type text primary key check (day_type in ('weekday', 'weekend')),
  segments jsonb not null
);

-- 8.7 holidays — 공휴일 (2026 시드)
create table if not exists public.holidays (
  date date primary key,
  name text not null
);

-- ============================================================
-- RLS: 익명(anon) SELECT 전체 허용. 쓰기는 필요한 테이블에만.
-- ============================================================
alter table public.employees                enable row level security;
alter table public.daily_records            enable row level security;
alter table public.daily_number_assignments enable row level security;
alter table public.attendance               enable row level security;
alter table public.substitute_plans         enable row level security;
alter table public.timetables               enable row level security;
alter table public.holidays                 enable row level security;

-- 전체 읽기 허용
create policy "read_all_employees"   on public.employees                for select using (true);
create policy "read_all_records"     on public.daily_records            for select using (true);
create policy "read_all_assignments" on public.daily_number_assignments for select using (true);
create policy "read_all_attendance"  on public.attendance               for select using (true);
create policy "read_all_subplans"    on public.substitute_plans         for select using (true);
create policy "read_all_timetables"  on public.timetables               for select using (true);
create policy "read_all_holidays"    on public.holidays                 for select using (true);

-- 출석: 익명 insert/delete 허용 (출석 토글). 정정 위한 update도 허용.
create policy "write_attendance_insert" on public.attendance for insert with check (true);
create policy "write_attendance_update" on public.attendance for update using (true) with check (true);
create policy "write_attendance_delete" on public.attendance for delete using (true);

-- 대타 예약: 전원 등록/삭제 가능
create policy "write_subplans_insert" on public.substitute_plans for insert with check (true);
create policy "write_subplans_update" on public.substitute_plans for update using (true) with check (true);
create policy "write_subplans_delete" on public.substitute_plans for delete using (true);

-- daily_records: anon 직접 UPDATE는 허용하지 않는다. 바쁜 타임 변경은 set_busy_time RPC(0003)만 수행
-- → day_type/first_round_a_role 등 다른 컬럼 위조 차단(명세 7.3: busy_time만 변경 가능).

-- employees / timetables / holidays / daily_number_assignments 는 anon 쓰기 금지(시드/스케줄러 전용).

-- 시드: 직원 7명, 시간표(6장), 2026 공휴일(프로토타입 목록)

-- 직원 7명 (이름 = ID 식별)
insert into public.employees (name, sort_order) values
  ('김하준', 1),
  ('이서연', 2),
  ('박지후', 3),
  ('최유나', 4),
  ('정도윤', 5),
  ('강민서', 6),
  ('윤채원', 7)
on conflict do nothing;

-- 시간표 (명세서 6장). segments: [{label,start,end,type,round?}]
insert into public.timetables (day_type, segments) values
('weekday', '[
  {"label":"개장 준비","start":"09:00","end":"09:30","type":"prep"},
  {"label":"1회 입장","start":"09:30","end":"10:00","type":"entry"},
  {"label":"1회 운영","start":"10:00","end":"11:50","type":"operation","round":1},
  {"label":"정리 · 점심","start":"11:50","end":"12:50","type":"cleanup"},
  {"label":"2회 입장","start":"12:50","end":"13:15","type":"entry"},
  {"label":"2회 운영","start":"13:15","end":"15:05","type":"operation","round":2},
  {"label":"정리","start":"15:05","end":"15:25","type":"cleanup"},
  {"label":"3회 입장","start":"15:25","end":"15:50","type":"entry"},
  {"label":"3회 운영","start":"15:50","end":"17:40","type":"operation","round":3},
  {"label":"마감","start":"17:40","end":"18:00","type":"close"}
]'::jsonb),
('weekend', '[
  {"label":"개장 준비","start":"09:00","end":"09:30","type":"prep"},
  {"label":"1회 입장","start":"09:30","end":"09:50","type":"entry"},
  {"label":"1회 운영","start":"09:50","end":"11:40","type":"operation","round":1},
  {"label":"정리 · 점심","start":"11:40","end":"12:40","type":"cleanup"},
  {"label":"2회 입장","start":"12:40","end":"13:00","type":"entry"},
  {"label":"2회 운영","start":"13:00","end":"14:50","type":"operation","round":2},
  {"label":"정리","start":"14:50","end":"15:05","type":"cleanup"},
  {"label":"3회 입장","start":"15:05","end":"15:25","type":"entry"},
  {"label":"3회 운영","start":"15:25","end":"17:15","type":"operation","round":3},
  {"label":"마감","start":"17:15","end":"17:30","type":"close"},
  {"label":"4회 입장","start":"17:30","end":"17:50","type":"entry"},
  {"label":"4회 운영","start":"17:50","end":"19:40","type":"operation","round":4},
  {"label":"마감","start":"19:40","end":"20:00","type":"close"}
]'::jsonb)
on conflict (day_type) do update set segments = excluded.segments;

-- 2026 대한민국 공휴일 (대체공휴일 포함, 근로자의날 제외)
insert into public.holidays (date, name) values
  ('2026-01-01', '신정'),
  ('2026-02-16', '설날 연휴'),
  ('2026-02-17', '설날'),
  ('2026-02-18', '설날 연휴'),
  ('2026-03-01', '삼일절'),
  ('2026-03-02', '대체공휴일(삼일절)'),
  ('2026-05-05', '어린이날'),
  ('2026-05-24', '부처님오신날'),
  ('2026-05-25', '대체공휴일(부처님오신날)'),
  ('2026-06-06', '현충일'),
  ('2026-08-15', '광복절'),
  ('2026-08-17', '대체공휴일(광복절)'),
  ('2026-09-24', '추석 연휴'),
  ('2026-09-25', '추석'),
  ('2026-09-26', '추석 연휴'),
  ('2026-10-03', '개천절'),
  ('2026-10-05', '대체공휴일(개천절)'),
  ('2026-10-09', '한글날'),
  ('2026-12-25', '크리스마스')
on conflict (date) do nothing;

-- 일일 배정 자동 생성 함수 + 바쁜 타임 변경 RPC + pg_cron 자정(KST) 스케줄

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
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  -- 날짜 범위 가드: 어제~7일 후만 허용(개장 전 사전 노출 목적). 임의 미래 날짜 대량 생성 차단.
  if target_date < v_today - 1 or target_date > v_today + 7 then
    raise exception '허용 범위 밖 날짜입니다: %', target_date;
  end if;

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

  -- 자정 cron과 앱의 사전노출 RPC가 동시 호출되는 경합(TOCTOU) 방어: 충돌 시 조용히 종료
  insert into daily_records (date, day_type, first_round_a_role, busy_time)
  values (target_date, v_day_type, v_first_role, v_busy)
  on conflict (date) do nothing;
  if not found then
    return; -- 다른 호출이 먼저 생성함
  end if;

  -- 번호 배정 완전 랜덤: 직원을 무작위 정렬해 1~7번 부여
  insert into daily_number_assignments (date, number, employee_id)
  select target_date, row_number() over (order by random()), id
  from employees
  on conflict (date, number) do nothing;
end;
$$;

-- anon이 개장 전 사전 노출을 위해 즉석 호출 가능하도록 실행 권한 부여
grant execute on function public.generate_daily_record(date) to anon, authenticated;

-- 바쁜 타임 변경 전용 RPC: busy_time만 갱신(다른 컬럼 위조 차단), 시각은 서버 now()로 확정.
-- 주말 행에만 적용. security definer로 daily_records 직접 UPDATE 정책 없이도 동작.
create or replace function public.set_busy_time(p_date date, p_busy int, p_by text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_busy < 1 or p_busy > 8 then
    raise exception 'busy_time은 1~8만 허용됩니다: %', p_busy;
  end if;
  update daily_records
     set busy_time = p_busy,
         busy_time_by = p_by,
         busy_time_at = now()
   where date = p_date
     and day_type = 'weekend';
end;
$$;

grant execute on function public.set_busy_time(date, int, text) to anon, authenticated;

-- ============================================================
-- pg_cron: 매일 KST 자정 = UTC 15:00 에 그날 배정 생성
-- (Supabase 대시보드 Database → Extensions 에서 pg_cron 활성화 필요)
-- ============================================================
create extension if not exists pg_cron;

-- 재실행 안전: 기존 동일 이름 잡이 있으면 먼저 제거(pg_cron 버전별 중복 등록 방지).
select cron.unschedule('daily-assignment-kst-midnight')
where exists (select 1 from cron.job where jobname = 'daily-assignment-kst-midnight');

-- KST 자정에 '오늘'(KST) 배정 생성. cron은 UTC 기준이므로 15:00 UTC = 00:00 KST.
select cron.schedule(
  'daily-assignment-kst-midnight',
  '0 15 * * *',
  $$ select public.generate_daily_record((now() at time zone 'Asia/Seoul')::date) $$
);
