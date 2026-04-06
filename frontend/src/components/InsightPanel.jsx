import { useState } from "react";

const TYPES = [
  { key:"descriptive",  label:"Descriptive",  icon:"📊", color:"#f97316", desc:"What happened"    },
  { key:"diagnostic",   label:"Diagnostic",   icon:"🔍", color:"#fb923c", desc:"Why it happened"  },
  { key:"predictive",   label:"Predictive",   icon:"📈", color:"#06b6d4", desc:"What's next"      },
  { key:"prescriptive", label:"Prescriptive", icon:"💡", color:"#f59e0b", desc:"What to do"       },
  { key:"evaluative",   label:"Evaluative",   icon:"✅", color:"#10b981", desc:"Data quality"     },
  { key:"exploratory",  label:"Exploratory",  icon:"🔭", color:"#a78bfa", desc:"Hidden patterns"  },
];

export default function InsightPanel({ insights, summary }) {
  const [kpi,  setKpi]  = useState(insights?.[0]?.kpi || "");
  const [type, setType] = useState("descriptive");

  const cur = insights?.find((i) => i.kpi === kpi);
  const t   = TYPES.find((t) => t.key === type);

  return (
    <div style={S.panel}>
      {/* Header */}
      <div style={S.hdr}>
        <div style={S.hdrLeft}>
          <div style={S.hdrIcon}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="5.5" stroke="#fb923c" strokeWidth="1.2"/>
              <path d="M4.5 6.5l1.5 1.5 3-3" stroke="#fb923c" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={S.hdrTitle}>AI Insights</span>
        </div>
      </div>

      {/* Summary — shown ONLY here, not on main dashboard */}
      {summary && (
        <div style={S.summary}>
          <div style={S.summaryLabel}>⚡ Executive Summary</div>
          <p style={S.summaryText}>{summary}</p>
        </div>
      )}

      {/* KPI pills */}
      <div style={S.kpiRow}>
        {insights?.map((ins) => (
          <button
            key={ins.kpi}
            style={{ ...S.kpiPill, ...(kpi === ins.kpi ? S.kpiPillOn : {}) }}
            onClick={() => setKpi(ins.kpi)}
          >
            {ins.kpi}
          </button>
        ))}
      </div>

      {/* Type tabs */}
      {cur && (
        <>
          <div style={S.tabs}>
            {TYPES.map((tp) => (
              <button
                key={tp.key}
                title={tp.desc}
                style={{ ...S.tab, ...(type === tp.key ? { ...S.tabOn, borderColor: tp.color, color: tp.color } : {}) }}
                onClick={() => setType(tp.key)}
              >
                <span style={{ fontSize:13 }}>{tp.icon}</span>
                <span style={S.tabLbl}>{tp.label}</span>
              </button>
            ))}
          </div>

          {/* Insight content */}
          <div style={{ ...S.insightBox, borderColor: t?.color + "33" }} className="fade-in">
            <div style={{ ...S.insightHdr, color: t?.color }}>
              <span style={S.insightIcon}>{t?.icon}</span>
              <div>
                <div style={S.insightType}>{t?.label}</div>
                <div style={S.insightDesc}>{t?.desc}</div>
              </div>
            </div>
            <p style={S.insightTxt}>{cur[type]}</p>
          </div>
        </>
      )}
    </div>
  );
}

const S = {
  panel:       { background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", overflow:"hidden" },
  hdr:         { padding:"14px 16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" },
  hdrLeft:     { display:"flex", alignItems:"center", gap:8 },
  hdrIcon:     { width:28, height:28, background:"rgba(139,92,246,0.1)", border:"1px solid rgba(139,92,246,0.18)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" },
  hdrTitle:    { fontSize:11, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.08em" },
  summary:     { margin:"14px 14px 0", padding:"13px 14px", background:"rgba(139,92,246,0.07)", border:"1px solid rgba(139,92,246,0.18)", borderRadius:"var(--radius)" },
  summaryLabel:{ fontSize:11, fontWeight:700, color:"#a78bfa", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:7, display:"flex", alignItems:"center", gap:5 },
  summaryText: { fontSize:12, color:"var(--text)", lineHeight:1.75 },
  kpiRow:      { display:"flex", flexWrap:"wrap", gap:7, padding:"14px 14px 0" },
  kpiPill:     { padding:"5px 11px", background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:20, color:"var(--text2)", fontSize:11, cursor:"pointer", fontWeight:500 },
  kpiPillOn:   { background:"rgba(91,141,239,0.12)", border:"1px solid rgba(91,141,239,0.4)", color:"var(--accent)" },
  tabs:        { display:"flex", flexWrap:"wrap", gap:5, padding:"12px 14px" },
  tab:         { display:"flex", alignItems:"center", gap:4, padding:"5px 9px", background:"var(--bg4)", border:"1px solid var(--border)", borderRadius:8, color:"var(--text3)", fontSize:11, cursor:"pointer", transition:"all 0.15s" },
  tabOn:       { background:"rgba(91,141,239,0.08)" },
  tabLbl:      { fontWeight:500 },
  insightBox:  { margin:"0 14px 14px", padding:"14px", background:"var(--bg4)", border:"1px solid", borderRadius:"var(--radius)" },
  insightHdr:  { display:"flex", alignItems:"flex-start", gap:10, marginBottom:10 },
  insightIcon: { fontSize:18, lineHeight:1 },
  insightType: { fontSize:12, fontWeight:700, marginBottom:2 },
  insightDesc: { fontSize:10, color:"var(--text3)" },
  insightTxt:  { fontSize:13, color:"var(--text)", lineHeight:1.75 },
};
