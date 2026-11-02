import {
  GuidelineDocument,
  ApprovedFact,
  Review,
  ReviewListItem,
  SystemStatus,
  ProviderHealthStatus,
  DemoScenario,
  DecisionStatus,
  CampaignAudit,
  CampaignTemplate,
  RedTeamTestCase,
  RedTeamEvaluationResult,
  AssetAudit,
  AssetAuditListItem,
  FigmaAuditResult,
  CMSWebhookResult,
  RegulatoryRulePack,
  PolicyHierarchyNode
} from '../types';

const rawApiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const API_BASE = rawApiBase
  ? (rawApiBase.endsWith('/api') ? rawApiBase.replace(/\/+$/, '') : `${rawApiBase.replace(/\/+$/, '')}/api`)
  : '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `Server error: ${res.statusText}`;
    try {
      const errorJson = await res.json();
      if (errorJson && errorJson.detail) {
        errorMsg = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errorMsg);
  }
  if (res.status === 204) {
    return {} as T;
  }
  return res.json();
}

export const api = {
  // System & Health
  async getHealth(): Promise<{ status: string; app: string }> {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse(res);
  },

  async getStatus(): Promise<SystemStatus> {
    const res = await fetch(`${API_BASE}/status`);
    return handleResponse<SystemStatus>(res);
  },

  async getProvidersHealth(): Promise<Record<string, ProviderHealthStatus>> {
    const res = await fetch(`${API_BASE}/providers/health`);
    return handleResponse<Record<string, ProviderHealthStatus>>(res);
  },

  async testProviderConnection(providerName: string): Promise<ProviderHealthStatus> {
    const res = await fetch(`${API_BASE}/providers/test/${providerName}`, {
      method: 'POST',
    });
    return handleResponse<ProviderHealthStatus>(res);
  },

  // Guidelines
  async getGuidelines(): Promise<GuidelineDocument[]> {
    const res = await fetch(`${API_BASE}/guidelines`);
    return handleResponse<GuidelineDocument[]>(res);
  },

  async getGuideline(id: string): Promise<GuidelineDocument> {
    const res = await fetch(`${API_BASE}/guidelines/${id}`);
    return handleResponse<GuidelineDocument>(res);
  },

  async uploadGuidelinePDF(title: string, file: File): Promise<GuidelineDocument> {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/guidelines/upload`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<GuidelineDocument>(res);
  },

  async createManualGuideline(data: { title: string; content: string; approved_facts?: string[] }): Promise<GuidelineDocument> {
    const res = await fetch(`${API_BASE}/guidelines/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<GuidelineDocument>(res);
  },

  async deleteGuideline(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/guidelines/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(res);
  },

  // Approved Facts
  async getApprovedFacts(): Promise<ApprovedFact[]> {
    const res = await fetch(`${API_BASE}/facts`);
    return handleResponse<ApprovedFact[]>(res);
  },

  async createApprovedFact(data: { fact_text: string; category?: string; source_reference?: string }): Promise<ApprovedFact> {
    const res = await fetch(`${API_BASE}/facts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<ApprovedFact>(res);
  },

  async deleteApprovedFact(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/facts/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(res);
  },

  // Reviews
  async startReview(data: {
    title: string;
    content_type: string;
    content: string;
    campaign_context?: string;
    analysis_mode?: string;
    guideline_document_id?: string;
    policy_scope?: string;
  }): Promise<Review> {
    const res = await fetch(`${API_BASE}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<Review>(res);
  },

  async getReviews(): Promise<ReviewListItem[]> {
    const res = await fetch(`${API_BASE}/reviews`);
    return handleResponse<ReviewListItem[]>(res);
  },

  async getReview(id: string): Promise<Review> {
    const res = await fetch(`${API_BASE}/reviews/${id}`);
    return handleResponse<Review>(res);
  },

  async updateFindingDecision(
    reviewId: string,
    findingId: string,
    decisionStatus: DecisionStatus,
    customFix?: string
  ): Promise<Review> {
    const res = await fetch(`${API_BASE}/reviews/${reviewId}/findings/${findingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision_status: decisionStatus,
        user_custom_fix: customFix,
      }),
    });
    return handleResponse<Review>(res);
  },

  async updateRevisedContent(reviewId: string, revisedContent: string): Promise<Review> {
    const res = await fetch(`${API_BASE}/reviews/${reviewId}/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revised_content: revisedContent }),
    });
    return handleResponse<Review>(res);
  },

  async getReviewReport(id: string): Promise<string> {
    const res = await fetch(`${API_BASE}/reviews/${id}/report`);
    if (!res.ok) throw new Error('Failed to download review audit report');
    return res.text();
  },

  async getReviewReportJson(id: string): Promise<Record<string, any>> {
    const res = await fetch(`${API_BASE}/reviews/${id}/report/json`);
    return handleResponse<Record<string, any>>(res);
  },

  async deleteReview(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/reviews/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(res);
  },

  // Demo Scenarios
  async getDemoScenarios(): Promise<DemoScenario[]> {
    const res = await fetch(`${API_BASE}/demo/scenarios`);
    return handleResponse<DemoScenario[]>(res);
  },

  async resetDemoData(): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/demo/reset`, {
      method: 'POST',
    });
    return handleResponse<{ message: string }>(res);
  },

  // ==========================================
  // FEATURE 1: CAMPAIGN LAUNCH SIMULATOR API
  // ==========================================
  async getCampaignTemplates(): Promise<CampaignTemplate[]> {
    const res = await fetch(`${API_BASE}/campaigns/templates`);
    return handleResponse<CampaignTemplate[]>(res);
  },

  async simulateCampaign(data: {
    name: string;
    brand_name?: string;
    target_audience?: string;
    channels: string[];
    channel_contents: Record<string, string>;
    launch_gate_policy?: string;
    analysis_mode?: string;
  }): Promise<CampaignAudit> {
    const res = await fetch(`${API_BASE}/campaigns/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<CampaignAudit>(res);
  },

  async getCampaigns(): Promise<CampaignAudit[]> {
    const res = await fetch(`${API_BASE}/campaigns`);
    return handleResponse<CampaignAudit[]>(res);
  },

  async getCampaign(id: string): Promise<CampaignAudit> {
    const res = await fetch(`${API_BASE}/campaigns/${id}`);
    return handleResponse<CampaignAudit>(res);
  },

  async remediateCampaignFinding(
    campaignId: string,
    findingId: string,
    data: { status: 'remediated' | 'waived'; custom_fix?: string; remediation_notes?: string }
  ): Promise<CampaignAudit> {
    const res = await fetch(`${API_BASE}/campaigns/${campaignId}/remediate/${findingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<CampaignAudit>(res);
  },

  async reEvaluateCampaign(
    campaignId: string,
    data: { channel_contents?: Record<string, string>; launch_gate_policy?: string }
  ): Promise<CampaignAudit> {
    const res = await fetch(`${API_BASE}/campaigns/${campaignId}/re-evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<CampaignAudit>(res);
  },

  async getCampaignReport(id: string): Promise<string> {
    const res = await fetch(`${API_BASE}/campaigns/${id}/report`);
    if (!res.ok) throw new Error('Failed to download campaign audit report');
    return res.text();
  },

  async getCampaignReportJson(id: string): Promise<Record<string, any>> {
    const res = await fetch(`${API_BASE}/campaigns/${id}/report/json`);
    return handleResponse<Record<string, any>>(res);
  },

  async deleteCampaign(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/campaigns/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(res);
  },

  // ==========================================
  // FEATURE 3: BRAND RED-TEAM SIMULATOR API
  // ==========================================
  async getRedTeamCases(): Promise<RedTeamTestCase[]> {
    const res = await fetch(`${API_BASE}/redteam/cases`);
    return handleResponse<RedTeamTestCase[]>(res);
  },

  async runRedTeamEvaluation(): Promise<RedTeamEvaluationResult> {
    const res = await fetch(`${API_BASE}/redteam/run`, {
      method: 'POST',
    });
    return handleResponse<RedTeamEvaluationResult>(res);
  },

  async getRedTeamReport(): Promise<string> {
    const res = await fetch(`${API_BASE}/redteam/report`);
    if (!res.ok) throw new Error('Failed to download red-team evaluation report');
    return res.text();
  },

  async getRedTeamReportJson(): Promise<Record<string, any>> {
    const res = await fetch(`${API_BASE}/redteam/report/json`);
    return handleResponse<Record<string, any>>(res);
  },

  // ==========================================
  // ROUND 3: MULTIMODAL ASSET GOVERNANCE API
  // ==========================================
  async auditAsset(
    file: File,
    options?: { brand_name?: string; target_channel?: string; disclaimer_ratio_threshold?: number }
  ): Promise<AssetAudit> {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.brand_name) formData.append('brand_name', options.brand_name);
    if (options?.target_channel) formData.append('target_channel', options.target_channel);
    if (options?.disclaimer_ratio_threshold !== undefined) {
      formData.append('disclaimer_ratio_threshold', options.disclaimer_ratio_threshold.toString());
    }

    const res = await fetch(`${API_BASE}/assets/audit`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<AssetAudit>(res);
  },

  async getAssetAudits(): Promise<AssetAuditListItem[]> {
    const res = await fetch(`${API_BASE}/assets`);
    return handleResponse<AssetAuditListItem[]>(res);
  },

  async getAssetAudit(id: string): Promise<AssetAudit> {
    const res = await fetch(`${API_BASE}/assets/${id}`);
    return handleResponse<AssetAudit>(res);
  },

  async getAssetReport(id: string): Promise<string> {
    const res = await fetch(`${API_BASE}/assets/${id}/report`);
    if (!res.ok) throw new Error('Failed to download asset audit report');
    return res.text();
  },

  async deleteAssetAudit(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/assets/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(res);
  },

  // ==========================================
  // ROUND 3: WORKFLOW INTEGRATIONS API
  // ==========================================
  async auditFigmaSelection(data: {
    text: string;
    node_name?: string;
    component_type?: string;
  }): Promise<FigmaAuditResult> {
    const res = await fetch(`${API_BASE}/integrations/figma/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<FigmaAuditResult>(res);
  },

  async sendCMSWebhook(
    payload: any,
    secret?: string
  ): Promise<CMSWebhookResult> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (secret) {
      headers['X-OmniGuide-Webhook-Secret'] = secret;
    }
    const res = await fetch(`${API_BASE}/integrations/cms/webhook`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return handleResponse<CMSWebhookResult>(res);
  },

  // ==========================================
  // ROUND 3: REGULATORY RULE PACKS & HIERARCHY
  // ==========================================
  async getRegulatoryPacks(): Promise<RegulatoryRulePack[]> {
    const res = await fetch(`${API_BASE}/regulatory/packs`);
    return handleResponse<RegulatoryRulePack[]>(res);
  },

  async toggleRegulatoryPack(packId: string, enabled: boolean): Promise<{ pack_id: string; is_enabled: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/regulatory/packs/${packId}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    return handleResponse<{ pack_id: string; is_enabled: boolean; message: string }>(res);
  },

  async getGuidelineHierarchy(): Promise<{ total_documents: number; corporate_roots: PolicyHierarchyNode[] }> {
    const res = await fetch(`${API_BASE}/guidelines/hierarchy`);
    return handleResponse<{ total_documents: number; corporate_roots: PolicyHierarchyNode[] }>(res);
  },
};
