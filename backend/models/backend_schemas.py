from pydantic import BaseModel
from typing import Optional, List, Any, Dict


class ConnectionRequest(BaseModel):
    connection_string: str

class TableInfo(BaseModel):
    table_name: str
    columns: List[Dict[str, str]]
    row_count: int

class ConnectionResponse(BaseModel):
    success: bool
    message: str
    tables: Optional[List[TableInfo]] = None
    session_id: str


class DashboardRequest(BaseModel):
    session_id: str
    user_query: str
    num_visualizations: int = 3
    color_schema: str = "default"
    dashboard_title: str = "My Dashboard"


class ChartData(BaseModel):
    kpi: str
    chart_type: str
    x_axis: str
    y_axis: str
    data: List[Dict[str, Any]]
    color_schema: str
    title: str
    sql_query: Optional[str] = None   # ← NEW


class ChartInsight(BaseModel):
    kpi: str
    descriptive: str
    diagnostic: str
    predictive: str
    prescriptive: str
    evaluative: str
    exploratory: str


class SQLQueryInfo(BaseModel):           # ← NEW
    kpi: str
    sql: str


class DashboardResponse(BaseModel):
    dashboard_title: str
    charts: List[ChartData]
    insights: List[ChartInsight]
    summary: str
    kpi_coverage: float
    total_kpis_requested: int
    total_kpis_generated: int
    sql_queries: Optional[List[SQLQueryInfo]] = []   # ← NEW


class VoiceQueryRequest(BaseModel):
    session_id: str
    question: str
    dashboard_context: List[Dict[str, Any]]

class VoiceQueryResponse(BaseModel):
    question: str
    answer: str
    referenced_charts: List[str]
