// KPICard.jsx — Query-aware KPI cards (metrics derived from chart context + user query)

const PALETTES = {
  default: ["#a78bfa","#7c3aed","#06b6d4","#10b981","#f59e0b","#ef4444"],
  blue:    ["#3b82f6","#1d4ed8","#60a5fa","#2563eb","#93c5fd","#1e40af"],
  warm:    ["#f97316","#ea580c","#fb923c","#dc2626","#f87171","#b91c1c"],
  dark:    ["#6b7280","#374151","#9ca3af","#4b5563","#d1d5db","#1f2937"],
  green:   ["#10b981","#059669","#34d399","#065f46","#6ee7b7","#047857"],
  rose:    ["#f43f5e","#e11d48","#fb7185","#be123c","#fda4af","#dc2626"],
  teal:    ["#14b8a6","#0d9488","#2dd4bf","#0f766e","#5eead4","#115e59"],
  violet:  ["#7c3aed","#5b21b6","#a78bfa","#6d28d9","#c4b5fd","#4c1d95"],
};

function fmt(val) {
  if (typeof val !== "number") return val ?? "—";
  if (val >= 1_000_000) return `${(val/1_000_000).toFixed(2)}M`;
  if (val >= 1_000)     return `${(val/1_000).toFixed(1)}K`;
  return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2);
}

/**
 * Derive KPI metrics that are *relevant to the chart's own question*.
 * The chart's `kpi` field (its title / user question) guides which
 * secondary metrics are highlighted.
 */
function deriveKPI(chart) {
  const data   = chart.data || [];
  if (!data.length) return null;

  const xKey    = chart.x_axis;
  const kpiText = (chart.kpi || chart.title || "").toLowerCase();

  // All numeric columns except the x-axis
  const numKeys = Object.keys(data[0]).filter(k => k !== xKey && typeof data[0][k] === "number");
  if (!numKeys.length) return null;

  // ── Pick the "main" value key based on the user's query ──────────────────
  // Preference order: query keywords → first numeric column
  const priorityKeywords = [
    { words:["profit","margin","gain","income","earnings"], key: numKeys.find(k => /profit|margin|gain|income|earn/i.test(k)) },
    { words:["sales","revenue","amount","total"],           key: numKeys.find(k => /sale|revenue|amount|total/i.test(k)) },
    { words:["count","orders","quantity","qty"],            key: numKeys.find(k => /count|order|qty|quantity/i.test(k)) },
    { words:["discount","rate","pct","percent"],            key: numKeys.find(k => /discount|rate|pct|percent/i.test(k)) },
    { words:["cost","expense"],                             key: numKeys.find(k => /cost|expense/i.test(k)) },
  ];

  let mainKey = numKeys[0];
  for (const prio of priorityKeywords) {
    if (prio.key && prio.words.some(w => kpiText.includes(w))) {
      mainKey = prio.key; break;
    }
  }

  // Secondary metric: another numeric column if available
  const secKey = numKeys.find(k => k !== mainKey) || null;

  // ── Aggregations ─────────────────────────────────────────────────────────
  const total   = data.reduce((s,r) => s + (r[mainKey] || 0), 0);
  const avg     = total / data.length;
  const sorted  = [...data].sort((a,b) => (b[mainKey]||0) - (a[mainKey]||0));
  const topRow  = sorted[0];
  const botRow  = sorted[sorted.length-1];

  // Trend (for line/area charts, compare last vs previous)
  let trend = null, trendPct = null;
  if ((chart.chart_type === "line" || chart.chart_type === "area") && data.length >= 2) {
    const last  = data[data.length-1][mainKey];
    const prev  = data[data.length-2][mainKey];
    trend    = last >= prev ? "up" : "down";
    trendPct = prev !== 0 ? Math.abs(((last-prev)/prev)*100).toFixed(1) : "0.0";
  }

  // ── Build a query-contextual label for the main metric ───────────────────
  const metricLabel = mainKey.replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase());

  // ── Secondary stat title (what the chart is actually asking about) ───────
  // e.g. "Profit by Discount" → secondary = "Profit Margin" or "Avg Discount"
  const secondaryStat = secKey
    ? { label: secKey.replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase()),
        total: data.reduce((s,r) => s+(r[secKey]||0),0),
        avg:   data.reduce((s,r) => s+(r[secKey]||0),0) / data.length }
    : null;

  return {
    mainKey, metricLabel, secKey, secondaryStat,
    total, avg,
    topVal: topRow?.[mainKey] ?? 0, topLabel: topRow?.[xKey] ?? "",
    botVal: botRow?.[mainKey] ?? 0, botLabel: botRow?.[xKey] ?? "",
    count: data.length, trend, trendPct,
    // The actual "question" this KPI answers
    question: chart.kpi || chart.title || "",
  };
}

