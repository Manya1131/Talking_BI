"""
dashboard.py router
Handles dashboard generation endpoint.
"""

from fastapi import APIRouter, HTTPException
from models.backend_schemas import DashboardRequest, DashboardResponse
from services.backend_dashboard_builder import build_dashboard

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.post("/generate", response_model=DashboardResponse)
def generate_dashboard(request: DashboardRequest):
    """
    Generate a full BI dashboard from user input.
    
    Flow:
    1. Decompose user query into chart intents (Groq)
    2. Generate SQL for each intent (Groq)
    3. Execute queries on connected DB
    4. Select appropriate chart types
    5. Generate 6-type insights per chart (Groq)
    6. Generate executive summary (Groq)
    7. Calculate KPI coverage %
    
    Example request:
    {
      "session_id": "abc-123",
      "user_query": "revenue by category, sales by region, monthly profit trend",
      "num_visualizations": 4,
      "color_schema": "blue",
      "dashboard_title": "Superstore Analytics 2024"
    }
    """
    try:
        result = build_dashboard(request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dashboard generation failed: {str(e)}")
