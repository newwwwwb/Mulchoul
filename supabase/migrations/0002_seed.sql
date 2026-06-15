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
