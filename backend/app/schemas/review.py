from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class ReviewCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Review title or campaign name")
    content_type: str = Field(default="Marketing Copy", description="Social, Ad Copy, Press Release, Website Hero, Email, Blog")
    content: str = Field(..., min_length=3, description="Marketing content text to review")
    campaign_context: Optional[str] = Field(None, description="Optional target audience, market, or campaign goal")
    analysis_mode: Optional[str] = Field("hybrid", description="'hybrid' (AI + deterministic) or 'deterministic'")
    guideline_document_id: Optional[str] = Field(None, description="Optional specific guideline document ID to audit against with hierarchical inheritance")
    policy_scope: Optional[str] = Field(None, description="Optional policy scope filter (corporate, regional, product_line)")


class FindingDecisionUpdate(BaseModel):
    decision_status: str = Field(..., pattern="^(accepted|edited|dismissed|pending)$")
    user_custom_fix: Optional[str] = Field(None, description="Custom replacement text if edited")


class ReviewContentUpdate(BaseModel):
    revised_content: str = Field(..., description="Manually edited revised content")


class FindingResponse(BaseModel):
    id: str
    review_id: str
    category: str
    severity: str
    original_excerpt: str
    explanation: str
    guideline_clause_id: Optional[str] = None
    guideline_clause_identifier: Optional[str] = None
    guideline_clause_text: Optional[str] = None
    guideline_document_name: Optional[str] = None
    guideline_page_number: Optional[int] = None
    evidence_status: str
    evidence_tier: Optional[str] = "VERIFIED"
    evidence_provenance: Optional[str] = None
    suggested_fix: str
    decision_status: str
    user_custom_fix: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ReviewActionResponse(BaseModel):
    id: str
    review_id: str
    finding_id: Optional[str] = None
    action_type: str
    previous_value: Optional[str] = None
    new_value: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ReviewResponse(BaseModel):
    id: str
    title: str
    content_type: str
    original_content: str
    revised_content: str
    analysis_mode: str
    overall_status: str
    created_at: datetime
    updated_at: datetime
    findings: List[FindingResponse] = []
    actions: List[ReviewActionResponse] = []
    model_config = ConfigDict(from_attributes=True)


class ReviewListItem(BaseModel):
    id: str
    title: str
    content_type: str
    overall_status: str
    analysis_mode: str
    created_at: datetime
    findings_count: int = 0
    high_severity_count: int = 0
    resolved_count: int = 0
    model_config = ConfigDict(from_attributes=True)
