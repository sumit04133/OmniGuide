import hashlib
import hmac
import json
import logging
import os
import time
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.guideline import ApprovedFact, GuidelineClause
from app.models.integration import WebhookEventLog
from app.schemas.analysis import AIFindingItem
from app.services.retrieval import guideline_retriever
from app.services.rule_engine import rule_engine
from app.services.evidence_validator import evidence_validator
from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations", tags=["integrations"])

# In-memory idempotency cache for webhooks: set of processed event_ids (with cleanup)
_PROCESSED_WEBHOOK_EVENTS: Dict[str, float] = {}


def _cleanup_idempotency_cache():
    now = time.time()
    expired = [k for k, t in _PROCESSED_WEBHOOK_EVENTS.items() if now - t > 86400]
    for k in expired:
        _PROCESSED_WEBHOOK_EVENTS.pop(k, None)


# ---------------------------------------------------------------------------
# FIGMA SELECTED-TEXT AUDIT INTEGRATION
# ---------------------------------------------------------------------------

class FigmaAuditRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Selected text content from Figma node")
    node_name: Optional[str] = Field("Selected Layer", description="Name of the selected Figma layer or frame")
    component_type: Optional[str] = Field("banner", description="Type of component: banner, button, body, card")
    campaign_context: Optional[str] = Field(None, description="Optional marketing campaign context")


class FigmaFindingItem(BaseModel):
    category: str
    severity: str
    original_excerpt: str
    explanation: str
    suggested_fix: str
    guideline_clause_identifier: Optional[str] = None
    evidence_tier: str = "VERIFIED"


class FigmaAuditResponse(BaseModel):
    status: str  # "compliant", "needs_review", "flagged"
    node_name: str
    total_findings: int
    findings: List[FigmaFindingItem]
    suggested_rewrites: List[str]
    compliance_score: int  # 0 to 100
    checked_at: str


@router.post("/figma/audit", response_model=FigmaAuditResponse)
def audit_figma_selection(payload: FigmaAuditRequest, db: Session = Depends(get_db)):
    """
    Figma Selected-Text Governance Endpoint.
    Audits selected copy from Figma canvas layers in real time,
    checks against stored guidelines and Approved Facts,
    and returns intent-preserving rewrites for in-canvas replacement.
    """
    clean_text = payload.text.strip()
    if not clean_text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    approved_facts = [f.fact_text for f in db.query(ApprovedFact).all()]

    # 1. Deterministic checks
    deterministic_findings = rule_engine.run_checks(text=clean_text, approved_facts=approved_facts)

    # 2. Guideline retrieval
    retrieved = guideline_retriever.retrieve_relevant_clauses(db=db, query_text=clean_text, top_k=3)

    # 3. Validate evidence
    validated = evidence_validator.validate_findings(db=db, findings=deterministic_findings)

    # Calculate status and score
    high_count = sum(1 for f in validated if f.severity == "High")
    med_count = sum(1 for f in validated if f.severity == "Medium")

    score = max(0, 100 - (high_count * 25) - (med_count * 10))
    if high_count > 0:
        overall_status = "flagged"
    elif med_count > 0:
        overall_status = "needs_review"
    else:
        overall_status = "compliant"

    # Generate compliant rewrites
    rewrites = []
    draft = clean_text
    for f in validated:
        if f.original_excerpt in draft and f.suggested_fix:
            draft = draft.replace(f.original_excerpt, f.suggested_fix)
    if draft != clean_text:
        rewrites.append(draft)

    findings_resp = [
        FigmaFindingItem(
            category=f.category,
            severity=f.severity,
            original_excerpt=f.original_excerpt,
            explanation=f.explanation,
            suggested_fix=f.suggested_fix,
            guideline_clause_identifier=f.guideline_clause_identifier,
            evidence_tier=f.evidence_tier or "VERIFIED"
        )
        for f in validated
    ]

    import datetime
    return FigmaAuditResponse(
        status=overall_status,
        node_name=payload.node_name or "Selected Layer",
        total_findings=len(findings_resp),
        findings=findings_resp,
        suggested_rewrites=rewrites,
        compliance_score=score,
        checked_at=datetime.datetime.now(datetime.timezone.utc).isoformat()
    )


# ---------------------------------------------------------------------------
# HEADLESS CMS WEBHOOK INTEGRATION (Contentful & Strapi)
# ---------------------------------------------------------------------------

class CMSWebhookResponse(BaseModel):
    event_id: str
    provider: str
    status: str  # "processed", "duplicate_skipped", "flagged", "compliant"
    audit_decision: str  # "approved", "blocked", "warning"
    blocking_violations_count: int
    findings_count: int
    message: str


