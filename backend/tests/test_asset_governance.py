import io
from unittest.mock import patch, MagicMock
import pytest
from PIL import Image
from app.services.asset_governance import RawVisionAnalysisResult, RawVisionFinding


def create_test_image(format="PNG", size=(600, 400), color=(50, 100, 150)) -> bytes:
    """Helper to generate a real, valid image in memory."""
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=format)
    return buf.getvalue()


def test_valid_image_upload_png(client):
    png_bytes = create_test_image(format="PNG", size=(800, 400))
    response = client.post(
        "/api/assets/audit",
        files={"file": ("banner_superlative.png", png_bytes, "image/png")},
        data={"brand_name": "NovaForge", "target_channel": "instagram"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["filename"] == "banner_superlative.png"
    assert data["mime_type"] == "image/png"
    assert data["image_width"] == 800
    assert data["image_height"] == 400
    assert "findings" in data
    assert "disclaimer_status" in data
    assert data["overall_status"] in ("compliant", "needs_review", "flagged")


def test_valid_image_upload_jpeg_and_webp(client):
    jpeg_bytes = create_test_image(format="JPEG", size=(500, 300))
    res_jpeg = client.post(
        "/api/assets/audit",
        files={"file": ("ad_creative.jpg", jpeg_bytes, "image/jpeg")},
        data={"brand_name": "NovaForge"}
    )
    assert res_jpeg.status_code == 201
    assert res_jpeg.json()["mime_type"] == "image/jpeg"

    webp_bytes = create_test_image(format="WEBP", size=(400, 400))
    res_webp = client.post(
        "/api/assets/audit",
        files={"file": ("web_banner.webp", webp_bytes, "image/webp")},
        data={"brand_name": "NovaForge"}
    )
    assert res_webp.status_code == 201
    assert res_webp.json()["mime_type"] == "image/webp"


def test_unsupported_file_type_rejection(client):
    fake_txt = b"Hello world, this is marketing copy in a text file."
    response = client.post(
        "/api/assets/audit",
        files={"file": ("bad_copy.txt", fake_txt, "text/plain")}
    )
    assert response.status_code == 400
    assert "Invalid or corrupted image file" in response.json()["detail"] or "Unsupported" in response.json()["detail"]


def test_empty_upload_rejection(client):
    response = client.post(
        "/api/assets/audit",
        files={"file": ("empty.png", b"", "image/png")}
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_malformed_image_rejection(client):
    # Spoofed PNG extension with corrupted content
    corrupted_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDRcorruptedcontent"
    response = client.post(
        "/api/assets/audit",
        files={"file": ("corrupted.png", corrupted_bytes, "image/png")}
    )
    assert response.status_code == 400
    assert "corrupted" in response.json()["detail"].lower() or "invalid" in response.json()["detail"].lower()


def test_oversized_file_rejection(client):
    # Patch upload limit to 1MB for testing
    with patch("app.core.config.settings.UPLOAD_MAX_SIZE_MB", 1):
        big_bytes = b"A" * (2 * 1024 * 1024)  # 2MB
        response = client.post(
            "/api/assets/audit",
            files={"file": ("too_big.png", big_bytes, "image/png")}
        )
        assert response.status_code == 400
        assert "exceeds" in response.json()["detail"].lower()


def test_ai_timeout_fallback_to_deterministic(client):
    """Verifies that an AI provider failure falls back seamlessly to deterministic mode."""
    png_bytes = create_test_image(format="PNG", size=(600, 300))

    with patch("app.services.gemini_service.gemini_service.is_configured", return_value=True), \
         patch("app.services.asset_governance.asset_governance_service._run_gemini_vision", side_effect=Exception("Timeout reading from Gemini")):
        response = client.post(
            "/api/assets/audit",
            files={"file": ("timeout_test.png", png_bytes, "image/png")}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["analysis_mode"] == "deterministic_fallback"


def test_disclaimer_size_heuristic_violation(client):
    """
    Simulates a headline of height 100 and a tiny disclaimer of height 12 (12% < 20% threshold).
    Verifies that a disclaimer_visibility violation is flagged.
    """
    png_bytes = create_test_image(format="PNG", size=(800, 600))

    mock_vision_result = RawVisionAnalysisResult(
        headline_text="NovaForge Enterprise Infrastructure",
        supporting_text="High performance cloud",
        disclaimer_text="*Terms and conditions apply. SLA excludes scheduled maintenance.",
        headline_box=[100.0, 100.0, 200.0, 700.0],  # height = 100.0
        disclaimer_box=[550.0, 100.0, 562.0, 600.0],  # height = 12.0 -> ratio = 12/100 = 0.12 (12%)
        findings=[],
        overall_assessment="Audit completed."
    )

    with patch("app.services.gemini_service.gemini_service.is_configured", return_value=True), \
         patch("app.services.asset_governance.asset_governance_service._run_gemini_vision", return_value=mock_vision_result):
        response = client.post(
            "/api/assets/audit",
            files={"file": ("tiny_disclaimer.png", png_bytes, "image/png")},
            data={"disclaimer_ratio_threshold": 0.20}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["disclaimer_status"] == "violation"
        assert data["disclaimer_ratio"] == 0.12
        # Should contain a disclaimer_visibility finding citing SEC-2.1
        disc_findings = [f for f in data["findings"] if f["category"] == "disclaimer_visibility"]
        assert len(disc_findings) == 1
        assert disc_findings[0]["severity"] == "High"
        assert "12%" in disc_findings[0]["explanation"]


def test_disclaimer_size_compliant(client):
    """Simulates a legible disclaimer of height 30 on headline of height 100 (30% > 20% threshold)."""
    png_bytes = create_test_image(format="PNG", size=(800, 600))

    mock_vision_result = RawVisionAnalysisResult(
        headline_text="NovaForge Cloud",
        disclaimer_text="*Audited independently by TechAudit Labs 2026.",
        headline_box=[100.0, 100.0, 200.0, 700.0],  # height = 100.0
        disclaimer_box=[500.0, 100.0, 530.0, 600.0],  # height = 30.0 -> ratio = 30%
        findings=[],
        overall_assessment="Audit completed."
    )

    with patch("app.services.gemini_service.gemini_service.is_configured", return_value=True), \
         patch("app.services.asset_governance.asset_governance_service._run_gemini_vision", return_value=mock_vision_result):
        response = client.post(
            "/api/assets/audit",
            files={"file": ("clear_disclaimer.png", png_bytes, "image/png")},
            data={"disclaimer_ratio_threshold": 0.20}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["disclaimer_status"] == "compliant"
        assert data["disclaimer_ratio"] == 0.30
        assert not any(f["category"] == "disclaimer_visibility" for f in data["findings"])


def test_verified_finding_and_hallucinated_clause_handling(client):
    """
    Verifies that a valid clause (SEC-1.1) is grounded with VERIFIED status,
    while a fabricated clause (FICTITIOUS-99) is flagged for human review without crash.
    """
    png_bytes = create_test_image(format="PNG", size=(800, 400))

    mock_vision_result = RawVisionAnalysisResult(
        headline_text="India's #1 Cloud Tool",
        findings=[
            RawVisionFinding(
                category="unsupported_superlative",
                severity="High",
                extracted_text="#1 Cloud",
                explanation="Ranking superlative without registered benchmark.",
                suggested_fix="High-performance cloud",
                guideline_clause_identifier="SEC-1.1",
                box_ymin=100.0, box_xmin=150.0, box_ymax=180.0, box_xmax=400.0
            ),
            RawVisionFinding(
                category="tone_and_voice",
                severity="Low",
                extracted_text="Revolutionary platform",
                explanation="Hyperbolic marketing phrase.",
                suggested_fix="Advanced platform",
                guideline_clause_identifier="FICTITIOUS-99",  # Hallucinated ID
                box_ymin=220.0, box_xmin=150.0, box_ymax=260.0, box_xmax=400.0
            )
        ],
        overall_assessment="Evaluation with mixed findings."
    )

    with patch("app.services.gemini_service.gemini_service.is_configured", return_value=True), \
         patch("app.services.asset_governance.asset_governance_service._run_gemini_vision", return_value=mock_vision_result):
        response = client.post(
            "/api/assets/audit",
            files={"file": ("claims_test.png", png_bytes, "image/png")}
        )
        assert response.status_code == 201
        findings = response.json()["findings"]

        # 1. Grounded SEC-1.1 finding
        grounded = next(f for f in findings if f["extracted_text"] == "#1 Cloud")
        assert grounded["evidence_tier"] == "VERIFIED"
        assert grounded["guideline_clause_identifier"] == "SEC-1.1"

        # 2. Hallucinated clause flagged
        hallucinated = next(f for f in findings if f["extracted_text"] == "Revolutionary platform")
        assert hallucinated["evidence_tier"] == "NEEDS_HUMAN_REVIEW"
        assert "UNVERIFIED" in hallucinated["guideline_clause_identifier"]


def test_invalid_and_missing_bounding_boxes_handled_gracefully(client):
    """Verifies that inverted or missing bounding boxes are sanitized gracefully without throwing errors."""
    png_bytes = create_test_image(format="PNG", size=(600, 400))

    mock_vision_result = RawVisionAnalysisResult(
        headline_text="Test Banner",
        findings=[
            RawVisionFinding(
                category="banned_term",
                severity="High",
                extracted_text="cheap",
                explanation="Prohibited term",
                suggested_fix="cost-effective",
                guideline_clause_identifier="SEC-3.1",
                box_ymin=200.0, box_xmin=300.0, box_ymax=150.0, box_xmax=250.0  # Inverted: ymax < ymin!
            ),
            RawVisionFinding(
                category="banned_term",
                severity="Medium",
                extracted_text="silver bullet",
                explanation="Prohibited term",
                suggested_fix="robust solution",
                guideline_clause_identifier="SEC-3.1",
                box_ymin=None, box_xmin=None, box_ymax=None, box_xmax=None  # Missing box
            )
        ],
        overall_assessment="Sanitization test."
    )

    with patch("app.services.gemini_service.gemini_service.is_configured", return_value=True), \
         patch("app.services.asset_governance.asset_governance_service._run_gemini_vision", return_value=mock_vision_result):
        response = client.post(
            "/api/assets/audit",
            files={"file": ("box_test.png", png_bytes, "image/png")}
        )
        assert response.status_code == 201
        findings = response.json()["findings"]
        for f in findings:
            # Both should have sanitized null coordinates instead of invalid geometry
            assert f["box_ymin"] is None or f["box_ymax"] > f["box_ymin"]


def test_duplicate_submission_and_report_export(client):
    """Verifies that repeat submissions succeed and Markdown report export works."""
    png_bytes = create_test_image(format="PNG", size=(500, 300))

    # First submission
    res1 = client.post(
        "/api/assets/audit",
        files={"file": ("repeat_ad.png", png_bytes, "image/png")}
    )
    assert res1.status_code == 201
    audit_id_1 = res1.json()["id"]

    # Second submission with same file name and bytes (safe idempotency / repeat handling)
    res2 = client.post(
        "/api/assets/audit",
        files={"file": ("repeat_ad.png", png_bytes, "image/png")}
    )
    assert res2.status_code == 201
    audit_id_2 = res2.json()["id"]
    assert audit_id_1 != audit_id_2  # Distinct audit tracking records

    # Test report export
    rep_res = client.get(f"/api/assets/{audit_id_1}/report")
    assert rep_res.status_code == 200
    assert "OmniGuide Creative Asset Governance Audit Report" in rep_res.text
    assert audit_id_1 in rep_res.text

    # Test list endpoint
    list_res = client.get("/api/assets")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 2
