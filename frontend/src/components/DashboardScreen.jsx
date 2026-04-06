import { useRef, useState } from "react";
import ChartCard from "./ChartCard";
import KPICard from "./KPICard";
import InsightPanel from "./InsightPanel";
import VoicePanel from "./VoicePanel";

function loadH2C() {
  return new Promise((res, rej) => {
    if (window.html2canvas) { res(window.html2canvas); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    s.onload = () => res(window.html2canvas);
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

async function captureEl(el, scale = 2) {
  const h2c = await loadH2C();
  return h2c(el, {
    backgroundColor: "var(--bg3)",
    scale,
    useCORS: true,
    allowTaint: true,
    logging: false,
    scrollX: 0,
    scrollY: 0,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  });
}

export default function DashboardScreen({ data, sessionId, colorSchema, onReset, sqlQueries }) {
  const { dashboard_title, charts, insights, summary, total_kpis_generated } = data;
  const exportRef  = useRef(null);
  const [exporting,  setExporting]  = useState(false);
  const [exportType, setExportType] = useState("");
  const [showMenu,   setShowMenu]   = useState(false);
  const [showSQL,    setShowSQL]    = useState(false);
  const [activeTab,  setActiveTab]  = useState("charts");
  const sqlScrollRefs = useRef([]);

  const voiceCtx = charts.map(c => ({ kpi:c.kpi, chart_type:c.chart_type, data:c.data.slice(0,20) }));

  const copySqlCard = async (sql) => {
    try {
      await navigator.clipboard.writeText(sql);
      alert("Full SQL copied to clipboard.");
    } catch (e) {
      alert("Copy failed. Please select the SQL text manually.");
    }
  };

  // ── PNG ───────────────────────────────────────────────────────────────
  const exportPNG = async () => {
    setShowMenu(false); setExporting(true); setExportType("png");
    try {
      const canvas = await captureEl(exportRef.current);
      const a = document.createElement("a");
      a.download = `${dashboard_title.replace(/\s+/g,"_")}.png`;
      a.href = canvas.toDataURL("image/png", 1.0);
      a.click();
    } catch(e) { alert("PNG failed: " + e.message); }
    finally { setExporting(false); setExportType(""); }
  };

  // ── PDF — fixed: no blank pages, waits for image load ─────────────────
  const exportPDF = async () => {
    setShowMenu(false); setExporting(true); setExportType("pdf");
    try {
      const canvas  = await captureEl(exportRef.current, 1.6);
      const imgData = canvas.toDataURL("image/png", 0.92);
      const date    = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
      const imgH    = Math.round((canvas.height / canvas.width) * 794);   // A4 width = 794px @96dpi

      const insightBlocks = insights.map((ins, i) => `
        <div class="ic" style="page-break-inside:avoid; margin-bottom:18px;">
          <div class="ic-head">
            <span class="ic-num">${String(i+1).padStart(2,"0")}</span>
            <span class="ic-kpi">${ins.kpi || ""}</span>
          </div>
          ${ins.descriptive ? `<div class="ic-row"><div class="ic-lbl">📊 What happened</div><div class="ic-txt">${ins.descriptive}</div></div>` : ""}
          ${ins.diagnostic  ? `<div class="ic-row"><div class="ic-lbl">🔍 Why it happened</div><div class="ic-txt">${ins.diagnostic}</div></div>` : ""}
          ${ins.prescriptive? `<div class="ic-row"><div class="ic-lbl">💡 What to do</div><div class="ic-txt">${ins.prescriptive}</div></div>` : ""}
        </div>
      `).join("");

      const pw = window.open("", "_blank");
      if (!pw) { alert("Allow pop-ups to export PDF."); setExporting(false); return; }

      pw.document.write(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<title>${dashboard_title} — Talking BI Report</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'DM Sans',sans-serif;background:#ffffff;color:#1f2937;font-size:13px;}
  @page{margin:0;size:A4 portrait;}
  @media print{html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}

  /* ── COVER ───────────────────────── */
  .cover{
    width:210mm; height:297mm;
    background:linear-gradient(150deg,#ffffff 0%,#f8f9fa 55%,#ffffff 100%);
    display:flex; flex-direction:column; padding:56px 64px;
    page-break-after:always; position:relative; overflow:hidden;
  }
  .cover::before{content:'';position:absolute;top:-140px;right:-120px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(167,139,250,0.08) 0%,transparent 65%);pointer-events:none;}
  .cover::after {content:'';position:absolute;bottom:-80px;left:30px;width:340px;height:340px;border-radius:50%;background:radial-gradient(circle,rgba(124,58,237,0.06) 0%,transparent 65%);pointer-events:none;}

  .c-brand{display:flex;align-items:center;gap:14px;margin-bottom:auto;position:relative;z-index:1;}
  .c-icon{width:48px;height:48px;background:rgba(167,139,250,0.12);border:1.5px solid rgba(167,139,250,0.24);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;}
  .c-name{font-size:22px;font-weight:800;color:#1f2937;letter-spacing:-0.3px;}
  .c-name span{color:#a78bfa;}

  .c-body{flex:1;display:flex;flex-direction:column;justify-content:center;padding:48px 0 32px;position:relative;z-index:1;}
  .c-eyebrow{font-size:10px;font-weight:700;color:#a78bfa;letter-spacing:.2em;text-transform:uppercase;margin-bottom:20px;}
  .c-title{font-size:52px;font-weight:800;color:#1f2937;line-height:1.1;letter-spacing:-1.5px;margin-bottom:14px;}
  .c-sub{font-size:17px;color:#6b7280;font-weight:300;margin-bottom:52px;}
  .c-bar{width:60px;height:3px;background:linear-gradient(90deg,#a78bfa,#06b6d4);border-radius:2px;margin-bottom:52px;}
  .c-stats{display:flex;gap:56px;}
  .c-stat-n{font-size:44px;font-weight:800;color:#a78bfa;letter-spacing:-1.5px;display:block;line-height:1;}
  .c-stat-l{font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.1em;margin-top:8px;}

  .c-foot{padding-top:28px;border-top:1px solid #dee2e6;display:flex;justify-content:space-between;position:relative;z-index:1;}
  .c-foot p{font-size:11px;color:#9ca3af;}

  /* ── DASHBOARD PAGE ───────────────── */
  .dash{
    width:210mm;
    background:#f8fafc;
    page-break-after:always;
    display:flex; flex-direction:column;
  }
  .dash-hdr{
    background:#ffffff;padding:20px 32px;
    border-bottom:1px solid rgba(148,163,184,0.18);
    display:flex;justify-content:space-between;align-items:center;flex-shrink:0;
  }
  .dash-hdr h2{font-size:16px;font-weight:700;color:#0f172a;}
  .dash-hdr p {font-size:11px;color:#475569;margin-top:3px;}
  .dash-badge{padding:5px 14px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:20px;color:#4f46e5;font-size:11px;font-weight:600;}
  /* KEY FIX: img takes only as much height as it needs — no forced page height */
  .dash img{width:100%;display:block;}

  /* ── INSIGHTS PAGE ────────────────── */
  .insights{
    width:210mm;
    background:#fff;
    padding:52px 60px 60px;
    page-break-before:always;
  }
  .ins-hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:28px;border-bottom:2px solid rgba(15,23,42,0.08);margin-bottom:36px;}
  .ins-title{font-size:30px;font-weight:800;color:#0f172a;margin-bottom:6px;}
  .ins-sub  {font-size:13px;color:var(--text3);}
  .ins-meta {font-size:11px;color:#64748b;text-align:right;line-height:1.9;}

  .summary{background:linear-gradient(135deg,#6366f1 0%,#0ea5e9 100%);border-radius:16px;padding:28px 32px;margin-bottom:36px;}
  .summary h3{font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,0.85);margin-bottom:12px;}
  .summary p {font-size:14.5px;color:#f8fafc;line-height:1.85;}

  .sec-head{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:20px;padding-bottom:10px;border-bottom:1px solid #e2e8f0;}

  .ic{background:#f8fafc;border:1px solid #e2e8f0;border-left:3px solid #6366f1;border-radius:12px;padding:20px 24px;}
  .ic-head{display:flex;align-items:flex-start;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;}
  .ic-num {font-size:11px;font-weight:700;color:#4f46e5;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.18);border-radius:6px;padding:4px 8px;flex-shrink:0;}
  .ic-kpi {font-size:14px;font-weight:600;color:#0f172a;line-height:1.3;}
  .ic-row {display:flex;gap:16px;margin-bottom:12px;}
  .ic-row:last-child{margin-bottom:0;}
  .ic-lbl {font-size:10px;font-weight:700;color:#b8a898;width:140px;flex-shrink:0;text-transform:uppercase;letter-spacing:.05em;padding-top:2px;}
  .ic-txt {font-size:12.5px;color:#3a2818;line-height:1.78;}

  .foot{background:#f1f5f9;border-top:1px solid #e2e8f0;padding:14px 60px;display:flex;justify-content:space-between;font-size:10.5px;color:#64748b;margin-top:36px;}
</style>
</head><body>

<!-- COVER -->
<div class="cover">
  <div class="c-brand">
    <div class="c-icon">📊</div>
    <div class="c-name">Talking <span>BI</span></div>
  </div>
  <div class="c-body">
    <div class="c-eyebrow">Business Intelligence Report</div>
    <div class="c-title">${dashboard_title}</div>
    <div class="c-sub">AI-Generated Analytics Report</div>
    <div class="c-bar"></div>
    <div class="c-stats">
      <div><span class="c-stat-n">${total_kpis_generated}</span><div class="c-stat-l">Charts Generated</div></div>
      <div><span class="c-stat-n">${insights.length}</span><div class="c-stat-l">KPIs Analyzed</div></div>
      <div><span class="c-stat-n">3</span><div class="c-stat-l">Insight Types</div></div>
    </div>
  </div>
  <div class="c-foot"><p>Confidential · Generated by Talking BI</p><p>${date}</p></div>
</div>

<!-- DASHBOARD SCREENSHOT — image sized to its natural height, no forced blank space -->
<div class="dash">
  <div class="dash-hdr">
    <div><h2>${dashboard_title}</h2><p>Dashboard Overview · ${date}</p></div>
    <div class="dash-badge">${total_kpis_generated} Visualizations</div>
  </div>
  <img id="dashImg" src="${imgData}" alt="Dashboard" style="width:100%;display:block;max-height:${imgH}px;object-fit:contain;object-position:top;"/>
</div>

<!-- INSIGHTS -->
<div class="insights">
  <div class="ins-hdr">
    <div><div class="ins-title">AI Insights &amp; Analysis</div><div class="ins-sub">Automatically generated insights from your dashboard data</div></div>
    <div class="ins-meta">Talking BI<br/>${date}</div>
  </div>
  ${summary ? `<div class="summary"><h3>⚡ Executive Summary</h3><p>${summary}</p></div>` : ""}
  <div class="sec-head">📊 Chart-by-Chart Insights</div>
  ${insightBlocks}
  <div class="foot">
    <span>Talking BI · AI-Powered Business Intelligence</span>
    <span>${dashboard_title} · ${date}</span>
  </div>
</div>

<script>
  // Only print after the dashboard screenshot has fully loaded
  var img = document.getElementById('dashImg');
  function doPrint() { setTimeout(function(){ window.print(); }, 500); }
  if (img.complete && img.naturalWidth > 0) { doPrint(); }
  else { img.onload = doPrint; img.onerror = doPrint; }
<\/script>
</body></html>`);
      pw.document.close();
    } catch(e) { alert("PDF failed: " + e.message); }
    finally { setExporting(false); setExportType(""); }
  };

  return (
    <div style={S.screen}>
      {/* ── Topbar ── */}
      <div style={S.topbar}>
        <div style={S.topLeft}>
          <div style={S.logoWrap}>
            <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
              <path d="M3 17L8 6l5 8 3-5" stroke="var(--accent3)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="18" cy="5" r="2.2" fill="var(--accent4)"/>
            </svg>
          </div>
          <h1 style={S.title}>{dashboard_title}</h1>
          <div style={S.badge}>{total_kpis_generated} charts</div>
        </div>

        <div style={S.actions}>
          {sqlQueries?.length > 0 && (
            <button style={S.sqlBtn} onClick={() => setShowSQL(v => !v)}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect x=".5" y=".5" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.1"/>
                <path d="M3 4l2 2-2 2M7 8h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              SQL
            </button>
          )}
          <div style={{ position:"relative" }}>
            <button style={{ ...S.exportBtn, ...(exporting ? S.off : {}) }}
              onClick={() => !exporting && setShowMenu(v => !v)} disabled={exporting}>
              {exporting
                ? <><span style={S.spin}/>{exportType==="pdf" ? "Saving PDF…" : "Saving PNG…"}</>
                : <>↓ Export <span style={{ fontSize:9 }}>▼</span></>}
            </button>
            {showMenu && (
              <div style={S.menu}>
                <button style={S.mItem} onClick={exportPNG}>
                  <div style={S.mIcon}>🖼️</div>
                  <div><div style={S.mT}>Save as PNG</div><div style={S.mS}>High-res image (2×)</div></div>
                </button>
                <div style={S.mSep}/>
                <button style={S.mItem} onClick={exportPDF}>
                  <div style={S.mIcon}>📄</div>
                  <div><div style={{ ...S.mT, color:"var(--accent3)" }}>Save as PDF</div><div style={S.mS}>Professional 3-page report</div></div>
                </button>
              </div>
            )}
          </div>
          <button style={S.newBtn} onClick={onReset}>↺ New</button>
        </div>
      </div>

      {/* SQL Modal */}
      {showSQL && sqlQueries?.length > 0 && (
        <>
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:998, backdropFilter:"blur(4px)" }} onClick={() => setShowSQL(false)}/>
          <div style={S.sqlModal}>
            <div style={S.sqlModalHdr}>
              <span style={S.sqlModalTitle}>SQL Queries Generated by AI</span>
              <button style={S.sqlClose} onClick={() => setShowSQL(false)}>✕</button>
            </div>
            <div style={S.sqlHint}>Full SQL queries displayed below. Use Copy button to copy the complete query.</div>
            <div style={S.sqlModalBody}>
              {sqlQueries.map((q,i) => (
                <div key={i} style={S.sqlCard}>
                  <div style={S.sqlCardHdr}>
                    <div style={S.sqlKpi}>{i+1}. {q.kpi}</div>
                    <button style={S.sqlAction} onClick={() => copySqlCard(q.sql)}>📋 Copy SQL</button>
                  </div>
                  <div style={S.sqlScroll}>
                    <pre style={S.sqlCode}>{q.sql}</pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Body ── */}
      <div style={S.body}>
        <div style={S.main}>
          <div style={S.tabs}>
            {[["kpis","📊 KPI Cards"],["charts","📈 Charts"],["both","⚡ Both"]].map(([id,label]) => (
              <button key={id} style={{ ...S.tab, ...(activeTab===id ? S.tabOn : {}) }} onClick={() => setActiveTab(id)}>
                {label}
              </button>
            ))}
          </div>

          <div ref={exportRef} style={S.exportArea}>
            {(activeTab==="kpis"||activeTab==="both") && (
              <div style={S.kpiGrid}>
                {charts.map((chart,i) => (
                  <KPICard key={chart.kpi} chart={chart} colorSchema={colorSchema||"default"} index={i}/>
                ))}
              </div>
            )}
            {(activeTab==="charts"||activeTab==="both") && (
              <div style={S.chartGrid}>
                {charts.map((chart,i) => (
                  /* colorSchema correctly passed to ChartCard */
                  <ChartCard key={chart.kpi} chart={chart} colorSchema={colorSchema||"default"} index={i}/>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={S.sidebar}>
          <VoicePanel sessionId={sessionId} dashboardContext={voiceCtx}/>
          <InsightPanel insights={insights} summary={summary}/>
        </div>
      </div>

      {showMenu && <div style={S.overlay} onClick={() => setShowMenu(false)}/>}
    </div>
  );
}

const S = {
  screen:   { minHeight:"100vh", display:"flex", flexDirection:"column" },
  topbar:   { padding:"12px 24px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--bg3)", backdropFilter:"blur(20px)", position:"sticky", top:0, zIndex:30 },
  topLeft:  { display:"flex", alignItems:"center", gap:12 },
  logoWrap: { width:32, height:32, background:"rgba(99,102,241,0.1)", border:"1px solid rgba(99,102,241,0.2)", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center" },
  title:    { fontSize:17, fontWeight:800, color:"var(--text)", letterSpacing:"-0.3px" },
  badge:    { padding:"3px 10px", background:"rgba(99,102,241,0.1)", border:"1px solid rgba(99,102,241,0.2)", borderRadius:20, color:"var(--accent2)", fontSize:11, fontWeight:700 },
  actions:  { display:"flex", alignItems:"center", gap:10 },
  sqlBtn:   { display:"flex", alignItems:"center", gap:6, padding:"7px 13px", background:"rgba(14,165,233,0.08)", border:"1px solid rgba(14,165,233,0.2)", borderRadius:"var(--radius)", color:"var(--accent3)", fontSize:12, fontWeight:600, cursor:"pointer" },
  exportBtn:{ display:"flex", alignItems:"center", gap:7, padding:"8px 16px", background:"rgba(99,102,241,0.08)", border:"1px solid rgba(99,102,241,0.2)", borderRadius:"var(--radius)", color:"var(--accent2)", fontSize:13, fontWeight:600, cursor:"pointer" },
  off:      { opacity:0.5, cursor:"not-allowed" },
  spin:     { width:13, height:13, border:"2px solid rgba(99,102,241,0.3)", borderTopColor:"var(--accent2)", borderRadius:"50%", animation:"spin 0.7s linear infinite", display:"inline-block", marginRight:6 },
  menu:     { position:"absolute", top:"calc(100% + 8px)", right:0, background:"var(--bg2)", border:"1px solid var(--border2)", borderRadius:"var(--radius-lg)", padding:6, minWidth:220, boxShadow:"0 20px 60px rgba(0,0,0,0.7)", zIndex:100, animation:"slideDown 0.15s ease" },
  mItem:    { display:"flex", alignItems:"center", gap:12, width:"100%", padding:"10px 12px", background:"none", border:"none", borderRadius:9, cursor:"pointer", textAlign:"left" },
  mIcon:    { fontSize:20, flexShrink:0 },
  mT:       { fontSize:13, fontWeight:600, color:"var(--accent)", marginBottom:2 },
  mS:       { fontSize:11, color:"var(--text3)" },
  mSep:     { height:1, background:"var(--border)", margin:"4px 0" },
  newBtn:   { display:"flex", alignItems:"center", gap:6, padding:"8px 14px", background:"var(--bg3)", border:"1px solid var(--border2)", borderRadius:"var(--radius)", color:"var(--text2)", fontSize:13, cursor:"pointer" },
  overlay:  { position:"fixed", inset:0, zIndex:20 },

  sqlModal:     { background:"var(--bg2)", borderBottom:"1px solid var(--border)", maxHeight:"min(75vh,600px)", width:"95vw", maxWidth:"1200px", display:"flex", flexDirection:"column", position:"fixed", top:"50%", left:"50%", transform:"translate(-50%, -50%)", zIndex:999, borderRadius:"var(--radius-lg)", boxShadow:"0 20px 80px rgba(0,0,0,0.5)" },
  sqlModalHdr:  { padding:"12px 20px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" },
  sqlModalTitle:{ fontSize:13, fontWeight:700, color:"var(--accent3)", textTransform:"uppercase", letterSpacing:"0.07em" },
  sqlHint:      { padding:"10px 20px", fontSize:12, color:"var(--text2)", borderBottom:"1px solid var(--border)", background:"rgba(14,165,233,0.04)" },
  sqlClose:     { background:"none", border:"none", color:"var(--text2)", cursor:"pointer", fontSize:16, padding:"0 4px" },
  sqlModalBody: { overflowY:"auto", padding:"16px", display:"flex", flexDirection:"column", gap:12, flex:1 },
  sqlCard:      { background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:"var(--radius)", overflow:"hidden", width:"100%" },
  sqlCardHdr:   { display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"10px 14px", borderBottom:"1px solid var(--border)" },
  sqlAction:    { padding:"6px 12px", background:"rgba(240,192,96,0.12)", border:"1px solid rgba(240,192,96,0.22)", borderRadius:"999px", color:"var(--accent3)", fontSize:11, cursor:"pointer" },
  sqlScroll:    { overflowX:"auto", width:"100%", padding:"14px", maxHeight:"400px", overflowY:"auto" },
  sqlKpi:       { fontSize:11, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", letterSpacing:"0.06em" },
  /* Full SQL shown with wrapping for readability */
  sqlCode:      { padding:0, margin:0, fontSize:12, color:"var(--text2)", fontFamily:"var(--font-mono)", lineHeight:1.75, whiteSpace:"pre-wrap", wordBreak:"break-word", width:"100%" },

  body:     { flex:1, display:"flex", overflow:"hidden" },
  main:     { flex:1, overflowY:"auto", padding:"20px 24px" },
  exportArea:{ display:"flex", flexDirection:"column", gap:20 },

  tabs:     { display:"flex", gap:8, marginBottom:20 },
  tab:      { padding:"7px 16px", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:20, color:"var(--text2)", fontSize:12, fontWeight:600, cursor:"pointer" },
  tabOn:    { background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.25)", color:"var(--accent2)" },

  kpiGrid:  { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16 },
  chartGrid:{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(420px,1fr))", gap:18 },
  sidebar:  { width:370, borderLeft:"1px solid var(--border)", overflowY:"auto", padding:18, display:"flex", flexDirection:"column", gap:18, background:"var(--bg2)" },
};
