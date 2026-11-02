import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.guideline import GuidelineDocument, GuidelineClause, ApprovedFact
from app.schemas.guideline import (
    GuidelineDocumentResponse,
    GuidelineManualCreate,
    ApprovedFactCreate,
    ApprovedFactResponse
)
from app.services.pdf_processor import (
    extract_text_from_pdf_bytes,
    ScannedPDFError,
    InvalidPDFError
)
from app.services.clause_splitter import (
    extract_clauses_from_pdf_pages,
    split_text_into_clauses
)

router = APIRouter(prefix="/guidelines", tags=["guidelines"])


@router.post("/upload", response_model=GuidelineDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_guideline_pdf(
    title: str = Form(..., min_length=1, max_length=255),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Uploads a text-based PDF guideline, extracts text using PyMuPDF page-by-page,
    splits clauses with stable identifiers and page numbers, and stores them in the database.
    Rejects scanned/image-only PDFs with an explicit OCR limitation message.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload a standard PDF (.pdf) document."
        )

    # Read and check size
    content = await file.read()
    max_bytes = settings.UPLOAD_MAX_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds the maximum permitted limit of {settings.UPLOAD_MAX_SIZE_MB}MB."
        )

    try:
        extracted = extract_text_from_pdf_bytes(content, filename=file.filename)
    except ScannedPDFError as spe:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(spe)
        )
    except InvalidPDFError as ipe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ipe)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error extracting PDF contents: {str(e)}"
        )

    # Extract identifiable clauses with page numbers
    clauses = extract_clauses_from_pdf_pages(extracted.pages)
    if not clauses:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not identify distinct clauses or rules from this document. Please check the text formatting."
        )

    # Persist Document
    doc = GuidelineDocument(
        title=title.strip(),
        filename=file.filename,
        extracted_text=extracted.full_text,
        is_demo=False
    )
    db.add(doc)
    db.flush()

    # Persist Clauses
    for c in clauses:
        clause_obj = GuidelineClause(
            document_id=doc.id,
            clause_identifier=c.clause_identifier,
            clause_text=c.clause_text,
            section_heading=c.section_heading,
            page_number=c.page_number
        )
        db.add(clause_obj)

    db.commit()
    db.refresh(doc)

    response = GuidelineDocumentResponse.model_validate(doc)
    response.clause_count = len(doc.clauses)
    return response


@router.post("/manual", response_model=GuidelineDocumentResponse, status_code=status.HTTP_201_CREATED)
def create_manual_guideline(
    payload: GuidelineManualCreate,
    db: Session = Depends(get_db)
):
    """
    Creates a new guideline document from pasted raw text, automatically splitting clauses.
    """
    clauses = split_text_into_clauses(payload.content, default_page_number=1, doc_prefix="MANUAL")
    if not clauses:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please provide sufficient guideline content with clear sections or rules."
        )

    # Validate parent reference if provided
    if payload.parent_document_id:
        parent = db.query(GuidelineDocument).filter(GuidelineDocument.id == payload.parent_document_id).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Specified parent policy document '{payload.parent_document_id}' does not exist."
            )

    doc = GuidelineDocument(
        title=payload.title.strip(),
        filename="manual_entry.txt",
        extracted_text=payload.content,
        policy_scope=payload.policy_scope or "corporate",
        parent_document_id=payload.parent_document_id,
        region_code=payload.region_code,
        product_line=payload.product_line,
        is_demo=False
    )
    db.add(doc)
    db.flush()

    for c in clauses:
        db.add(GuidelineClause(
            document_id=doc.id,
            clause_identifier=c.clause_identifier,
            clause_text=c.clause_text,
            section_heading=c.section_heading,
            page_number=c.page_number
        ))

    # Add optional initial approved facts
    if payload.approved_facts:
        for f in payload.approved_facts:
            if f.strip():
                db.add(ApprovedFact(
                    fact_text=f.strip(),
                    category="general",
                    source_reference=payload.title
                ))

    db.commit()
    db.refresh(doc)

    response = GuidelineDocumentResponse.model_validate(doc)
    response.clause_count = len(doc.clauses)
    return response


@router.get("", response_model=List[GuidelineDocumentResponse])
def list_guidelines(db: Session = Depends(get_db)):
    """Lists all stored guideline documents with clause counts."""
    docs = db.query(GuidelineDocument).order_by(GuidelineDocument.created_at.desc()).all()
    results = []
    for d in docs:
        item = GuidelineDocumentResponse.model_validate(d)
        item.clause_count = len(d.clauses)
        results.append(item)
    return results


@router.get("/{document_id}", response_model=GuidelineDocumentResponse)
def get_guideline(document_id: str, db: Session = Depends(get_db)):
    """Retrieves a single guideline document and all its individual clauses."""
    doc = db.query(GuidelineDocument).filter(GuidelineDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guideline document not found.")
    
    item = GuidelineDocumentResponse.model_validate(doc)
    item.clause_count = len(doc.clauses)
    return item


@router.get("/hierarchy")
def get_guideline_hierarchy(db: Session = Depends(get_db)):
    """
    Returns the hierarchical policy graph showing Corporate -> Regional -> Product-line inheritance.
    Includes parent-child relationships and cycle validation.
    """
    all_docs = db.query(GuidelineDocument).all()
    doc_map = {d.id: d for d in all_docs}

    roots = []
    children_map = {}

    for d in all_docs:
        if d.parent_document_id and d.parent_document_id in doc_map:
            children_map.setdefault(d.parent_document_id, []).append(d)
        else:
            roots.append(d)

    def build_tree_node(doc):
        kids = children_map.get(doc.id, [])
        return {
            "id": doc.id,
            "title": doc.title,
            "policy_scope": doc.policy_scope or "corporate",
            "region_code": doc.region_code,
            "product_line": doc.product_line,
            "clause_count": len(doc.clauses),
            "parent_document_id": doc.parent_document_id,
            "children": [build_tree_node(k) for k in kids]
        }

    return {
        "total_documents": len(all_docs),
        "corporate_roots": [build_tree_node(r) for r in roots]
    }


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_guideline(document_id: str, db: Session = Depends(get_db)):
    """Deletes a guideline document and its clauses."""
    doc = db.query(GuidelineDocument).filter(GuidelineDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guideline document not found.")
    
    db.delete(doc)
    db.commit()
    return None


# Approved Facts Endpoints
facts_router = APIRouter(prefix="/facts", tags=["facts"])


@facts_router.post("", response_model=ApprovedFactResponse, status_code=status.HTTP_201_CREATED)
def create_approved_fact(payload: ApprovedFactCreate, db: Session = Depends(get_db)):
    """Creates a new approved fact in the corporate library."""
    fact = ApprovedFact(
        fact_text=payload.fact_text.strip(),
        category=payload.category,
        source_reference=payload.source_reference
    )
    db.add(fact)
    db.commit()
    db.refresh(fact)
    return ApprovedFactResponse.model_validate(fact)


@facts_router.get("", response_model=List[ApprovedFactResponse])
def list_approved_facts(db: Session = Depends(get_db)):
    """Lists all approved facts available for claim verification."""
    facts = db.query(ApprovedFact).order_by(ApprovedFact.created_at.desc()).all()
    return [ApprovedFactResponse.model_validate(f) for f in facts]


@facts_router.delete("/{fact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_approved_fact(fact_id: str, db: Session = Depends(get_db)):
    """Deletes an approved fact."""
    fact = db.query(ApprovedFact).filter(ApprovedFact.id == fact_id).first()
    if not fact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approved fact not found.")
    db.delete(fact)
    db.commit()
    return None
