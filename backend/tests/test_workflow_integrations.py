import json
import os
import subprocess
import sys
from unittest.mock import patch
import pytest


# ---------------------------------------------------------------------------
# FIGMA SELECTED-TEXT AUDIT TESTS
# ---------------------------------------------------------------------------

def test_figma_audit_superlative_flagged(client):
    payload = {
        "text": "India's #1 fastest tool for Indian teams.",
        "node_name": "Hero Headline",
        "component_type": "banner"
    }
    response = client.post("/api/integrations/figma/audit", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("flagged", "needs_review")
    assert data["total_findings"] >= 1
    assert data["compliance_score"] < 100
    assert len(data["suggested_rewrites"]) >= 1
    # Check that SEC-1.1 or SEC-1.2 is cited
    categories = [f["category"] for f in data["findings"]]
    assert "unsupported_superlative" in categories


def test_figma_audit_compliant_copy(client):
    payload = {
        "text": "NovaForge delivers high-performance infrastructure with 42ms benchmark latency for enterprise workloads.",
        "node_name": "Body Text",
        "component_type": "body"
    }
    response = client.post("/api/integrations/figma/audit", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "compliant"
    assert data["total_findings"] == 0
    assert data["compliance_score"] == 100


def test_figma_audit_empty_text_rejection(client):
    response = client.post("/api/integrations/figma/audit", json={"text": "   "})
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# HEADLESS CMS WEBHOOK TESTS (Contentful & Strapi)
# ---------------------------------------------------------------------------

def test_contentful_webhook_violating_copy(client):
    contentful_payload = {
        "sys": {"id": "entry-test-101", "type": "Entry"},
        "fields": {
            "headline": {"en-US": "NovaForge: India's #1 fastest cloud platform"},
            "body": {"en-US": "Zero downtime guaranteed for all users."}
        }
    }
    response = client.post(
        "/api/integrations/cms/webhook",
        json=contentful_payload,
        headers={"X-Contentful-Topic": "ContentManagement.Entry.publish"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["event_id"] == "entry-test-101"
    assert data["provider"] == "contentful"
    assert data["status"] == "flagged"
    assert data["audit_decision"] == "blocked"
    assert data["blocking_violations_count"] >= 1


def test_strapi_webhook_compliant_copy(client):
    strapi_payload = {
        "event": "entry.publish",
        "model": "landing-page",
        "entry": {
            "id": "strapi-entry-55",
            "title": "Enterprise Cloud Platform",
            "content": "NovaForge platform delivers 42ms benchmark latency under standard enterprise SLA terms."
        }
    }
    response = client.post(
        "/api/integrations/cms/webhook",
        json=strapi_payload
    )
    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "strapi"
    assert data["status"] == "compliant"
    assert data["audit_decision"] == "approved"
    assert data["blocking_violations_count"] == 0


def test_cms_webhook_idempotency_duplicate_skipped(client):
    """Verifies that repeat delivery of the same event ID is safely skipped."""
    payload = {
        "sys": {"id": "idempotent-event-999", "type": "Entry"},
        "fields": {"headline": {"en-US": "High performance infrastructure"}}
    }
    # First delivery
    res1 = client.post("/api/integrations/cms/webhook", json=payload)
    assert res1.status_code == 200
    assert res1.json()["status"] in ("compliant", "processed")

    # Duplicate delivery
    res2 = client.post("/api/integrations/cms/webhook", json=payload)
    assert res2.status_code == 200
    assert res2.json()["status"] == "duplicate_skipped"
    assert "Duplicate webhook delivery detected" in res2.json()["message"]


def test_cms_webhook_database_persistence_across_restarts(client, db_session):
    """Verifies that webhook idempotency is durably persisted in database even after in-memory cache is wiped."""
    from app.api.integrations import _PROCESSED_WEBHOOK_EVENTS
    from app.models.integration import WebhookEventLog

    test_event_id = "restart-persist-evt-12345"
    payload = {
        "id": test_event_id,
        "content": "Enterprise infrastructure with proven benchmark latency."
    }

    # 1. First delivery persists to DB
    res1 = client.post("/api/integrations/cms/webhook", json=payload)
    assert res1.status_code == 200

    # Verify record was stored in webhook_event_logs table
    db_record = db_session.query(WebhookEventLog).filter_by(event_id=test_event_id).first()
    assert db_record is not None
    assert db_record.event_id == test_event_id

    # 2. Simulate complete server restart by wiping in-memory dictionary
    _PROCESSED_WEBHOOK_EVENTS.clear()
    assert test_event_id not in _PROCESSED_WEBHOOK_EVENTS

    # 3. Repeat delivery must be recognized as duplicate from DB log
    res2 = client.post("/api/integrations/cms/webhook", json=payload)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["status"] == "duplicate_skipped"
    assert "persisted in database audit log" in data2["message"]



def test_cms_webhook_secret_authorization_rejection(client, monkeypatch):
    """When OMNIGUIDE_WEBHOOK_SECRET is configured, requests with missing/wrong secret receive HTTP 401."""
    monkeypatch.setenv("OMNIGUIDE_WEBHOOK_SECRET", "super-secret-token-12345")

    payload = {"id": "sec-test-1", "copy": "Test copy"}
    # Wrong secret
    res_wrong = client.post(
        "/api/integrations/cms/webhook",
        json=payload,
        headers={"X-OmniGuide-Webhook-Secret": "wrong-secret"}
    )
    assert res_wrong.status_code == 401

    # Valid secret
    res_valid = client.post(
        "/api/integrations/cms/webhook",
        json=payload,
        headers={"X-OmniGuide-Webhook-Secret": "super-secret-token-12345"}
    )
    assert res_valid.status_code == 200


def test_cms_webhook_malformed_json(client):
    res = client.post(
        "/api/integrations/cms/webhook",
        content=b"not-json-content",
        headers={"Content-Type": "application/json"}
    )
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# CI SCRIPT INTEGRATION TESTS (scripts/governance_ci.py)
# ---------------------------------------------------------------------------

def test_ci_script_compliant_file_passes():
    """Directly invokes governance_ci.py with sample_launch_copy.md -> must exit with 0."""
    result = subprocess.run(
        [
            sys.executable,
            "scripts/governance_ci.py",
            "--file", "content/sample_launch_copy.md",
            "--launch-gate", "strict",
            "--offline-fallback"
        ],
        capture_output=True,
        text=True
    )
    assert result.returncode == 0
    assert "PASSED" in result.stdout
    assert "Strict Launch Gate Passed" in result.stdout


def test_ci_script_failing_file_blocks_pr():
    """Directly invokes governance_ci.py with sample_failing_copy.md -> must exit with 1."""
    result = subprocess.run(
        [
            sys.executable,
            "scripts/governance_ci.py",
            "--file", "content/sample_failing_copy.md",
            "--launch-gate", "strict",
            "--offline-fallback"
        ],
        capture_output=True,
        text=True
    )
    assert result.returncode == 1
    assert "FAILED" in result.stdout
    assert "Strict Launch Gate Failed" in result.stdout
    assert "Pull request blocked" in result.stdout


def test_ci_script_secrets_not_printed():
    """Verifies that secrets passed in --api-key or environment do not appear in console output."""
    secret_key = "test_bearer_token_xyz_safe_mock_token_999"
    result = subprocess.run(
        [
            sys.executable,
            "scripts/governance_ci.py",
            "--file", "content/sample_launch_copy.md",
            "--api-key", secret_key,
            "--offline-fallback"
        ],
        capture_output=True,
        text=True
    )
    assert secret_key not in result.stdout
    assert secret_key not in result.stderr
