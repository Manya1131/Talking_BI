"""
dashboard_builder.py — Full pipeline, returns SQL queries too
"""
import time
from services.db_connector import get_schema_context, execute_query
from services import backend_groq_service as groq_service
from models.backend_schemas import DashboardRequest, DashboardResponse, ChartData, ChartInsight
import decimal, datetime


def _serialize(data: list) -> list:
    clean = []
    for row in data:
        r = {}
        for k, v in row.items():
            if isinstance(v, decimal.Decimal): r[k] = float(v)
            elif isinstance(v, (datetime.date, datetime.datetime)): r[k] = str(v)
            elif v is None: r[k] = None
            else: r[k] = v
        clean.append(r)
    return clean


def build_dashboard(request: DashboardRequest):
    session_id   = request.session_id
    color_schema = request.color_schema

    schema_ctx = get_schema_context(session_id)
    intents    = groq_service.decompose_intents(
        request.user_query, schema_ctx, request.num_visualizations, color_schema
    )

    charts      = []
    raw_insights= []
    sql_queries = []   # ← collect SQL queries
    ok          = 0

    for intent in intents:
        kpi = intent.get("kpi", "Unknown")
        try:
            sql = groq_service.generate_sql(intent, schema_ctx)
            intent["sql_query"] = sql
            sql_queries.append({"kpi": kpi, "sql": sql})   # ← store it

            data = execute_query(session_id, sql)
            if not data:
                print(f"⚠️ No data: {kpi}")
                continue

            chart_type = groq_service.select_chart_type(intent, data)
            clean_data = _serialize(data)

            charts.append(ChartData(
                kpi=kpi, chart_type=chart_type,
                x_axis=intent.get("x_axis","x"),
                y_axis=intent.get("y_axis","y"),
                data=clean_data, color_schema=color_schema,
                title=kpi,
                sql_query=sql   # ← pass SQL to chart
            ))

            ins = groq_service.generate_insights(kpi, clean_data, chart_type)
            raw_insights.append(ins)
            ok += 1

            time.sleep(1.5)  # rate limit protection

        except Exception as e:
            print(f"❌ {kpi}: {e}")
            continue

    insights = [
        ChartInsight(
            kpi=ins.get("kpi",""),
            descriptive=ins.get("descriptive",""),
            diagnostic=ins.get("diagnostic",""),
            predictive=ins.get("predictive",""),
            prescriptive=ins.get("prescriptive",""),
            evaluative=ins.get("evaluative",""),
            exploratory=ins.get("exploratory",""),
        ) for ins in raw_insights
    ]

    summary = ""
    if raw_insights:
        summary = groq_service.generate_summary(request.dashboard_title, raw_insights)

    total = request.num_visualizations
    kpi_coverage = round((ok/total)*100, 1) if total > 0 else 0

    return DashboardResponse(
        dashboard_title=request.dashboard_title,
        charts=charts,
        insights=insights,
        summary=summary,
        kpi_coverage=kpi_coverage,
        total_kpis_requested=total,
        total_kpis_generated=ok,
        sql_queries=sql_queries,  # ← return to frontend
    )
