import { useState, useEffect } from "react";
import "./index.css";
import ConnectionScreen from "./components/ConnectionScreen";
import InputForm from "./components/InputForm";
import DashboardScreen from "./components/DashboardScreen";
import { connectDatabase, generateDashboard } from "./api";

export default function App() {
  const [screen,      setScreen]      = useState("connect");
  const [connData,    setConnData]    = useState(null);
  const [dashData,    setDashData]    = useState(null);
  const [colorSchema, setColorSchema] = useState("default");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [sqlQueries,  setSqlQueries]  = useState([]);
  const [theme,       setTheme]       = useState("light");

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);
    document.documentElement.classList.toggle("dark", savedTheme === "dark");
  }, []);

  // Toggle theme function
  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const handleConnected = (d) => { setConnData(d); setScreen("input"); };

  const handleGenerate = async (formData) => {
    setLoading(true); setError(""); setSqlQueries([]);
    setColorSchema(formData.color_schema);
    try {
      const result = await generateDashboard(formData);
      setDashData(result);
      if (result.sql_queries) setSqlQueries(result.sql_queries);
      else if (result.charts) {
        const sqls = result.charts.filter(c => c.sql_query).map(c => ({ kpi:c.kpi, sql:c.sql_query }));
        setSqlQueries(sqls);
      }
      setScreen("dashboard");
    } catch (e) {
      setError(e.response?.data?.detail || "Dashboard generation failed. Please try again.");
    } finally { setLoading(false); }
  };

  const handleReset   = () => { setDashData(null); setScreen("input"); setError(""); setSqlQueries([]); };
  /* ← NEW: go back to connection screen from input */
  const handleBack    = () => { setConnData(null); setScreen("connect"); setError(""); setSqlQueries([]); };

  return (
    <>
      <div style={bgGrid}/>
      
      {/* Theme Toggle Button */}
      <button onClick={toggleTheme} style={themeToggleBtn} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>
        {theme === "light" ? "🌙" : "☀️"}
      </button>
      
      {error && (
        <div style={errToast}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError("")} style={closeBtn}>✕</button>
        </div>
      )}

      {screen === "connect" && (
        <ConnectionScreen onConnected={handleConnected}/>
      )}
      {screen === "input" && connData && (
        <InputForm
          connectionData={connData}
          onSubmit={handleGenerate}
          loading={loading}
          sqlQueries={sqlQueries}
          onBack={handleBack}       /* ← pass back handler */
        />
      )}
      {screen === "dashboard" && dashData && (
        <DashboardScreen
          data={dashData}
          sessionId={connData?.session_id}
          colorSchema={colorSchema}
          onReset={handleReset}
          sqlQueries={sqlQueries}
        />
      )}
    </>
  );
}

/* Subtle pastel grid */
const bgGrid  = { position:"fixed", inset:0, backgroundImage:`linear-gradient(var(--glow2) 1px,transparent 1px),linear-gradient(90deg,var(--glow2) 1px,transparent 1px)`, backgroundSize:"52px 52px", pointerEvents:"none", zIndex:0 };
const errToast= { position:"fixed", top:20, left:"50%", transform:"translateX(-50%)", zIndex:1000, display:"flex", alignItems:"center", gap:12, padding:"12px 20px", background:"rgba(244,63,94,0.12)", border:"1px solid rgba(244,63,94,0.25)", borderRadius:12, color:"var(--text)", fontSize:14, backdropFilter:"blur(12px)", maxWidth:"90vw" };
const closeBtn= { background:"none", border:"none", color:"var(--text2)", cursor:"pointer", fontSize:16, padding:"0 4px" };
const themeToggleBtn= { position:"fixed", top:20, right:20, zIndex:1000, width:44, height:44, borderRadius:"50%", background:"var(--bg3)", border:"1px solid var(--border)", color:"var(--text)", fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.12)", transition:"all 0.2s ease", backdropFilter:"blur(8px)" };
