# OmniGuide — AI-Powered Brand Governance Platform

**Product Name:** OmniGuide  
**Primary Tagline:** "Governance, Guided by Intelligence."  
**Supporting Message:** "Every claim checked. Every decision explained."  


---

## 1. Product Vision

OmniGuide helps organisations audit and govern marketing content across both visual and text channels before publication. It reviews submitted marketing copy and creative banners against uploaded brand guidelines, identifies potential violations, explains **why** each issue matters, cites exact supporting guideline clauses with source document names and page numbers, and suggests intent-preserving corrections.

### Core Philosophy: Human-in-the-Loop Governance
- **AI assists, humans decide:** OmniGuide never silently publishes content or modifies creative copy without human approval.
- **Evidence-backed, no hallucinations:** Every guideline citation is validated against stored database records. If an external AI proposes an ungrounded or invented clause ID, OmniGuide flags it as unverified rather than presenting it as fact.
- **Distinguishing unverified from false:** Claims lacking registered approved sources are clearly labelled as `UNSUPPORTED`, never mischaracterised as verified false.
- **Multimodal Visual Rigor:** Visual creative banners, display ads, and promotional graphics are audited with the same strictness as text copy—complete with disclaimer visibility heuristics and bounding-box overlays.
- **Resilient fallback:** Operates in Hybrid AI mode (Gemini Flash/Vision + Dense-Sparse RRF + Deterministic rules) or pure Deterministic mode when offline or without an API key.

---

## 2. Architecture & Technology Stack

```
┌────────────────────────────────────────────────────────────────────────┐
│                          OmniGuide Frontend                            │
│     React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons         │
│  ┌───────────────────────┐ ┌──────────────────────┐ ┌───────────────┐  │
│  │ Text Copy Workbench   │ │ Multimodal Asset Canvas│ │ Integrations │  │
│  │ (Side-by-Side Review) │ │ (Bounding Box Overlays)│ │ (CI/Figma/CMS)│  │
│  └───────────────────────┘ └──────────────────────┘ └───────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / JSON REST API
┌───────────────────────────────────▼────────────────────────────────────┐
│                          FastAPI Backend                               │
│                                                                        │
│  ┌─────────────────────┐   ┌────────────────────────────────────────┐  │
│  │ Deterministic Rules │   │ Hybrid Dense-Sparse Policy Retriever   │  │
│  │ (Regex, Banned, %)  │   │ • BM25 Lexical Token Weighting         │  │
│  └──────────┬──────────┘   │ • Dense Vector Embeddings (Gemini)     │  │
│             │              │ • Reciprocal Rank Fusion (RRF k=60)    │  │
│             │              │ • Hierarchical Policy Graph (Corp->Reg)│  │
│             │              │ • Regulatory Rule Packs (FTC/ASCI/DSA) │  │
│             │              └───────────────────┬────────────────────┘  │
│             ▼                                  ▼                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │   Gemini Intelligence Engine (Google GenAI Python SDK)           │  │
│  │   • Gemini Flash (Marketing Copy Audit & Rewrites)               │  │
│  │   • Gemini Vision (Multimodal Asset Claims & Disclaimers)        │  │
│  │   • Structured Pydantic JSON Output Schema                       │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│                                     ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │   Evidence Validator & Anti-Hallucination Grounding Engine        │  │
│  │   [VERIFIED | UNSUPPORTED | CONTRADICTED | NEEDS_HUMAN_REVIEW]   │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────────────┼──────────────────────────────────┘
                                      │ SQLAlchemy 2.x ORM
┌─────────────────────────────────────▼──────────────────────────────────┐
│                     PostgreSQL Database (Neon)                         │
│  Guidelines • Clauses • Approved Facts • Reviews • Asset Audits        │
└────────────────────────────────────────────────────────────────────────┘
```

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, Lucide React, React Router 7.
- **Backend:** Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2.x, Psycopg 3.
- **Multimodal AI Engine:** Google Gemini Flash (`gemini-2.5-flash`) for text analysis and Gemini Vision for creative asset auditing via the official Google GenAI Python SDK (`google-genai`).
- **Dense-Sparse Hybrid Retrieval:** BM25 lexical token-weighted retrieval combined with dense embeddings via Reciprocal Rank Fusion (RRF).
- **Document Processing:** PyMuPDF (`pymupdf`) for page-by-page text extraction and clause parsing.
- **Deterministic Rule Engine:** Regular expressions, banned term detection, superlative pattern matching, and Approved Facts metric grounding.
- **Database:** PostgreSQL on Neon (with automatic SQLite fallback for local developer testing).

---

## 3. The Three Round 3 Major Improvements

