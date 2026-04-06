import { useState } from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";

// ── Pastel Professional Color Palettes ──────────────────────────────────
const PALETTES = {
  default:  ["#a78bfa","#7c3aed","#06b6d4","#10b981","#f59e0b","#ef4444"],
  amber:    ["#f59e0b","#d97706","#fbbf24","#f97316","#fb923c","#92400e"],
  blue:     ["#3b82f6","#1d4ed8","#60a5fa","#2563eb","#93c5fd","#1e40af"],
  warm:     ["#f97316","#ea580c","#fb923c","#dc2626","#f87171","#b91c1c"],
  dark:     ["#6b7280","#374151","#9ca3af","#4b5563","#d1d5db","#1f2937"],
  green:    ["#10b981","#059669","#34d399","#065f46","#6ee7b7","#047857"],
  rose:     ["#f43f5e","#e11d48","#fb7185","#be123c","#fda4af","#dc2626"],
  teal:     ["#14b8a6","#0d9488","#2dd4bf","#0f766e","#5eead4","#115e59"],
  gold:     ["#d97706","#b45309","#f59e0b","#92400e","#fbbf24","#78350f"],
  violet:   ["#7c3aed","#5b21b6","#a78bfa","#6d28d9","#c4b5fd","#4c1d95"],
  neon:     ["#a78bfa","#06b6d4","#10b981","#f59e0b","#ef4444","#3b82f6"],
  forest:   ["#16a34a","#15803d","#4ade80","#166534","#86efac","#14532d"],
  arctic:   ["#06b6d4","#0891b2","#22d3ee","#0e7490","#67e8f9","#164e63"],
  sunset:   ["#f97316","#ea580c","#f59e0b","#dc2626","#fb7185","#b91c1c"],
  ocean:    ["#0ea5e9","#0284c7","#38bdf8","#0369a1","#7dd3fc","#075985"],
};

const fmtAxis = (v) => {
  if (typeof v !== "number") return v;
  if (v >= 1_000_000) return `${(v/1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v/1_000).toFixed(1)}K`;
  return Number.isInteger(v) ? v : parseFloat(v.toFixed(1));
};

const fmtSpeak = (v) => {
  if (typeof v !== "number") return v;
  if (v >= 1_000_000) return `${(v/1_000_000).toFixed(1)} million`;
  if (v >= 1_000)     return `${(v/1_000).toFixed(1)} thousand`;
  return Number.isInteger(v) ? v : parseFloat(v.toFixed(2));
};

function buildExplanation(chart) {
  const data = chart.data || [];
  const xKey = chart.x_axis;
  if (!data.length) return `This chart titled "${chart.title}" has no data.`;
  const valKeys = Object.keys(data[0]).filter(k => k !== xKey && typeof data[0][k] === "number");
  if (!valKeys.length) return `This chart shows ${chart.title}.`;
  const key    = valKeys[0];
  const sorted = [...data].sort((a,b) => (b[key]||0) - (a[key]||0));
  const top    = sorted[0];
  const bot    = sorted[sorted.length-1];
  const total  = data.reduce((s,r) => s + (r[key]||0), 0);
  const avg    = total / data.length;
  let txt = `This chart is about ${chart.title}. `;
  if (chart.chart_type === "pie") txt += `It shows how ${key} is distributed. `;
  else if (chart.chart_type === "line" || chart.chart_type === "area") txt += `It shows the trend of ${key} over time. `;
  else txt += `It compares ${key} across different ${xKey}s. `;
  if (top?.[xKey] != null) txt += `The highest value is ${fmtSpeak(top[key])}, belonging to ${top[xKey]}. `;
  if (bot?.[xKey] != null && bot[xKey] !== top[xKey]) txt += `The lowest is ${fmtSpeak(bot[key])}, belonging to ${bot[xKey]}. `;
  if (data.length > 2) txt += `Total is ${fmtSpeak(total)}, average ${fmtSpeak(avg)}. `;
  if ((chart.chart_type === "line" || chart.chart_type === "area") && data.length >= 2) {
    const diff = data[data.length-1][key] - data[0][key];
    const pct  = data[0][key] !== 0 ? Math.abs(diff/data[0][key]*100).toFixed(1) : 0;
    txt += diff > 0 ? `Upward trend, up ${pct}%. ` : `Downward trend, down ${pct}%. `;
  }
  txt += `${data.length} data points total.`;
  return txt;
}

