from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.regulatory_rulepacks import regulatory_rulepack_service

router = APIRouter(prefix="/regulatory", tags=["regulatory"])


class RulePackToggleRequest(BaseModel):
    enabled: bool = Field(..., description="True to enable the regulatory rule pack, False to disable")


@router.get("/packs", response_model=List[Dict[str, Any]])
def list_regulatory_packs():
    """
    Returns all registered statutory and industry regulatory rule packs:
    - US FTC Truth in Advertising & Endorsements
    - Indian ASCI Self-Regulation Advertising Code
    - EU Digital Services Act (DSA) & Unfair Commercial Practices
    """
    return regulatory_rulepack_service.get_all_packs()


@router.post("/packs/{pack_id}/toggle", response_model=Dict[str, Any])
def toggle_regulatory_pack(pack_id: str, payload: RulePackToggleRequest):
    """Enables or disables a regulatory rule pack in the active governance retrieval corpus."""
    try:
        return regulatory_rulepack_service.toggle_pack(pack_id=pack_id, enabled=payload.enabled)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