### Improvement 1: Multimodal Creative Asset Governance
- **Supported Formats:** Validates PNG, JPEG, and WebP assets with binary magic byte validation and size checks.
- **Visual Content Extraction:** Extracts visible headlines, supporting copy, fine-print disclaimers, and claims.
- **Approved Facts Grounding:** Every visual claim is verified against stored guideline clauses and registered corporate facts, classified into the 4 evidence tiers.
- **Disclaimer Visibility Heuristic:** Calculates the relative height ratio:
  $$\text{Ratio} = \frac{\text{Height}_{\text{disclaimer}}}{\text{Height}_{\text{headline}}}$$
  Flags disclaimers smaller than 20% of headline height (configurable heuristic: 10% permissive to 40% strict) to prevent hidden fine print.
- **Visual Overlays:** Interactive SVG/canvas bounding-box overlays color-coded by severity (Rose=High, Amber=Medium, Sky=Low) with hover inspection.
- **Endpoint:** `POST /api/assets/audit`

### Improvement 2: Governance in Development & Content Workflows
- **GitHub Actions CI/CD:** Real reusable GitHub Actions workflow (`.github/workflows/content-governance.yml`) and CLI script (`scripts/governance_ci.py`). Evaluates PR copy files, enforces Strict Launch Gates, blocks merges on violations (Exit 1), and generates concise Markdown reports in `$GITHUB_STEP_SUMMARY`.
- **Figma Selected-Text Integration:** Real-time API endpoint (`POST /api/integrations/figma/audit`) returning compliance scores, grounded clause citations, and intent-preserving rewrites. Includes local prototype Figma plugin (`integrations/figma/manifest.json`, `code.js`, `ui.html`).
- **Headless CMS Webhooks:** Secure webhook receiver (`POST /api/integrations/cms/webhook`) supporting Contentful and Strapi publish events. Features HMAC/secret verification, idempotency protection against duplicate delivery, and automated governance reviews before publication.

### Improvement 3: Hybrid Dense-Sparse Policy Retrieval & Policy Hierarchy
- **Hybrid Retrieval (BM25 + Dense Embeddings):** Combines lexical keyword precision with dense semantic vector representations via Reciprocal Rank Fusion ($k=60$). Gracefully falls back to BM25 if the vector provider is offline or unconfigured.
- **Hierarchical Policy Inheritance:** Models parent-child relationships across policies:
  $$\text{Corporate Policy} \longrightarrow \text{Regional Policy} \longrightarrow \text{Product-Line Policy}$$
  Child scope audits automatically inherit mandatory corporate policies with graph cycle detection and source attribution.
- **Regulatory Rule Packs:** Built-in modular regulatory packs for:
  1. **US FTC** (15 U.S.C. § 45 & 16 CFR Part 255 - Deceptive Acts & Disclosures)
  2. **Indian ASCI** (ASCI Code Ch. I/IV & 2021 Influencer Advertising Guidelines)
  3. **EU DSA** (Regulation (EU) 2022/2065 Art. 25 & Directive 2005/29/EC)
  With real-time enable/disable toggles affecting governance retrieval.

---

## 4. Local Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### 1. Set Up Backend
```bash
git clone https://github.com/syntaxcommandant/OmniGuide.git
cd OmniGuide

# Create and activate virtual environment
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Configure environment
cp .env.example .env
```
*(Optional: add `GEMINI_API_KEY` to `.env`. Deterministic mode runs automatically if omitted).*

