from unittest.mock import patch, MagicMock
import pytest
from app.models.guideline import GuidelineDocument, GuidelineClause
from app.services.retrieval import guideline_retriever, cosine_similarity
from app.services.regulatory_rulepacks import regulatory_rulepack_service


# ---------------------------------------------------------------------------
# HYBRID RETRIEVAL & RRF RANKING TESTS
# ---------------------------------------------------------------------------

def test_cosine_similarity_math():
    v1 = [1.0, 0.0, 0.0]
    v2 = [1.0, 0.0, 0.0]
    assert pytest.approx(cosine_similarity(v1, v2), 0.001) == 1.0

    v3 = [0.0, 1.0, 0.0]
    assert pytest.approx(cosine_similarity(v1, v3), 0.001) == 0.0

    # Handles zero vector gracefully
    assert cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0
    assert cosine_similarity([], []) == 0.0


def test_bm25_exact_keyword_retrieval(db_session):
    """Verifies that exact governance keywords ('#1', 'speed') retrieve the exact matching clauses."""
    clauses = guideline_retriever.retrieve_relevant_clauses(
        db=db_session,
        query_text="Our platform is #1 in speed and performance",
        top_k=3
    )
    assert len(clauses) > 0
    identifiers = [c.clause_identifier for c in clauses]
    assert "SEC-1.1" in identifiers or "SEC-1.2" in identifiers
    assert clauses[0].retrieval_method in ("keyword_lexical", "hybrid_rrf")


def test_semantic_match_with_mock_embedding_provider(db_session):
    """
    Simulates dense semantic embeddings where the query lacks exact keyword overlap
    (e.g., 'rapid compute throughput') but semantic vector matches SEC-1.2 ('Comparative Speed').
    """
    # Mock Gemini embed_content
    mock_query_embed = MagicMock()
    mock_query_embed.embedding.values = [0.8, 0.2, 0.1, 0.0]

    mock_clause_embed_speed = MagicMock()
    mock_clause_embed_speed.embedding.values = [0.82, 0.19, 0.08, 0.01]  # High similarity

    mock_clause_embed_other = MagicMock()
    mock_clause_embed_other.embedding.values = [0.01, 0.02, 0.95, 0.88]  # Low similarity

    def mock_embed_content(model, contents):
        if "rapid" in contents.lower() or "throughput" in contents.lower():
            return mock_query_embed
        elif "speed" in contents.lower() or "fastest" in contents.lower():
            return mock_clause_embed_speed
        return mock_clause_embed_other

    with patch("app.core.config.settings.GEMINI_API_KEY", "mock-gemini-key"), \
         patch("google.genai.Client") as mock_client_cls:
        mock_instance = MagicMock()
        mock_instance.models.embed_content.side_effect = mock_embed_content
        mock_client_cls.return_value = mock_instance

        results = guideline_retriever.retrieve_relevant_clauses(
            db=db_session,
            query_text="Rapid compute throughput",
            top_k=3
        )
        assert len(results) > 0
        assert results[0].retrieval_method == "hybrid_rrf"


def test_embedding_provider_failure_falls_back_to_bm25(db_session):
    """When Gemini embedding API errors out, system seamlessly falls back to BM25."""
    with patch("app.core.config.settings.GEMINI_API_KEY", "mock-gemini-key"), \
         patch("app.services.retrieval.GuidelineRetriever._compute_dense_ranking", return_value=None):
        results = guideline_retriever.retrieve_relevant_clauses(
            db=db_session,
            query_text="India's #1 fastest cloud",
            top_k=3
        )
        assert len(results) > 0
        assert results[0].retrieval_method == "keyword_lexical"


def test_rrf_ranking_deduplication():
    """Tests Reciprocal Rank Fusion formula and deduplication math."""
    retriever = guideline_retriever
    c1 = {"id": "c1", "text": "Clause 1"}
    c2 = {"id": "c2", "text": "Clause 2"}
    c3 = {"id": "c3", "text": "Clause 3"}

    # BM25 rank: c1 > c2
    list_bm25 = [(c1, 5.0), (c2, 3.0)]
    # Dense rank: c2 > c3
    list_dense = [(c2, 0.9), (c3, 0.8)]

    combined = retriever._reciprocal_rank_fusion(list_bm25, list_dense, k=60)
    # c2 appeared in both rankings, so score(c2) = (1/62) + (1/61) > score(c1) = 1/61
    assert len(combined) == 3
    assert combined[0][0]["id"] == "c2"
    assert pytest.approx(combined[0][1], 0.0001) == (1.0 / 62.0) + (1.0 / 61.0)


