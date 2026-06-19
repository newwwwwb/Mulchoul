-- 코드 검토 반영 패치: 이미 배포된 DB에 1회 적용(SQL Editor 붙여넣기). 신규 설치는 setup.sql에 이미 포함됨.
-- #1 daily_records 직접 UPDATE 차단 + busy_time 전용 RPC, #2 cron 중복등록 방지, #4 날짜가드+경합방어

-- #1) anon이 day_type/first_round_a_role까지 위조할 수 있던 광범위 UPDATE 정책 제거
drop policy if exists "write_records_update" on public.daily_records;

-- #4) 날짜 범위 가드 + 자정 동시호출(TOCTOU) 경합 방어를 추가한 생성 함수
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
  if target_date < v_today - 1 or target_date > v_today + 7 then
    raise exception '허용 범위 밖 날짜입니다: %', target_date;
  end if;

  if exists (select 1 from daily_records where date = target_date) then
    return;
  end if;

  select exists(select 1 from holidays where date = target_date) into v_is_holiday;
  v_dow := extract(dow from target_date)::int;
  if v_is_holiday or v_dow = 0 or v_dow = 6 then
    v_day_type := 'weekend';
  else
    v_day_type := 'weekday';
  end if;

  v_first_role := case when random() < 0.5 then '문진' else '현장' end;
  v_busy := case when v_day_type = 'weekend' then 3 else null end;

  insert into daily_records (date, day_type, first_round_a_role, busy_time)
  values (target_date, v_day_type, v_first_role, v_busy)
  on conflict (date) do nothing;
  if not found then
    return;
  end if;

  insert into daily_number_assignments (date, number, employee_id)
  select target_date, row_number() over (order by random()), id
  from employees
  on conflict (date, number) do nothing;
end;
$$;

grant execute on function public.generate_daily_record(date) to anon, authenticated;

-- #1) 바쁜 타임 변경 전용 RPC (busy_time만, 시각은 서버 now())
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
     set busy_time = p_busy, busy_time_by = p_by, busy_time_at = now()
   where date = p_date and day_type = 'weekend';
end;
$$;

grant execute on function public.set_busy_time(date, int, text) to anon, authenticated;

-- #2) cron 중복 등록 방지: 기존 잡 제거 후 재등록
select cron.unschedule('daily-assignment-kst-midnight')
where exists (select 1 from cron.job where jobname = 'daily-assignment-kst-midnight');

select cron.schedule(
  'daily-assignment-kst-midnight',
  '0 15 * * *',
  $$ select public.generate_daily_record((now() at time zone 'Asia/Seoul')::date) $$
);
