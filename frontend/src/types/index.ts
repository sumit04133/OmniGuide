export interface GuidelineClause {
  id: string;
  document_id: string;
  clause_identifier: string;
  clause_text: string;
  section_heading?: string | null;
  page_number?: number | null;
}

export interface GuidelineDocument {
  id: string;
  title: string;
  filename: string;
  is_demo: boolean;
  created_at: string;
  clause_count?: number;
  clauses?: GuidelineClause[];
}

export interface ApprovedFact {
  id: string;
  fact_text: string;
  category?: string | null;
  source_reference?: string | null;
  created_at: string;
}

export type FindingCategory =
  | 'unsupported_superlative'
  | 'banned_term'
  | 'required_terminology'
  | 'unverified_claim'
  | 'tone_and_voice'
  | 'brand_consistency'
  | 'missing_approved_source';

export type SeverityLevel = 'High' | 'Medium' | 'Low';
export type Severity = SeverityLevel;
export type EvidenceStatus = 'verified' | 'insufficient_evidence' | 'missing_approved_source' | 'deterministic_rule';
export type DecisionStatus = 'pending' | 'accepted' | 'edited' | 'dismissed';
export type ReviewOverallStatus = 'compliant' | 'needs_review' | 'resolved' | 'flagged';

export interface Finding {
  id: string;
  review_id: string;
  category: FindingCategory | string;
  severity: SeverityLevel;
  original_excerpt: string;
  explanation: string;
  guideline_clause_id?: string | null;
  guideline_clause_identifier?: string | null;
  guideline_clause_text?: string | null;
  guideline_document_name?: string | null;
  guideline_page_number?: number | null;
  evidence_status: EvidenceStatus;
  suggested_fix: string;
  decision_status: DecisionStatus;
  user_custom_fix?: string | null;
}

export interface ReviewAction {
  id: string;
  review_id: string;
  finding_id?: string | null;
  action_type: string;
  previous_value?: string | null;
  new_value?: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  title: string;
  content_type: string;
  original_content: string;
  revised_content: string;
  analysis_mode: string;
  overall_status: ReviewOverallStatus;
  created_at: string;
  updated_at: string;
  findings: Finding[];
  actions: ReviewAction[];
}

export interface ReviewListItem {
  id: string;
  title: string;
  content_type: string;
  overall_status: ReviewOverallStatus;
  analysis_mode: string;
  created_at: string;
  findings_count: number;
  high_severity_count: number;
  resolved_count: number;
}

export type ProviderState =
  | 'NOT_CONFIGURED'
  | 'CONFIGURED_NOT_TESTED'
  | 'OPERATIONAL'
  | 'CONNECTION_FAILED'
  | 'RATE_LIMITED'
  | 'PROVIDER_ERROR';

export interface ProviderHealthStatus {
  provider_name: string;
  display_name: string;
  state: ProviderState;
  model_name: string;
  is_configured: boolean;
  is_operational: boolean;
  last_tested_at?: string | null;
  latency_ms?: number | null;
  safe_message: string;
  is_active: boolean;
}

export interface SystemStatus {
  status: string;
  version: string;
  database_connected: boolean;
  database_dialect: string;
  ai_provider: string;
  gemini_configured: boolean;
  groq_configured: boolean;
  guidelines_count: number;
  clauses_count: number;
  approved_facts_count: number;
  reviews_count: number;
  providers?: Record<string, ProviderHealthStatus>;
}

export interface DemoScenario {
  id: string;
  title: string;
  content_type: string;
  content: string;
  campaign_context: string;
  description: string;
  expected_findings: string[];
}

// ==========================================
// FEATURE 1: CAMPAIGN LAUNCH SIMULATOR TYPES
// ==========================================

export type LaunchGatePolicy = 'strict' | 'standard' | 'permissive';
export type LaunchGateStatus = 'blocked' | 'needs_review' | 'launch_ready';
export type EvidenceTier = 'verified_violation' | 'unsupported_claim' | 'potential_violation' | 'compliant_grounded';
export type RemediationStatus = 'unresolved' | 'remediated' | 'waived';

export interface CampaignFinding {
  id: string;
  channel: string;
  category: string;
  severity: Severity;
  original_excerpt: string;
  explanation: string;
  guideline_ref?: string | null;
  suggested_fix: string;
  evidence_status: EvidenceTier;
  evidence_quote?: string | null;
  source: 'deterministic' | 'ai';
  remediation_status: RemediationStatus;
  remediation_notes?: string | null;
}

export interface ChannelContentResult {
  id?: string;
  channel: string;
  original_content: string;
  revised_content: string;
  channel_readiness_score: number;
  channel_status: 'compliant' | 'needs_review' | 'flagged';
  findings: CampaignFinding[];
}

export interface CrossChannelIssue {
  issue_type: string;
  channels_involved: string[];
  description: string;
  suggested_harmonization: string;
  severity: Severity;
}

export interface ScoringBreakdown {
  baseline_score: number;
  total_deductions: number;
  high_severity_deductions: number;
  medium_severity_deductions: number;
  low_severity_deductions: number;
  cross_channel_deductions: number;
  remediation_restored: number;
  final_score: number;
  scoring_formula_explanation: string;
}

export interface CampaignAudit {
  id: string;
  name: string;
  brand_name: string;
  target_audience?: string | null;
  channels: string[];
  launch_gate_policy: LaunchGatePolicy;
  status: LaunchGateStatus;
  launch_readiness_score: number;
  blocking_violations_count: number;
  warnings_count: number;
  remediated_count: number;
  scoring_breakdown: ScoringBreakdown;
  cross_channel_issues: CrossChannelIssue[];
  channel_contents: ChannelContentResult[];
  findings: CampaignFinding[];
  created_at: string;
  updated_at: string;
}

