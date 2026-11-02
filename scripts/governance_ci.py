#!/usr/bin/env python3
"""
OmniGuide Governance CI Runner
Automated brand and legal compliance gate for CI/CD pipelines (e.g. GitHub Actions).
Evaluates marketing copy files, verifies against brand guidelines and approved facts,
and blocks merges when Strict Launch Gates are violated.
"""

import argparse
import json
import os
import re
import sys
from typing import List, Dict, Any, Optional, Tuple

try:
    import httpx
except ImportError:
    import urllib.request
    import urllib.error
    httpx = None


SUPPORTED_EXTENSIONS = {".md", ".txt", ".json", ".yaml", ".yml", ".html"}


def mask_secret(val: Optional[str]) -> str:
    """Masks secrets for safe logging."""
    if not val:
        return "[NOT_SET]"
    if len(val) <= 6:
        return "***"
    return f"{val[:3]}...{val[-3:]}"


def extract_text_from_file(filepath: str) -> str:
    """Reads and extracts text from supported content files."""
    ext = os.path.splitext(filepath)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported content file extension '{ext}'. Supported: {', '.join(SUPPORTED_EXTENSIONS)}")

    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    if ext in (".json",):
        try:
            data = json.loads(content)
            # If JSON, extract text values from common copy fields
            texts = []
            if isinstance(data, dict):
                for k in ("copy", "headline", "body", "content", "description", "text"):
                    if k in data and isinstance(data[k], str):
                        texts.append(data[k])
                if not texts:
                    # Collect all string values
                    for v in data.values():
                        if isinstance(v, str):
                            texts.append(v)
            return "\n\n".join(texts) if texts else content
        except Exception:
            return content

    return content


def run_governance_audit(
    content: str,
    title: str,
    api_url: str,
    api_key: Optional[str] = None,
    timeout: float = 15.0
) -> Dict[str, Any]:
    """Submits copy to OmniGuide REST API endpoint."""
    endpoint = f"{api_url.rstrip('/')}/reviews"
    payload = {
        "title": f"CI Audit: {title}",
        "content_type": "Marketing Copy",
        "content": content,
        "analysis_mode": "hybrid"
    }
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    if httpx:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(endpoint, json=payload, headers=headers)
            if resp.status_code not in (200, 201):
                raise RuntimeError(f"OmniGuide API returned HTTP {resp.status_code}: {resp.text}")
            return resp.json()
    else:
        req = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"OmniGuide API returned HTTP {e.code}: {e.read().decode('utf-8')}")


def run_local_deterministic_audit(content: str, title: str) -> Dict[str, Any]:
    """Offline fallback using Python regex rules if backend service is unreachable."""
    findings = []
    # Superlatives check
    superlatives = ["#1", "number one", "fastest", "cheapest", "world's best", "100% guaranteed", "zero downtime"]
    for s in superlatives:
        pattern = re.compile(re.escape(s), re.IGNORECASE)
        match = pattern.search(content)
        if match:
            findings.append({
                "category": "unsupported_superlative",
                "severity": "High",
                "original_excerpt": match.group(0),
                "explanation": f"Superlative '{match.group(0)}' requires registered benchmark certification under SEC-1.1.",
                "guideline_clause_identifier": "SEC-1.1",
                "suggested_fix": "high-performance",
                "evidence_tier": "VERIFIED"
            })

    # Banned terms check
    banned = ["cheap", "dirt cheap", "silver bullet", "hacky"]
    for b in banned:
        pattern = re.compile(rf"\b{re.escape(b)}\b", re.IGNORECASE)
        match = pattern.search(content)
        if match:
            findings.append({
                "category": "banned_term",
                "severity": "High",
                "original_excerpt": match.group(0),
                "explanation": f"Prohibited term '{match.group(0)}' violates enterprise brand guidelines under SEC-3.1.",
                "guideline_clause_identifier": "SEC-3.1",
                "suggested_fix": "cost-effective",
                "evidence_tier": "VERIFIED"
            })

    overall_status = "flagged" if any(f["severity"] == "High" for f in findings) else ("needs_review" if findings else "compliant")
    return {
        "id": "ci-local-audit",
        "title": title,
        "overall_status": overall_status,
        "analysis_mode": "deterministic_ci_fallback",
        "findings": findings
    }


def evaluate_launch_gate(findings: List[Dict[str, Any]], policy: str = "strict") -> Tuple[bool, str]:
    """
    Evaluates whether the content passes the configured launch gate.
    - strict: Zero High or Medium severity violations allowed.
    - standard: Zero High severity violations allowed (Medium produces warning).
    - advisory: Never blocks, reports all findings as recommendations.
    """
    high_count = sum(1 for f in findings if f.get("severity") == "High")
    med_count = sum(1 for f in findings if f.get("severity") == "Medium")

    if policy == "strict":
        if high_count > 0 or med_count > 0:
            return False, f"Strict Launch Gate Failed: {high_count} High, {med_count} Medium severity findings detected."
        return True, "Strict Launch Gate Passed: All claims verified and compliant."

    elif policy == "standard":
        if high_count > 0:
            return False, f"Standard Launch Gate Failed: {high_count} High severity blocking violations detected."
        return True, f"Standard Launch Gate Passed: 0 High severity violations ({med_count} Medium advisory notices)."

    else:  # advisory
        return True, f"Advisory Gate Passed: {high_count} High, {med_count} Medium findings flagged for reviewer attention."


