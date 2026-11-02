import json
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import PlainTextResponse, JSONResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.asset import AssetAudit, AssetFinding
from app.schemas.asset import (
    AssetAuditResponse,
    AssetAuditListItem,
    AssetFindingResponse
)
from app.services.asset_governance import asset_governance_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assets", tags=["assets"])


@router.post("/audit", response_model=AssetAuditResponse, status_code=status.HTTP_201_CREATED)
async def audit_asset(
    file: UploadFile = File(...),
    brand_name: str = Form("NovaForge"),
    target_channel: str = Form("display_ad"),
    disclaimer_ratio_threshold: float = Form(0.20),
    db: Session = Depends(get_db)
):
    """
    Multimodal Creative Asset Governance Endpoint.
    Audits visual banners, display ads, and promotional creatives (PNG, JPEG, WebP).
    Extracts visible claims, headlines, and fine-print disclaimers;
    verifies against the Approved Facts Library and brand guidelines;
    evaluates disclaimer-to-headline height ratio heuristic;
    and computes visual bounding-box overlays with severity indicators.
    """
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file uploaded. Please select an image file (PNG, JPEG, or WebP)."
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty. Please select a valid image file."
        )

    try:
        audit = asset_governance_service.audit_creative_asset(
            db=db,
            file_bytes=file_bytes,
            filename=file.filename,
            content_type=file.content_type,
            brand_name=brand_name.strip() or "NovaForge",
            target_channel=target_channel.strip() or "display_ad",
            disclaimer_threshold=disclaimer_ratio_threshold
        )
        return _build_audit_response(audit)
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        logger.error(f"Asset audit unexpected failure: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Asset governance evaluation failed: {str(e)}"
        )


@router.get("", response_model=List[AssetAuditListItem])
def list_asset_audits(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Lists historical creative asset audits."""
    audits = (
        db.query(AssetAudit)
        .order_by(AssetAudit.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    items = []
    for a in audits:
        findings_count = len(a.findings)
        high_count = sum(1 for f in a.findings if f.severity == "High")
        items.append(AssetAuditListItem(
            id=a.id,
            filename=a.filename,
            mime_type=a.mime_type,
            image_width=a.image_width,
            image_height=a.image_height,
            brand_name=a.brand_name,
            overall_status=a.overall_status,
            analysis_mode=a.analysis_mode,
            findings_count=findings_count,
            high_severity_count=high_count,
            disclaimer_status=a.disclaimer_status,
            created_at=a.created_at
        ))
    return items


@router.get("/{id}", response_model=AssetAuditResponse)
def get_asset_audit(id: str, db: Session = Depends(get_db)):
    """Retrieves full visual audit details including bounding boxes and provenance."""
    audit = db.query(AssetAudit).filter(AssetAudit.id == id).first()
    if not audit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset audit not found.")
    return _build_audit_response(audit)


@router.get("/{id}/report", response_class=PlainTextResponse)
def get_asset_report_markdown(id: str, db: Session = Depends(get_db)):
    """Generates an executive Markdown audit report for the creative asset."""
    audit = db.query(AssetAudit).filter(AssetAudit.id == id).first()
    if not audit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset audit not found.")

    lines = [
        f"# OmniGuide Creative Asset Governance Audit Report",
        f"**Asset:** `{audit.filename}`",
        f"**Audit ID:** `{audit.id}`",
        f"**Date:** {audit.created_at.strftime('%Y-%m-%d %H:%M:%S UTC')}",
        f"**Dimensions:** {audit.image_width} x {audit.image_height} px ({audit.mime_type})",
        f"**Brand:** {audit.brand_name} | **Channel:** {audit.target_channel}",
        f"**Overall Status:** `{audit.overall_status.upper()}` | **Engine Mode:** `{audit.analysis_mode}`",
        "",
        "---",
        "",
        "## Visual Copy Breakdown",
        f"- **Headline:** {audit.headline_text or '*(None extracted)*'}",
        f"- **Supporting Copy:** {audit.supporting_text or '*(None extracted)*'}",
        f"- **Disclaimer Text:** {audit.disclaimer_text or '*(None extracted)*'}",
        f"- **Disclaimer Height Ratio:** {f'{audit.disclaimer_ratio * 100:.1f}%' if audit.disclaimer_ratio else 'N/A'} (Threshold: {audit.disclaimer_threshold * 100:.0f}%)",
        f"- **Disclaimer Status:** `{audit.disclaimer_status.upper()}`",
        "",
        "---",
        "",
        f"## Grounded Findings ({len(audit.findings)} detected)",
        ""
    ]

    if not audit.findings:
        lines.append("No compliance or guideline violations detected. Asset is compliant for distribution.")
    else:
        for idx, f in enumerate(audit.findings, 1):
            lines.append(f"### Finding {idx}: {f.category} [{f.severity}]")
            lines.append(f"- **Visible Text:** \"{f.extracted_text}\"")
            lines.append(f"- **Explanation:** {f.explanation}")
            lines.append(f"- **Suggested Remediation:** {f.suggested_fix}")
            lines.append(f"- **Evidence Tier:** `{f.evidence_tier}` ({f.evidence_status})")
            if f.guideline_clause_identifier:
                lines.append(f"- **Policy Citation:** `{f.guideline_clause_identifier}`")
            if f.box_ymin is not None:
                lines.append(f"- **Bounding Box (Normalized %):** Top {f.box_ymin}%, Left {f.box_xmin}%, Bottom {f.box_ymax}%, Right {f.box_xmax}%")
            lines.append("")

    return "\n".join(lines)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset_audit(id: str, db: Session = Depends(get_db)):
    """Deletes an asset audit and associated findings."""
    audit = db.query(AssetAudit).filter(AssetAudit.id == id).first()
    if not audit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset audit not found.")
    db.delete(audit)
    db.commit()
    return None


def _build_audit_response(audit: AssetAudit) -> AssetAuditResponse:
    findings_resp = []
    for f in audit.findings:
        prov = None
        if f.evidence_provenance:
            try:
                prov = json.loads(f.evidence_provenance)
            except Exception:
                prov = None

        findings_resp.append(AssetFindingResponse(
            id=f.id,
            category=f.category,
            severity=f.severity,
            extracted_text=f.extracted_text,
            explanation=f.explanation,
            suggested_fix=f.suggested_fix,
            guideline_clause_identifier=f.guideline_clause_identifier,
            guideline_clause_text=f.guideline_clause_text,
            guideline_document_name=f.guideline_document_name,
            guideline_page_number=f.guideline_page_number,
            evidence_tier=f.evidence_tier,
            evidence_status=f.evidence_status,
            evidence_provenance=prov,
            box_ymin=f.box_ymin,
            box_xmin=f.box_xmin,
            box_ymax=f.box_ymax,
            box_xmax=f.box_xmax
        ))

    return AssetAuditResponse(
        id=audit.id,
        filename=audit.filename,
        mime_type=audit.mime_type,
        file_size_bytes=audit.file_size_bytes,
        image_width=audit.image_width,
        image_height=audit.image_height,
        brand_name=audit.brand_name,
        target_channel=audit.target_channel,
        headline_text=audit.headline_text,
        supporting_text=audit.supporting_text,
        disclaimer_text=audit.disclaimer_text,
        disclaimer_ratio=audit.disclaimer_ratio,
        disclaimer_status=audit.disclaimer_status,
        disclaimer_threshold=audit.disclaimer_threshold,
        overall_status=audit.overall_status,
        analysis_mode=audit.analysis_mode,
        image_data_url=audit.image_data_url,
        created_at=audit.created_at,
        findings=findings_resp
    )