export interface CampaignTemplate {
  id: string;
  name: string;
  brand_name: string;
  target_audience: string;
  launch_gate_policy: LaunchGatePolicy;
  channels: string[];
  channel_contents: Record<string, string>;
}

// ==========================================
// FEATURE 3: BRAND RED-TEAM SIMULATOR TYPES
// ==========================================

export interface RedTeamTestCase {
  id: string;
  title: string;
  category: string;
  adversarial_vector: string;
  untrusted_input: string;
  expected_to_violate: boolean;
  expected_severity?: Severity | null;
  expected_categories: string[];
  defense_explanation: string;
}

export interface RedTeamCaseResult {
  case_id: string;
  title: string;
  category: string;
  adversarial_vector: string;
  untrusted_input: string;
  expected_to_violate: boolean;
  expected_severity?: string | null;
  actual_findings_count: number;
  actual_findings: Array<{
    category: string;
    severity: string;
    original_excerpt: string;
    guideline_ref?: string | null;
    suggested_fix: string;
  }>;
  evaluation_status: 'PASS_TRUE_POSITIVE' | 'PASS_TRUE_NEGATIVE' | 'FAIL_FALSE_POSITIVE' | 'FAIL_FALSE_NEGATIVE';
  defense_explanation: string;
}

export interface ConfusionMatrix {
  true_positives: number;
  false_positives: number;
  true_negatives: number;
  false_negatives: number;
}

export interface RedTeamMetrics {
  precision: number;
  recall: number;
  f1_score: number;
  critical_violation_detection_rate: number;
  prompt_injection_defense_rate: number;
}

export interface RedTeamEvaluationResult {
  evaluation_timestamp: string;
  execution_duration_ms: number;
  total_test_cases: number;
  confusion_matrix: ConfusionMatrix;
  metrics: RedTeamMetrics;
  case_results: RedTeamCaseResult[];
  evaluation_verdict: string;
}

// ==========================================
// ROUND 3: MULTIMODAL ASSET GOVERNANCE TYPES
// ==========================================

export interface AssetFinding {
  id: string;
  category: string;
  severity: Severity;
  extracted_text: string;
  explanation: string;
  suggested_fix: string;
  guideline_clause_identifier?: string | null;
  guideline_clause_text?: string | null;
  guideline_document_name?: string | null;
  guideline_page_number?: number | null;
  evidence_tier: 'VERIFIED' | 'UNSUPPORTED' | 'CONTRADICTED' | 'NEEDS_HUMAN_REVIEW';
  evidence_status: string;
  evidence_provenance?: Record<string, any> | null;
  box_ymin?: number | null;
  box_xmin?: number | null;
  box_ymax?: number | null;
  box_xmax?: number | null;
}

export interface AssetAudit {
  id: string;
  filename: string;
  mime_type: string;
  file_size_bytes: number;
  image_width: number;
  image_height: number;
  brand_name: string;
  target_channel: string;
  headline_text?: string | null;
  supporting_text?: string | null;
  disclaimer_text?: string | null;
  disclaimer_ratio?: number | null;
  disclaimer_status: 'compliant' | 'warning' | 'violation' | 'not_detected';
  disclaimer_threshold: number;
  overall_status: 'compliant' | 'needs_review' | 'flagged';
  analysis_mode: string;
  image_data_url?: string | null;
  created_at: string;
  findings: AssetFinding[];
}

export interface AssetAuditListItem {
  id: string;
  filename: string;
  mime_type: string;
  image_width: number;
  image_height: number;
  brand_name: string;
  overall_status: 'compliant' | 'needs_review' | 'flagged';
  analysis_mode: string;
  findings_count: number;
  high_severity_count: number;
  disclaimer_status: string;
  created_at: string;
}

// ==========================================
// ROUND 3: WORKFLOW INTEGRATIONS TYPES
// ==========================================

export interface FigmaFindingItem {
  category: string;
  severity: Severity;
  original_excerpt: string;
  explanation: string;
  suggested_fix: string;
  guideline_clause_identifier?: string | null;
  evidence_tier: string;
}

export interface FigmaAuditResult {
  status: 'compliant' | 'needs_review' | 'flagged';
  node_name: string;
  total_findings: number;
  findings: FigmaFindingItem[];
  suggested_rewrites: string[];
  compliance_score: number;
  checked_at: string;
}

export interface CMSWebhookResult {
  event_id: string;
  provider: string;
  status: 'processed' | 'duplicate_skipped' | 'flagged' | 'compliant';
  audit_decision: 'approved' | 'blocked' | 'warning';
  blocking_violations_count: number;
  findings_count: number;
  message: string;
}

// ==========================================
// ROUND 3: REGULATORY RULE PACKS & HIERARCHY
// ==========================================

export interface RegulatoryRuleClause {
  clause_identifier: string;
  clause_text: string;
  section_heading: string;
  regulatory_source: string;
  mandatory_tier: string;
}

export interface RegulatoryRulePack {
  id: string;
  name: string;
  jurisdiction: string;
  authority: string;
  description: string;
  version: string;
  is_enabled: boolean;
  is_illustrative: boolean;
  statutory_reference: string;
  clauses: RegulatoryRuleClause[];
}

export interface PolicyHierarchyNode {
  id: string;
  title: string;
  policy_scope: 'corporate' | 'regional' | 'product_line';
  region_code?: string | null;
  product_line?: string | null;
  clause_count: number;
  parent_document_id?: string | null;
  children: PolicyHierarchyNode[];
}