def write_github_step_summary(
    filepath: str,
    gate_passed: bool,
    gate_policy: str,
    gate_reason: str,
    audit_results: List[Dict[str, Any]],
    summary_dest: Optional[str] = None
):
    """Outputs Markdown to GitHub Actions $GITHUB_STEP_SUMMARY."""
    lines = [
        "## OmniGuide AI Brand Governance — Pull Request Gate",
        "",
        f"**Gate Status:** {'✅ **PASSED**' if gate_passed else '❌ **BLOCKED**'}",
        f"**Policy:** `{gate_policy.upper()}`",
        f"**Decision:** {gate_reason}",
        f"**Audited File:** `{filepath}`",
        "",
        "---",
        "",
        "### Findings Breakdown",
        ""
    ]

    total_findings = sum(len(a.get("findings", [])) for a in audit_results)
    if total_findings == 0:
        lines.append("🎉 **No brand or legal violations detected.** Content is compliant for production release.")
    else:
        lines.append("| Severity | Category | Highlighted Excerpt | Policy Citation | Recommended Fix |")
        lines.append("| :--- | :--- | :--- | :--- | :--- |")
        for a in audit_results:
            for f in a.get("findings", []):
                sev = f.get("severity", "Medium")
                badge = "🔴 High" if sev == "High" else ("🟡 Medium" if sev == "Medium" else "🔵 Low")
                cat = f.get("category", "")
                exc = f.get("original_excerpt", "").replace("|", "\\|")
                cite = f.get("guideline_clause_identifier", "N/A")
                fix = f.get("suggested_fix", "").replace("|", "\\|")
                lines.append(f"| {badge} | `{cat}` | \"{exc}\" | `{cite}` | {fix} |")

    summary_md = "\n".join(lines) + "\n"

    target = summary_dest or os.environ.get("GITHUB_STEP_SUMMARY")
    if target:
        try:
            with open(target, "a", encoding="utf-8") as f:
                f.write(summary_md)
        except Exception as e:
            print(f"[OmniGuide CI Warning] Could not write to GITHUB_STEP_SUMMARY: {e}", file=sys.stderr)

    return summary_md


def main():
    parser = argparse.ArgumentParser(description="OmniGuide Brand Governance CI Runner")
    parser.add_argument("--file", "-f", required=True, help="Path to copy/marketing content file to audit")
    parser.add_argument("--api-url", default=os.environ.get("OMNIGUIDE_API_URL", "http://localhost:8000/api"), help="OmniGuide backend API base URL")
    parser.add_argument("--api-key", default=os.environ.get("OMNIGUIDE_API_KEY", ""), help="OmniGuide API Bearer Token (optional)")
    parser.add_argument("--launch-gate", choices=["strict", "standard", "advisory"], default="strict", help="Launch gate policy (default: strict)")
    parser.add_argument("--offline-fallback", action="store_true", default=True, help="Fall back to local deterministic rule engine if API is unavailable")
    parser.add_argument("--summary-file", default=None, help="Path to output markdown step summary")

    args = parser.parse_args()

    filepath = args.file
    if not os.path.exists(filepath):
        print(f"[OmniGuide CI Error] File not found: {filepath}", file=sys.stderr)
        sys.exit(2)

    try:
        content = extract_text_from_file(filepath)
    except Exception as e:
        print(f"[OmniGuide CI Error] Error reading content file: {e}", file=sys.stderr)
        sys.exit(2)

    if not content.strip():
        print(f"[OmniGuide CI Notice] File '{filepath}' is empty. Skipping governance audit.")
        sys.exit(0)

    print(f"[OmniGuide CI] Auditing '{filepath}' under '{args.launch_gate.upper()}' Launch Gate...")

    audit_result = None
    try:
        audit_result = run_governance_audit(
            content=content,
            title=os.path.basename(filepath),
            api_url=args.api_url,
            api_key=args.api_key if args.api_key else None
        )
        print(f"[OmniGuide CI] Connected to OmniGuide API. Audit completed (Mode: {audit_result.get('analysis_mode')}).")
    except Exception as api_err:
        print(f"[OmniGuide CI Notice] Backend API at {args.api_url} unreachable: {api_err}")
        if args.offline_fallback:
            print("[OmniGuide CI] Executing offline deterministic governance checks...")
            audit_result = run_local_deterministic_audit(content, os.path.basename(filepath))
        else:
            print("[OmniGuide CI Error] API failure and offline fallback disabled.", file=sys.stderr)
            sys.exit(2)

    findings = audit_result.get("findings", [])
    passed, reason = evaluate_launch_gate(findings, policy=args.launch_gate)

    print("\n" + "=" * 60)
    print(f"OMNIGUIDE GOVERNANCE GATE: {'PASSED' if passed else 'FAILED'}")
    print(f"Policy: {args.launch_gate.upper()} | Reason: {reason}")
    print(f"Violations detected: {len(findings)}")
    print("=" * 60)

    for idx, f in enumerate(findings, 1):
        print(f"  {idx}. [{f.get('severity', 'Medium')}] {f.get('category')}: \"{f.get('original_excerpt')}\"")
        print(f"     Cite: {f.get('guideline_clause_identifier')} | Fix: {f.get('suggested_fix')}")

    # Write Step Summary
    write_github_step_summary(
        filepath=filepath,
        gate_passed=passed,
        gate_policy=args.launch_gate,
        gate_reason=reason,
        audit_results=[audit_result],
        summary_dest=args.summary_file
    )

    if not passed:
        print("\n[OmniGuide CI Error] Pull request blocked by OmniGuide Launch Gate.")
        sys.exit(1)
    else:
        print("\n[OmniGuide CI Success] Content approved for deployment.")
        sys.exit(0)


if __name__ == "__main__":
    main()