### 2. Run Backend Server
```bash
# Windows PowerShell:
$env:PYTHONPATH="backend"; uvicorn app.main:app --reload --port 8000

# macOS / Linux:
PYTHONPATH=backend uvicorn app.main:app --reload --port 8000
```
- Interactive Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/api/health](http://localhost:8000/api/health)

### 3. Run Frontend
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 5. Automated Test Suite (82 / 82 Passing)

The repository features comprehensive automated unit and integration tests covering all requirements:

```bash
# Run pytest from root directory
pytest -v
```

### Verified Test Results Summary
- **Baseline Foundation (48/48 passed):**
  - Canonical superlative review workflow (`#1 fastest`).
  - PyMuPDF PDF clause extraction and scanned PDF rejection.
  - Deterministic regex governance and Approved Facts quantitative grounding (`42ms`).
  - Evidence validator tier classification (`VERIFIED`, `UNSUPPORTED`, `CONTRADICTED`, `NEEDS_HUMAN_REVIEW`).
  - Campaign Launch Simulator, cross-channel contradiction detection, and score recovery.
  - Red-Team adversarial simulator with 15 benchmark test vectors.
- **Improvement 1: Asset Governance (12/12 passed):**
  - PNG, JPEG, and WebP valid uploads.
  - Unsupported file type, malformed image, and oversized file rejection.
  - AI timeout and offline fallback to deterministic scan.
  - Disclaimer-size heuristic violation (<20%) vs compliant ratio (30%).
  - Grounded claims vs hallucinated clause sanitization.
  - Inverted/missing bounding boxes handled gracefully.
  - Idempotent repeat submissions and Markdown report exports.
- **Improvement 2: Workflow Integrations (11/11 passed):**
  - Figma selected-text audit with superlatives and compliant copy.
  - Contentful publication payload governance evaluation.
  - Strapi entry publish webhook processing.
  - Webhook secret/HMAC signature rejection on invalid credentials.
  - Duplicate webhook delivery skipped via idempotency cache.
  - GitHub Actions CI runner (`governance_ci.py`) blocking failing PR (Exit 1) and approving compliant PR (Exit 0).
  - Secrets masking in CI console output.
- **Improvement 3: Hybrid Retrieval & Hierarchy (11/11 passed):**
  - Cosine similarity vector math.
  - BM25 exact keyword match and dense semantic match with RRF ranking.
  - Missing embeddings fallback to BM25.
  - Valid parent-child policy inheritance (Child inherits Corporate guardrails).
  - Circular policy hierarchy rejection (cycle detection).
  - Non-existent parent document rejection (HTTP 400).
  - Regulatory rule packs listing (FTC, ASCI, EU DSA) and enable/disable toggles.

---

Use this step-by-step checklist to evaluate all new Round 3 capabilities:

### Journey 1: Multimodal Creative Asset Governance
1. Navigate to **Creative Assets** (`/assets`) in the sidebar.
2. Under **Pre-Loaded Benchmark Creative Demo Scenarios**, click:
   - **#1 Fastest Banner**: Generates an ad banner with a prominent `#1 Fastest` headline and tiny fine-print disclaimer.
3. Click **Audit Creative Asset**:
   - High-severity finding: `#1 Fastest` flagged under `SEC-1.1`.
   - Disclaimer visibility violation: Disclaimer height is flagged as only 12.8% of headline height (violating the 20% minimum heuristic).
   - Interactive Canvas: Hover over the bounding boxes on the image to highlight findings in the panel!
4. Click **Download Report (.md)**: Inspect the generated executive Markdown report.

### Journey 2: Development & Workflow Integrations
1. Navigate to **CI/CD & Workflows** (`/integrations`) in the sidebar.
2. **GitHub Actions Tab**:
   - Select **Violating Copy PR** → Click **Run Pull Request Governance Check**.
   - Watch the Strict Launch Gate block the PR with **Exit Code 1**, displaying violations table.
   - Switch to **Compliant Copy PR** → Watch the gate approve with **Exit Code 0**!
3. **Figma Plugin Tab**:
   - Inspect the selected layer copy → Click **Audit Figma Selection**.
   - See compliance score, grounded citations, and click **Apply Rewrite to Layer**.
4. **Headless CMS Webhooks Tab**:
   - Click **Send Webhook Event** → Inspect the real-time audit decision (`blocked` or `approved`).
   - Click **Test Duplicate (Idempotency)** → Notice instant duplicate detection and skipping.

### Journey 3: Policy Hierarchy & Regulatory Rule Packs
1. Navigate to **Brand Guidelines** (`/guidelines`) in the sidebar.
2. Click **Policy Hierarchy Graph**:
   - View the mapped Corporate Root policies and child regional/product scopes.
3. Click **Regulatory Rule Packs**:
   - Inspect the US FTC, Indian ASCI, and EU DSA rule packs.
   - Toggle **Active / Disabled** switches and see the active retrieval corpus update dynamically.

---

## 7. Environment Variables Reference

| Variable | Scope | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Backend | `sqlite:///./omniguide.db` | PostgreSQL connection string (Neon/Render). |
| `GEMINI_API_KEY` | Backend | `""` | Google Gemini API key. Enables Flash & Vision AI. |
| `GEMINI_MODEL` | Backend | `gemini-2.5-flash` | Gemini model name for text and vision. |
| `OMNIGUIDE_WEBHOOK_SECRET` | Backend | `""` | Secret token for validating CMS webhooks. |
| `OMNIGUIDE_API_URL` | CI/CD | `http://localhost:8000/api` | API backend URL for GitHub Actions CI runner. |
| `DEFAULT_ANALYSIS_MODE` | Backend | `hybrid` | `hybrid` or `deterministic`. |
| `UPLOAD_MAX_SIZE_MB` | Backend | `15` | Maximum PDF and creative image upload size (MB). |
| `CORS_ORIGINS` | Backend | `*` | Allowed origins for CORS. |
| `VITE_API_BASE_URL` | Frontend | `http://localhost:8000/api` | API backend URL for frontend client requests. |

---

## 8. Cloud Production Deployment

### Backend (Render)
- **Build Command:** `pip install -r backend/requirements.txt`
- **Start Command:** `PYTHONPATH=backend uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Environment Variables:** `DATABASE_URL` (Neon PostgreSQL), `GEMINI_API_KEY`, `CORS_ORIGINS`.

### Frontend (Vercel)
- **Framework:** Vite
- **Root Directory:** `frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variable:** `VITE_API_BASE_URL=https://omniguide-api.onrender.com/api`

---


