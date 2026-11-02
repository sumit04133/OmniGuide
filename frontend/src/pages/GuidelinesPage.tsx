import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileUp,
  Download,
  Database,
  Search,
  ChevronDown,
  ChevronRight,
  Info,
  GitBranch,
  Scale,
  ShieldCheck,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { api } from '../services/api';
import { GuidelineDocument, ApprovedFact, RegulatoryRulePack, PolicyHierarchyNode } from '../types';

export const GuidelinesPage: React.FC = () => {
  const [documents, setDocuments] = useState<GuidelineDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<GuidelineDocument | null>(null);
  const [approvedFacts, setApprovedFacts] = useState<ApprovedFact[]>([]);
  const [regulatoryPacks, setRegulatoryPacks] = useState<RegulatoryRulePack[]>([]);
  const [hierarchyData, setHierarchyData] = useState<{ total_documents: number; corporate_roots: PolicyHierarchyNode[] } | null>(null);
  const [activeTab, setActiveTab] = useState<'documents' | 'upload' | 'facts' | 'hierarchy' | 'regulatory'>('documents');

  // Form states
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [showPdfProcessingExpl, setShowPdfProcessingExpl] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [factText, setFactText] = useState('');
  const [factCategory, setFactCategory] = useState('performance');
  const [factSource, setFactSource] = useState('');

  // UI feedback
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [clauseSearch, setClauseSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [docs, facts, packs, hierarchy] = await Promise.all([
        api.getGuidelines(),
        api.getApprovedFacts(),
        api.getRegulatoryPacks(),
        api.getGuidelineHierarchy()
      ]);
      setDocuments(docs);
      setApprovedFacts(facts);
      setRegulatoryPacks(packs);
      setHierarchyData(hierarchy);
      if (docs.length > 0 && !selectedDoc) {
        const fullDoc = await api.getGuideline(docs[0].id);
        setSelectedDoc(fullDoc);
      }
    } catch (err: any) {
      console.error('Error fetching guidelines:', err);
    }
  }, [selectedDoc]);

  const handleToggleRulePack = async (packId: string, currentEnabled: boolean) => {
    try {
      await api.toggleRegulatoryPack(packId, !currentEnabled);
      setRegulatoryPacks(prev =>
        prev.map(p => p.id === packId ? { ...p, is_enabled: !currentEnabled } : p)
      );
      setSuccessMsg(`Regulatory rule pack '${packId}' ${!currentEnabled ? 'enabled' : 'disabled'}.`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (e: any) {
      setErrorMsg('Failed to toggle rule pack: ' + e.message);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectDoc = async (id: string) => {
    try {
      const doc = await api.getGuideline(id);
      setSelectedDoc(doc);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!uploadTitle.trim()) {
      setErrorMsg('Please enter a guideline title.');
      return;
    }
    if (!uploadFile) {
      setErrorMsg('Please select a PDF file to upload.');
      return;
    }

    setLoading(true);
    try {
      const newDoc = await api.uploadGuidelinePDF(uploadTitle, uploadFile);
      setSuccessMsg(`Extracted ${newDoc.clause_count} clauses from '${newDoc.filename}'!`);
      setUploadTitle('');
      setUploadFile(null);
      await loadData();
      setSelectedDoc(newDoc);
      setActiveTab('documents');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to extract text from PDF.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!manualTitle.trim()) {
      setErrorMsg('Please enter a guideline title.');
      return;
    }
    if (manualContent.trim().length < 20) {
      setErrorMsg('Please provide comprehensive guideline content with distinct sections or rules.');
      return;
    }

    setLoading(true);
    try {
      const newDoc = await api.createManualGuideline({
        title: manualTitle,
        content: manualContent,
      });
      setSuccessMsg(`Created guideline '${newDoc.title}' with ${newDoc.clause_count} clauses!`);
      setManualTitle('');
      setManualContent('');
      await loadData();
      setSelectedDoc(newDoc);
      setActiveTab('documents');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save manual guideline.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factText.trim()) return;

    try {
      await api.createApprovedFact({
        fact_text: factText.trim(),
        category: factCategory,
        source_reference: factSource.trim() || undefined,
      });
      setFactText('');
      setFactSource('');
      setSuccessMsg('Approved corporate fact registered successfully.');
      const updatedFacts = await api.getApprovedFacts();
      setApprovedFacts(updatedFacts);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleDeleteFact = async (id: string) => {
    try {
      await api.deleteApprovedFact(id);
      setApprovedFacts((prev) => prev.filter((f) => f.id !== id));
      setSuccessMsg('Approved fact removed.');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!window.confirm('Delete this guideline document and its indexed clauses?')) return;
    try {
      await api.deleteGuideline(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (selectedDoc?.id === id) {
        setSelectedDoc(null);
      }
      setSuccessMsg('Guideline document deleted.');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const filteredClauses = selectedDoc?.clauses?.filter((c) => {
    if (!clauseSearch.trim()) return true;
    const q = clauseSearch.toLowerCase();
    return (
      c.clause_identifier.toLowerCase().includes(q) ||
      c.clause_text.toLowerCase().includes(q) ||
      (c.section_heading && c.section_heading.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-teal-600" />
            <span>Guidelines & Approved Facts</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage ground-truth brand policies, indexed clause citations, and verified corporate facts.
          </p>
        </div>

        <a
          href="/demo_guideline.pdf"
          download="novaforge_governance_v2.4.pdf"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold self-start sm:self-auto transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Download Sample PDF</span>
        </a>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Guideline Notice</div>
            <div className="text-xs text-red-700 mt-0.5">{errorMsg}</div>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs sm:text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Clearly Separated Tabs per Section 8 */}
      <div className="flex border-b border-slate-200 space-x-2">
        <button
          onClick={() => { setActiveTab('documents'); setErrorMsg(null); }}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-lg transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'documents'
              ? 'bg-white text-teal-800 border-t-2 border-t-teal-600 border-x border-slate-200 shadow-2xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Guideline Documents & Clauses</span>
        </button>

        <button
          onClick={() => { setActiveTab('upload'); setErrorMsg(null); }}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-lg transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'upload'
              ? 'bg-white text-teal-800 border-t-2 border-t-teal-600 border-x border-slate-200 shadow-2xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Upload PDF Guidelines</span>
        </button>

        <button
          onClick={() => { setActiveTab('facts'); setErrorMsg(null); }}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-lg transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'facts'
              ? 'bg-white text-teal-800 border-t-2 border-t-teal-600 border-x border-slate-200 shadow-2xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Approved Corporate Facts ({approvedFacts.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('hierarchy'); setErrorMsg(null); }}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-lg transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'hierarchy'
              ? 'bg-white text-teal-800 border-t-2 border-t-teal-600 border-x border-slate-200 shadow-2xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <GitBranch className="w-4 h-4" />
          <span>Policy Hierarchy Graph</span>
        </button>

        <button
          onClick={() => { setActiveTab('regulatory'); setErrorMsg(null); }}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-lg transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'regulatory'
              ? 'bg-white text-teal-800 border-t-2 border-t-teal-600 border-x border-slate-200 shadow-2xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Regulatory Rule Packs ({regulatoryPacks.length})</span>
        </button>
      </div>

      {/* Tab 1: Documents & Clauses Browser */}
      {activeTab === 'documents' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Active Guideline Document</h2>
              <p className="text-xs text-slate-500">
                Select document to inspect clauses cited during marketing content audits.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Select Document:</span>
              <select
                value={selectedDoc?.id || ''}
                onChange={(e) => handleSelectDoc(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 focus-ring"
              >
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} {d.is_demo ? '(Active Standard)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedDoc ? (
            <div className="space-y-4">
              {/* Document Summary Card */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{selectedDoc.title}</span>
                    {selectedDoc.is_demo && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                        Verified Baseline
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    File: {selectedDoc.filename} • {selectedDoc.clauses?.length || selectedDoc.clause_count || 0} Clauses Indexed
                  </p>
                </div>

                {!selectedDoc.is_demo && (
                  <button
                    onClick={() => handleDeleteDoc(selectedDoc.id)}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-red-50 border border-red-200 text-red-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Document</span>
                  </button>
                )}
              </div>

              {/* Optional Technical Extraction Details per Section 8 */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowTechDetails(!showTechDetails)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1 cursor-pointer"
                >
                  {showTechDetails ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <span>{showTechDetails ? 'Hide' : 'Show'} Technical Extraction Details</span>
                </button>

                {showTechDetails && (
                  <div className="mt-2 p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 font-mono space-y-1 animate-fadeIn">
                    <div>Parser: PyMuPDF 2.0 digital stream reader</div>
                    <div>Extraction Method: Header regex boundary splitting + clause ID detection</div>
                    <div>Page Tracking: 1-indexed physical PDF coordinate bounding</div>
                    <div>Indexing: Lexical BM25 index + exact clause key storage in SQLite/PostgreSQL</div>
                  </div>
                )}
              </div>

              {/* Clause Search Filter */}
              <div className="relative max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={clauseSearch}
                  onChange={(e) => setClauseSearch(e.target.value)}
                  placeholder="Search extracted clauses by ID, heading, or keyword..."
                  className="w-full pl-9 pr-3.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus-ring"
                />
              </div>

              {/* Clauses List */}
              <div className="space-y-3">
                {filteredClauses?.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition-colors shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                          {c.clause_identifier}
                        </span>
                        {c.section_heading && (
                          <span className="text-xs font-semibold text-slate-800">
                            {c.section_heading}
                          </span>
                        )}
                      </div>
                      {c.page_number && (
                        <span className="text-[11px] text-slate-500 font-mono px-2 py-0.5 rounded bg-slate-50 border border-slate-200">
                          Page {c.page_number}
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed pl-2 border-l-2 border-teal-500">
                      {c.clause_text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-sm">
              No guideline document selected.
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Upload PDF Guidelines & Manual Entry */}
      {activeTab === 'upload' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Upload Digital PDF Guidelines</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              PyMuPDF parses searchable text page-by-page, extracts identifiable clauses, and indexes them with page references.
            </p>
          </div>

          <form onSubmit={handleUploadSubmit} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Guideline Document Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="e.g. Acme Corp Global Brand & Compliance Standard 2026"
                className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus-ring"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                PDF Document File <span className="text-red-500">*</span>
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.[0]) {
                    setUploadFile(e.dataTransfer.files[0]);
                  }
                }}
                className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-xl transition-colors ${
                  isDragging
                    ? 'border-teal-500 bg-teal-50/50'
                    : 'border-slate-300 bg-slate-50/60 hover:border-teal-500'
                }`}
              >
                <div className="space-y-2 text-center">
                  <FileUp className="mx-auto h-8 w-8 text-teal-600" />
                  <div className="flex text-xs text-slate-600">
                    <label className="relative cursor-pointer rounded font-medium text-teal-700 hover:text-teal-800">
                      <span>Choose a PDF file</span>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        className="sr-only"
                      />
                    </label>
                    <p className="pl-1 text-slate-500">or drag and drop</p>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {uploadFile ? (
                      <span className="text-teal-800 font-semibold">{uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)</span>
                    ) : (
                      'Digital PDF up to 15MB. Note: Requires searchable digital text.'
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Compact Expandable Section: How PDF processing works */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPdfProcessingExpl(!showPdfProcessingExpl)}
                className="w-full p-3.5 text-left flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-teal-600" />
                  <span>How PDF processing works</span>
                </div>
                {showPdfProcessingExpl ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {showPdfProcessingExpl && (
                <div className="px-4 pb-4 text-xs space-y-2.5 border-t border-slate-200/80 pt-3 animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                    <div>• <strong className="text-slate-800">Accepted Format:</strong> Searchable PDF (.pdf)</div>
                    <div>• <strong className="text-slate-800">Maximum File Size:</strong> 15 MB (enforced by backend)</div>
                    <div>• <strong className="text-slate-800">Text Requirement:</strong> Digital text stream (OCR not supported)</div>
                    <div>• <strong className="text-slate-800">Scanned PDF Policy:</strong> Scanned image-only PDFs trigger an explicit notice</div>
                  </div>
                  <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-500 leading-relaxed">
                    <strong className="text-slate-700">What happens after upload:</strong> PyMuPDF extracts text page-by-page, parses clause identifiers (e.g. SEC-1.1), persists page references to the database, and indexes them for BM25 retrieval during content audits.
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-xs focus-ring"
            >
              <Upload className="w-4 h-4" />
              <span>{loading ? 'Extracting Clauses...' : 'Upload & Extract Clauses'}</span>
            </button>
          </form>

          {/* Optional Manual Entry Toggle */}
          <div className="pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowManualEntry(!showManualEntry)}
              className="text-xs text-teal-700 hover:text-teal-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              {showManualEntry ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span>Or Paste Guidelines Text Manually</span>
            </button>

            {showManualEntry && (
              <form onSubmit={handleManualSubmit} className="mt-4 space-y-4 max-w-xl animate-fadeIn">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Guideline Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="e.g. Social Media Brand Governance Rules 2026"
                    className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus-ring"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Guideline Content <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={6}
                    value={manualContent}
                    onChange={(e) => setManualContent(e.target.value)}
                    placeholder={`Section 1.1 Comparative Superlatives\nMarketing materials must never claim #1 or fastest without audited 3rd party benchmark reports.\n\nSection 2.1 Warranties\nStatements like 100% guaranteed are prohibited without published SLA contracts.`}
                    className="w-full p-3 rounded-lg bg-white border border-slate-300 text-xs font-mono text-slate-900 placeholder-slate-400 focus-ring"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer shadow-xs focus-ring"
                >
                  <Plus className="w-4 h-4" />
                  <span>{loading ? 'Processing...' : 'Save & Extract Clauses'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Approved Corporate Facts */}
      {activeTab === 'facts' && (
        <div className="space-y-6">
          {/* How Approved Facts Work per Part 6 */}
          <div className="p-4 rounded-xl bg-teal-50/80 border border-teal-200 text-xs space-y-1.5 text-teal-950">
            <div className="font-bold text-teal-900 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-teal-600" />
              <span>Separation of Approved Facts & Guideline Policies</span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              <strong>Brand Guidelines</strong> define behavioral rules (e.g., Section 1.1 prohibiting unverified superlatives and Section 2.2 requiring evidence for numerical claims). <strong>Approved Corporate Facts</strong> provide the verified benchmark figures (e.g., "42ms benchmark latency"). When marketing copy asserts numerical metrics, OmniGuide checks if that claim is backed by a registered corporate fact.
            </p>
          </div>

          {/* Add Fact Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Register Approved Corporate Fact</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Quantitative metrics (e.g. "42ms latency", "99.9% uptime") in draft marketing copy must match an approved fact to be verified as grounded.
              </p>
            </div>

            <form onSubmit={handleAddFact} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Fact Statement <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={factText}
                  onChange={(e) => setFactText(e.target.value)}
                  placeholder="e.g. NovaForge benchmark latency is 42ms for enterprise workloads."
                  className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category</label>
                <select
                  value={factCategory}
                  onChange={(e) => setFactCategory(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-sm text-slate-900 focus-ring"
                >
                  <option value="performance">Performance & Speed</option>
                  <option value="reliability">Reliability & SLA</option>
                  <option value="scale">Customer Scale & Revenue</option>
                  <option value="certification">Compliance & Security</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Source Reference / Audit Report
                </label>
                <input
                  type="text"
                  value={factSource}
                  onChange={(e) => setFactSource(e.target.value)}
                  placeholder="e.g. TechAudit Labs Benchmark TA-2026-01"
                  className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus-ring"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs focus-ring"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Fact</span>
                </button>
              </div>
            </form>
          </div>

          {/* Facts List */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Registered Approved Facts ({approvedFacts.length})
            </h3>
            <div className="space-y-3">
              {approvedFacts.map((fact) => (
                <div
                  key={fact.id}
                  className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                        {fact.category || 'Fact'}
                      </span>
                      {fact.source_reference && (
                        <span className="text-[11px] text-slate-500 font-mono">
                          Source: {fact.source_reference}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm text-slate-900 font-medium">"{fact.fact_text}"</p>
                  </div>
                  <button
                    onClick={() => handleDeleteFact(fact.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer rounded"
                    title="Remove Fact"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Policy Hierarchy Graph & Scope Inheritance */}
      {activeTab === 'hierarchy' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-teal-700" />
                  Hierarchical Policy Graph & Inheritance
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                  OmniGuide enforces parent-child policy inheritance (Corporate → Regional → Product-line).
                  Mandatory corporate guardrails cannot be bypassed by regional or product-specific exemptions.
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-teal-50 text-teal-800 border border-teal-200">
                {hierarchyData?.total_documents || documents.length} Documents Mapped
              </span>
            </div>

            {/* Tree Nodes Display */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Corporate Root Policies & Child Scopes
              </div>

              {hierarchyData?.corporate_roots && hierarchyData.corporate_roots.length > 0 ? (
                <div className="space-y-3">
                  {hierarchyData.corporate_roots.map((root) => (
                    <div key={root.id} className="p-4 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800 uppercase tracking-wider">
                            Corporate Root
                          </span>
                          <span className="font-bold text-sm text-slate-900">{root.title}</span>
                        </div>
                        <span className="text-xs font-mono text-slate-500">
                          {root.clause_count} Clauses • Scope: {root.policy_scope}
                        </span>
                      </div>

                      {root.children && root.children.length > 0 && (
                        <div className="pl-6 border-l-2 border-teal-200 ml-3 space-y-2 pt-1">
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Inherited Child Policies:
                          </div>
                          {root.children.map((child) => (
                            <div key={child.id} className="p-2.5 rounded bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <ChevronRight className="w-3.5 h-3.5 text-teal-600" />
                                <span className="font-semibold text-slate-800">{child.title}</span>
                                {child.region_code && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-mono">
                                    Region: {child.region_code}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500 font-mono">
                                {child.clause_count} clauses (Inherits {root.clause_count} corporate rules)
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((d) => (
                    <div key={d.id} className="p-3.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-bold uppercase text-[10px]">
                          Corporate
                        </span>
                        <span className="font-semibold text-slate-800">{d.title}</span>
                      </div>
                      <span className="text-slate-400 font-mono">
                        {d.clause_count || d.clauses?.length || 0} Clauses
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Regulatory Rule Packs (FTC, ASCI, EU DSA) */}
      {activeTab === 'regulatory' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-teal-700" />
                  Regulatory Rule Packs Framework
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                  Enable or disable standardized regulatory compliance packs for US FTC, Indian ASCI, and EU Digital Services Act.
                  Active rules are indexed into the hybrid retrieval engine with exact statutory citations.
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200">
                Illustrative Benchmark Framework
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
              {regulatoryPacks.map((pack) => (
                <div
                  key={pack.id}
                  className={`p-5 rounded-xl border transition-all flex flex-col justify-between space-y-4 ${
                    pack.is_enabled
                      ? 'border-teal-200 bg-teal-50/20 shadow-xs'
                      : 'border-slate-200 bg-slate-50/50 opacity-75'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase tracking-wider font-mono">
                        {pack.jurisdiction}
                      </span>
                      <button
                        onClick={() => handleToggleRulePack(pack.id, pack.is_enabled)}
                        className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                      >
                        {pack.is_enabled ? (
                          <span className="flex items-center gap-1 text-teal-700">
                            <ToggleRight className="w-6 h-6 fill-teal-600 text-white" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-400">
                            <ToggleLeft className="w-6 h-6 text-slate-400" />
                            <span>Disabled</span>
                          </span>
                        )}
                      </button>
                    </div>

                    <h3 className="font-bold text-sm text-slate-900">{pack.name}</h3>
                    <div className="text-[11px] text-teal-800 font-semibold">{pack.authority}</div>
                    <p className="text-xs text-slate-600 leading-relaxed">{pack.description}</p>
                    <div className="text-[11px] text-slate-400 font-mono pt-1">
                      Ref: {pack.statutory_reference}
                    </div>
                  </div>

                  {/* Clauses List */}
                  <div className="border-t border-slate-200/80 pt-3 space-y-2 text-xs">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Included Clauses ({pack.clauses.length}):
                    </div>
                    {pack.clauses.map((c, i) => (
                      <div key={i} className="p-2 rounded bg-white border border-slate-100 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-teal-800">{c.clause_identifier}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700">
                            {c.mandatory_tier}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 line-clamp-2">{c.clause_text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

