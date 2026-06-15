# 물놀이 근무 보드 — 구현 체크리스트

명세서 5장 작업 순서 기준. 완료 시 `[x]` 처리.

## 1. 프로젝트 초기화
- [ ] Vite + React + TypeScript 초기화
- [ ] 의존성 설치(@supabase/supabase-js, vitest)
- [ ] 폴더 구조 생성(src/logic, src/lib, src/screens, src/components, supabase/migrations)
- [ ] .gitignore(.env 포함)

## 2. 핵심 로직 이식 + 테스트
- [ ] 시간표 상수(WEEKDAY/WEEKEND_TIMETABLE) 이식
- [ ] buildTimeSlots / toMin / fmt 이식
- [ ] classifyDate + 2026 공휴일 이식
- [ ] rolesForTime(평일) / weekendRolesForTime(주말) 이식
- [ ] KST 현재시각 헬퍼(nowKstMinutes, kstDateString)
- [ ] vitest 단위 테스트: 평일/주말 모두 현장3 고정, 1~N번 공정 휴식 검증

## 3. Supabase 마이그레이션
- [ ] 7개 테이블(8.1~8.7) SQL
- [ ] PK/FK/UNIQUE 제약
- [ ] RLS 활성화 + 익명 read 전체 / write 정책
- [ ] timetables 시드(6장)
- [ ] holidays 시드(2026)
- [ ] employees 시드(7명)

## 4. 클라이언트/환경
- [ ] supabase 클라이언트(src/lib/supabase.ts)
- [ ] .env.example
- [ ] 타입(src/lib/types.ts)

## 5. 화면 4개 (UI 이식)
- [ ] 디자인 토큰 C / 공용 컴포넌트
- [ ] 출석 화면
- [ ] 대시보드(실시간 시계로 데모 슬라이더 교체)
- [ ] 시간표(조회)
- [ ] 대타 캘린더(등록/조회/삭제 + 이력)

## 6. Realtime
- [ ] daily_records / daily_number_assignments / attendance / substitute_plans 구독
- [ ] busy_time 변경 + 낙관적 업데이트
- [ ] 출석 토글 낙관적 업데이트

## 7. pg_cron
- [ ] 자정(KST) 배정 생성 함수(번호 랜덤, firstRoundARole 랜덤, 주말 busy_time=3)
- [ ] cron.schedule 등록 SQL
- [ ] 앱 부팅 시 그날 행 없으면 RPC로 즉석 생성(개장 전 사전 노출 보장)

## 8. README
- [ ] 로컬 실행 / Supabase 생성·키·마이그레이션 / Vercel 배포 / 환경변수

## 9. 검증
- [ ] npm run build 성공
- [ ] 타입/린트 에러 0
- [ ] vitest 통과
