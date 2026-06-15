# 컨텍스트 노트 — 구현 중 내린 결정과 근거

작업하며 결정·근거를 계속 추가한다. 다음 세션이 재유추 없이 이어받기 위한 기록.

## 정보원
- `_docs/물놀이시설_작업분배_웹앱_명세서.md` (rev.6) — 요구사항 절대 기준
- `_docs/물놀이근무보드_프로토타입.jsx` — 검증된 동작 프로토타입(로직/UI 그대로 이식)

## 명세서 vs 프로토타입 모순 (명세서 우선)
1. **시간표 type 세분화**: 프로토타입은 prep/entry/operation/cleanup/close, 명세서 8.6은 operation/common 2종.
   → DB `timetables.segments`는 명세서대로 운영 판별을 `type`으로 하되, 프로토타입의 세부 type/label을 JSON에 함께 보존.
   역할 계산은 `type==='operation'`만 사용하므로 영향 없음.

## 기술 결정
- **TypeScript** 채택(명세서 권장). 로직은 순수 함수로 src/logic 분리.
- **테스트 도구: Vitest** (Vite 기본 통합, 설정 최소).
- **상태관리**: React useState + 작은 커스텀 훅. 외부 라이브러리 금지(명세서 11장).
- **KST 처리**: JS Date의 로컬 타임존에 의존하지 않고, `Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'})`로 KST 날짜/시각을 명시 산출. → 어느 배포 환경(UTC Vercel)에서도 KST 고정.
- **pg_cron 자정 생성**: UTC 기준 15:00(=KST 자정)에 스케줄. 함수 내부는 `(now() at time zone 'Asia/Seoul')::date`로 그날 날짜 계산.
- **사전 노출 보장**: cron이 못 돌았거나 신규 환경 대비, 앱이 그날 `daily_records`가 없으면 동일 로직의 `ensure_daily_record` RPC를 호출해 즉석 생성.

## 데이터 모델 메모
- 출석 토글 = attendance 행 삭제, 미출석 = 행 없음.
- 번호→조 매핑은 number 값으로 계산(1~3=A,4~6=B,7=대행/보강). 저장 안 함.
- busy_time은 주말만(평일 NULL). 변경자/시각 busy_time_by / busy_time_at.

## RLS 방침
- 익명(anon) SELECT 전체 허용.
- INSERT/UPDATE/DELETE: attendance, substitute_plans, daily_records(busy_time 변경) 에만 허용.
- employees/timetables/holidays/daily_number_assignments 는 anon write 금지(시드/스케줄러만).
  단 daily_number_assignments는 RPC(security definer)로 생성.