export default function KPICard({ chart, colorSchema = "violet", index = 0 }) {
  const kpi    = deriveKPI(chart);
  const colors = PALETTES[colorSchema] || PALETTES.violet;
  const color  = colors[index % colors.length];
  const color2 = colors[(index + 1) % colors.length];

  if (!kpi) return null;

  const trendUp = kpi.trend === "up";

  return (
    <div style={{ ...S.card, animationDelay:`${index*0.07}s`, "--c":color, "--c2":color2 }} className="fade-up hover-lift">
      {/* Accent line + glow */}
      <div style={{ ...S.accentLine, background:`linear-gradient(90deg, ${color}, ${color2})` }} />
      <div style={{ ...S.cardGlow, background:`radial-gradient(ellipse at top left, ${color}18, transparent 60%)` }} />

      {/* Header */}
      <div style={S.hdr}>
        <div style={{ ...S.iconWrap, background:`${color}18`, border:`1px solid ${color}28` }}>
          <ChartTypeIcon type={chart.chart_type} color={color} />
        </div>
        <div>
          <div style={S.chartType}>{(chart.chart_type||"bar").toUpperCase()}</div>
          <div style={S.kpiTitle}>{chart.title || chart.kpi}</div>
        </div>
      </div>

      {/* Primary metric — always tied to user's query */}
      <div style={S.primaryMetric}>
        <div style={{ ...S.primaryVal, color }}>{fmt(kpi.total)}</div>
        <div style={S.primaryLabel}>Total {kpi.metricLabel}</div>
      </div>

      {/* Trend badge (only for time-series) */}
      {kpi.trend && (
        <div style={{ ...S.trendBadge,
          background: trendUp ? "rgba(16,185,129,0.08)" : "rgba(244,63,94,0.08)",
          border: `1px solid ${trendUp ? "rgba(16,185,129,0.2)" : "rgba(244,63,94,0.2)"}`,
          color: trendUp ? "#10b981" : "#f43f5e",
        }}>
          {trendUp ? "↑" : "↓"} {kpi.trendPct}% vs prev period
        </div>
      )}

      {/* Stats row — contextual to the query */}
      <div style={S.statsRow}>
        <div style={S.stat}>
          <span style={S.statVal}>{fmt(kpi.avg)}</span>
          <span style={S.statLbl}>Avg</span>
        </div>
        <div style={S.statDiv}/>
        <div style={S.stat}>
          <span style={S.statVal}>{fmt(kpi.topVal)}</span>
          <span style={S.statLbl}>Peak</span>
        </div>
        <div style={S.statDiv}/>
        <div style={S.stat}>
          <span style={S.statVal}>{fmt(kpi.botVal)}</span>
          <span style={S.statLbl}>Lowest</span>
        </div>
        <div style={S.statDiv}/>
        <div style={S.stat}>
          <span style={S.statVal}>{kpi.count}</span>
          <span style={S.statLbl}>Points</span>
        </div>
      </div>

      {/* Top entry — directly answers the user's query */}
      {kpi.topLabel && (
        <div style={S.topEntry}>
          <span style={S.topBadge}>🏆 Top</span>
          <span style={{ ...S.topName, color }}>{kpi.topLabel}</span>
          <span style={S.topNum}>{fmt(kpi.topVal)}</span>
        </div>
      )}

      {/* Secondary metric (if multi-metric chart) */}
      {kpi.secondaryStat && (
        <div style={S.secMetric}>
          <span style={S.secLabel}>{kpi.secondaryStat.label}</span>
          <span style={{ ...S.secVal, color:color2 }}>{fmt(kpi.secondaryStat.total)}</span>
        </div>
      )}
    </div>
  );
}

