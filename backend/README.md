# 🎤 Talking BI — Backend

AI-powered BI backend using **FastAPI** + **Groq (LLaMA 3.3 70B)** + **SQLAlchemy**.

---

## 📁 Project Structure

```
talking-bi-backend/
├── main.py                        # FastAPI app entry point
├── requirements.txt
├── .env.example                   # Copy to .env and fill in
├── models/
│   └── schemas.py                 # Pydantic request/response models
├── routers/
│   ├── connection.py              # DB connect/disconnect endpoints
│   ├── dashboard.py               # Dashboard generation endpoint
│   └── voice.py                   # Voice Q&A endpoint
└── services/
    ├── db_connector.py            # Dynamic DB connection + schema discovery
    ├── groq_service.py            # All Groq/LLM calls
    └── dashboard_builder.py       # Full pipeline orchestration
```

---

## ⚙️ Setup

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Set your Groq API key
```bash
cp .env.example .env
# Edit .env and add your key:
# GROQ_API_KEY=gsk_xxxxxxxxxxxx
```
Get your free Groq API key at: https://console.groq.com

### 3. Run the server
```bash
python main.py
# OR
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Open API docs
```
http://localhost:8000/docs
```

---

## 🚀 API Usage

### Step 1 — Connect to Database
```http
POST /api/connection/connect
Content-Type: application/json

{
  "connection_string": "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Connected successfully! Found 4 table(s).",
  "session_id": "abc-123-def",
  "tables": [
    {"table_name": "orders", "columns": [...], "row_count": 5009},
    ...
  ]
}
```

---

### Step 2 — Generate Dashboard
```http
POST /api/dashboard/generate
Content-Type: application/json

{
  "session_id": "abc-123-def",
  "user_query": "revenue by category, sales by region, monthly profit trend",
  "num_visualizations": 4,
  "color_schema": "blue",
  "dashboard_title": "Superstore Analytics 2024"
}
```
**Response:**
```json
{
  "dashboard_title": "Superstore Analytics 2024",
  "charts": [
    {
      "kpi": "Revenue by Category",
      "chart_type": "bar",
      "x_axis": "category",
      "y_axis": "revenue",
      "data": [{"category": "Technology", "revenue": 836154.03}, ...],
      "color_schema": "blue",
      "title": "Revenue by Category"
    }
  ],
  "insights": [
    {
      "kpi": "Revenue by Category",
      "descriptive": "Technology leads with $836K revenue...",
      "diagnostic": "...",
      "predictive": "...",
      "prescriptive": "...",
      "evaluative": "...",
      "exploratory": "..."
    }
  ],
  "summary": "Technology dominates revenue at $836K...",
  "kpi_coverage": 100.0,
  "total_kpis_requested": 4,
  "total_kpis_generated": 4
}
```

---

### Step 3 — Voice Q&A
```http
POST /api/voice/ask
Content-Type: application/json

{
  "session_id": "abc-123-def",
  "question": "Which region has the highest sales?",
  "dashboard_context": [
    {
      "kpi": "Sales by Region",
      "data": [{"region": "West", "sales": 725458}, ...]
    }
  ]
}
```
**Response:**
```json
{
  "question": "Which region has the highest sales?",
  "answer": "The West region has the highest sales at $725,458...",
  "referenced_charts": ["Sales by Region"]
}
```

---

## 🔌 Supported Databases

| Database   | Connection String Format |
|------------|--------------------------|
| PostgreSQL | `postgresql://user:pass@host:5432/db` |
| Supabase   | `postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres` |
| MySQL      | `mysql+pymysql://user:pass@host:3306/db` |
| SQLite     | `sqlite:///path/to/file.db` |

---

## 🎨 Color Schemas
- `default` — Standard multi-color
- `blue` — Blue gradient palette
- `dark` — Dark mode palette
- `warm` — Orange/red palette

---

## 🧠 Groq Model
Uses **LLaMA 3.3 70B Versatile** via Groq for:
- Intent decomposition
- SQL generation
- Chart type selection
- Insight generation (6 types)
- Dashboard summary
- Voice Q&A
