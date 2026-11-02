import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileImage,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Shield,
  Sparkles,
  RefreshCw,
  Download,
  Info,
  Maximize2,
  Trash2,
  Clock,
  Layers,
  ChevronRight,
  Sliders
} from 'lucide-react';
import { api } from '../services/api';
import { AssetAudit, AssetFinding, AssetAuditListItem } from '../types';

export const AssetAuditPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [brandName, setBrandName] = useState('NovaForge');
  const [targetChannel, setTargetChannel] = useState('display_ad');
  const [disclaimerThreshold, setDisclaimerThreshold] = useState(0.20);
  const [isAuditing, setIsAuditing] = useState(false);
  const [currentAudit, setCurrentAudit] = useState<AssetAudit | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hoveredFindingId, setHoveredFindingId] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [recentAudits, setRecentAudits] = useState<AssetAuditListItem[]>([]);
  const [activeTab, setActiveTab] = useState<'audit' | 'history'>('audit');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadRecentAudits();
  }, []);

  const loadRecentAudits = async () => {
    try {
      const list = await api.getAssetAudits();
      setRecentAudits(list);
    } catch (e) {
      console.error('Failed to load recent asset audits', e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      selectImageFile(file);
    }
  };

  const selectImageFile = (file: File) => {
    setSelectedFile(file);
    setErrorMsg(null);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectImageFile(e.dataTransfer.files[0]);
    }
  };

  // Pre-load benchmark demo scenarios
  const loadDemoScenario = (scenarioType: 'superlative' | 'metric' | 'compliant') => {
    setErrorMsg(null);
    // Create an in-memory canvas to generate realistic benchmark images
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 450;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (scenarioType === 'superlative') {
      // Dark navy gradient background
      const grad = ctx.createLinearGradient(0, 0, 800, 450);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 800, 450);

      // Brand badge
      ctx.fillStyle = '#0d9488';
      ctx.fillRect(50, 40, 140, 30);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.fillText('NOVAFORGE', 75, 60);

      // Dominant superlative headline (height ~ 48px)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 38px Inter, sans-serif';
      ctx.fillText("India's #1 Fastest Enterprise Cloud", 50, 160);

      // Sub-copy
      ctx.fillStyle = '#94a3b8';
      ctx.font = '18px Inter, sans-serif';
      ctx.fillText('Get 100% guaranteed zero-downtime infrastructure for scale.', 50, 220);

      // Tiny, obscured disclaimer at bottom (height ~ 10px -> 10/48 = 20.8% or smaller)
      ctx.fillStyle = '#475569';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText('*Claim based on internal latency tests conducted Jan 2024. Subject to standard commercial exclusions.', 50, 410);

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'banner_superlative_fastest.png', { type: 'image/png' });
          selectImageFile(file);
        }
      });
    } else if (scenarioType === 'metric') {
      const grad = ctx.createLinearGradient(0, 0, 800, 450);
      grad.addColorStop(0, '#0c4a6e');
      grad.addColorStop(1, '#075985');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 800, 450);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px Inter, sans-serif';
      ctx.fillText('Eliminate 100% of Errors with 98% Latency Drop', 50, 170);

      ctx.fillStyle = '#bae6fd';
      ctx.font = '18px Inter, sans-serif';
      ctx.fillText('Modern engineering infrastructure delivering instant scale.', 50, 230);

      ctx.fillStyle = '#7dd3fc';
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText('*Comparative metric claims not registered in corporate fact library.', 50, 410);

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'unverified_metric_banner.png', { type: 'image/png' });
          selectImageFile(file);
        }
      });
    } else {
      // Compliant
      const grad = ctx.createLinearGradient(0, 0, 800, 450);
      grad.addColorStop(0, '#064e3b');
      grad.addColorStop(1, '#065f46');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 800, 450);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px Inter, sans-serif';
      ctx.fillText('High-Performance Enterprise Cloud Infrastructure', 50, 170);

      ctx.fillStyle = '#a7f3d0';
      ctx.font = '18px Inter, sans-serif';
      ctx.fillText('Delivering verified 42ms benchmark latency for critical enterprise workloads.', 50, 230);

      ctx.fillStyle = '#6ee7b7';
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText('Certified by TechAudit Labs Report #TA-2026-01. Uptime backed by 99.95% Enterprise SLA.', 50, 410);

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'compliant_enterprise_ad.png', { type: 'image/png' });
          selectImageFile(file);
        }
      });
    }
  };

  const handleRunAudit = async () => {
    if (!selectedFile) {
      setErrorMsg('Please select an image file to audit.');
      return;
    }

    setIsAuditing(true);
    setErrorMsg(null);

    try {
      const result = await api.auditAsset(selectedFile, {
        brand_name: brandName,
        target_channel: targetChannel,
        disclaimer_ratio_threshold: disclaimerThreshold
      });
      setCurrentAudit(result);
      loadRecentAudits();
    } catch (err: any) {
      setErrorMsg(err.message || 'Asset audit failed. Please verify the image file.');
    } finally {
      setIsAuditing(false);
    }
  };

  const handleDownloadReport = async (auditId: string) => {
    try {
      const reportMd = await api.getAssetReport(auditId);
      const blob = new Blob([reportMd], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `OmniGuide_Asset_Audit_${auditId}.md`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('Failed to download report: ' + err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-700">
              <FileImage className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Multimodal Creative Asset Governance
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-slate-500 max-w-2xl">
            Audit visual banners, display ads, and promotional creatives using Gemini Vision with grounding
            against brand guidelines and registered corporate Approved Facts.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'audit' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            New Asset Audit
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'history' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Audit History ({recentAudits.length})
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold">Audit Error</div>
            <div>{errorMsg}</div>
          </div>
        </div>
      )}

      {activeTab === 'audit' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Upload & Canvas Preview (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Benchmark Demo Buttons */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                Pre-Loaded Benchmark Creative Demo Scenarios
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => loadDemoScenario('superlative')}
                  className="px-3 py-2 text-left rounded-lg bg-white border border-slate-200 hover:border-teal-500 hover:bg-teal-50/30 transition text-xs group"
                >
                  <div className="font-semibold text-slate-800 group-hover:text-teal-900">#1 Fastest Banner</div>
                  <div className="text-[11px] text-slate-500">Violates SEC-1.1 & tiny disclaimer</div>
                </button>
                <button
                  type="button"
                  onClick={() => loadDemoScenario('metric')}
                  className="px-3 py-2 text-left rounded-lg bg-white border border-slate-200 hover:border-amber-500 hover:bg-amber-50/30 transition text-xs group"
                >
                  <div className="font-semibold text-slate-800 group-hover:text-amber-900">98% Metric Drop</div>
                  <div className="text-[11px] text-slate-500">Unapproved numerical claims</div>
                </button>
                <button
                  type="button"
                  onClick={() => loadDemoScenario('compliant')}
                  className="px-3 py-2 text-left rounded-lg bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition text-xs group"
                >
                  <div className="font-semibold text-slate-800 group-hover:text-emerald-900">Compliant Ad (42ms)</div>
                  <div className="text-[11px] text-slate-500">Verified corporate SLA fact</div>
                </button>
              </div>
            </div>

            {/* Upload Zone / Interactive Canvas */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-teal-600" />
                  Visual Creative Canvas
                </span>
                {currentAudit && (
                  <span className="text-xs text-slate-500 font-mono">
                    {currentAudit.image_width} × {currentAudit.image_height} px ({currentAudit.mime_type})
                  </span>
                )}
              </div>

              {previewUrl || (currentAudit && currentAudit.image_data_url) ? (
                <div className="relative bg-slate-900 flex items-center justify-center p-2 min-h-[360px] overflow-hidden select-none">
                  {/* Base Image */}
                  <div className="relative max-w-full max-h-[500px]">
                    <img
                      src={currentAudit?.image_data_url || previewUrl || ''}
                      alt="Uploaded Creative Asset"
                      className="max-h-[500px] w-auto object-contain block rounded"
                    />

                    {/* Bounding Box Overlays */}
                    {currentAudit &&
                      currentAudit.findings.map((f) => {
                        if (
                          f.box_ymin === null ||
                          f.box_ymin === undefined ||
                          f.box_xmin === null ||
                          f.box_xmin === undefined ||
                          f.box_ymax === null ||
                          f.box_ymax === undefined ||
                          f.box_xmax === null ||
                          f.box_xmax === undefined
                        ) {
                          return null;
                        }

                        const top = `${f.box_ymin}%`;
                        const left = `${f.box_xmin}%`;
                        const width = `${Math.max(2, f.box_xmax - f.box_xmin)}%`;
                        const height = `${Math.max(2, f.box_ymax - f.box_ymin)}%`;

                        const isHigh = f.severity === 'High';
                        const isHovered = hoveredFindingId === f.id || selectedFindingId === f.id;

                        const borderColor = isHigh ? 'border-rose-500' : 'border-amber-500';
                        const bgColor = isHigh ? 'bg-rose-500/20' : 'bg-amber-500/20';
                        const badgeColor = isHigh ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white';

                        return (
                          <div
                            key={f.id}
                            style={{ top, left, width, height }}
                            onMouseEnter={() => setHoveredFindingId(f.id)}
                            onMouseLeave={() => setHoveredFindingId(null)}
                            onClick={() => setSelectedFindingId(f.id)}
                            className={`absolute border-2 rounded transition-all cursor-pointer ${borderColor} ${bgColor} ${
                              isHovered ? 'ring-2 ring-white ring-offset-2 scale-[1.01] z-20 shadow-lg' : 'z-10'
                            }`}
                          >
                            <span
                              className={`absolute -top-3.5 left-1 text-[9px] font-bold px-1 py-0.5 rounded shadow-xs uppercase tracking-wider ${badgeColor}`}
                            >
                              {f.severity}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-12 text-center border-2 border-dashed border-slate-300 hover:border-teal-500 bg-slate-50/50 hover:bg-teal-50/20 transition cursor-pointer flex flex-col items-center justify-center min-h-[320px]"
                >
                  <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 mb-4 shadow-2xs">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div className="text-base font-semibold text-slate-800">
                    Upload creative banner or ad asset
                  </div>
                  <div className="text-xs text-slate-500 mt-1 max-w-sm">
                    Drag and drop your image here, or browse files. Supported formats: PNG, JPEG, WebP (up to 15MB).
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Action Toolbar */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition shadow-2xs"
                  >
                    Select New Image
                  </button>
                  {selectedFile && (
                    <span className="text-xs text-slate-600 font-mono truncate max-w-[200px]">
                      {selectedFile.name}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleRunAudit}
                  disabled={!selectedFile || isAuditing}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition disabled:opacity-50 flex items-center gap-2 shadow-2xs"
                >
                  {isAuditing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Auditing via Gemini Vision...
                    </>
                  ) : (
                    <>
                      <Shield className="w-3.5 h-3.5" />
                      Audit Creative Asset
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Heuristic Configuration Panel */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  Audit Configuration & Heuristics
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Min Ratio: {(disclaimerThreshold * 100).toFixed(0)}%
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Target Channel</label>
                  <select
                    value={targetChannel}
                    onChange={(e) => setTargetChannel(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="display_ad">Display Banner (Google/AdRoll)</option>
                    <option value="instagram">Instagram / Social Feed</option>
                    <option value="billboard">Digital Out-of-Home (OOH)</option>
                    <option value="landing_hero">Website Hero Header</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Disclaimer Legibility Threshold (Headline Height %)
                  </label>
                  <input
                    type="range"
                    min="0.10"
                    max="0.40"
                    step="0.05"
                    value={disclaimerThreshold}
                    onChange={(e) => setDisclaimerThreshold(parseFloat(e.target.value))}
                    className="w-full accent-teal-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>10% (Permissive)</span>
                    <span>20% (Standard)</span>
                    <span>40% (Strict)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Findings & Disclaimer Visibility Gauge (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {currentAudit ? (
              <>
                {/* Executive Scorecard */}
                <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Governance Verdict
                      </div>
                      <div className="text-lg font-bold text-slate-900 mt-0.5 flex items-center gap-2">
                        {currentAudit.overall_status === 'compliant' ? (
                          <span className="text-emerald-700 flex items-center gap-1.5">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            Compliant
                          </span>
                        ) : currentAudit.overall_status === 'flagged' ? (
                          <span className="text-rose-700 flex items-center gap-1.5">
                            <XCircle className="w-5 h-5 text-rose-600" />
                            Violations Flagged
                          </span>
                        ) : (
                          <span className="text-amber-700 flex items-center gap-1.5">
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                            Needs Review
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownloadReport(currentAudit.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Report (.md)
                    </button>
                  </div>

                  {/* Disclaimer Visibility Heuristic Gauge */}
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Disclaimer Legibility Heuristic:</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          currentAudit.disclaimer_status === 'compliant'
                            ? 'bg-emerald-100 text-emerald-800'
                            : currentAudit.disclaimer_status === 'violation'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {currentAudit.disclaimer_status.toUpperCase()}
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 transition-all duration-500 ${
                          currentAudit.disclaimer_status === 'compliant'
                            ? 'bg-emerald-500'
                            : currentAudit.disclaimer_status === 'violation'
                            ? 'bg-rose-500'
                            : 'bg-slate-400'
                        }`}
                        style={{
                          width: `${Math.min(100, ((currentAudit.disclaimer_ratio || 0) / 0.40) * 100)}%`
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        Measured Ratio:{' '}
                        <strong>
                          {currentAudit.disclaimer_ratio !== null && currentAudit.disclaimer_ratio !== undefined
                            ? `${(currentAudit.disclaimer_ratio * 100).toFixed(1)}%`
                            : 'N/A'}
                        </strong>
                      </span>
                      <span>
                        Threshold: {(currentAudit.disclaimer_threshold * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Extracted Copy Summary */}
                  <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
                    <div>
                      <span className="font-semibold text-slate-700">Extracted Headline: </span>
                      <span className="text-slate-600 font-medium">
                        "{currentAudit.headline_text || 'None detected'}"
                      </span>
                    </div>
                    {currentAudit.disclaimer_text && (
                      <div>
                        <span className="font-semibold text-slate-700">Extracted Disclaimer: </span>
                        <span className="text-slate-500 italic">
                          "{currentAudit.disclaimer_text}"
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Grounded Findings List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Grounded Visual Findings ({currentAudit.findings.length})
                    </span>
                    <span className="text-xs text-slate-500">Hover box on canvas to inspect</span>
                  </div>

                  {currentAudit.findings.length === 0 ? (
                    <div className="p-6 text-center rounded-xl bg-white border border-slate-200 text-xs text-slate-500">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      No visual or text compliance issues found in this creative asset.
                    </div>
                  ) : (
                    currentAudit.findings.map((f, idx) => {
                      const isHigh = f.severity === 'High';
                      const isSelected = selectedFindingId === f.id || hoveredFindingId === f.id;

                      return (
                        <div
                          key={f.id}
                          onMouseEnter={() => setHoveredFindingId(f.id)}
                          onMouseLeave={() => setHoveredFindingId(null)}
                          onClick={() => setSelectedFindingId(f.id)}
                          className={`p-4 rounded-xl border bg-white transition-all cursor-pointer ${
                            isSelected
                              ? 'border-teal-500 ring-2 ring-teal-100 shadow-md'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                  isHigh ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {f.severity}
                              </span>
                              <span className="text-xs font-semibold text-slate-800">
                                {f.category.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                              {f.evidence_tier}
                            </span>
                          </div>

                          <div className="text-xs font-semibold text-slate-900 bg-slate-50 p-2 rounded border border-slate-100 mb-2">
                            "{f.extracted_text}"
                          </div>

                          <p className="text-xs text-slate-600 mb-2">{f.explanation}</p>

                          <div className="text-xs bg-teal-50/60 border border-teal-100 p-2 rounded text-teal-900 mb-2">
                            <span className="font-semibold">Recommended Remediation: </span>
                            {f.suggested_fix}
                          </div>

                          {f.guideline_clause_identifier && (
                            <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2 font-mono">
                              <span>Policy Citation:</span>
                              <span className="text-teal-700 font-semibold">
                                {f.guideline_clause_identifier}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="p-8 rounded-xl border border-slate-200 bg-white text-center text-slate-400 space-y-3">
                <Shield className="w-10 h-10 mx-auto text-slate-300" />
                <div className="text-sm font-semibold text-slate-600">Awaiting Asset Submission</div>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Select an image or one of the pre-loaded benchmark scenarios above, then click "Audit Creative Asset"
                  to execute visual compliance verification.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* History Tab */
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Historical Asset Audits
            </span>
            <button
              onClick={loadRecentAudits}
              className="text-xs text-teal-700 hover:text-teal-800 flex items-center gap-1 font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {recentAudits.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No creative asset audits recorded yet. Run your first image audit above!
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentAudits.map((item) => (
                <div
                  key={item.id}
                  className="p-4 hover:bg-slate-50 transition flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="p-2 rounded bg-slate-100 text-slate-600">
                      <FileImage className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{item.filename}</div>
                      <div className="text-xs text-slate-400 font-mono">
                        {item.image_width}×{item.image_height}px • {item.mime_type} •{' '}
                        {new Date(item.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        item.overall_status === 'compliant'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.overall_status === 'flagged'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.overall_status}
                    </span>

                    <button
                      onClick={() => handleDownloadReport(item.id)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition"
                      title="Download Markdown Report"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
