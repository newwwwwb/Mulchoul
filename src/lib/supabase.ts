// Supabase 클라이언트 단일 인스턴스. anon key는 공개키이므로 프론트 노출 정상.

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // 환경변수 누락 시 개발자에게 즉시 알림 (README의 .env 설정 안내)
  console.error(
    "[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 설정되지 않았습니다. .env 파일을 확인하세요."
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "");

export const isSupabaseConfigured = Boolean(url && anonKey);
