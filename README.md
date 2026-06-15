# 물놀이 근무 보드

물놀이 시설 직원 7명의 **번호·조·역할(문진/현장/휴식)을 실시간 공유**하는 웹앱.
로그인 없이 이름=ID, 출석 화면에서 이름 클릭이 본인 식별. 배정은 매일 자정(KST) 자동 랜덤 생성.

- 프론트엔드: React + Vite + TypeScript
- 백엔드/DB: Supabase (PostgreSQL · Realtime · pg_cron)
- 배포: Vercel
- 상태 관리: React 기본(useState/Context)

---

## 1. 로컬 실행

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
# .env 에 Supabase URL / anon key 입력 (아래 2단계)
npm run dev               # http://localhost:5173
```

기타 스크립트:

```bash
npm test         # 역할 계산 단위 테스트(vitest)
npm run build    # 타입체크 + 프로덕션 빌드
npm run lint     # 타입 에러만 체크(tsc --noEmit)
```

> `.env` 가 없으면 화면에 "Supabase 환경변수 미설정" 오류가 표시된다. 키 입력 후 새로고침하면 동작한다.

---

## 2. Supabase 설정

### 2.1 프로젝트 생성 · 키 발급
1. https://supabase.com 에서 새 프로젝트 생성.
2. **Project Settings → API** 에서 두 값을 복사해 `.env` 에 입력.
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = `anon` `public` key
   - ⚠️ `service_role` 키는 프론트/`.env`(VITE_ 변수)에 **절대 두지 말 것.** anon key만 공개 정상.

### 2.2 마이그레이션 적용
`supabase/migrations/` 의 SQL 3개를 **순서대로** 실행한다. 두 방법 중 택1.

**(A) 대시보드 SQL Editor (간단)**
Supabase 대시보드 → **SQL Editor** 에서 아래 파일 내용을 순서대로 붙여넣고 실행.
1. `0001_schema.sql` — 테이블 7개 + RLS 정책
2. `0002_seed.sql` — 직원 7명 · 시간표(6장) · 2026 공휴일
3. `0003_daily_assignment.sql` — 일일 배정 생성 함수 + pg_cron 스케줄

> `0003` 의 `create extension pg_cron` 가 실패하면, **Database → Extensions** 에서 `pg_cron` 을 먼저 활성화한 뒤 다시 실행.

**(B) Supabase CLI**
```bash
supabase link --project-ref <your-ref>
supabase db push
```

### 2.3 Realtime 활성화
**Database → Replication**(또는 Realtime 설정)에서 다음 테이블의 변경 이벤트를 켠다.
`daily_records`, `daily_number_assignments`, `attendance`, `substitute_plans`

### 2.4 동작 확인
- 앱은 접속 시 그날 `daily_records` 가 없으면 `generate_daily_record` RPC를 즉석 호출해 배정을 생성한다(개장 전 사전 노출 보장).
- pg_cron 은 매일 **UTC 15:00 = KST 00:00** 에 그날 배정을 자동 생성한다.
- 등록된 cron 확인: SQL Editor 에서 `select * from cron.job;`

---

## 3. Vercel 배포

1. GitHub 저장소에 푸시.
2. https://vercel.com → **New Project** → 저장소 import.
3. 프레임워크 자동 감지(Vite). 빌드 설정 기본값:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **Environment Variables** 에 `.env` 와 동일하게 추가.
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy. 이후 push 시 자동 재배포.

---

## 4. 환경변수 목록

| 변수 | 설명 | 노출 |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL | 프론트 노출(정상) |
| `VITE_SUPABASE_ANON_KEY` | anon public key | 프론트 노출(정상) |

`service_role` 키는 사용하지 않으며 어떤 프론트 변수에도 넣지 않는다.

---

## 5. 구조

```
src/
  logic/        # 순수 함수 (테스트 대상)
    timetable.ts   # 시간표 상수 · buildTimeSlots · currentSlot
    roles.ts       # rolesForTime(평일) / weekendRolesForTime(주말)
    holidays.ts    # 2026 공휴일 · classifyDate
    kst.ts         # Asia/Seoul 기준 현재 날짜·시각
    roles.test.ts  # 단위 테스트
  lib/          # supabase 클라이언트 · DB 타입
  hooks/useBoard.ts  # 오늘 데이터 로딩 · Realtime 구독 · 출석/바쁜타임 액션
  screens/      # 출석 · 대시보드 · 시간표 · 대타 캘린더
  components/   # 공용 프레젠테이션 컴포넌트
  ui/tokens.ts  # 디자인 토큰(색)
supabase/migrations/  # 스키마 · 시드 · 배정 함수/cron
```

---

## 6. 운영 규칙 요약

- **평일(월~금)**: 3회차 6타임. 매 타임 1→6번 순서로 1명 휴식, **7번은 안 쉬고** 쉬는 사람 자리 대행. 항상 현장 3 + 문진 3.
- **주말·공휴일(토·일·공휴일)**: 4회차 8타임. 하루 1개 **바쁜 타임**은 전원 근무(7번 문진 보강 → 현장 3 + 문진 4), 나머지 7타임은 1→7번 순서 휴식.
- **바쁜 타임**은 누구나 변경 가능하며 Realtime 으로 전원 즉시 반영, 마지막 변경자·시각 표시.
- **공휴일 데이터는 2026년까지** 유효. 이후 갱신 필요(`holidays` 테이블 / 향후 공공데이터 API).
