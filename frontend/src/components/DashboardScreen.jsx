import { useRef, useState } from "react";
import ChartCard from "./ChartCard";
import KPICard from "./KPICard";
import InsightPanel from "./InsightPanel";
import VoicePanel from "./VoicePanel";

/* ─────────────────────────────────────────────────────────────────────────
   LIBRARY LOADERS — lazy, only loaded when user clicks Export
   • dom-to-image-more  → handles CSS variables + SVG (Recharts uses SVG)
   • jsPDF              → builds PDF from data — no screenshot, no blank pages
──────────────────────────────────────────────────────────────────────────*/
function loadScript(src, globalName) {
  return new Promise((res, rej) => {
    if (window[globalName]) { res(window[globalName]); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload  = () => res(window[globalName]);
    s.onerror = () => rej(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}
const loadDomToImage = () =>
  loadScript(
    "https://cdnjs.cloudflare.com/ajax/libs/dom-to-image-more/3.4.0/dom-to-image-more.min.js",
    "domtoimage"
  );
const loadJsPDF = () =>
  loadScript(
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    "jspdf"
  );

/* ─────────────────────────────────────────────────────────────────────────
   NUMBER FORMATTER
──────────────────────────────────────────────────────────────────────────*/
function fmt(val) {
  if (typeof val !== "number") return String(val ?? "—");
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000)     return `${(val / 1_000).toFixed(1)}K`;
  return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2);
}

/* ─────────────────────────────────────────────────────────────────────────
   DERIVE KPI STATS  (mirrors KPICard logic)
──────────────────────────────────────────────────────────────────────────*/
function deriveStats(chart) {
  const data = chart.data || [];
  if (!data.length) return null;
  const xKey    = chart.x_axis;
  const numKeys = Object.keys(data[0]).filter(
    k => k !== xKey && typeof data[0][k] === "number"
  );
  if (!numKeys.length) return null;
  const key    = numKeys[0];
  const total  = data.reduce((s, r) => s + (r[key] || 0), 0);
  const avg    = total / data.length;
  const sorted = [...data].sort((a, b) => (b[key] || 0) - (a[key] || 0));
  return {
    total, avg,
    peak:      sorted[0]?.[key]  ?? 0,
    peakLabel: sorted[0]?.[xKey] ?? "",
    low:       sorted[sorted.length - 1]?.[key]  ?? 0,
    count:     data.length,
    metricLabel: key.replace(/_/g, " "),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════════════════*/
export default function DashboardScreen({ data, sessionId, colorSchema, onReset, sqlQueries }) {
  const { dashboard_title, charts, insights, summary, total_kpis_generated } = data;
  const exportRef = useRef(null);

  const [exporting,  setExporting]  = useState(false);
  const [exportType, setExportType] = useState("");
  const [showMenu,   setShowMenu]   = useState(false);
  const [showSQL,    setShowSQL]    = useState(false);
  const [activeTab,  setActiveTab]  = useState("charts");

  const voiceCtx = charts.map(c => ({
    kpi: c.kpi, chart_type: c.chart_type, data: c.data.slice(0, 20),
  }));

  const copySql = async (sql) => {
    try { await navigator.clipboard.writeText(sql); alert("SQL copied to clipboard."); }
    catch  { alert("Copy failed — select the text manually."); }
  };

  /* ────────────────────────────────────────────────────────────────────
     PNG EXPORT
     dom-to-image-more resolves CSS variables & handles inline SVG
  ────────────────────────────────────────────────────────────────────*/
  const exportPNG = async () => {
    setShowMenu(false); setExporting(true); setExportType("png");
    try {
      const dti  = await loadDomToImage();
      const node = exportRef.current;
      const bgColor =
        getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()
        || "#0c0a09";

      const blob = await dti.toBlob(node, {
        bgcolor: bgColor,
        scale:   2,
        quality: 1.0,
      });

      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `${dashboard_title.replace(/\s+/g, "_")}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      console.error("PNG error:", e);
      alert("PNG export failed: " + e.message);
    } finally { setExporting(false); setExportType(""); }
  };

  /* ────────────────────────────────────────────────────────────────────
     PDF EXPORT  — built PROGRAMMATICALLY with jsPDF
     No screenshot → no blank pages, no CSS-variable failures.

     Layout:
       Page 1  — Dark cover  (ember gradient, stats)
       Page 2  — KPI summary table  (one row per chart)
       Page 3+ — AI insight cards   (auto page-break)
  ────────────────────────────────────────────────────────────────────*/
  const exportPDF = async () => {
    setShowMenu(false); setExporting(true); setExportType("pdf");
    try {
      await loadJsPDF();
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W   = 210;
      const H   = 297;
      const PAD = 20;
      const date = new Date().toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      });

      /* helpers */
      const rRect = (x, y, w, h, r, style = "F") =>
        doc.roundedRect(x, y, w, h, r, r, style);

      const pageFooter = (pageLabel) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(160, 148, 130);
        doc.text("SmartDash AI  ·  AI-Powered Business Intelligence", PAD, H - 10);
        doc.text(`${dashboard_title}  ·  ${date}  ·  ${pageLabel}`, W - PAD, H - 10, { align: "right" });
      };

      /* ── PAGE 1: COVER ──────────────────────────────────────────── */
      // Dark background
      doc.setFillColor(12, 10, 9);
      doc.rect(0, 0, W, H, "F");

      // Ember glow — top-right
      doc.setGState(doc.GState({ opacity: 0.08 }));
      doc.setFillColor(232, 96, 44);
      doc.circle(W + 10, -10, 100, "F");
      doc.setGState(doc.GState({ opacity: 0.04 }));
      doc.setFillColor(245, 147, 71);
      doc.circle(W - 10, 30, 70, "F");

      // Gold glow — bottom-left
      doc.setGState(doc.GState({ opacity: 0.05 }));
      doc.setFillColor(240, 192, 96);
      doc.circle(10, H + 10, 80, "F");
      doc.setGState(doc.GState({ opacity: 1 }));

      // Subtle grid lines
      doc.setDrawColor(232, 96, 44);
      doc.setLineWidth(0.07);
      doc.setGState(doc.GState({ opacity: 0.06 }));
      [55, 110, 165, 220].forEach(yy => doc.line(0, yy, W, yy));
      doc.setGState(doc.GState({ opacity: 1 }));

      // Brand
      doc.setFillColor(232, 96, 44);
      rRect(PAD, 18, 12, 12, 2.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text("BI", PAD + 6, 26, { align: "center" });

      doc.setFontSize(13);
      doc.setTextColor(240, 236, 230);
      doc.text("SmartDash", PAD + 15, 27);
      doc.setTextColor(232, 96, 44);
      doc.text("AI", PAD + 42, 27);

      // Eyebrow
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(232, 96, 44);
      doc.setCharSpace(1.6);
      doc.text("BUSINESS INTELLIGENCE REPORT", PAD, 98);
      doc.setCharSpace(0);

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(36);
      doc.setTextColor(240, 236, 230);
      const titleLines = doc.splitTextToSize(dashboard_title, W - PAD * 2 - 10);
      doc.text(titleLines, PAD, 114);
      const titleEndY = 114 + titleLines.length * 14.5;

      // Subtitle
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(138, 124, 106);
      doc.text("AI-Generated Analytics Report", PAD, titleEndY + 7);

      // Accent bar
      doc.setFillColor(232, 96, 44);
      doc.rect(PAD, titleEndY + 17, 22, 2, "F");
      doc.setFillColor(240, 192, 96);
      doc.rect(PAD + 22, titleEndY + 17, 18, 2, "F");

      // Stats
      const sy = titleEndY + 34;
      const statsData = [
        [String(total_kpis_generated), "CHARTS GENERATED"],
        [String(insights.length),       "KPIS ANALYZED"],
        ["3",                            "INSIGHT TYPES"],
      ];
      const statBoxW = (W - PAD * 2) / statsData.length;
      statsData.forEach(([n, lbl], i) => {
        const sx = PAD + i * statBoxW;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(28);
        doc.setTextColor(232, 96, 44);
        doc.text(n, sx, sy);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(138, 124, 106);
        doc.setCharSpace(0.7);
        doc.text(lbl, sx, sy + 7);
        doc.setCharSpace(0);
      });

      // Cover footer
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.07);
      doc.setGState(doc.GState({ opacity: 0.06 }));
      doc.line(PAD, H - 22, W - PAD, H - 22);
      doc.setGState(doc.GState({ opacity: 1 }));
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(74, 62, 48);
      doc.text("Confidential  ·  Generated by SmartDash AI", PAD, H - 14);
      doc.text(date, W - PAD, H - 14, { align: "right" });

      /* ── PAGE 2: KPI SUMMARY TABLE ──────────────────────────────── */
      doc.addPage();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, W, H, "F");

      // Top stripe
      doc.setFillColor(232, 96, 44);
      doc.rect(0, 0, W, 1.5, "F");

      // Heading
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(26, 18, 8);
      doc.text("KPI Summary", PAD, 26);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(138, 124, 106);
      doc.text(`${dashboard_title}  ·  ${date}`, PAD, 34);
      doc.setDrawColor(232, 96, 44);
      doc.setLineWidth(0.25);
      doc.line(PAD, 38, W - PAD, 38);

      // Table
      let ty = 50;
      const cols = [PAD, 88, 118, 147, 176];

      // Header row
      doc.setFillColor(26, 18, 8);
      doc.rect(PAD, ty - 5.5, W - PAD * 2, 10, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(240, 236, 230);
      doc.setCharSpace(0.4);
      ["CHART / KPI", "TOTAL", "AVERAGE", "PEAK", "PTS"].forEach((h, i) => doc.text(h, cols[i], ty + 1));
      doc.setCharSpace(0);
      ty += 12;

      charts.forEach((chart, idx) => {
        const stats  = deriveStats(chart);
        const isEven = idx % 2 === 0;
        if (isEven) {
          doc.setFillColor(253, 250, 247);
          doc.rect(PAD, ty - 5, W - PAD * 2, 10, "F");
        }
        // Title
        const t = (chart.title || chart.kpi || "");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(26, 18, 8);
        doc.text(t.length > 32 ? t.slice(0, 30) + "…" : t, cols[0], ty + 1);
        // Stats
        if (stats) {
          doc.setFont("helvetica", "bold");
          doc.setTextColor(232, 96, 44);
          doc.text(fmt(stats.total), cols[1], ty + 1);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(74, 62, 48);
          doc.text(fmt(stats.avg),   cols[2], ty + 1);
          doc.text(fmt(stats.peak),  cols[3], ty + 1);
          doc.text(String(stats.count), cols[4], ty + 1);
        }
        doc.setDrawColor(240, 232, 224);
        doc.setLineWidth(0.07);
        doc.line(PAD, ty + 5, W - PAD, ty + 5);
        ty += 11;
      });

      // Top performers
      ty += 8;
      if (ty < H - 60) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(26, 18, 8);
        doc.text("Top Performers", PAD, ty);
        ty += 9;

        charts.forEach((chart) => {
          const stats = deriveStats(chart);
          if (!stats?.peakLabel || ty > H - 28) return;
          doc.setFillColor(253, 245, 238);
          rRect(PAD, ty - 4, W - PAD * 2, 9, 2);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(232, 96, 44);
          doc.text((chart.title || chart.kpi || "").slice(0, 28), PAD + 3, ty + 2);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(138, 124, 106);
          doc.text(`Top: ${stats.peakLabel}  |  ${fmt(stats.peak)}`, 110, ty + 2);
          ty += 12;
        });
      }

      pageFooter("Page 2");

      /* ── PAGE 3+: AI INSIGHTS ───────────────────────────────────── */
      doc.addPage();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, W, H, "F");
      doc.setFillColor(232, 96, 44);
      doc.rect(0, 0, W, 1.5, "F");

      let cy = 26;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(26, 18, 8);
      doc.text("AI Insights & Analysis", PAD, cy);
      cy += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(138, 124, 106);
      doc.text("Automatically generated insights from your dashboard data", PAD, cy);
      cy += 6;
      doc.setDrawColor(232, 96, 44);
      doc.setLineWidth(0.25);
      doc.line(PAD, cy, W - PAD, cy);
      cy += 10;

      // Executive summary box
      if (summary) {
        const lines  = doc.splitTextToSize(summary, W - PAD * 2 - 18);
        const boxH   = lines.length * 5 + 20;

        doc.setFillColor(232, 96, 44);
        rRect(PAD, cy, W - PAD * 2, boxH, 4);
        // Overlay tint right half
        doc.setGState(doc.GState({ opacity: 0.2 }));
        doc.setFillColor(240, 192, 96);
        rRect(W / 2, cy, W / 2 - PAD, boxH, 4);
        doc.setGState(doc.GState({ opacity: 1 }));

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.setCharSpace(0.8);
        doc.text(">> EXECUTIVE SUMMARY", PAD + 5, cy + 9);
        doc.setCharSpace(0);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(lines, PAD + 5, cy + 17);
        cy += boxH + 12;
      }

      // Section label
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(138, 124, 106);
      doc.setCharSpace(0.5);
      doc.text("CHART-BY-CHART INSIGHTS", PAD, cy);
      doc.setCharSpace(0);
      cy += 9;

      let pageNum = 3;

      insights.forEach((ins, idx) => {
        const rows = [];
        if (ins.descriptive)  rows.push(["What happened",  ins.descriptive]);
        if (ins.diagnostic)   rows.push(["Why it happened", ins.diagnostic]);
        if (ins.prescriptive) rows.push(["What to do",      ins.prescriptive]);

        // Estimate height
        let cardH = 22;
        rows.forEach(([label, txt]) => {
          const labelH = doc.splitTextToSize(label, 38).length;
          const textH  = doc.splitTextToSize(txt, W - PAD * 2 - 48).length;
          cardH += Math.max(labelH, textH) * 4.8 + 8;
        });
        cardH += 4;

        // Page break
        if (cy + cardH > H - 18) {
          pageFooter(`Page ${pageNum}`);
          doc.addPage();
          doc.setFillColor(255, 255, 255);
          doc.rect(0, 0, W, H, "F");
          doc.setFillColor(232, 96, 44);
          doc.rect(0, 0, W, 1.5, "F");
          cy = 20;
          pageNum++;
        }

        // Card bg
        doc.setFillColor(253, 250, 247);
        rRect(PAD, cy, W - PAD * 2, cardH, 3);

        // Left accent stripe
        doc.setFillColor(232, 96, 44);
        doc.roundedRect(PAD, cy, 3, cardH, 1.5, 1.5, "F");

        // Number badge
        doc.setFillColor(255, 240, 230);
        rRect(PAD + 5, cy + 5, 10, 7, 1.5);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(232, 96, 44);
        doc.text(String(idx + 1).padStart(2, "0"), PAD + 10, cy + 10, { align: "center" });

        // KPI title
        const kpiShort = (ins.kpi || "").length > 55
          ? (ins.kpi || "").slice(0, 53) + "…"
          : (ins.kpi || "");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(26, 18, 8);
        doc.text(kpiShort, PAD + 18, cy + 10);

        // Header divider
        doc.setDrawColor(240, 232, 224);
        doc.setLineWidth(0.2);
        doc.line(PAD + 5, cy + 16, W - PAD - 5, cy + 16);

        // Rows
        let ry = cy + 22;
        rows.forEach(([label, txt]) => {
          const labelLines = doc.splitTextToSize(label, 38);
          const textLines  = doc.splitTextToSize(txt, W - PAD * 2 - 48);
          const rowH = Math.max(labelLines.length, textLines.length) * 4.8 + 8;

          // Label column (left, orange, bold)
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(180, 80, 30);
          doc.text(labelLines, PAD + 6, ry);

          // Separator line
          doc.setDrawColor(220, 200, 185);
          doc.setLineWidth(0.15);
          doc.line(PAD + 46, ry - 4, PAD + 46, ry + rowH - 8);

          // Text column (right)
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(58, 40, 24);
          doc.text(textLines, PAD + 50, ry);
          ry += rowH;
        });

        cy += cardH + 8;
      });

      pageFooter(`Page ${pageNum}`);

      /* Save */
      doc.save(`${dashboard_title.replace(/\s+/g, "_")}_Report.pdf`);

    } catch (e) {
      console.error("PDF error:", e);
      alert("PDF export failed: " + e.message);
    } finally { setExporting(false); setExportType(""); }
  };

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════*/
  return (
    <div style={S.screen}>
      {/* Topbar */}
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

          <div style={{ position: "relative" }}>
            <button
              style={{ ...S.exportBtn, ...(exporting ? S.off : {}) }}
              onClick={() => !exporting && setShowMenu(v => !v)}
              disabled={exporting}
            >
              {exporting
                ? <><span style={S.spin}/>{exportType === "pdf" ? "Saving PDF…" : "Saving PNG…"}</>
                : <>↓ Export <span style={{ fontSize: 9 }}>▼</span></>}
            </button>

            {showMenu && (
              <div style={S.menu}>
                <button style={S.mItem} onClick={exportPNG}>
                  <span style={S.mIcon}>🖼️</span>
                  <div><div style={S.mT}>Save as PNG</div><div style={S.mS}>High-res image (2×) — full dashboard</div></div>
                </button>
                <div style={S.mSep}/>
                <button style={S.mItem} onClick={exportPDF}>
                  <span style={S.mIcon}>📄</span>
                  <div>
                    <div style={{ ...S.mT, color: "var(--accent3)" }}>Save as PDF</div>
                    <div style={S.mS}>Cover + KPI table + AI insights</div>
                  </div>
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
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 998, backdropFilter: "blur(4px)" }}
            onClick={() => setShowSQL(false)}
          />
          <div style={S.sqlModal}>
            <div style={S.sqlModalHdr}>
              <span style={S.sqlModalTitle}>SQL Queries Generated by AI</span>
              <button style={S.sqlClose} onClick={() => setShowSQL(false)}>✕</button>
            </div>
            <div style={S.sqlHint}>Full SQL shown below. Use Copy to grab any query.</div>
            <div style={S.sqlModalBody}>
              {sqlQueries.map((q, i) => (
                <div key={i} style={S.sqlCard}>
                  <div style={S.sqlCardHdr}>
                    <div style={S.sqlKpi}>{i + 1}. {q.kpi}</div>
                    <button style={S.sqlAction} onClick={() => copySql(q.sql)}>📋 Copy SQL</button>
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

      {/* Body */}
      <div style={S.body}>
        <div style={S.main}>
          <div style={S.tabs}>
            {[["kpis","📊 KPI Cards"],["charts","📈 Charts"],["both","⚡ Both"]].map(([id, label]) => (
              <button
                key={id}
                style={{ ...S.tab, ...(activeTab === id ? S.tabOn : {}) }}
                onClick={() => setActiveTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div ref={exportRef} style={S.exportArea}>
            {(activeTab === "kpis" || activeTab === "both") && (
              <div style={S.kpiGrid}>
                {charts.map((chart, i) => (
                  <KPICard key={chart.kpi} chart={chart} colorSchema={colorSchema || "default"} index={i}/>
                ))}
              </div>
            )}
            {(activeTab === "charts" || activeTab === "both") && (
              <div style={S.chartGrid}>
                {charts.map((chart, i) => (
                  <ChartCard key={chart.kpi} chart={chart} colorSchema={colorSchema || "default"} index={i}/>
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
  menu:     { position:"absolute", top:"calc(100% + 8px)", right:0, background:"var(--bg2)", border:"1px solid var(--border2)", borderRadius:"var(--radius-lg)", padding:6, minWidth:230, boxShadow:"0 20px 60px rgba(0,0,0,0.7)", zIndex:100, animation:"slideDown 0.15s ease" },
  mItem:    { display:"flex", alignItems:"center", gap:12, width:"100%", padding:"10px 12px", background:"none", border:"none", borderRadius:9, cursor:"pointer", textAlign:"left" },
  mIcon:    { fontSize:20, flexShrink:0 },
  mT:       { fontSize:13, fontWeight:600, color:"var(--accent)", marginBottom:2 },
  mS:       { fontSize:11, color:"var(--text3)" },
  mSep:     { height:1, background:"var(--border)", margin:"4px 0" },
  newBtn:   { display:"flex", alignItems:"center", gap:6, padding:"8px 14px", background:"var(--bg3)", border:"1px solid var(--border2)", borderRadius:"var(--radius)", color:"var(--text2)", fontSize:13, cursor:"pointer" },
  overlay:  { position:"fixed", inset:0, zIndex:20 },

  sqlModal:     { background:"var(--bg2)", maxHeight:"min(75vh,600px)", width:"95vw", maxWidth:"1200px", display:"flex", flexDirection:"column", position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", zIndex:999, borderRadius:"var(--radius-lg)", boxShadow:"0 20px 80px rgba(0,0,0,0.5)" },
  sqlModalHdr:  { padding:"12px 20px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" },
  sqlModalTitle:{ fontSize:13, fontWeight:700, color:"var(--accent3)", textTransform:"uppercase", letterSpacing:"0.07em" },
  sqlHint:      { padding:"10px 20px", fontSize:12, color:"var(--text2)", borderBottom:"1px solid var(--border)", background:"rgba(14,165,233,0.04)" },
  sqlClose:     { background:"none", border:"none", color:"var(--text2)", cursor:"pointer", fontSize:16, padding:"0 4px" },
  sqlModalBody: { overflowY:"auto", padding:"16px", display:"flex", flexDirection:"column", gap:12, flex:1 },
  sqlCard:      { background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:"var(--radius)", overflow:"hidden" },
  sqlCardHdr:   { display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"10px 14px", borderBottom:"1px solid var(--border)" },
  sqlAction:    { padding:"6px 12px", background:"rgba(240,192,96,0.12)", border:"1px solid rgba(240,192,96,0.22)", borderRadius:"999px", color:"var(--accent3)", fontSize:11, cursor:"pointer" },
  sqlScroll:    { overflowX:"auto", padding:"14px", maxHeight:"400px", overflowY:"auto" },
  sqlKpi:       { fontSize:11, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", letterSpacing:"0.06em" },
  sqlCode:      { padding:0, margin:0, fontSize:12, color:"var(--text2)", fontFamily:"var(--font-mono)", lineHeight:1.75, whiteSpace:"pre-wrap", wordBreak:"break-word" },

  body:      { flex:1, display:"flex", overflow:"hidden" },
  main:      { flex:1, overflowY:"auto", padding:"20px 24px" },
  exportArea:{ display:"flex", flexDirection:"column", gap:20 },

  tabs:  { display:"flex", gap:8, marginBottom:20 },
  tab:   { padding:"7px 16px", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:20, color:"var(--text2)", fontSize:12, fontWeight:600, cursor:"pointer" },
  tabOn: { background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.25)", color:"var(--accent2)" },

  kpiGrid:  { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16 },
  chartGrid:{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(420px,1fr))", gap:18 },
  sidebar:  { width:370, borderLeft:"1px solid var(--border)", overflowY:"auto", padding:18, display:"flex", flexDirection:"column", gap:18, background:"var(--bg2)" },
};
