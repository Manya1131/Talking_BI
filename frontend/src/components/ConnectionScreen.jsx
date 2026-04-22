import { useState, useRef } from "react";
import { connectDatabase, BASE } from "../api";

const EXAMPLES = [
  { label:"Supabase",   icon:"⚡", value:"postgresql://postgres:password@db.xxx.supabase.co:5432/postgres" },
  { label:"PostgreSQL", icon:"🐘", value:"postgresql://user:password@localhost:5432/mydb" },
  { label:"MySQL",      icon:"🐬", value:"mysql+pymysql://user:password@localhost:3306/mydb" },
  { label:"SQLite",     icon:"📁", value:"sqlite:///path/to/file.db" },
];

const FEATURES = [
  { icon:"🔌", label:"Connect any SQL database or upload CSV" },
  { icon:"🧠", label:"AI generates SQL automatically" },
  { icon:"📊", label:"Smart charts + query-aware KPI cards" },
  { icon:"🎤", label:"Voice Q&A on your data" },
  { icon:"📄", label:"Export as PNG or PDF report" },
];

/* Floating ember particles */
function Particles() {
  const pts = [
    { cx:12, cy:22, r:1.8, color:"#8b5cf6", dur:4.2 },
    { cx:82, cy:58, r:1.2, color:"#0ea5e9", dur:5.8 },
    { cx:48, cy:78, r:2.2, color:"#22c55e", dur:3.9 },
    { cx:72, cy:18, r:1.4, color:"#7c3aed", dur:6.1 },
    { cx:28, cy:52, r:1.0, color:"#38bdf8", dur:4.7 },
    { cx:91, cy:82, r:1.6, color:"#a78bfa", dur:5.3 },
    { cx:58, cy:38, r:1.2, color:"#60a5fa", dur:3.4 },
    { cx:35, cy:88, r:1.0, color:"#22c55e", dur:6.5 },
    { cx:64, cy:68, r:1.4, color:"#38bdf8", dur:4.0 },
  ];
  return (
    <svg style={S.particles} viewBox="0 0 100 100" preserveAspectRatio="none">
      {pts.map((p,i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.color} opacity="0.45">
          <animateTransform attributeName="transform" type="translate"
            values={`0,0; ${(i%2===0?1:-1)*3},${-8}; 0,0`}
            dur={`${p.dur}s`} repeatCount="indefinite" calcMode="spline"
            keySplines="0.45 0 0.55 1; 0.45 0 0.55 1"/>
          <animate attributeName="opacity" values="0.2;0.8;0.2"
            dur={`${p.dur}s`} repeatCount="indefinite"/>
        </circle>
      ))}
    </svg>
  );
}

