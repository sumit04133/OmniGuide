from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class GuidelineClauseBase(BaseModel):
    clause_identifier: str = Field(..., description="Stable identifier e.g. SEC-1.1 or RULE-02")
    clause_text: str = Field(..., description="Exact text of the guideline clause")
    section_heading: Optional[str] = Field(None, description="Optional heading or category")
    page_number: Optional[int] = Field(None, description="Source PDF page number")


class GuidelineClauseCreate(GuidelineClauseBase):
    pass


class GuidelineClauseResponse(GuidelineClauseBase):
    id: str
    document_id: str
    model_config = ConfigDict(from_attributes=True)


class GuidelineDocumentBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)


class GuidelineManualCreate(GuidelineDocumentBase):
    content: str = Field(..., min_length=10, description="Pasted guideline text content")
    approved_facts: Optional[List[str]] = Field(default_factory=list, description="Optional initial approved facts")
    policy_scope: Optional[str] = Field("corporate", description="'corporate', 'regional', or 'product_line'")
    parent_document_id: Optional[str] = Field(None, description="Optional parent policy document UUID for inheritance")
    region_code: Optional[str] = Field(None, description="e.g. GLOBAL, IN, US, EU")
    product_line: Optional[str] = Field(None, description="e.g. Enterprise Cloud, Retail App")


class GuidelineDocumentResponse(GuidelineDocumentBase):
    id: str
    filename: str
    is_demo: bool
    policy_scope: Optional[str] = "corporate"
    parent_document_id: Optional[str] = None
    region_code: Optional[str] = None
    product_line: Optional[str] = None
    created_at: datetime
    clause_count: Optional[int] = 0
    clauses: Optional[List[GuidelineClauseResponse]] = []
    model_config = ConfigDict(from_attributes=True)


class ApprovedFactBase(BaseModel):
    fact_text: str = Field(..., min_length=3)
    category: Optional[str] = Field(None, description="metric, certification, award, etc.")
    source_reference: Optional[str] = Field(None, description="e.g. Audit Report 2026, Q3 Financials")


class ApprovedFactCreate(ApprovedFactBase):
    pass


class ApprovedFactResponse(ApprovedFactBase):
    id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
