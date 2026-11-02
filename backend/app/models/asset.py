import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AssetAudit(Base):
    __tablename__ = "asset_audits"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    filename = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_size_bytes = Column(Integer, nullable=False, default=0)
    image_width = Column(Integer, nullable=False, default=0)
    image_height = Column(Integer, nullable=False, default=0)
    brand_name = Column(String(255), nullable=False, default="NovaForge")
    target_channel = Column(String(100), nullable=False, default="display_ad")

    # Extracted text analysis
    headline_text = Column(Text, nullable=True)
    supporting_text = Column(Text, nullable=True)
    disclaimer_text = Column(Text, nullable=True)

    # Disclaimer visibility heuristic: ratio = disclaimer_height / headline_height
    disclaimer_ratio = Column(Float, nullable=True)
    disclaimer_status = Column(String(50), nullable=False, default="not_detected")
    # "compliant", "warning", "violation", "not_detected"
    disclaimer_threshold = Column(Float, nullable=False, default=0.20)  # 20% minimum headline height heuristic

    overall_status = Column(String(50), nullable=False, default="needs_review")
    # "compliant", "needs_review", "flagged"
    analysis_mode = Column(String(50), nullable=False, default="hybrid")
    # "hybrid", "deterministic", "deterministic_fallback"

    image_data_url = Column(Text, nullable=True)  # Ephemeral Data URI for visual review display
    created_at = Column(DateTime, default=utc_now, nullable=False)

    findings = relationship(
        "AssetFinding",
        back_populates="asset",
        cascade="all, delete-orphan",
        order_by="AssetFinding.severity"
    )


class AssetFinding(Base):
    __tablename__ = "asset_findings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    asset_id = Column(String(36), ForeignKey("asset_audits.id", ondelete="CASCADE"), nullable=False)

    category = Column(String(100), nullable=False)
    # "unsupported_superlative", "banned_term", "disclaimer_visibility",
    # "missing_approved_source", "visual_claim", "brand_consistency"
    severity = Column(String(20), nullable=False)  # "High", "Medium", "Low"
    extracted_text = Column(Text, nullable=False)
    explanation = Column(Text, nullable=False)
    suggested_fix = Column(Text, nullable=False)

    # Citation details
    guideline_clause_identifier = Column(String(100), nullable=True)
    guideline_clause_text = Column(Text, nullable=True)
    guideline_document_name = Column(String(255), nullable=True)
    guideline_page_number = Column(Integer, nullable=True)

    # Evidence intelligence
    evidence_tier = Column(String(50), nullable=False, default="VERIFIED")
    # "VERIFIED", "UNSUPPORTED", "CONTRADICTED", "NEEDS_HUMAN_REVIEW"
    evidence_status = Column(String(50), nullable=False, default="verified")
    evidence_provenance = Column(Text, nullable=True)  # JSON-encoded provenance dictionary

    # Normalized Bounding Box Coordinates: [0.0 - 100.0] percentage of image
    box_ymin = Column(Float, nullable=True)
    box_xmin = Column(Float, nullable=True)
    box_ymax = Column(Float, nullable=True)
    box_xmax = Column(Float, nullable=True)

    asset = relationship("AssetAudit", back_populates="findings")
