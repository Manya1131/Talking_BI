"""
main.py
SmartDash AI - FastAPI Backend
Entry point for the application.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import connection, dashboard, voice

# ──────────────────────────────────────────────
# App setup
# ──────────────────────────────────────────────

app = FastAPI(
    title="SmartDash AI API",
    description="""
## SmartDash AI - Backend API

An AI-powered Business Intelligence platform that:
- 🔌 Connects to any SQL database via connection string
- 🧠 Uses Groq (LLaMA 3.3 70B) to understand user requests
- 📊 Auto-generates dashboards with appropriate chart types
- 💡 Extracts 6-type insights per visualization
- 🎤 Answers voice questions grounded in actual data

### Workflow:
1. **POST /api/connection/connect** → Connect to your DB
2. **POST /api/dashboard/generate** → Generate your dashboard
3. **POST /api/voice/ask** → Ask questions about the dashboard
    """,
    version="1.0.0"
)

# ──────────────────────────────────────────────
# CORS (allow React frontend to call this API)
# ──────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # In production, set to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────
# Routers
# ──────────────────────────────────────────────

app.include_router(connection.router)
app.include_router(dashboard.router)
app.include_router(voice.router)


# ──────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {
        "status": "✅ SmartDash AI API is running",
        "docs": "/docs",
        "version": "1.0.0"
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}


# ──────────────────────────────────────────────
# Run (for development)
# ──────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