export default function ConnectionScreen({ onConnected }) {
  const [mode, setMode]         = useState("db");
  const [conn, setConn]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [focused, setFocused]   = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [csvFile, setCsvFile]   = useState(null);
  const fileRef                 = useRef(null);

  /* ── DB connect ── */
  const connectDB = async () => {
    if (!conn.trim()) return;
    setLoading(true); setError("");
    try {
      const d = await connectDatabase(conn.trim());
      onConnected(d);
    } catch (e) {
      setError(e.response?.data?.detail || "Connection failed. Check your connection string.");
    } finally { setLoading(false); }
  };

  /* ── CSV upload ── */
  const handleCSV = (file) => {
    if (!file) return;
    if (!file.name.match(/\.(csv|tsv)$/i)) {
      setError("Please upload a .csv or .tsv file."); return;
    }
    setCsvFile(file); setError("");
  };

  const connectCSV = async () => {
    if (!csvFile) return;
    setLoading(true); setError("");
    try {
      const formData = new FormData();
      formData.append("file", csvFile);

      const res = await fetch(`${BASE}/api/connection/upload-csv`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(d.detail || "Upload failed");
      }
      const data = await res.json();
      onConnected(data);
    } catch (e) {
      setError(e.message || "CSV upload failed.");
    } finally { setLoading(false); }
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleCSV(e.dataTransfer.files?.[0]);
  };

  return (
    <div style={S.page} className="conn-page">
      {/* ── Left hero ── */}
      <div style={S.left} className="conn-left">
        <Particles />
        <div style={S.blob1}/><div style={S.blob2}/>
        <div style={S.leftInner} className="conn-left-inner">
          {/* Brand */}
          <div style={S.brand}>
            <div style={S.brandIcon}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M3 17L8 6l5 8 3-5" stroke="var(--accent3)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="18" cy="5" r="2.2" fill="var(--accent4)"/>
              </svg>
            </div>
            <span style={S.brandName}>SmartDash <span style={S.brandAccent}>AI</span></span>
          </div>

          <h1 style={S.headline}>
            Turn raw data into<br/>
            <span style={S.headlineGrad}>instant intelligence</span>
          </h1>
          <p style={S.sub}>Connect your database or drop a CSV. Describe what you need — AI builds your full dashboard with voice explanations.</p>

          <div style={S.features} className="conn-features">
            {FEATURES.map(({ icon, label }) => (
              <div key={label} style={S.feature}>
                <span style={S.featIcon}>{icon}</span>
                <span style={S.featTxt}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={S.right} className="conn-right">
        <div style={S.card} className="conn-card fade-up">
          <h2 style={S.cardH}>Connect your data</h2>
          <p style={S.cardSub}>Database connection string or CSV file — your choice</p>

          {/* Mode toggle */}
          <div style={S.toggle}>
            <button style={{ ...S.toggleBtn, ...(mode==="db" ? S.toggleOn : {}) }}
              onClick={() => { setMode("db"); setError(""); setCsvFile(null); }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink:0 }}>
                <ellipse cx="7" cy="4" rx="5" ry="2" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M2 4v3c0 1.1 2.24 2 5 2s5-.9 5-2V4M2 7v3c0 1.1 2.24 2 5 2s5-.9 5-2V7" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
              Database
            </button>
            <button style={{ ...S.toggleBtn, ...(mode==="csv" ? S.toggleOn : {}) }}
              onClick={() => { setMode("csv"); setError(""); setConn(""); }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink:0 }}>
                <rect x="2" y="1" width="10" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M4 5h6M4 7.5h6M4 10h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
              CSV Upload
            </button>
          </div>

          {/* ── DB Mode ── */}
          {mode === "db" && (
            <>
              <div style={{ ...S.inputBox, ...(focused ? S.inputFocus : {}) }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink:0 }}>
                  <rect x="1" y="2" width="12" height="10" rx="2" stroke="var(--text3)" strokeWidth="1.1"/>
                  <path d="M4 6h6M4 8.5h4" stroke="var(--text3)" strokeWidth="1.1" strokeLinecap="round"/>
                </svg>
                <input style={S.inp}
                  placeholder="postgresql://user:pass@host:5432/dbname"
                  value={conn}
                  onChange={e => setConn(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && connectDB()}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  spellCheck={false}/>
              </div>

              <p style={S.qLabel}>Quick fill</p>
              <div style={S.qRow}>
                {EXAMPLES.map(ex => (
                  <button key={ex.label} style={S.qBtn} onClick={() => setConn(ex.value)}>
                    <span>{ex.icon}</span>{ex.label}
                  </button>
                ))}
              </div>

              {error && <div style={S.err}><span>⚠️</span>{error}</div>}

              <button style={{ ...S.btn, ...(loading||!conn.trim() ? S.btnOff : {}) }}
                onClick={connectDB} disabled={loading||!conn.trim()}>
                {loading ? <><span style={S.spin}/>Connecting…</> : <>Connect Database →</>}
              </button>
              <p style={S.hint}>🔒 Connection string is never stored or shared</p>
            </>
          )}

          {/* ── CSV Mode ── */}
          {mode === "csv" && (
            <>
              <div style={{ ...S.dropZone, ...(dragOver ? S.dropActive : {}), ...(csvFile ? S.dropDone : {}) }}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}>
                <input ref={fileRef} type="file" accept=".csv,.tsv" style={{ display:"none" }}
                  onChange={e => handleCSV(e.target.files?.[0])}/>
                {csvFile ? (
                  <>
                    <div style={{ fontSize:28, marginBottom:10 }}>✅</div>
                    <div style={S.dropFileName}>{csvFile.name}</div>
                    <div style={S.dropSub}>{(csvFile.size/1024).toFixed(1)} KB · click to change</div>
                  </>
                ) : (
                  <>
                    <div style={S.dropIconWrap}>
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                        <path d="M14 18V8M14 8L10 12M14 8l4 4" stroke="var(--accent2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        <rect x="4" y="18" width="20" height="6" rx="2" stroke="var(--accent)" strokeWidth="1.4" strokeDasharray="3 2"/>
                      </svg>
                    </div>
                    <div style={S.dropText}>{dragOver ? "Drop it here!" : "Drag & drop your CSV"}</div>
                    <div style={S.dropSub}>or click to browse · .csv and .tsv supported</div>
                  </>
                )}
              </div>

              <div style={S.csvNote}>
                <span>💡</span>
                <span>First row should be column headers. Any delimiter is auto-detected. Max 50 MB.</span>
              </div>

              {error && <div style={S.err}><span>⚠️</span>{error}</div>}

              <button style={{ ...S.btn, ...(loading||!csvFile ? S.btnOff : {}) }}
                onClick={connectCSV} disabled={loading||!csvFile}>
                {loading ? <><span style={S.spin}/>Uploading CSV…</> : <>Analyse CSV File →</>}
              </button>
              <p style={S.hint}>📊 Data is processed in your session only — never stored</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const S = {
  page:       { minHeight:"100vh", display:"flex", position:"relative", overflow:"hidden" },

  left:       { flex:1, background:"linear-gradient(145deg,var(--bg3) 0%,var(--bg4) 50%,var(--bg3) 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:"56px 52px", borderRight:"1px solid rgba(167,139,250,0.12)", position:"relative", overflow:"hidden" },
  particles:  { position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" },
  blob1:      { position:"absolute", top:"-15%", right:"-8%", width:"50%", height:"50%", background:"radial-gradient(ellipse,rgba(167,139,250,0.08) 0%,transparent 70%)", borderRadius:"50%", pointerEvents:"none", animation:"driftOrb1 18s ease-in-out infinite alternate" },
  blob2:      { position:"absolute", bottom:"-10%", left:"-5%", width:"42%", height:"42%", background:"radial-gradient(ellipse,rgba(124,58,237,0.06) 0%,transparent 70%)", borderRadius:"50%", pointerEvents:"none", animation:"driftOrb1 22s ease-in-out infinite alternate-reverse" },
  leftInner:  { maxWidth:440, position:"relative", zIndex:1 },

  brand:      { display:"flex", alignItems:"center", gap:12, marginBottom:52 },
  brandIcon:  { width:42, height:42, background:"rgba(79,70,229,0.12)", border:"1px solid rgba(79,70,229,0.24)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center" },
  brandName:  { fontWeight:800, fontSize:22, color:"var(--text)", letterSpacing:"-0.3px" },
  brandAccent:{ color:"var(--accent)" },

  headline:   { fontSize:42, fontWeight:800, color:"var(--text)", lineHeight:1.15, letterSpacing:"-0.8px", marginBottom:18 },
  headlineGrad:{ background:"linear-gradient(120deg, #6366f1 0%, #0ea5e9 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text", display:"inline" },
  sub:        { fontSize:15, color:"var(--text2)", lineHeight:1.8, marginBottom:44, maxWidth:380 },

  features:   { display:"flex", flexDirection:"column", gap:14 },
  feature:    { display:"flex", alignItems:"center", gap:14 },
  featIcon:   { fontSize:17, width:36, height:36, background:"rgba(99,102,241,0.08)", border:"1px solid rgba(99,102,241,0.18)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  featTxt:    { fontSize:13.5, color:"var(--text2)" },

  right:      { width:520, display:"flex", alignItems:"center", justifyContent:"center", padding:48, background:"var(--bg2)" },
  card:       { width:"100%", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:"var(--radius-xl)", padding:"38px 42px", boxShadow:"0 20px 40px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.08)" },
  cardH:      { fontSize:23, fontWeight:800, color:"var(--text)", letterSpacing:"-0.4px", marginBottom:6 },
  cardSub:    { fontSize:13, color:"var(--text2)", marginBottom:28 },

  toggle:     { display:"flex", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:4, marginBottom:28, gap:4 },
  toggleBtn:  { flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:7, padding:"9px 14px", background:"none", border:"none", borderRadius:8, color:"var(--text2)", fontSize:13, fontWeight:500, cursor:"pointer", transition:"all 0.2s" },
  toggleOn:   { background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.3)", color:"var(--accent2)" },

  inputBox:   { display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:"var(--bg3)", border:"1px solid var(--border2)", borderRadius:"var(--radius)", marginBottom:14, transition:"border-color 0.2s,box-shadow 0.2s" },
  inputFocus: { borderColor:"rgba(14,165,233,0.45)", boxShadow:"0 0 0 3px rgba(14,165,233,0.08)" },
  inp:        { flex:1, background:"none", border:"none", outline:"none", color:"var(--text)", fontSize:13, fontFamily:"var(--font-mono)", letterSpacing:"-0.2px" },

  qLabel:     { fontSize:11, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 },
  qRow:       { display:"flex", gap:7, flexWrap:"wrap", marginBottom:22 },
  qBtn:       { display:"flex", alignItems:"center", gap:6, padding:"6px 12px", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:"var(--radius)", color:"var(--text2)", fontSize:12, fontWeight:500, cursor:"pointer" },

  dropZone:   { border:"2px dashed rgba(14,165,233,0.28)", borderRadius:"var(--radius-lg)", padding:"36px 24px", textAlign:"center", cursor:"pointer", marginBottom:16, transition:"all 0.25s", background:"rgba(14,165,233,0.04)" },
  dropActive: { borderColor:"rgba(14,165,233,0.7)", background:"rgba(14,165,233,0.08)", boxShadow:"0 0 0 3px rgba(14,165,233,0.08)" },
  dropDone:   { borderColor:"rgba(34,197,94,0.5)", background:"rgba(34,197,94,0.04)", borderStyle:"solid" },
  dropIconWrap:{ display:"flex", justifyContent:"center", marginBottom:12 },
  dropText:   { fontSize:15, fontWeight:600, color:"var(--text2)", marginBottom:6 },
  dropFileName:{ fontSize:14, fontWeight:600, color:"var(--text)", marginBottom:4 },
  dropSub:    { fontSize:12, color:"var(--text3)" },

  csvNote:    { display:"flex", alignItems:"flex-start", gap:8, padding:"10px 14px", background:"rgba(14,165,233,0.08)", border:"1px solid rgba(14,165,233,0.18)", borderRadius:"var(--radius)", marginBottom:18, color:"var(--text2)", fontSize:12, lineHeight:1.6 },

  err:        { display:"flex", alignItems:"flex-start", gap:8, padding:"11px 14px", background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:"var(--radius)", color:"#b91c1c", fontSize:13, marginBottom:18, lineHeight:1.5 },

  btn:        { width:"100%", padding:"14px", background:"linear-gradient(135deg,#6366f1,#0ea5e9)", backgroundSize:"200% 200%", border:"none", borderRadius:"var(--radius)", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", marginBottom:16, letterSpacing:"0.01em", boxShadow:"0 12px 30px rgba(14,165,233,0.18)", transition:"opacity 0.2s,box-shadow 0.2s", animation:"gradShift 4s ease infinite" },
  btnOff:     { opacity:0.4, cursor:"not-allowed", boxShadow:"none", animation:"none" },
  spin:       { width:15, height:15, border:"2px solid rgba(255,255,255,0.25)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.7s linear infinite", display:"inline-block", marginRight:8 },
  hint:       { textAlign:"center", fontSize:12, color:"var(--text3)" },
};