@router.post("/cms/webhook", response_model=CMSWebhookResponse)
async def receive_cms_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_omniguide_webhook_secret: Optional[str] = Header(None, alias="X-OmniGuide-Webhook-Secret"),
    x_contentful_topic: Optional[str] = Header(None, alias="X-Contentful-Topic"),
    x_webhook_signature: Optional[str] = Header(None, alias="X-Webhook-Signature")
):
    """
    Secure Headless CMS Webhook Receiver.
    Supports Contentful and Strapi content publication/update events.
    Verifies secrets and HMAC signatures, guarantees idempotency against duplicate delivery,
    and executes brand governance review before permitting publication.
    """
    _cleanup_idempotency_cache()

    # Secret / Signature Authentication
    expected_secret = os.environ.get("OMNIGUIDE_WEBHOOK_SECRET", "")
    if expected_secret:
        # Check header secret or HMAC signature
        is_secret_valid = (x_omniguide_webhook_secret == expected_secret)
        is_sig_valid = False
        body_bytes = await request.body()

        if x_webhook_signature:
            computed = hmac.new(expected_secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()
            is_sig_valid = hmac.compare_digest(computed, x_webhook_signature.replace("sha256=", ""))

        if not is_secret_valid and not is_sig_valid:
            logger.warning("Unauthorized CMS webhook submission: invalid secret or signature.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized webhook request: invalid webhook secret or HMAC signature."
            )
    else:
        body_bytes = await request.body()

    # Parse JSON payload
    try:
        payload = json.loads(body_bytes.decode("utf-8"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed JSON payload received."
        )

    # Identify provider and event details
    event_id = None
    provider = "unknown"
    content_pieces: List[str] = []

    # 1. Contentful format detection
    if x_contentful_topic or ("sys" in payload and "type" in payload.get("sys", {})):
        provider = "contentful"
        event_id = payload.get("sys", {}).get("id") or str(time.time())
        fields = payload.get("fields", {})
        for field_name, field_val in fields.items():
            if isinstance(field_val, dict):
                # Localized content e.g. {"en-US": "text"}
                for loc_val in field_val.values():
                    if isinstance(loc_val, str):
                        content_pieces.append(loc_val)
            elif isinstance(field_val, str):
                content_pieces.append(field_val)

    # 2. Strapi format detection
    elif "event" in payload and "model" in payload:
        provider = "strapi"
        event_id = str(payload.get("entry", {}).get("id") or time.time())
        entry = payload.get("entry", {})
        for k, v in entry.items():
            if isinstance(v, str) and len(v) > 5 and k not in ("createdAt", "updatedAt", "publishedAt"):
                content_pieces.append(v)

    # 3. Generic CMS payload
    else:
        provider = "generic_cms"
        event_id = str(payload.get("id") or time.time())
        for k, v in payload.items():
            if isinstance(v, str) and len(v) > 5:
                content_pieces.append(v)

    if not event_id:
        event_id = hashlib.md5(body_bytes).hexdigest()

    # Idempotency check:
    # 1. Fast in-memory check
    # 2. Durable database check against webhook_event_logs table (persists across restarts)
    existing_log = None
    if event_id in _PROCESSED_WEBHOOK_EVENTS:
        existing_log = db.query(WebhookEventLog).filter_by(event_id=event_id).first()
    else:
        existing_log = db.query(WebhookEventLog).filter_by(event_id=event_id).first()
        if existing_log:
            _PROCESSED_WEBHOOK_EVENTS[event_id] = existing_log.created_at.timestamp()

    if existing_log:
        return CMSWebhookResponse(
            event_id=event_id,
            provider=existing_log.provider or provider,
            status="duplicate_skipped",
            audit_decision=existing_log.audit_decision or "approved",
            blocking_violations_count=existing_log.blocking_violations_count or 0,
            findings_count=existing_log.findings_count or 0,
            message="Duplicate webhook delivery detected (persisted in database audit log). Previously audited and skipped."
        )

    # Record event in cache
    _PROCESSED_WEBHOOK_EVENTS[event_id] = time.time()

    # If no content extracted, return warning
    full_text = "\n\n".join(content_pieces).strip()
    if not full_text:
        return CMSWebhookResponse(
            event_id=event_id,
            provider=provider,
            status="processed",
            audit_decision="approved",
            blocking_violations_count=0,
            findings_count=0,
            message="No textual marketing content identified in payload."
        )

    # Run governance audit
    approved_facts = [f.fact_text for f in db.query(ApprovedFact).all()]
    deterministic_findings = rule_engine.run_checks(text=full_text, approved_facts=approved_facts)
    validated = evidence_validator.validate_findings(db=db, findings=deterministic_findings)

    high_count = sum(1 for f in validated if f.severity == "High")
    total_count = len(validated)

    if high_count > 0:
        decision = "blocked"
        audit_status = "flagged"
        msg = f"CMS content rejected by OmniGuide Strict Gate: {high_count} blocking violations found."
    elif total_count > 0:
        decision = "warning"
        audit_status = "needs_review"
        msg = f"CMS content approved with warnings: {total_count} advisory findings detected."
    else:
        decision = "approved"
        audit_status = "compliant"
        msg = "CMS content verified compliant with corporate guidelines and approved facts."

    # Persist event log to database for durable idempotency across server restarts
    try:
        log_entry = WebhookEventLog(
            event_id=event_id,
            provider=provider,
            audit_decision=decision,
            blocking_violations_count=high_count,
            findings_count=total_count,
            payload_summary=full_text[:500] if full_text else None
        )
        db.add(log_entry)
        db.commit()
    except Exception as log_err:
        logger.warning(f"Failed to persist webhook event log: {log_err}")
        db.rollback()

    return CMSWebhookResponse(
        event_id=event_id,
        provider=provider,
        status=audit_status,
        audit_decision=decision,
        blocking_violations_count=high_count,
        findings_count=total_count,
        message=msg
    )
