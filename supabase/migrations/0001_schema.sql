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
