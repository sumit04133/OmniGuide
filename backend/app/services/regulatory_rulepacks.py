"""
OmniGuide Regulatory Rule Packs Service
Provides structured regulatory compliance packs for US FTC, Indian ASCI, and EU Digital Services Act (DSA).
Supports enabling/disabling packs with verifiable statutory/regulatory citations.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class RegulatoryRuleClause(BaseModel):
    clause_identifier: str
    clause_text: str
    section_heading: str
    regulatory_source: str
    mandatory_tier: str = "High"  # High, Medium


class RegulatoryRulePack(BaseModel):
    id: str
    name: str
    jurisdiction: str  # e.g., "United States", "India", "European Union"
    authority: str     # e.g., "Federal Trade Commission (FTC)", "ASCI", "European Commission"
    description: str
    version: str = "2026.1"
    is_enabled: bool = True
    is_illustrative: bool = True  # Explicit disclaimer that this is a structured benchmark framework
    statutory_reference: str
    clauses: List[RegulatoryRuleClause]


# In-memory toggle state for rule packs
_RULE_PACK_TOGGLES: Dict[str, bool] = {
    "ftc_commercial": True,
    "asci_india": True,
    "eu_dsa": True
}


BUILTIN_RULE_PACKS: List[RegulatoryRulePack] = [
    RegulatoryRulePack(
        id="ftc_commercial",
        name="FTC Truth in Advertising & Endorsement Standards",
        jurisdiction="United States",
        authority="Federal Trade Commission (FTC)",
        description="Standardized US regulatory rules enforcing deceptive claim prohibition, performance substantiation, and clear influencer disclosures.",
        statutory_reference="15 U.S.C. § 45 (FTC Act Section 5) & 16 CFR Part 255",
        is_enabled=True,
        clauses=[
            RegulatoryRuleClause(
                clause_identifier="FTC-SEC-5",
                clause_text="Deceptive Acts & Practices: Advertising must be truthful and non-deceptive. Advertisers must possess a reasonable basis consisting of competent and reliable scientific or benchmark evidence before making objective claims.",
                section_heading="Section 5: Claim Substantiation",
                regulatory_source="15 U.S.C. § 45(a)(1) - Unfair or Deceptive Acts Prohibited",
                mandatory_tier="High"
            ),
            RegulatoryRuleClause(
                clause_identifier="FTC-ENDORSE",
                clause_text="Clear & Conspicuous Endorsement Disclosure: Material connections between advertisers and endorsers (including compensation, free product, or corporate affiliation) must be disclosed prominently and unavoidably.",
                section_heading="Part 255: Endorsements & Testimonials",
                regulatory_source="16 CFR Part 255.5 - Disclosure of Material Connections",
                mandatory_tier="High"
            ),
            RegulatoryRuleClause(
                clause_identifier="FTC-DISC-PROX",
                clause_text="Prominence of Disclaimers: Fine-print disclosures that contradict the main headline or are obscured by placement, font size, or color contrast fail the 'clear and conspicuous' legal standard.",
                section_heading="Disclosure Legibility & Placement",
                regulatory_source="FTC Policy Statement on Deception (103 F.T.C. 174)",
                mandatory_tier="High"
            )
        ]
    ),
    RegulatoryRulePack(
        id="asci_india",
        name="ASCI Advertising Code of Self-Regulation",
        jurisdiction="India",
        authority="Advertising Standards Council of India (ASCI)",
        description="Self-regulatory code governing truthfulness, fair competition, and digital influencer disclosures in the Indian advertising ecosystem.",
        statutory_reference="ASCI Code Chapters I & IV + Consumer Protection Act 2019",
        is_enabled=True,
        clauses=[
            RegulatoryRuleClause(
                clause_identifier="ASCI-CH-1",
                clause_text="Honest Representations: Advertisements must be truthful. Distortion, exaggeration, or misleading claims—direct or implied—regarding product capability, speed, or performance are prohibited.",
                section_heading="Chapter I: Truthfulness & Honesty",
                regulatory_source="ASCI Code Chapter I (Clause 1.4)",
                mandatory_tier="High"
            ),
            RegulatoryRuleClause(
                clause_identifier="ASCI-CH-4",
                clause_text="Substantiated Comparative Claims: Advertisements containing comparative assertions or rankings ('#1', 'best') must be based on documented, verifiable facts, conducted by independent research or official registries within 12 months.",
                section_heading="Chapter IV: Fair in Competition",
                regulatory_source="ASCI Code Chapter IV (Clause 4.1)",
                mandatory_tier="High"
            ),
            RegulatoryRuleClause(
                clause_identifier="ASCI-INFL-2021",
                clause_text="Digital Influencer Advertising Disclosures: Promotional brand content across social media must carry a prominent disclosure label (e.g. #ad, #collab, #sponsored) placed prominently within the first 3 lines of copy or on-video.",
                section_heading="Digital & Influencer Guidelines",
                regulatory_source="ASCI Guidelines for Influencer Advertising in Digital Media (2021)",
                mandatory_tier="Medium"
            )
        ]
    ),
    RegulatoryRulePack(
        id="eu_dsa",
        name="EU Digital Services Act & Unfair Commercial Practices",
        jurisdiction="European Union",
        authority="European Commission",
        description="European Union digital advertising standards regarding dark patterns, algorithmic transparency, and fair marketing practices.",
        statutory_reference="Regulation (EU) 2022/2065 (DSA Article 25) & Directive 2005/29/EC (UCPD)",
        is_enabled=True,
        clauses=[
            RegulatoryRuleClause(
                clause_identifier="EU-DSA-ART25",
                clause_text="Deceptive Interface Design (Dark Patterns): Online interfaces must not deceive, manipulate, or substantially impair user autonomy or choice through misleading urgency or false scarcity claims.",
                section_heading="Article 25: Online Interface Design",
                regulatory_source="Regulation (EU) 2022/2065 (Digital Services Act, Art. 25)",
                mandatory_tier="High"
            ),
            RegulatoryRuleClause(
                clause_identifier="EU-UCPD-DIR",
                clause_text="Misleading Omissions: Hiding or omitting material commercial information, terms of service limitations, or mandatory consumer renewal conditions constitutes an unfair commercial practice.",
                section_heading="Unfair Commercial Practices Directive",
                regulatory_source="Directive 2005/29/EC Annex I (Commercial Transparency)",
                mandatory_tier="High"
            )
        ]
    )
]


class RegulatoryRulePackService:
    """Manages regulatory compliance rule packs."""

    def get_all_packs(self) -> List[Dict[str, Any]]:
        """Returns all regulatory packs with their active enabled status."""
        result = []
        for pack in BUILTIN_RULE_PACKS:
            data = pack.model_dump()
            data["is_enabled"] = _RULE_PACK_TOGGLES.get(pack.id, True)
            result.append(data)
        return result

    def toggle_pack(self, pack_id: str, enabled: bool) -> Dict[str, Any]:
        """Enables or disables a specific regulatory pack."""
        found = False
        for p in BUILTIN_RULE_PACKS:
            if p.id == pack_id:
                found = True
                break
        if not found:
            raise ValueError(f"Regulatory rule pack '{pack_id}' not found.")

        _RULE_PACK_TOGGLES[pack_id] = enabled
        return {
            "pack_id": pack_id,
            "is_enabled": enabled,
            "message": f"Regulatory rule pack '{pack_id}' {'enabled' if enabled else 'disabled'} successfully."
        }

    def get_active_regulatory_clauses(self) -> List[Dict[str, Any]]:
        """Returns all clauses from currently enabled regulatory packs."""
        active_clauses = []
        for pack in BUILTIN_RULE_PACKS:
            if _RULE_PACK_TOGGLES.get(pack.id, True):
                for c in pack.clauses:
                    active_clauses.append({
                        "clause_identifier": c.clause_identifier,
                        "clause_text": c.clause_text,
                        "section_heading": c.section_heading,
                        "document_name": f"{pack.name} ({pack.jurisdiction})",
                        "page_number": None,
                        "regulatory_source": c.regulatory_source,
                        "is_regulatory": True
                    })
        return active_clauses


regulatory_rulepack_service = RegulatoryRulePackService()
