import json
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.guideline import ApprovedFact
from app.models.review import Review, Finding, ReviewAction
from app.schemas.review import (
    ReviewCreate,
    ReviewResponse,
    ReviewListItem,
    FindingDecisionUpdate,
    ReviewContentUpdate
)
from app.schemas.analysis import AIFindingItem
from app.services.retrieval import guideline_retriever
from app.services.rule_engine import rule_engine
from app.services.gemini_service import gemini_service, GeminiServiceError
from app.services.evidence_validator import evidence_validator
from app.services.review_reporter import generate_review_report_markdown, generate_review_report_json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def start_review(payload: ReviewCreate, db: Session = Depends(get_db)):
    """
    Core review orchestrator implementing the 5-stage hybrid analysis pipeline:
    1. Deterministic Rule Engine checks (regex, banned terms, superlatives, approved-facts metrics).
    2. Guideline Clause Retrieval (lexical BM25 weighted retrieval).
    3. AI Analysis via Google Gemini Flash (or deterministic fallback if key missing / mode=deterministic).
    4. Evidence Validation (verifying citations against real stored clauses, rejecting hallucinations).
    5. Synthesis of revised draft and persistent storage.
    """
    clean_content = payload.content.strip()
    if len(clean_content) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Submitted content must be at least 3 characters long."
        )

    # Fetch Approved Facts
    approved_facts_records = db.query(ApprovedFact).all()
    approved_facts_list = [f.fact_text for f in approved_facts_records]

    # Stage A: Deterministic checks
    deterministic_findings = rule_engine.run_checks(
        text=clean_content,
        approved_facts=approved_facts_list
    )

    # Stage B: Guideline retrieval (with hierarchical inheritance support)
    retrieved_clauses = guideline_retriever.retrieve_relevant_clauses(
        db=db,
        query_text=clean_content,
        top_k=5,
        document_id=payload.guideline_document_id,
        scope=payload.policy_scope
    )

    # Stage C: AI Analysis or Deterministic Fallback
    final_findings: List[AIFindingItem] = []
    revised_draft = clean_content
    effective_analysis_mode = payload.analysis_mode or "hybrid"
    is_compliant = True

    if effective_analysis_mode == "hybrid" and gemini_service.is_configured():
        try:
            ai_result = gemini_service.analyze_marketing_content(
                content=clean_content,
                content_type=payload.content_type,
                retrieved_clauses=retrieved_clauses,
                approved_facts=approved_facts_list,
                campaign_context=payload.campaign_context
            )
            # Combine AI findings with deterministic findings (deduplicating by excerpt)
            existing_excerpts = set()
            for f in ai_result.findings:
                clean_exc = f.original_excerpt.lower().strip()
                if clean_exc not in existing_excerpts:
                    final_findings.append(f)
                    existing_excerpts.add(clean_exc)

            for df in deterministic_findings:
                clean_exc = df.original_excerpt.lower().strip()
                if clean_exc not in existing_excerpts:
                    final_findings.append(df)
                    existing_excerpts.add(clean_exc)

            revised_draft = ai_result.revised_draft
            is_compliant = ai_result.is_compliant and len(final_findings) == 0

        except GeminiServiceError as ge:
            logger.warning(f"AI provider failed; falling back to deterministic-only review: {ge}")
            effective_analysis_mode = "deterministic_fallback"
            final_findings = deterministic_findings
            # Apply deterministic replacements to build draft
            revised_draft = _build_deterministic_revised_draft(clean_content, final_findings)
            is_compliant = len(final_findings) == 0
    else:
        # Deterministic-only review
        effective_analysis_mode = "deterministic"
        final_findings = deterministic_findings
        revised_draft = _build_deterministic_revised_draft(clean_content, final_findings)
        is_compliant = len(final_findings) == 0

    # Stage D: Evidence Validation
    validated_findings = evidence_validator.validate_findings(db=db, findings=final_findings)

    # Determine overall review status
    if not validated_findings:
        overall_status = "compliant"
    else:
        has_high_severity = any(f.severity == "High" for f in validated_findings)
        overall_status = "flagged" if has_high_severity else "needs_review"

    # Stage E: Persist to database
    review = Review(
        title=payload.title.strip(),
        content_type=payload.content_type,
        original_content=clean_content,
        revised_content=revised_draft,
        analysis_mode=effective_analysis_mode,
        overall_status=overall_status
    )
    db.add(review)
    db.flush()

    # Persist findings
    for vf in validated_findings:
        # Find document name and page number from retrieved clauses
        doc_name = None
        page_num = None
        for rc in retrieved_clauses:
            if rc.clause_identifier == vf.guideline_clause_identifier:
                doc_name = rc.document_name
                page_num = rc.page_number
                break

        provenance_str = json.dumps(vf.evidence_provenance) if vf.evidence_provenance else None
        finding_obj = Finding(
            review_id=review.id,
            category=vf.category,
            severity=vf.severity,
            original_excerpt=vf.original_excerpt,
            explanation=vf.explanation,
            guideline_clause_identifier=vf.guideline_clause_identifier,
            guideline_clause_text=vf.guideline_clause_text,
            guideline_document_name=doc_name,
            guideline_page_number=page_num,
            evidence_status=vf.evidence_status,
            evidence_tier=vf.evidence_tier or "VERIFIED",
            evidence_provenance=provenance_str,
            suggested_fix=vf.suggested_fix,
            decision_status="pending"
        )
        db.add(finding_obj)

    # Log initial action
    action = ReviewAction(
        review_id=review.id,
        action_type="create_review",
        new_value=f"Review initiated under {effective_analysis_mode} mode. Detected {len(validated_findings)} findings."
    )
    db.add(action)

    db.commit()
    db.refresh(review)

    return ReviewResponse.model_validate(review)


