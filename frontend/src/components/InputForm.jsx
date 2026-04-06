import { useState } from "react";

const THEMES = [
  { id:"default", label:"Pastel", colors:["#a78bfa","#7c3aed","#06b6d4","#10b981"] },
  { id:"blue",    label:"Sky",    colors:["#3b82f6","#1d4ed8","#60a5fa","#2563eb"] },
  { id:"warm",    label:"Coral",  colors:["#f97316","#ea580c","#fb923c","#dc2626"] },
  { id:"dark",    label:"Slate",  colors:["#6b7280","#374151","#9ca3af","#4b5563"] },
  { id:"green",   label:"Mint",   colors:["#10b981","#059669","#34d399","#065f46"] },
  { id:"rose",    label:"Blush",  colors:["#f43f5e","#e11d48","#fb7185","#be123c"] },
  { id:"teal",    label:"Aqua",   colors:["#14b8a6","#0d9488","#2dd4bf","#0f766e"] },
  { id:"gold",    label:"Amber",  colors:["#d97706","#b45309","#f59e0b","#92400e"] },
];

const QUICK = [
  "Revenue by category, sales by region, monthly profit trend",
  "Top 10 customers by sales, order count by ship mode",
  "Sales vs profit by sub-category, discount impact",
  "Monthly sales trend, orders by segment, top products",
];

