// 배포 환경(UTC)에 무관하게 Asia/Seoul(KST) 기준 날짜/시각을 산출하는 헬퍼

const KST_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  weekday: "short",
});

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface KstNow {
  dateStr: string; // "YYYY-MM-DD"
  minutes: number; // 자정부터 분
  weekday: number; // 0=일 ... 6=토
  hhmm: string; // "HH:MM"
}

// 주어진 시각(기본: 현재)을 KST로 환산
export function kstNow(at: Date = new Date()): KstNow {
  const parts = KST_PARTS.formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const wd = WD[get("weekday")] ?? 0;
  return {
    dateStr: `${year}-${month}-${day}`,
    minutes: hour * 60 + minute,
    weekday: wd,
    hhmm: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}