function ChartTypeIcon({ type, color }) {
  const s = { stroke:color, strokeWidth:1.6, fill:"none", strokeLinecap:"round", strokeLinejoin:"round" };
  if (type === "line" || type === "area")
    return <svg width="15" height="15" viewBox="0 0 15 15"><path d="M2 11L5.5 6l4 4L14 2" {...s}/></svg>;
  if (type === "pie" || type === "donut")
    return <svg width="15" height="15" viewBox="0 0 15 15"><circle cx="7.5" cy="7.5" r="5.5" {...s}/><path d="M7.5 7.5V2M7.5 7.5l3.9 3.9" {...s}/></svg>;
  if (type === "scatter")
    return <svg width="15" height="15" viewBox="0 0 15 15"><circle cx="4" cy="10" r="1.5" fill={color}/><circle cx="8" cy="6" r="1.5" fill={color} opacity=".7"/><circle cx="12" cy="4" r="1.5" fill={color} opacity=".5"/></svg>;
  // default: bar
  return <svg width="15" height="15" viewBox="0 0 15 15"><rect x="1.5" y="8" width="3" height="5" rx="1" fill={color} opacity=".8"/><rect x="6" y="5" width="3" height="8" rx="1" fill={color}/><rect x="10.5" y="3" width="3" height="10" rx="1" fill={color} opacity=".6"/></svg>;
}

const S = {
  card:        {
    background:"var(--bg2)", border:"1px solid var(--border)",
    borderRadius:"var(--radius-lg)", padding:"18px 20px",
    display:"flex", flexDirection:"column", gap:12,
    position:"relative", overflow:"hidden",
    transition:"border-color 0.25s, box-shadow 0.25s",
  },
  accentLine:  { position:"absolute", top:0, left:0, right:0, height:2, borderRadius:"16px 16px 0 0" },
  cardGlow:    { position:"absolute", inset:0, pointerEvents:"none" },

  hdr:         { display:"flex", alignItems:"flex-start", gap:10, position:"relative" },
  iconWrap:    { width:34, height:34, borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  chartType:   { fontSize:9, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:2 },
  kpiTitle:    { fontSize:12, fontWeight:600, color:"var(--text2)", letterSpacing:"0.01em", lineHeight:1.35 },

  primaryMetric:{ display:"flex", flexDirection:"column", gap:3, position:"relative" },
  primaryVal:  { fontSize:34, fontWeight:700, letterSpacing:"-1.5px", fontFamily:"var(--font-display)", animation:"countUp 0.5s ease forwards" },
  primaryLabel:{ fontSize:10.5, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.08em" },

  trendBadge:  { display:"flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:20, fontSize:11, fontWeight:600, width:"fit-content" },

  statsRow:    { display:"flex", alignItems:"center", background:"var(--bg3)", borderRadius:"var(--radius)", overflow:"hidden" },
  stat:        { flex:1, padding:"9px 10px", display:"flex", flexDirection:"column", alignItems:"center", gap:3 },
  statVal:     { fontSize:13.5, fontWeight:700, color:"var(--text)" },
  statLbl:     { fontSize:9.5, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.07em" },
  statDiv:     { width:1, height:32, background:"var(--border)" },

  topEntry:    { display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:"var(--bg3)", borderRadius:"var(--radius)", overflow:"hidden" },
  topBadge:    { fontSize:11, color:"var(--text3)", flexShrink:0 },
  topName:     { fontSize:12, fontWeight:600, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  topNum:      { fontSize:12, color:"var(--text2)", fontWeight:500, flexShrink:0 },

  secMetric:   { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 12px", background:"var(--bg3)", borderRadius:"var(--radius)" },
  secLabel:    { fontSize:11, color:"var(--text3)" },
  secVal:      { fontSize:13, fontWeight:700 },
};