def _build_deterministic_revised_draft(original: str, findings: List[AIFindingItem]) -> str:
    """Builds a cleaned draft by replacing flagged excerpts with suggestions."""
    draft = original
    for f in findings:
        if f.original_excerpt and f.original_excerpt in draft:
            # If the suggested fix is an in-place string or substitution
            if len(f.suggested_fix) < 100 and not f.suggested_fix.startswith("Replace") and not f.suggested_fix.startswith("Verify"):
                draft = draft.replace(f.original_excerpt, f.suggested_fix)
            elif "premier" in f.suggested_fix.lower() or "leading" in f.suggested_fix.lower():
                draft = draft.replace(f.original_excerpt, "a leading")
            elif "high-performance" in f.suggested_fix.lower():
                draft = draft.replace(f.original_excerpt, "high-performance")
    return draft


@router.get("", response_model=List[ReviewListItem])
def list_reviews(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Lists all saved reviews with findings metrics."""
    reviews = db.query(Review).order_by(Review.created_at.desc()).offset(skip).limit(limit).all()
    results = []
    for r in reviews:
        findings_count = len(r.findings)
        high_severity_count = sum(1 for f in r.findings if f.severity == "High")
        resolved_count = sum(1 for f in r.findings if f.decision_status in ("accepted", "edited", "dismissed"))
        
        results.append(ReviewListItem(
            id=r.id,
            title=r.title,
            content_type=r.content_type,
            overall_status=r.overall_status,
            analysis_mode=r.analysis_mode,
            created_at=r.created_at,
            findings_count=findings_count,
            high_severity_count=high_severity_count,
            resolved_count=resolved_count
        ))
    return results


@router.get("/{review_id}", response_model=ReviewResponse)
def get_review(review_id: str, db: Session = Depends(get_db)):
    """Retrieves full details of a saved review including findings, citations, and actions."""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found.")
    return ReviewResponse.model_validate(review)


@router.patch("/{review_id}/findings/{finding_id}", response_model=ReviewResponse)
def update_finding_decision(
    review_id: str,
    finding_id: str,
    payload: FindingDecisionUpdate,
    db: Session = Depends(get_db)
):
    """
    Accepts, edits, or dismisses a finding.
    Updates the revised copy accordingly and persists an audit trail action.
    """
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found.")

    finding = db.query(Finding).filter(Finding.id == finding_id, Finding.review_id == review_id).first()
    if not finding:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found.")

    old_status = finding.decision_status
    new_status = payload.decision_status
    finding.decision_status = new_status

    action_details = f"Decision changed from '{old_status}' to '{new_status}' for finding '{finding.category}'"

    if new_status == "accepted":
        # Apply suggested fix to revised content if excerpt exists
        if finding.original_excerpt and finding.original_excerpt in review.revised_content:
            # If the suggested fix looks like a clean replacement
            clean_fix = finding.suggested_fix
            if not clean_fix.startswith("Replace") and not clean_fix.startswith("Verify"):
                review.revised_content = review.revised_content.replace(finding.original_excerpt, clean_fix)
            action_details += f". Applied suggested fix: '{clean_fix}'."

    elif new_status == "edited":
        if not payload.user_custom_fix:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_custom_fix is required when status is 'edited'.")
        finding.user_custom_fix = payload.user_custom_fix.strip()
        # Apply custom replacement to revised content
        if finding.original_excerpt in review.revised_content:
            review.revised_content = review.revised_content.replace(finding.original_excerpt, finding.user_custom_fix)
        action_details += f". Applied custom fix: '{finding.user_custom_fix}'."

    elif new_status == "dismissed":
        action_details += ". Finding dismissed by user."

    # Update overall status if all findings are resolved
    all_resolved = all(f.decision_status in ("accepted", "edited", "dismissed") for f in review.findings)
    if all_resolved:
        review.overall_status = "resolved"

    # Log action
    db.add(ReviewAction(
        review_id=review.id,
        finding_id=finding.id,
        action_type=new_status,
        previous_value=old_status,
        new_value=action_details
    ))

    db.commit()
    db.refresh(review)
    return ReviewResponse.model_validate(review)


@router.put("/{review_id}/content", response_model=ReviewResponse)
def update_revised_content(
    review_id: str,
    payload: ReviewContentUpdate,
    db: Session = Depends(get_db)
):
    """Allows manual editing of the revised marketing copy."""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found.")

    old_content = review.revised_content
    review.revised_content = payload.revised_content.strip()

    db.add(ReviewAction(
        review_id=review.id,
        action_type="update_content",
        previous_value=old_content,
        new_value="Manual content edit saved."
    ))

    db.commit()
    db.refresh(review)
    return ReviewResponse.model_validate(review)


@router.get("/{review_id}/report", response_class=PlainTextResponse)
def get_review_report(review_id: str, db: Session = Depends(get_db)):
    """Exports a structured markdown governance audit report for a single copy review."""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found.")
    return generate_review_report_markdown(review)


@router.get("/{review_id}/report/json", response_model=Dict[str, Any])
def get_review_report_json(review_id: str, db: Session = Depends(get_db)):
    """Exports a structured machine-readable JSON governance audit report matching persisted records."""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found.")
    return generate_review_report_json(review)


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(review_id: str, db: Session = Depends(get_db)):
    """Deletes a review and its findings."""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found.")
    db.delete(review)
    db.commit()
    return None