function speak(text, onStart, onEnd) {
  if (!window.speechSynthesis) { alert("Voice not supported. Use Chrome or Edge."); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate=0.88; u.pitch=1; u.volume=1;
  const vs   = window.speechSynthesis.getVoices();
  const best = vs.find(v => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural"))) || vs.find(v => v.lang.startsWith("en"));
  if (best) u.voice = best;
  u.onstart=onStart; u.onend=onEnd; u.onerror=onEnd;
  window.speechSynthesis.speak(u);
}

const Tooltip_ = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:10, padding:"10px 14px", boxShadow:"0 10px 24px rgba(15,23,42,0.08)" }}>
      <p style={{ fontSize:11, color:"var(--text3)", marginBottom:6 }}>{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{ fontSize:12, fontWeight:500, color:p.color }}>
          {p.name}: <b>{fmtAxis(p.value)}</b>
        </p>
      ))}
    </div>
  );
};

export default function ChartCard({ chart, colorSchema = "default", index = 0 }) {
  const [speaking, setSpeaking] = useState(false);
  const [showExp,  setShowExp]  = useState(false);
  const [explanation, setExp]   = useState("");
  const [chartType, setChartType] = useState(chart.chart_type || "bar");

  // Resolve palette — support all schema names
  const paletteKey = PALETTES[colorSchema] ? colorSchema : "default";
  const colors = PALETTES[paletteKey];

  const data     = chart.data || [];
  const xKey     = chart.x_axis;
  const dataKeys = data.length > 0
    ? Object.keys(data[0]).filter(k => k !== xKey)
    : [chart.y_axis];

  const accentColor = colors[0];
  const effectiveChartType = chartType.toLowerCase();
  const chartTypeOptions = ["bar","line","area","pie"];

  const handleSpeak = () => {
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const txt = buildExplanation({ ...chart, chart_type: effectiveChartType });
    setExp(txt); setShowExp(true);
    speak(txt, () => setSpeaking(true), () => setSpeaking(false));
  };

  const axisStyle = { tick:{ fill:"var(--text3)", fontSize:10 }, axisLine:false, tickLine:false };
  const grid      = <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" vertical={false}/>;

  const renderChart = () => {
    switch (effectiveChartType) {
      case "line": return (
        <LineChart data={data}>
          {grid}
          <XAxis dataKey={xKey} {...axisStyle}/>
          <YAxis tickFormatter={fmtAxis} {...axisStyle}/>
          <Tooltip content={<Tooltip_/>}/>
          <Legend wrapperStyle={{ fontSize:11 }}/>
          {dataKeys.map((k,i) => (
            <Line key={k} type="monotone" dataKey={k}
              stroke={colors[i % colors.length]} strokeWidth={2.5}
              dot={{ r:3, fill:colors[i%colors.length] }}
              activeDot={{ r:5 }}/>
          ))}
        </LineChart>
      );
      case "area": return (
        <AreaChart data={data}>
          <defs>
            {dataKeys.map((k,i) => (
              <linearGradient key={k} id={`ag-${index}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={colors[i%colors.length]} stopOpacity={0.28}/>
                <stop offset="95%" stopColor={colors[i%colors.length]} stopOpacity={0}/>
              </linearGradient>
            ))}
          </defs>
          {grid}
          <XAxis dataKey={xKey} {...axisStyle}/>
          <YAxis tickFormatter={fmtAxis} {...axisStyle}/>
          <Tooltip content={<Tooltip_/>}/>
          {dataKeys.map((k,i) => (
            <Area key={k} type="monotone" dataKey={k}
              stroke={colors[i%colors.length]} strokeWidth={2.2}
              fill={`url(#ag-${index}-${i})`}/>
          ))}
        </AreaChart>
      );
      case "pie": case "donut": return (
        <PieChart>
          <Pie data={data} dataKey={dataKeys[0]} nameKey={xKey}
            cx="50%" cy="50%" outerRadius={90}
            innerRadius={chart.chart_type==="donut"?42:0}
            paddingAngle={3} strokeWidth={0}>
            {data.map((_,i) => <Cell key={i} fill={colors[i%colors.length]}/>)}
          </Pie>
          <Tooltip content={<Tooltip_/>}/>
          <Legend wrapperStyle={{ fontSize:11 }}/>
        </PieChart>
      );
      default: return (
        <BarChart data={data} barCategoryGap="28%">
          {grid}
          <XAxis dataKey={xKey} {...axisStyle}/>
          <YAxis tickFormatter={fmtAxis} {...axisStyle}/>
          <Tooltip content={<Tooltip_/>}/>
          <Legend wrapperStyle={{ fontSize:11 }}/>
          {dataKeys.map((k,i) => (
            <Bar key={k} dataKey={k}
              fill={colors[i%colors.length]}
              radius={[4,4,0,0]} maxBarSize={52}/>
          ))}
        </BarChart>
      );
    }
  };

  return (
    <div style={{ ...S.card, animationDelay:`${index*0.08}s` }} className="fade-up">
      <div style={S.hdr}>
        <div style={S.hdrLeft}>
          <div style={{ ...S.typeBadge, background:`${accentColor}18`, color:accentColor, border:`1px solid ${accentColor}30` }}>
            {effectiveChartType}
          </div>
          <h3 style={S.cardTitle}>{chart.title}</h3>
        </div>
        <button style={{ ...S.speakBtn, ...(speaking ? S.speakOn : {}) }} onClick={handleSpeak}>
          {speaking ? (
            <>
              <div style={S.waves}>
                <span style={{ ...S.wave, animationDelay:"0s" }}/>
                <span style={{ ...S.wave, animationDelay:"0.12s" }}/>
                <span style={{ ...S.wave, animationDelay:"0.24s" }}/>
              </div>Stop
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M3 6H1v4h2l4 3V3L3 6z" fill="currentColor"/>
                <path d="M11.5 8a3.5 3.5 0 00-2-3.15v6.3A3.5 3.5 0 0011.5 8z" fill="currentColor"/>
                <path d="M14 8a6 6 0 00-3-5.2v1.56A4.5 4.5 0 0113 8a4.5 4.5 0 01-2 3.64v1.56A6 6 0 0014 8z" fill="currentColor"/>
              </svg>Explain
            </>
          )}
        </button>
      </div>

      <div style={S.chartSwitch}>
        {chartTypeOptions.map((type) => (
          <button key={type}
            style={{ ...S.chartTypeBtn, ...(effectiveChartType===type?S.chartTypeActive:{}) }}
            onClick={() => setChartType(type)}>
            {type.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ padding:"14px 8px 8px" }}>
        <ResponsiveContainer width="100%" height={230}>{renderChart()}</ResponsiveContainer>
      </div>

      {showExp && (
        <div style={{ ...S.expBox, borderColor:`${accentColor}25`, background:`${accentColor}08` }} className="fade-in">
          <div style={S.expHdr}>
            <div style={{ ...S.expDot, background:accentColor, animation:speaking?"pulse 1.2s infinite":"none" }}/>
            <span style={{ ...S.expLabel, color:accentColor }}>{speaking ? "🔊 Speaking…" : "📋 Explanation"}</span>
            <button style={S.expClose} onClick={() => { setShowExp(false); window.speechSynthesis.cancel(); setSpeaking(false); }}>✕</button>
          </div>
          <p style={S.expTxt}>{explanation}</p>
        </div>
      )}
    </div>
  );
}

const S = {
  card:      { background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", overflow:"hidden" },
  hdr:       { padding:"14px 16px 12px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 },
  hdrLeft:   { display:"flex", alignItems:"center", gap:10, flex:1, minWidth:0 },
  typeBadge: { padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", flexShrink:0 },
  cardTitle: { fontSize:13, fontWeight:700, color:"var(--text)", letterSpacing:"-0.2px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" },
  speakBtn:  { display:"flex", alignItems:"center", gap:6, padding:"6px 13px", background:"rgba(14,165,233,0.08)", border:"1px solid rgba(14,165,233,0.2)", borderRadius:20, color:"var(--accent3)", fontSize:11, fontWeight:600, cursor:"pointer", flexShrink:0 },
  speakOn:   { background:"rgba(52,211,153,0.1)", borderColor:"rgba(52,211,153,0.3)", color:"var(--accent5)" },
  waves:     { display:"flex", alignItems:"center", gap:2, height:13 },
  chartSwitch: { display:"flex", flexWrap:"wrap", gap:8, padding:"10px 16px", background:"rgba(255,255,255,0.02)", borderBottom:"1px solid var(--border)", justifyContent:"flex-start" },
  chartTypeBtn:{ padding:"7px 12px", border:"1px solid var(--border)", borderRadius:999, background:"transparent", color:"var(--text2)", fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", cursor:"pointer", transition:"all 0.2s" },
  chartTypeActive:{ background:"rgba(99,102,241,0.14)", borderColor:"rgba(99,102,241,0.28)", color:"var(--accent2)", fontWeight:700 },
  wave:      { display:"inline-block", width:3, height:10, background:"var(--accent5)", borderRadius:2, animation:"soundWave 0.55s ease-in-out infinite alternate" },
  expBox:    { margin:"0 14px 14px", padding:"13px 14px", border:"1px solid", borderRadius:"var(--radius)" },
  expHdr:    { display:"flex", alignItems:"center", gap:8, marginBottom:8 },
  expDot:    { width:7, height:7, borderRadius:"50%", flexShrink:0 },
  expLabel:  { fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", flex:1 },
  expClose:  { background:"none", border:"none", color:"var(--text3)", cursor:"pointer", fontSize:12 },
  expTxt:    { fontSize:12, color:"var(--text)", lineHeight:1.75 },
};