# ---------------------------------------------------------------------------
# HIERARCHICAL POLICY INHERITANCE TESTS
# ---------------------------------------------------------------------------

def test_valid_parent_child_policy_inheritance(db_session):
    """
    Creates a corporate parent policy ('NovaForge Global Standard') and a child regional
    policy ('NovaForge India Regional Addendum').
    Verifies that querying the child policy scope inherits the parent's mandatory rules!
    """
    # 1. Create Corporate Parent Document
    corp_doc = GuidelineDocument(
        title="NovaForge Global Corporate Standard",
        filename="corp_global.txt",
        extracted_text="Corporate rules",
        policy_scope="corporate"
    )
    db_session.add(corp_doc)
    db_session.flush()

    corp_clause = GuidelineClause(
        document_id=corp_doc.id,
        clause_identifier="CORP-GLOBAL-01",
        clause_text="All advertising copy worldwide must not state absolute guarantees without SLA citation.",
        section_heading="Global Warranties",
        page_number=1
    )
    db_session.add(corp_clause)

    # 2. Create Child Regional Document inheriting from Parent
    india_doc = GuidelineDocument(
        title="NovaForge India Regional Standard",
        filename="india_regional.txt",
        extracted_text="Regional rules",
        policy_scope="regional",
        parent_document_id=corp_doc.id,
        region_code="IN"
    )
    db_session.add(india_doc)
    db_session.flush()

    india_clause = GuidelineClause(
        document_id=india_doc.id,
        clause_identifier="IN-REG-01",
        clause_text="All digital influencer endorsements in India must carry #ad disclosure under ASCI standards.",
        section_heading="Regional Influencer Guidelines",
        page_number=1
    )
    db_session.add(india_clause)
    db_session.commit()

    # 3. Resolve inherited clauses for the child document
    resolved = guideline_retriever.resolve_hierarchical_clauses(
        db=db_session,
        document_id=india_doc.id
    )

    identifiers = [item[0].clause_identifier for item in resolved]
    # Child clause is present
    assert "IN-REG-01" in identifiers
    # Parent corporate clause is inherited
    assert "CORP-GLOBAL-01" in identifiers

    # Verify inheritance tracking metadata
    corp_entry = next(item for item in resolved if item[0].clause_identifier == "CORP-GLOBAL-01")
    assert corp_entry[3] == "NovaForge Global Corporate Standard"  # inherited_from_document


def test_circular_hierarchy_rejection(db_session):
    """Verifies that an intentional circular reference (A -> B -> A) is caught and rejected."""
    doc_a = GuidelineDocument(title="Doc A", filename="a.txt", extracted_text="a", policy_scope="corporate")
    db_session.add(doc_a)
    db_session.flush()

    doc_b = GuidelineDocument(title="Doc B", filename="b.txt", extracted_text="b", policy_scope="regional", parent_document_id=doc_a.id)
    db_session.add(doc_b)
    db_session.flush()

    # Create cycle: Doc A points to Doc B
    doc_a.parent_document_id = doc_b.id
    db_session.commit()

    with pytest.raises(ValueError, match="Circular policy hierarchy detected"):
        guideline_retriever.resolve_hierarchical_clauses(db=db_session, document_id=doc_a.id)


def test_manual_guideline_creation_missing_parent_rejection(client):
    """Creating a document referencing a non-existent parent returns HTTP 400."""
    payload = {
        "title": "Invalid Child Policy",
        "content": "Section 1: Test rule for invalid parent test.",
        "parent_document_id": "non-existent-uuid-99999"
    }
    response = client.post("/api/guidelines/manual", json=payload)
    assert response.status_code == 400
    assert "does not exist" in response.json()["detail"]


