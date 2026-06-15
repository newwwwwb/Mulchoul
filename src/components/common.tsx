// 화면 전반에서 재사용하는 작은 프레젠테이션 컴포넌트 (프로토타입에서 이식)

import { C } from "../ui/tokens";

export function SectionTitle({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11.5, color: C.teal, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {eyebrow}
      </div>
      <h1 style={{ margin: "4px 0 6px", fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>{title}</h1>
      {desc && <p style={{ margin: 0, fontSize: 13.5, color: C.sub, lineHeight: 1.5, maxWidth: 560 }}>{desc}</p>}
    </div>
  );
}

export function NumBadge({ n }: { n: number | null | undefined }) {
  if (!n) return null;
  const seven = n === 7;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 24,
        height: 24,
        borderRadius: 7,
        fontSize: 12.5,
        fontWeight: 800,
        background: seven ? C.amber : C.ink,
        color: "#fff",
      }}
    >
      {n}
    </span>
  );
}

export function SubTag({ small }: { small?: boolean }) {
  return (
    <span
      style={{
        marginLeft: 6,
        fontSize: small ? 10 : 11,
        fontWeight: 700,
        color: C.amber,
        background: "#FBF1DD",
        padding: small ? "1px 5px" : "2px 7px",
        borderRadius: 6,
      }}
    >
      대타
    </span>
  );
}

export function InfoCard({ label, value, extra }: { label: string; value: string; extra?: string | null }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 13, padding: "14px 16px" }}>
      <div style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>{label}</div>
      <div style={{ marginTop: 5, fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>
        {value}
        {extra && <span style={{ fontSize: 12, color: C.amber, marginLeft: 6, fontWeight: 700 }}>{extra}</span>}
      </div>
    </div>
  );
}

export function Legend({ c, t }: { c: string; t: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
      {t}
    </span>
  );
}

export function Empty({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ background: C.surface, border: `1px dashed ${C.line}`, borderRadius: 14, padding: "40px 24px", textAlign: "center" }}>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 13, color: C.sub }}>{desc}</div>
    </div>
  );
}

export function Wave() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden>
      <rect width="30" height="30" rx="8" fill={C.teal} />
      <path d="M5 18c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M5 12c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5" />
    </svg>
  );
}
