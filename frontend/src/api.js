// api.js — All backend API calls

import axios from "axios";

// Automatically use localhost for local development, and Render for the live site
const BASE = process.env.REACT_APP_API_URL || 
  (window.location.hostname === "localhost" ? "http://localhost:8000" : "https://talking-bi-2oa7.onrender.com");

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
