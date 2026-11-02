import React, { useState } from 'react';
import {
  GitPullRequest,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Copy,
  Terminal,
  ShieldAlert,
  Webhook,
  Layers,
  Sparkles,
  ExternalLink,
  Code,
  Shield,
  RefreshCw,
  FileText,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import { FigmaAuditResult, CMSWebhookResult } from '../types';

export const IntegrationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'github' | 'figma' | 'cms'>('github');

  // GitHub CI Simulator State
  const [ciCopyType, setCiCopyType] = useState<'compliant' | 'violating'>('violating');
  const [ciGatePolicy, setCiGatePolicy] = useState<'strict' | 'standard' | 'advisory'>('strict');
  const [ciRunning, setCiRunning] = useState(false);
  const [ciResult, setCiResult] = useState<any>(null);

  // Figma Simulator State
  const [figmaText, setFigmaText] = useState("NovaForge is India's #1 fastest tool for Indian teams. 100% guaranteed zero downtime!");
  const [figmaNodeName, setFigmaNodeName] = useState("Hero Banner Text Layer");
  const [figmaLoading, setFigmaLoading] = useState(false);
  const [figmaResult, setFigmaResult] = useState<FigmaAuditResult | null>(null);

  // CMS Webhook Simulator State
  const [cmsProvider, setCmsProvider] = useState<'contentful' | 'strapi'>('contentful');
  const [cmsSecret, setCmsSecret] = useState('');
  const [cmsCopy, setCmsCopy] = useState("India's fastest cloud platform for dirt cheap pricing.");
  const [cmsLoading, setCmsLoading] = useState(false);
  const [cmsResult, setCmsResult] = useState<CMSWebhookResult | null>(null);

  // Run GitHub CI Simulation
  const runCiSimulation = async () => {
    setCiRunning(true);
    setCiResult(null);

    const testContent = ciCopyType === 'violating'
      ? "India's #1 fastest cloud platform for dirt cheap pricing! 100% guaranteed zero downtime."
      : "NovaForge delivers high-performance governance with 42ms benchmark latency for enterprise workloads.";

    try {
      const review = await api.startReview({
        title: `CI Pull Request Check: ${ciCopyType} sample`,
        content_type: 'Marketing Copy',
        content: testContent,
        analysis_mode: 'hybrid'
      });

      const highCount = review.findings.filter(f => f.severity === 'High').length;
      const medCount = review.findings.filter(f => f.severity === 'Medium').length;

      let gatePassed = true;
      let reason = '';
      if (ciGatePolicy === 'strict') {
        gatePassed = highCount === 0 && medCount === 0;
        reason = gatePassed
          ? 'Strict Launch Gate Passed: All claims verified and compliant.'
          : `Strict Launch Gate Failed: ${highCount} High, ${medCount} Medium severity violations found.`;
      } else if (ciGatePolicy === 'standard') {
        gatePassed = highCount === 0;
        reason = gatePassed
          ? `Standard Launch Gate Passed: 0 High violations (${medCount} Medium warnings).`
          : `Standard Launch Gate Failed: ${highCount} High severity blocking violations detected.`;
      } else {
        gatePassed = true;
        reason = `Advisory Gate: ${highCount} High, ${medCount} Medium notices reported.`;
      }

      setCiResult({
        gatePassed,
        reason,
        policy: ciGatePolicy,
        exitCode: gatePassed ? 0 : 1,
        review
      });
    } catch (e: any) {
      alert('CI check simulation failed: ' + e.message);
    } finally {
      setCiRunning(false);
    }
  };

  // Run Figma Selected Text Audit
  const handleFigmaAudit = async () => {
    setFigmaLoading(true);
    try {
      const res = await api.auditFigmaSelection({
        text: figmaText,
        node_name: figmaNodeName,
        component_type: 'banner'
      });
      setFigmaResult(res);
    } catch (e: any) {
      alert('Figma audit failed: ' + e.message);
    } finally {
      setFigmaLoading(false);
    }
  };

  // Run CMS Webhook Simulation
  const handleCmsWebhook = async (isDuplicate: boolean = false) => {
    setCmsLoading(true);
    const eventId = isDuplicate ? 'idempotent-repeat-event-123' : `event-${Date.now()}`;

    let payload: any;
    if (cmsProvider === 'contentful') {
      payload = {
        sys: { id: eventId, type: 'Entry' },
        fields: {
          headline: { 'en-US': cmsCopy },
          body: { 'en-US': 'Commercial promotional material.' }
        }
      };
    } else {
      payload = {
        event: 'entry.publish',
        model: 'article',
        entry: {
          id: eventId,
          content: cmsCopy
        }
      };
    }

    try {
      const res = await api.sendCMSWebhook(payload, cmsSecret || undefined);
      setCmsResult(res);
    } catch (e: any) {
      alert('CMS Webhook submission error: ' + e.message);
    } finally {
      setCmsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-700">
              <GitPullRequest className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Governance in Development & Content Workflows
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-slate-500 max-w-2xl">
            Integrate brand compliance checks directly into developer pull requests, design selection workflows,
            and headless content management pipelines.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('github')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              activeTab === 'github' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            GitHub Actions CI/CD
          </button>
          <button
            onClick={() => setActiveTab('figma')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              activeTab === 'figma' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Figma Plugin Prototype
          </button>
          <button
            onClick={() => setActiveTab('cms')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              activeTab === 'cms' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Headless CMS Webhooks
          </button>
        </div>
      </div>

      {/* TAB 1: GITHUB ACTIONS CI/CD */}
      {activeTab === 'github' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-6 space-y-6">
            <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <GitPullRequest className="w-5 h-5 text-teal-700" />
                Live Pull Request Launch Gate Simulator
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Test how the OmniGuide GitHub Action evaluates modified content files in pull requests,
                validates against registered guidelines, and enforces the Strict Launch Gate to block non-compliant PRs.
              </p>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Pull Request Test Case</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCiCopyType('violating')}
                      className={`p-2.5 text-left rounded-lg border text-xs font-medium transition ${
                        ciCopyType === 'violating'
                          ? 'border-rose-500 bg-rose-50/50 text-rose-900 font-semibold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div>🔴 Violating Copy PR</div>
                      <div className="text-[11px] text-slate-500">Contains "#1 fastest", "cheap", "zero downtime"</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCiCopyType('compliant')}
                      className={`p-2.5 text-left rounded-lg border text-xs font-medium transition ${
                        ciCopyType === 'compliant'
                          ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-semibold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div>🟢 Compliant Copy PR</div>
                      <div className="text-[11px] text-slate-500">Cites verified 42ms latency SLA</div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Launch Gate Policy Enforcement</label>
                  <select
                    value={ciGatePolicy}
                    onChange={(e: any) => setCiGatePolicy(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-medium"
                  >
                    <option value="strict">Strict Gate (Blocks on ANY High or Medium violation)</option>
                    <option value="standard">Standard Gate (Blocks on High severity only)</option>
                    <option value="advisory">Advisory Gate (Non-blocking findings report)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={runCiSimulation}
                  disabled={ciRunning}
                  className="w-full py-2.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition flex items-center justify-center gap-2 shadow-2xs disabled:opacity-50"
                >
                  {ciRunning ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Evaluating PR Against Brand Guidelines...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Run Pull Request Governance Check
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* CLI Execution Commands */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-900 text-slate-100 space-y-2 font-mono text-xs">
              <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-teal-400" />
                Run Locally via CLI Client
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 select-all overflow-x-auto text-[11px] text-teal-300">
                python scripts/governance_ci.py --file content/sample_failing_copy.md --launch-gate strict
              </div>
              <div className="text-[10px] text-slate-400">
                Exit code 0 on compliance, exit code 1 on blocking gate violation.
              </div>
            </div>
          </div>

          {/* Right Column: Workflow Output & Summary (6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            {ciResult ? (
              <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    {ciResult.gatePassed ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    ) : (
                      <XCircle className="w-6 h-6 text-rose-600" />
                    )}
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        CI Pull Request Check: {ciResult.gatePassed ? 'PASSED (Exit 0)' : 'BLOCKED (Exit 1)'}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        Policy: {ciResult.policy.toUpperCase()} • {ciResult.review.findings.length} findings
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      ciResult.gatePassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {ciResult.gatePassed ? 'Approved' : 'PR Blocked'}
                  </span>
                </div>

                <div className="text-xs p-3 rounded-lg bg-slate-50 text-slate-700 font-medium">
                  {ciResult.reason}
                </div>

                {/* Findings Table */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    $GITHUB_STEP_SUMMARY Output Preview:
                  </div>
                  {ciResult.review.findings.length === 0 ? (
                    <div className="p-4 text-center text-xs text-emerald-700 bg-emerald-50 rounded-lg">
                      No violations detected. Ready for automatic merge.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden text-xs">
                      {ciResult.review.findings.map((f: any, idx: number) => (
                        <div key={idx} className="p-3 bg-white space-y-1">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                f.severity === 'High' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {f.severity}
                            </span>
                            <span className="font-mono text-[11px] text-teal-700 font-semibold">
                              {f.guideline_clause_identifier || 'SEC-1.1'}
                            </span>
                          </div>
                          <div className="font-semibold text-slate-900">"{f.original_excerpt}"</div>
                          <div className="text-slate-600">{f.explanation}</div>
                          <div className="text-[11px] text-teal-800 bg-teal-50 p-1.5 rounded">
                            <strong>Remediation:</strong> {f.suggested_fix}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Workflow YAML Preview */
              <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-slate-500" />
                    .github/workflows/content-governance.yml
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Reusable Action</span>
                </div>
                <pre className="p-3 rounded-lg bg-slate-900 text-slate-200 text-[11px] font-mono overflow-x-auto max-h-[360px] leading-relaxed">
{`name: OmniGuide Content Governance Check
on:
  pull_request:
    paths: ['content/**', 'copy/**', '**/*.md']

jobs:
  governance-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install httpx
      - name: Run OmniGuide Governance Gate
        run: |
          python scripts/governance_ci.py \\
            --file "$CHANGED_FILE" \\
            --launch-gate strict`}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FIGMA INTEGRATION PROTOTYPE */}
      {activeTab === 'figma' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-6 space-y-6">
            <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-teal-700" />
                  Interactive Figma Selection Simulator
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                  Local Prototype
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Simulates selecting a text layer on the Figma canvas and auditing it via{' '}
                <code className="text-teal-700 font-mono">POST /api/integrations/figma/audit</code>.
              </p>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Canvas Layer Name</label>
                  <input
                    type="text"
                    value={figmaNodeName}
                    onChange={(e) => setFigmaNodeName(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Selected Layer Text Content
                  </label>
                  <textarea
                    rows={4}
                    value={figmaText}
                    onChange={(e) => setFigmaText(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white font-medium"
                    placeholder="Type or paste copy selected from a Figma frame..."
                  />
                </div>

                <button
                  type="button"
                  onClick={handleFigmaAudit}
                  disabled={figmaLoading || !figmaText.trim()}
                  className="w-full py-2.5 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition flex items-center justify-center gap-2 shadow-2xs disabled:opacity-50"
                >
                  {figmaLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Auditing Selection...
                    </>
                  ) : (
                    <>
                      <Shield className="w-3.5 h-3.5" />
                      Audit Figma Selection
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Plugin Installation Instructions */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs text-slate-600">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-teal-600" />
                How to Run in Figma Desktop App
              </div>
              <ol className="list-decimal pl-4 space-y-1 text-slate-500">
                <li>Open Figma Desktop → <strong>Plugins</strong> → <strong>Development</strong>.</li>
                <li>Click <strong>Import plugin from manifest...</strong>.</li>
                <li>Select <code className="bg-white px-1 py-0.5 rounded border font-mono">integrations/figma/manifest.json</code>.</li>
                <li>Select any text layer on your canvas and launch the plugin!</li>
              </ol>
            </div>
          </div>

          {/* Right Column: Figma Audit Response */}
          <div className="lg:col-span-6 space-y-6">
            {figmaResult ? (
              <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Layer: {figmaResult.node_name}
                    </div>
                    <div className="text-base font-bold text-slate-900 mt-0.5">
                      Compliance Score: {figmaResult.compliance_score}/100
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      figmaResult.status === 'compliant'
                        ? 'bg-emerald-100 text-emerald-800'
                        : figmaResult.status === 'flagged'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {figmaResult.status}
                  </span>
                </div>

                {/* Rewrites Section */}
                {figmaResult.suggested_rewrites && figmaResult.suggested_rewrites.length > 0 && (
                  <div className="p-3.5 rounded-lg bg-teal-50 border border-teal-200/80 space-y-2">
                    <div className="text-xs font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                      Compliant Intent-Preserving Rewrite
                    </div>
                    <div className="text-xs font-medium text-teal-950 bg-white p-2.5 rounded border border-teal-100">
                      "{figmaResult.suggested_rewrites[0]}"
                    </div>
                    <button
                      onClick={() => setFigmaText(figmaResult.suggested_rewrites[0])}
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-teal-700 hover:bg-teal-800 text-white transition shadow-2xs"
                    >
                      Apply Rewrite to Layer
                    </button>
                  </div>
                )}

                {/* Findings List */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Grounded Violations ({figmaResult.total_findings})
                  </div>
                  <div className="space-y-2">
                    {figmaResult.findings.map((f, i) => (
                      <div key={i} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-rose-700">[{f.severity}] {f.category}</span>
                          <span className="font-mono text-teal-700 font-semibold">{f.guideline_clause_identifier}</span>
                        </div>
                        <div className="font-semibold text-slate-800">"{f.original_excerpt}"</div>
                        <div className="text-slate-600">{f.explanation}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center rounded-xl border border-slate-200 bg-white text-slate-400 text-xs">
                Enter copy and click "Audit Figma Selection" to view real-time governance feedback.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: HEADLESS CMS WEBHOOKS */}
      {activeTab === 'cms' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-6 space-y-6">
            <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Webhook className="w-5 h-5 text-teal-700" />
                Headless CMS Webhook Receiver & Gate
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Connect Contentful or Strapi webhooks to <code className="text-teal-700 font-mono">POST /api/integrations/cms/webhook</code>.
                OmniGuide validates HMAC signatures, handles duplicate delivery via idempotency, and audits copy before publishing.
              </p>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">CMS Provider</label>
                  <select
                    value={cmsProvider}
                    onChange={(e: any) => setCmsProvider(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-medium"
                  >
                    <option value="contentful">Contentful (Publish Event)</option>
                    <option value="strapi">Strapi (Entry.Publish Event)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Webhook Secret (Optional)
                  </label>
                  <input
                    type="password"
                    value={cmsSecret}
                    onChange={(e) => setCmsSecret(e.target.value)}
                    placeholder="Enter OMNIGUIDE_WEBHOOK_SECRET token..."
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CMS Entry Copy Payload
                  </label>
                  <textarea
                    rows={3}
                    value={cmsCopy}
                    onChange={(e) => setCmsCopy(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCmsWebhook(false)}
                    disabled={cmsLoading}
                    className="py-2.5 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition flex items-center justify-center gap-2 shadow-2xs disabled:opacity-50"
                  >
                    <Webhook className="w-3.5 h-3.5" />
                    Send Webhook Event
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCmsWebhook(true)}
                    disabled={cmsLoading}
                    className="py-2.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center justify-center gap-2 border border-slate-200"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Test Duplicate (Idempotency)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Webhook Response Inspector */}
          <div className="lg:col-span-6 space-y-6">
            {cmsResult ? (
              <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Webhook Event: {cmsResult.event_id}
                    </div>
                    <div className="text-base font-bold text-slate-900 mt-0.5">
                      Decision: {cmsResult.audit_decision.toUpperCase()}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      cmsResult.audit_decision === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : cmsResult.audit_decision === 'blocked'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {cmsResult.status}
                  </span>
                </div>

                <div className="text-xs p-3 rounded-lg bg-slate-50 text-slate-700 font-medium">
                  {cmsResult.message}
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono border-t border-slate-100 pt-3">
                  <div>
                    <span className="text-slate-400">Provider:</span>{' '}
                    <strong className="text-slate-800">{cmsResult.provider}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Blocking Violations:</span>{' '}
                    <strong className={cmsResult.blocking_violations_count > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                      {cmsResult.blocking_violations_count}
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center rounded-xl border border-slate-200 bg-white text-slate-400 text-xs">
                Send a webhook event to inspect real-time payload verification, signature checking, and audit decisions.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
