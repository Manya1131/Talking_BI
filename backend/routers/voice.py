"""
voice.py router
Handles voice-based Q&A on dashboard data.
"""

from fastapi import APIRouter, HTTPException
from models.backend_schemas import VoiceQueryRequest, VoiceQueryResponse
from services import backend_groq_service as groq_service

router = APIRouter(prefix="/api/voice", tags=["Voice Q&A"])


@router.post("/ask", response_model=VoiceQueryResponse)
def ask_question(request: VoiceQueryRequest):
    """
    Answer a natural language question about the current dashboard.
    
    The frontend sends:
    - The transcribed voice text (question)
    - The current dashboard chart data as context
    
    Groq answers grounded in actual data values.
    
    Example request:
    {
      "session_id": "abc-123",
      "question": "Which region has the highest sales?",
      "dashboard_context": [
        {
          "kpi": "Sales by Region",
          "data": [{"region": "West", "sales": 725458}, ...]
        }
      ]
    }
    """
    try:
        result = groq_service.answer_voice_question(
            question=request.question,
            dashboard_context=request.dashboard_context
        )
        return VoiceQueryResponse(
            question=request.question,
            answer=result.get("answer", "Could not generate answer."),
            referenced_charts=result.get("referenced_charts", [])
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice Q&A failed: {str(e)}")
