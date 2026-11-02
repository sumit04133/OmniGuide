from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator, ConfigDict


class BoundingBox(BaseModel):
    ymin: float = Field(..., description="Top coordinate (0.0 to 100.0%)")
    xmin: float = Field(..., description="Left coordinate (0.0 to 100.0%)")
    ymax: float = Field(..., description="Bottom coordinate (0.0 to 100.0%)")
    xmax: float = Field(..., description="Right coordinate (0.0 to 100.0%)")

    @field_validator("ymin", "xmin", "ymax", "xmax", mode="before")
    @classmethod
    def clamp_coordinate(cls, v: Any) -> float:
        try:
            val = float(v)
            if val > 100.0 and val <= 1000.0:
                val = val / 10.0
            return max(0.0, min(100.0, round(val, 2)))
        except (ValueError, TypeError):
            return 0.0


class AssetFindingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    category: str
    severity: str
    extracted_text: str
    explanation: str
    suggested_fix: str
    guideline_clause_identifier: Optional[str] = None
    guideline_clause_text: Optional[str] = None
    guideline_document_name: Optional[str] = None
    guideline_page_number: Optional[int] = None
    evidence_tier: str = "VERIFIED"
    evidence_status: str = "verified"
    evidence_provenance: Optional[Dict[str, Any]] = None
    box_ymin: Optional[float] = None
    box_xmin: Optional[float] = None
    box_ymax: Optional[float] = None
    box_xmax: Optional[float] = None


class AssetAuditResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    mime_type: str
    file_size_bytes: int
    image_width: int
    image_height: int
    brand_name: str
    target_channel: str
    headline_text: Optional[str] = None
    supporting_text: Optional[str] = None
    disclaimer_text: Optional[str] = None
    disclaimer_ratio: Optional[float] = None
    disclaimer_status: str
    disclaimer_threshold: float
    overall_status: str
    analysis_mode: str
    image_data_url: Optional[str] = None
    created_at: datetime
    findings: List[AssetFindingResponse] = Field(default_factory=list)


class AssetAuditListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    mime_type: str
    image_width: int
    image_height: int
    brand_name: str
    overall_status: str
    analysis_mode: str
    findings_count: int
    high_severity_count: int
    disclaimer_status: str
    created_at: datetime
