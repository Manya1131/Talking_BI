import { useState, useEffect, useRef } from "react";
import { askVoiceQuestion } from "../api";

export default function VoicePanel({ sessionId, dashboardContext }) {
  const [listening, setListening] = useState(false);
  const [question,  setQuestion]  = useState("");
  const [loading,   setLoading]   = useState(false);
  const [history,   setHistory]   = useState([]);
  const [error,     setError]     = useState("");
  const recRef   = useRef(null);
  const bottomRef= useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = false; r.interimResults = false; r.lang = "en-US";
    r.onresult = (e) => { setQuestion(e.results[0][0].transcript); setListening(false); };
    r.onend = () => setListening(false);
    recRef.current = r;
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [history]);

  const startListen = () => {
    if (!recRef.current) { setError("Voice not supported. Use Chrome or Edge."); return; }
    setError(""); setListening(true); recRef.current.start();
  };
  const stopListen = () => { recRef.current?.stop(); setListening(false); };

  const ask = async () => {
    if (!question.trim()) return;
    const q = question; setQuestion(""); setLoading(true); setError("");
    try {
      const res = await askVoiceQuestion(sessionId, q, dashboardContext);
      setHistory(h => [...h, { q, a: res.answer, charts: res.referenced_charts }]);
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(res.answer);
        u.rate = 0.9; u.pitch = 1;
        const voices = window.speechSynthesis.getVoices();
        const best = voices.find(v => v.lang.startsWith("en") && v.name.includes("Google")) || voices.find(v => v.lang.startsWith("en"));
        if (best) u.voice = best;
        window.speechSynthesis.speak(u);
      }
    } catch { setError("Could not get answer. Try again."); }
    finally { setLoading(false); }
  };

  const SUGGESTIONS = ["Which region has highest sales?", "What's the profit trend?", "Which category performs best?"];

  return (
    <div style={S.panel}>
      <div style={S.hdr}>
        <div style={S.hdrLeft}>
          <div style={{ ...S.micIcon, ...(listening ? S.micIconActive : {}) }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="3.5" y="0.5" width="5" height="7" rx="2.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M1.5 6a4.5 4.5 0 009 0M6 10.5v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={S.hdrTitle}>Voice Q&amp;A</span>
        </div>
        <span style={S.hdrSub}>Ask anything about your data</span>
      </div>

      {/* Chat */}
      <div style={S.chat}>
        {history.length === 0 && (
          <div style={S.empty}>
            <div style={S.emptyIcon}>🎤</div>
            <p style={S.emptyTxt}>Ask about your dashboard using voice or text</p>
            <div style={S.suggestions}>
              {SUGGESTIONS.map(s => (
                <button key={s} style={S.suggestion} onClick={() => setQuestion(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {history.map((item, i) => (
          <div key={i} style={S.chatItem} className="fade-up">
            <div style={S.qBubble}>
              <span style={S.bubbleAvatar}>🙋</span>
              <div style={S.bubbleTxt}>{item.q}</div>
            </div>
            <div style={S.aBubble}>
              <span style={S.bubbleAvatar}>🤖</span>
              <div>
                <div style={S.bubbleTxt}>{item.a}</div>
                {item.charts?.length > 0 && (
                  <div style={S.chips}>
                    {item.charts.map(c => <span key={c} style={S.chip}>{c}</span>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef}/>
      </div>

      {error && <div style={S.err}>{error}</div>}

      {/* Input */}
      <div style={S.inputRow}>
        <input
          style={S.inp}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key==="Enter" && ask()}
          placeholder={listening ? "Listening…" : "Type or use microphone…"}
        />
        <button
          style={{ ...S.iconBtn, ...(listening ? S.iconBtnRed : {}) }}
          onClick={listening ? stopListen : startListen}
          title={listening ? "Stop" : "Voice input"}
        >
          {listening
            ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="3" y="3" width="6" height="6" rx="1" fill="currentColor"/></svg>
            : <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="3.5" y="0.5" width="5" height="7" rx="2.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1.5 6a4.5 4.5 0 009 0M6 10.5v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          }
        </button>
        <button
          style={{ ...S.sendBtn, ...(loading || !question.trim() ? S.sendBtnOff : {}) }}
          onClick={ask}
          disabled={loading || !question.trim()}
        >
          {loading
            ? <span style={S.spinner}/>
            : <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 6.5h10M6.5 1.5l5 5-5 5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          }
        </button>
      </div>
    </div>
  );
}

const S = {
  panel:       { background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", display:"flex", flexDirection:"column", overflow:"hidden" },
  hdr:         { padding:"14px 16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" },
  hdrLeft:     { display:"flex", alignItems:"center", gap:8 },
  micIcon:     { width:28, height:28, background:"rgba(167,139,250,0.1)", border:"1px solid rgba(167,139,250,0.18)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--accent)", transition:"all 0.2s" },
  micIconActive:{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", color:"#ef4444", animation:"pulse 1s infinite" },
  hdrTitle:    { fontSize:11, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.08em" },
  hdrSub:      { fontSize:10, color:"var(--text3)" },
  chat:        { flex:1, overflowY:"auto", padding:14, minHeight:180, maxHeight:320, display:"flex", flexDirection:"column", gap:14 },
  empty:       { flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, padding:20 },
  emptyIcon:   { fontSize:28 },
  emptyTxt:    { fontSize:12, color:"var(--text3)", textAlign:"center" },
  suggestions: { display:"flex", flexDirection:"column", gap:5, width:"100%" },
  suggestion:  { padding:"7px 11px", background:"var(--bg4)", border:"1px solid var(--border)", borderRadius:"var(--radius)", color:"var(--text2)", fontSize:11, cursor:"pointer", textAlign:"left" },
  chatItem:    { display:"flex", flexDirection:"column", gap:7 },
  qBubble:     { display:"flex", gap:8, alignItems:"flex-start", justifyContent:"flex-end" },
  aBubble:     { display:"flex", gap:8, alignItems:"flex-start" },
  bubbleAvatar:{ fontSize:16, flexShrink:0 },
  bubbleTxt:   { padding:"9px 12px", background:"var(--bg4)", border:"1px solid var(--border)", borderRadius:"var(--radius)", fontSize:12, color:"var(--text)", lineHeight:1.65, maxWidth:"88%" },
  chips:       { display:"flex", gap:5, flexWrap:"wrap", marginTop:5 },
  chip:        { padding:"2px 8px", background:"rgba(167,139,250,0.08)", border:"1px solid rgba(167,139,250,0.18)", borderRadius:20, color:"var(--accent)", fontSize:10 },
  err:         { margin:"0 14px", padding:"9px 12px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.18)", borderRadius:"var(--radius)", color:"#fca5a5", fontSize:11 },
  inputRow:    { padding:"11px 13px", borderTop:"1px solid var(--border)", display:"flex", gap:7, alignItems:"center" },
  inp:         { flex:1, padding:"9px 12px", background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:"var(--radius)", color:"var(--text)", fontSize:12, outline:"none", fontFamily:"'DM Sans',sans-serif" },
  iconBtn:     { width:34, height:34, background:"var(--bg4)", border:"1px solid var(--border2)", borderRadius:"var(--radius)", color:"var(--text2)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 },
  iconBtnRed:  { background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", color:"#ef4444" },
  sendBtn:     { width:34, height:34, background:"var(--accent)", border:"none", borderRadius:"var(--radius)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 },
  sendBtnOff:  { opacity:0.35, cursor:"not-allowed" },
  spinner:     { width:12, height:12, border:"2px solid rgba(255,255,255,0.25)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.7s linear infinite", display:"inline-block" },
};