# ---------------------------------------------------------------------------
# REGULATORY RULE PACKS TESTS (FTC, ASCI, EU DSA)
# ---------------------------------------------------------------------------

def test_regulatory_rule_packs_list_and_structure(client):
    response = client.get("/api/regulatory/packs")
    assert response.status_code == 200
    packs = response.json()
    assert len(packs) >= 3

    pack_ids = [p["id"] for p in packs]
    assert "ftc_commercial" in pack_ids
    assert "asci_india" in pack_ids
    assert "eu_dsa" in pack_ids

    ftc = next(p for p in packs if p["id"] == "ftc_commercial")
    assert "Federal Trade Commission" in ftc["authority"]
    assert any("FTC-SEC-5" in c["clause_identifier"] for c in ftc["clauses"])


def test_regulatory_rule_pack_toggle(client):
    # Toggle off FTC
    res_off = client.post("/api/regulatory/packs/ftc_commercial/toggle", json={"enabled": False})
    assert res_off.status_code == 200
    assert res_off.json()["is_enabled"] is False

    # Check that FTC clauses are excluded
    active = regulatory_rulepack_service.get_active_regulatory_clauses()
    assert not any("FTC-SEC-5" in c["clause_identifier"] for c in active)

    # Toggle back on
    res_on = client.post("/api/regulatory/packs/ftc_commercial/toggle", json={"enabled": True})
    assert res_on.status_code == 200
    assert res_on.json()["is_enabled"] is True

    active_now = regulatory_rulepack_service.get_active_regulatory_clauses()
    assert any("FTC-SEC-5" in c["clause_identifier"] for c in active_now)


def test_regulatory_pack_clauses_injected_into_retrieval(db_session):
    """Verifies that regulatory clauses appear in retrieval results when enabled."""
    results = guideline_retriever.retrieve_relevant_clauses(
        db=db_session,
        query_text="Unfair or deceptive marketing claims under FTC law",
        top_k=5,
        include_regulatory=True
    )
    identifiers = [r.clause_identifier for r in results]
    assert any("FTC" in ident or "SEC" in ident for ident in identifiers)


def test_reviews_endpoint_with_inherited_child_policy(client, db_session):
    """Verifies that POST /api/reviews accepts guideline_document_id and executes review."""
    from app.models.guideline import GuidelineDocument, GuidelineClause

    # 1. Create parent corporate policy
    parent = GuidelineDocument(
        title="Corporate Standard 2026",
        filename="corp.pdf",
        extracted_text="Corporate rules",
        policy_scope="corporate"
    )
    db_session.add(parent)
    db_session.flush()

    c1 = GuidelineClause(
        document_id=parent.id,
        clause_identifier="CORP-INHERITED-1",
        clause_text="Claims of zero downtime are prohibited across all corporate divisions."
    )
    db_session.add(c1)

    # 2. Create child regional policy
    child = GuidelineDocument(
        title="India Regional Cloud Addendum",
        filename="india_cloud.pdf",
        extracted_text="India regional rules",
        policy_scope="regional",
        parent_document_id=parent.id,
        region_code="IN"
    )
    db_session.add(child)
    db_session.flush()

    c2 = GuidelineClause(
        document_id=child.id,
        clause_identifier="INDIA-CLOUD-1",
        clause_text="All cloud latency benchmarks must reference Indian data centers."
    )
    db_session.add(c2)
    db_session.commit()

    # 3. Submit review referencing the child policy
    payload = {
        "title": "Cloud Launch Copy Audit",
        "content_type": "Marketing Copy",
        "content": "Our enterprise cloud delivers zero downtime infrastructure for modern teams.",
        "analysis_mode": "deterministic",
        "guideline_document_id": child.id,
        "policy_scope": "regional"
    }

    response = client.post("/api/reviews", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Cloud Launch Copy Audit"
    assert "id" in data

    # 4. Backward-compatibility check: submit review without guideline_document_id
    payload_compat = {
        "title": "Backward Compatible Review",
        "content_type": "Marketing Copy",
        "content": "Compliant enterprise cloud infrastructure.",
        "analysis_mode": "deterministic"
    }
    response_compat = client.post("/api/reviews", json=payload_compat)
    assert response_compat.status_code == 201

