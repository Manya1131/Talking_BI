// api.js — All backend API calls

import axios from "axios";

const BASE = "http://localhost:8000";

// ── Connection ──────────────────────────────────
export const connectDatabase = async (connectionString) => {
  const res = await axios.post(`${BASE}/api/connection/connect`, {
    connection_string: connectionString,
  });
  return res.data;
};

export const disconnectDatabase = async (sessionId) => {
  const res = await axios.delete(`${BASE}/api/connection/disconnect/${sessionId}`);
  return res.data;
};

// ── Dashboard ───────────────────────────────────
export const generateDashboard = async (payload) => {
  const res = await axios.post(`${BASE}/api/dashboard/generate`, payload);
  return res.data;
};

// ── Voice Q&A ───────────────────────────────────
export const askVoiceQuestion = async (sessionId, question, dashboardContext) => {
  const res = await axios.post(`${BASE}/api/voice/ask`, {
    session_id: sessionId,
    question,
    dashboard_context: dashboardContext,
  });
  return res.data;
};
