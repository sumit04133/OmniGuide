# OmniGuide Figma Integration Prototype

> **Status:** Local Developer Prototype (Under Development / Round 3 Benchmark)  
> **API Endpoint:** `POST /api/integrations/figma/audit`

This integration connects Figma design workflows directly to the OmniGuide brand governance engine. Designers can select any frame or text layer in Figma, run an instant brand compliance check, inspect grounded guideline citations, and replace non-compliant copy with verified intent-preserving alternatives with one click.

---

## Architecture

```
┌─────────────────────────────────┐
│       Figma Desktop App         │
│  (Selected Text Canvas Layer)   │
└───────────────┬─────────────────┘
                │ Plugin RPC (code.js -> ui.html)
┌───────────────▼─────────────────┐
│     OmniGuide Plugin UI         │
│  (Local Webview: ui.html)       │
└───────────────┬─────────────────┘
                │ HTTP POST /api/integrations/figma/audit
┌───────────────▼─────────────────┐
│      OmniGuide REST API         │
│ (FastAPI + Rule Engine + GenAI) │
└─────────────────────────────────┘
```

---

## How to Test Locally in Figma

1. Open **Figma Desktop App**.
2. Go to **Plugins** → **Development** → **Import plugin from manifest...**.
3. Select the `manifest.json` file inside `integrations/figma/`.
4. Create or select a text layer containing marketing copy (e.g. `"India's #1 fastest cloud platform"`).
5. Open the plugin: Right-click canvas → **Plugins** → **Development** → **OmniGuide — AI Brand Governance**.
6. Click **Audit Selected Copy**:
   - The plugin communicates with `http://localhost:8000/api/integrations/figma/audit`.
   - Violations are flagged with guideline clause citations (e.g. `SEC-1.1`).
   - Click **Apply Rewrite to Canvas Layer** to apply the compliant revision in-place on the Figma canvas!

---

## API Specification

- **Endpoint:** `POST /api/integrations/figma/audit`
- **Request Body:**
  ```json
  {
    "text": "India's #1 fastest cloud platform",
    "node_name": "Hero Headline Frame",
    "component_type": "banner"
  }
  ```
- **Response Body:**
  ```json
  {
    "status": "flagged",
    "node_name": "Hero Headline Frame",
    "total_findings": 2,
    "findings": [
      {
        "category": "unsupported_superlative",
        "severity": "High",
        "original_excerpt": "#1",
        "explanation": "Unsupported ranking superlative prohibited without accredited third-party benchmark.",
        "suggested_fix": "leading",
        "guideline_clause_identifier": "SEC-1.1",
        "evidence_tier": "VERIFIED"
      }
    ],
    "suggested_rewrites": [
      "India's leading high-performance cloud platform"
    ],
    "compliance_score": 50,
    "checked_at": "2026-11-02T12:00:00Z"
  }
  ```
