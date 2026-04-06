"""
groq_service.py — All Groq API calls
"""
import os, json, re
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL   = "llama-3.3-70b-versatile"   # faster, lower token usage

def _chat(system: str, user: str, temperature: float = 0.3) -> str:
    response = _client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user}
        ],
        temperature=temperature,
        max_tokens=2048
    )
    return response.choices[0].message.content.strip()


def _extract_json(text: str):
    try:
        return json.loads(text)
    except:
        pass
    m = re.search(r"```(?:json)?\s*([\s\S]+?)```", text)
    if m:
        try: return json.loads(m.group(1).strip())
        except: pass
    m = re.search(r"(\[[\s\S]+\]|\{[\s\S]+\})", text)
    if m:
        try: return json.loads(m.group(1))
        except: pass
    raise ValueError(f"Could not extract JSON:\n{text[:300]}")


# ── 1. Intent decomposition ───────────────────────────────────────────────────
def decompose_intents(user_query: str, schema_context: str, num_visualizations: int, color_schema: str) -> list:
    system = "You are a BI analyst. Decompose user analytics requests into chart intents. Return ONLY valid JSON array."
    user = f"""
DATABASE SCHEMA:
{schema_context}

USER REQUEST: "{user_query}"
NUMBER OF VISUALIZATIONS: {num_visualizations}

Return a JSON array with exactly {num_visualizations} chart intents.
Each intent:
{{
  "kpi": "Short KPI name",
  "description": "What this chart shows",
  "x_axis": "column for x axis",
  "y_axis": "metric column",
  "aggregation": "SUM|COUNT|AVG|MAX|MIN",
  "group_by": "column to group by",
  "filters": "any WHERE conditions or empty string",
  "color_schema": "{color_schema}"
}}

Rules:
- Use actual column names from schema
- Make diverse meaningful intents
- If user asks fewer KPIs, infer additional related ones
"""
    return _extract_json(_chat(system, user))


# ── 2. SQL generation ─────────────────────────────────────────────────────────
def generate_sql(intent: dict, schema_context: str) -> str:
    system = "You are a SQL expert. Generate ONE valid SQL SELECT query. Return ONLY raw SQL, no markdown, no semicolon."
    user = f"""
DATABASE SCHEMA:
{schema_context}

CHART: {intent.get('kpi')}
X Axis: {intent.get('x_axis')}
Y Axis: {intent.get('y_axis')}
Aggregation: {intent.get('aggregation','SUM')}
Group By: {intent.get('group_by')}
Filters: {intent.get('filters','')}

Rules:
- Use proper JOINs if needed
- Alias aggregated columns clearly (AS total_sales, AS revenue etc)
- ORDER BY aggregated value DESC
- LIMIT 20 if many groups
- Use double quotes for names with spaces
- Return ONLY the SQL query
"""
    sql = _chat(system, user, temperature=0.1)
    sql = re.sub(r"`{3,}(?:sql)?", "", sql, flags=re.IGNORECASE).strip()
    # If the model emits extra commentary, keep the final SELECT statement only.
    m = re.search(r"(SELECT[\s\S]+)$", sql, flags=re.IGNORECASE)
    if m:
        sql = m.group(1).strip()
    return sql


# ── 3. Chart type selection ───────────────────────────────────────────────────
def select_chart_type(intent: dict, data_sample: list) -> str:
    group_by  = intent.get("group_by", "").lower()
    kpi_lower = intent.get("kpi", "").lower()
    n         = len(data_sample)

    time_kw = ["month","year","date","quarter","week","day","time","trend"]
    if any(k in group_by for k in time_kw) or any(k in kpi_lower for k in ["trend","over time","monthly","yearly"]):
        return "line" if n > 3 else "bar"
    if any(k in kpi_lower for k in ["share","proportion","percentage","distribution"]):
        return "pie" if n <= 6 else "bar"
    return "bar"


# ── 4. Insight generation ─────────────────────────────────────────────────────
def generate_insights(kpi: str, chart_data: list, chart_type: str) -> dict:
    system = "You are a BI analyst. Generate data-driven insights. Return ONLY valid JSON."
    data_str = json.dumps(chart_data[:5], default=str)
    user = f"""
CHART: {kpi}
TYPE: {chart_type}
DATA (sample):
{data_str}

Return JSON:
{{
  "descriptive":  "Key facts and specific numbers from the data (1-2 sentences)",
  "diagnostic":   "Why this pattern exists, root causes (1-2 sentences)",
  "predictive":   "What is likely to happen next based on trends (1-2 sentences)",
  "prescriptive": "Specific actionable recommendations (1-2 sentences)",
  "evaluative":   "Data quality and reliability notes (1 sentence)",
  "exploratory":  "Unexpected patterns or anomalies found (1-2 sentences)"
}}

Be specific with actual numbers from the data. Business-focused language.
"""
    result = _extract_json(_chat(system, user, temperature=0.5))
    result["kpi"] = kpi
    return result


# ── 5. Dashboard summary ──────────────────────────────────────────────────────
def generate_summary(dashboard_title: str, all_insights: list) -> str:
    system = "You are a BI analyst. Write a concise executive summary. 3-4 sentences max. Be specific with numbers."
    insights_str = json.dumps(all_insights[:3], default=str)
    user = f"""
DASHBOARD: {dashboard_title}
INSIGHTS: {insights_str}

Write 3-4 sentences covering:
1. Most important finding with specific numbers
2. Key trend or pattern
3. Top recommended action

Return ONLY the summary text.
"""
    return _chat(system, user, temperature=0.5)


# ── 6. Voice Q&A — FIXED with full data context ───────────────────────────────
def answer_voice_question(question: str, dashboard_context: list) -> dict:
    """
    Answer grounded in actual chart data.
    dashboard_context: list of {kpi, chart_type, data:[...rows...]}
    """
    system = """You are a BI analyst answering questions about dashboard data.
CRITICAL RULES:
- Always answer THE ACTUAL QUESTION asked — don't just describe the data
- Use specific numbers from the data provided
- If asked "why", give a reason/analysis, not just facts
- If asked about trends, explain the trend direction and magnitude
- Keep answers concise (2-4 sentences)
- Reference specific data points
Return ONLY valid JSON."""

    # Build rich context with actual data
    context_parts = []
    for chart in dashboard_context:
        kpi  = chart.get("kpi","")
        data = chart.get("data",[])
        if data:
            context_parts.append(f"\nChart: {kpi}\nData: {json.dumps(data[:15], default=str)}")
    context_str = "\n".join(context_parts)

    user = f"""
QUESTION: "{question}"

DASHBOARD DATA:
{context_str}

Answer the question directly and specifically using the data above.
If asked "why", analyze and explain the reason based on data patterns.
If asked about a drop/increase, calculate the actual change and explain it.

Return JSON:
{{
  "answer": "Direct answer to the question with specific numbers and analysis",
  "referenced_charts": ["list of chart names used to answer"]
}}
"""
    result = _extract_json(_chat(system, user, temperature=0.3))
    return result