export default function InputForm({ connectionData, onSubmit, loading, sqlQueries, onBack }) {
  const [query,   setQuery]   = useState("");
  const [numViz,  setNumViz]  = useState(3);
  const [theme,   setTheme]   = useState("default");
  const [title,   setTitle]   = useState("My Dashboard");
  const [showSQL, setShowSQL] = useState(false);

  const submit = () => {
    if (!query.trim()) return;
    onSubmit({
      session_id: connectionData.session_id,
      user_query: query,
      num_visualizations: numViz,
      color_schema: theme,
      dashboard_title: title,
    });
  };

  return (
    <div style={S.wrap}>
      {/* ── Topbar ── */}
      <div style={S.bar}>
        <div style={S.barLeft}>
          {/* Back button */}
          <button style={S.backBtn} onClick={onBack} title="Back to connection">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
          <div style={S.divider}/>
          <div style={S.logo}>
            <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
                <path d="M3 17L8 6l5 8 3-5" stroke="var(--accent3)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="18" cy="5" r="2.2" fill="var(--accent4)"/>
            </svg>
          </div>
          <span style={S.logoTxt}>Talking<span style={{ color:"var(--accent)" }}>BI</span></span>
        </div>
        <div style={S.pill}>
          <div style={S.dot}/>
          {connectionData.tables?.length} tables connected
        </div>
      </div>

      <div style={S.body}>
        {/* ── Left form ── */}
        <div style={S.left}>
          <div style={S.formHead}>
            <h2 style={S.h2}>Build your dashboard</h2>
            <p style={S.p}>Describe what you want to see in plain English — AI handles the rest</p>
          </div>

          <F label="Dashboard title">
            <input style={S.inp} value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Sales Analytics 2024"/>
          </F>

          <F label="What do you want to visualize?">
            <textarea style={S.ta} value={query} onChange={e => setQuery(e.target.value)}
              placeholder="e.g. revenue by category, sales by region, monthly profit trend, top customers by sales..."
              rows={4}/>
          </F>

          <F label="Quick examples">
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {QUICK.map((q,i) => (
                <button key={i} style={S.qBtn} onClick={() => setQuery(q)}>
                  <span style={{ color:"var(--accent)", fontWeight:700 }}>→</span> {q}
                </button>
              ))}
            </div>
          </F>

          <F label={<>Number of charts <span style={S.badge}>{numViz}</span></>}>
            <div style={S.numRow}>
              {[2,3,4,5,6].map(n => (
                <button key={n} style={{ ...S.numBtn, ...(numViz===n ? S.numOn : {}) }}
                  onClick={() => setNumViz(n)}>{n}</button>
              ))}
            </div>
          </F>

          <F label="Color theme">
            <div style={S.themeGrid}>
              {THEMES.map(t => (
                <button key={t.id} style={{ ...S.themeBtn, ...(theme===t.id ? S.themeOn : {}) }}
                  onClick={() => setTheme(t.id)}>
                  <div style={S.swatches}>
                    {t.colors.map((c,i) => <div key={i} style={{ width:11, height:11, borderRadius:3, background:c }}/>)}
                  </div>
                  <span style={S.themeLbl}>{t.label}</span>
                </button>
              ))}
            </div>
          </F>

          {/* SQL preview — full query shown, no truncation */}
          {sqlQueries && sqlQueries.length > 0 && (
            <div style={S.sqlSection}>
              <button style={S.sqlToggle} onClick={() => setShowSQL(v => !v)}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="1" width="12" height="12" rx="2" stroke="var(--accent3)" strokeWidth="1.2"/>
                  <path d="M4 5l2 2-2 2M7.5 9h3" stroke="var(--accent3)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {showSQL ? "Hide" : "View"} SQL Queries ({sqlQueries.length})
                <span style={{ marginLeft:"auto" }}>{showSQL ? "▲" : "▼"}</span>
              </button>
              {showSQL && (
                <div style={S.sqlList} className="fade-in">
                  {sqlQueries.map((q,i) => (
                    <div key={i} style={S.sqlCard}>
                      <div style={S.sqlKpi}>{i+1}. {q.kpi || q.sql?.slice(0,60)}</div>
                      {/* Full SQL displayed — no truncation */}
                      <pre style={S.sqlCode}>{q.sql}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Loading progress */}
          {loading && (
            <div style={S.loadBox}>
              <div style={S.loadRow}>
                <span style={S.loadSpin}/>
                <span style={S.loadTxt}>Generating dashboard — AI is writing SQL queries…</span>
              </div>
              <div style={S.loadSteps}>
                {["Understanding intent","Generating SQL","Executing queries","Building charts","Generating insights"].map((step,i) => (
                  <div key={i} style={S.loadStep}>
                    <div style={{ ...S.loadDot, animationDelay:`${i*0.35}s` }}/>
                    <span style={S.loadStepTxt}>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button style={{ ...S.submit, ...(loading||!query.trim() ? S.submitOff : {}) }}
            onClick={submit} disabled={loading||!query.trim()}>
            {loading
              ? <><span style={S.spin}/>Generating dashboard…</>
              : <>→ Generate Dashboard</>
            }
          </button>
        </div>

        {/* ── Right schema ── */}
        <div style={S.right}>
          <p style={S.schemaTitle}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight:6 }}>
              <rect x=".5" y=".5" width="11" height="11" rx="2" stroke="var(--accent)" strokeWidth="1.1"/>
              <path d="M.5 4.5h11M4.5 4.5v7" stroke="var(--accent)" strokeWidth="1.1"/>
            </svg>
            Connected Schema
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {connectionData.tables?.map(t => (
              <div key={t.table_name} style={S.tCard}>
                <div style={S.tHead}>
                  <span style={S.tName}>{t.table_name}</span>
                  <span style={S.tRows}>{t.row_count?.toLocaleString()} rows</span>
                </div>
                <div style={{ padding:"6px 0" }}>
                  {t.columns.slice(0,6).map(c => (
                    <div key={c.name} style={{ display:"flex", justifyContent:"space-between", padding:"3px 12px" }}>
                      <span style={{ fontSize:11, color:"var(--text2)" }}>{c.name}</span>
                      <span style={{ fontSize:10, color:"var(--text3)", fontFamily:"monospace" }}>{c.type?.split("(")[0].toLowerCase()}</span>
                    </div>
                  ))}
                  {t.columns.length > 6 && (
                    <div style={{ padding:"3px 12px", fontSize:10, color:"var(--text3)", fontStyle:"italic" }}>
                      +{t.columns.length-6} more columns
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function F({ label, children }) {
  return (
    <div style={{ marginBottom:24 }}>
      <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:11, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const S = {
  wrap:      { minHeight:"100vh", display:"flex", flexDirection:"column" },
  bar:       { padding:"12px 28px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--bg3)", backdropFilter:"blur(10px)", position:"sticky", top:0, zIndex:10 },
  barLeft:   { display:"flex", alignItems:"center", gap:10 },

  /* Back button */
  backBtn:   { display:"flex", alignItems:"center", gap:6, padding:"7px 13px", background:"rgba(99,102,241,0.08)", border:"1px solid rgba(99,102,241,0.22)", borderRadius:"var(--radius)", color:"var(--accent2)", fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.15s" },
  divider:   { width:1, height:22, background:"var(--border2)", margin:"0 4px" },

  logo:      { width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center" },
  logoTxt:   { fontWeight:800, fontSize:18, color:"var(--text)" },
  pill:      { display:"flex", alignItems:"center", gap:7, padding:"5px 14px", background:"rgba(14,165,233,0.08)", border:"1px solid rgba(14,165,233,0.18)", borderRadius:20, color:"var(--accent3)", fontSize:12, fontWeight:500 },
  dot:       { width:7, height:7, borderRadius:"50%", background:"var(--accent3)", animation:"pulse 2s infinite" },

  body:      { flex:1, display:"flex" },
  left:      { flex:1, padding:"40px 48px", maxWidth:700, overflowY:"auto" },
  formHead:  { marginBottom:32 },
  h2:        { fontSize:28, fontWeight:800, color:"var(--text)", letterSpacing:"-0.5px", marginBottom:6 },
  p:         { fontSize:13, color:"var(--text2)" },

  inp:       { width:"100%", padding:"11px 14px", background:"var(--bg3)", border:"1px solid var(--border2)", borderRadius:"var(--radius)", color:"var(--text)", fontSize:13, outline:"none" },
  ta:        { width:"100%", padding:"13px 14px", background:"var(--bg3)", border:"1px solid var(--border2)", borderRadius:"var(--radius)", color:"var(--text)", fontSize:13, outline:"none", resize:"vertical", lineHeight:1.65 },
  qBtn:      { padding:"9px 13px", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:"var(--radius)", color:"var(--text2)", fontSize:13, cursor:"pointer", textAlign:"left", display:"flex", alignItems:"flex-start", gap:8 },
  badge:     { background:"var(--accent)", color:"#fff", borderRadius:20, padding:"1px 8px", fontSize:11, fontWeight:700 },

  numRow:    { display:"flex", gap:9 },
  numBtn:    { width:46, height:46, background:"var(--bg3)", border:"1px solid var(--border2)", borderRadius:"var(--radius)", color:"var(--text2)", fontSize:15, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" },
  numOn:     { background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.35)", color:"var(--accent2)" },

  themeGrid: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 },
  themeBtn:  { padding:"10px", background:"var(--bg3)", border:"1px solid var(--border2)", borderRadius:"var(--radius)", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:7 },
  themeOn:   { border:"1px solid rgba(99,102,241,0.45)", background:"rgba(99,102,241,0.08)" },
  swatches:  { display:"flex", gap:3 },
  themeLbl:  { fontSize:11, color:"var(--text2)", fontWeight:600 },

  /* SQL — full display */
  sqlSection:{ marginBottom:24 },
  sqlToggle: { width:"100%", padding:"11px 14px", background:"var(--bg3)", border:"1px solid rgba(14,165,233,0.2)", borderRadius:"var(--radius)", color:"var(--accent3)", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:8 },
  sqlList:   { marginTop:8, display:"flex", flexDirection:"column", gap:10 },
  sqlCard:   { background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:"var(--radius)", overflow:"hidden" },
  sqlKpi:    { padding:"8px 12px", fontSize:11, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", letterSpacing:"0.06em", borderBottom:"1px solid var(--border)" },
  sqlCode:   { padding:"14px", fontSize:12, color:"var(--text2)", fontFamily:"var(--font-mono)", lineHeight:1.75, whiteSpace:"pre-wrap", wordBreak:"break-word", overflowX:"auto", maxHeight:"none" },

  /* Loading */
  loadBox:   { marginBottom:16, padding:"16px", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:"var(--radius)" },
  loadRow:   { display:"flex", alignItems:"center", gap:10, marginBottom:14 },
  loadSpin:  { width:16, height:16, border:"2px solid rgba(14,165,233,0.18)", borderTopColor:"var(--accent)", borderRadius:"50%", animation:"spin 0.7s linear infinite", display:"inline-block", flexShrink:0 },
  loadTxt:   { fontSize:13, color:"var(--text2)" },
  loadSteps: { display:"flex", flexDirection:"column", gap:8 },
  loadStep:  { display:"flex", alignItems:"center", gap:10 },
  loadDot:   { width:8, height:8, borderRadius:"50%", background:"var(--accent)", animation:"pulse 1.5s infinite", flexShrink:0 },
  loadStepTxt:{ fontSize:12, color:"var(--text3)" },

  submit:    { width:"100%", padding:"14px", background:"linear-gradient(135deg,#6366f1,#0ea5e9)", border:"none", borderRadius:"var(--radius)", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", letterSpacing:"0.02em", boxShadow:"0 8px 22px rgba(14,165,233,0.18)", transition:"opacity 0.2s" },
  submitOff: { opacity:0.4, cursor:"not-allowed", boxShadow:"none" },
  spin:      { width:16, height:16, border:"2px solid rgba(255,255,255,0.25)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.7s linear infinite", display:"inline-block", marginRight:8 },

  right:     { width:290, borderLeft:"1px solid var(--border)", padding:"28px 20px", background:"var(--bg2)", overflowY:"auto" },
  schemaTitle:{ display:"flex", alignItems:"center", fontSize:11, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:16 },
  tCard:     { background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:"var(--radius)", overflow:"hidden" },
  tHead:     { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", borderBottom:"1px solid var(--border)" },
  tName:     { fontSize:12, fontWeight:700, color:"var(--accent)" },
  tRows:     { fontSize:10, color:"var(--text3)" },
};
