import json
import logging
import math
import re
from dataclasses import dataclass
from typing import List, Optional, Set, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.guideline import GuidelineClause, GuidelineDocument
from app.services.regulatory_rulepacks import regulatory_rulepack_service

logger = logging.getLogger(__name__)


@dataclass
class RetrievedClause:
    clause_id: str
    clause_identifier: str
    clause_text: str
    document_name: str
    page_number: Optional[int]
    relevance_score: float
    retrieval_method: str  # "keyword_lexical", "semantic_embedding", or "hybrid_rrf"
    inheritance_scope: Optional[str] = None  # e.g., "corporate", "regional", "product_line", "regulatory"
    inherited_from_document: Optional[str] = None


STOP_WORDS: Set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can", "can't", "cannot", "could",
    "did", "do", "does", "doing", "don't", "down", "during", "each", "few", "for",
    "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers",
    "herself", "him", "himself", "his", "how", "i", "if", "in", "into", "is",
    "it", "its", "itself", "let's", "me", "more", "most", "my", "myself", "no",
    "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought",
    "our", "ours", "ourselves", "out", "over", "own", "same", "she", "should",
    "so", "some", "such", "than", "that", "the", "their", "theirs", "them",
    "themselves", "then", "there", "these", "they", "this", "those", "through",
    "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "were",
    "what", "when", "where", "which", "while", "who", "whom", "why", "with",
    "won't", "would", "you", "your", "yours", "yourself", "yourselves"
}


def tokenize(text: str) -> List[str]:
    """Extracts alphanumeric words in lowercase, skipping common stop words."""
    tokens = re.findall(r'[a-zA-Z0-9#\+]+', text.lower())
    return [t for t in tokens if t not in STOP_WORDS and len(t) > 1]


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Computes cosine similarity between two numeric vectors."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0
    return dot / (norm1 * norm2)


# In-memory vector cache for stored guideline clauses: clause_id -> float vector
_CLAUSE_VECTOR_CACHE: Dict[str, List[float]] = {}


class GuidelineRetriever:
    """
    Advanced Hybrid Dense-Sparse Policy Retrieval & Hierarchical Inheritance Engine.
    Combines:
    1. Lexical BM25 token-weighted retrieval.
    2. Dense semantic embeddings via Gemini text-embedding-004 with graceful offline fallback.
    3. Reciprocal Rank Fusion (RRF) with standard k=60 rank combining.
    4. Hierarchical Policy Graph traversal (Corporate -> Regional -> Product-line) with cycle protection.
    5. Integrated statutory regulatory rule packs (FTC, ASCI, EU DSA).
    """

    def resolve_hierarchical_clauses(
        self,
        db: Session,
        document_id: Optional[str] = None,
        scope: Optional[str] = None
    ) -> List[Tuple[GuidelineClause, str, str, Optional[str]]]:
        """
        Resolves the policy graph by following parent_document_id relationships.
        Enforces cycle prevention and guarantees that higher-level corporate policies
        are inherited and not bypassed by child policies.
        Returns: List of tuples (clause, doc_title, policy_scope, inherited_from_doc_name)
        """
        if not db:
            return []

        all_docs = db.query(GuidelineDocument).all()
        doc_map = {d.id: d for d in all_docs}

        # If a specific document is requested, traverse its parent hierarchy
        active_doc_chain: List[GuidelineDocument] = []
        if document_id and document_id in doc_map:
            curr_id = document_id
            visited = set()
            while curr_id and curr_id in doc_map:
                if curr_id in visited:
                    raise ValueError(f"Circular policy hierarchy detected in document chain involving '{curr_id}'.")
                visited.add(curr_id)
                curr_doc = doc_map[curr_id]
                active_doc_chain.append(curr_doc)
                curr_id = curr_doc.parent_document_id

            # Ensure all corporate root policies are also included if not in chain
            for d in all_docs:
                if (d.policy_scope or "corporate") == "corporate" and d.id not in visited:
                    active_doc_chain.append(d)
        else:
            active_doc_chain = all_docs

        resolved_entries = []
        target_doc_title = doc_map[document_id].title if (document_id and document_id in doc_map) else None

        for doc in active_doc_chain:
            is_inherited = (target_doc_title is not None and doc.title != target_doc_title)
            inherited_from = doc.title if is_inherited else None
            doc_scope = doc.policy_scope or "corporate"

            for c in doc.clauses:
                resolved_entries.append((c, doc.title, doc_scope, inherited_from))

        return resolved_entries

    def retrieve_relevant_clauses(
        self,
        db: Session,
        query_text: str,
        top_k: int = 5,
        min_score: float = 0.05,
        document_id: Optional[str] = None,
        scope: Optional[str] = None,
        include_regulatory: bool = True
    ) -> List[RetrievedClause]:
        """
        Retrieves top_k relevant guideline clauses for query_text using Hybrid Dense-Sparse
        Reciprocal Rank Fusion (or BM25 fallback if embeddings unavailable).
        """
        # 1. Resolve clauses from database including hierarchical inheritance
        try:
            hierarchical_entries = self.resolve_hierarchical_clauses(db=db, document_id=document_id, scope=scope)
        except ValueError as ve:
            logger.error(f"Hierarchy resolution error: {ve}")
            hierarchical_entries = [
                (c, c.document.title if c.document else "Guideline", "corporate", None)
                for c in db.query(GuidelineClause).all()
            ]

        # 2. Inject active regulatory rule packs if requested
        candidate_clauses = []
        for c, doc_title, pol_scope, inherited_from in hierarchical_entries:
            candidate_clauses.append({
                "id": c.id,
                "identifier": c.clause_identifier,
                "text": c.clause_text,
                "document_name": doc_title,
                "page_number": c.page_number,
                "scope": pol_scope,
                "inherited_from": inherited_from,
                "embedding": c.embedding
            })

        if include_regulatory:
            active_reg_clauses = regulatory_rulepack_service.get_active_regulatory_clauses()
            for rc in active_reg_clauses:
                candidate_clauses.append({
                    "id": f"reg-{rc['clause_identifier']}",
                    "identifier": rc["clause_identifier"],
                    "text": rc["clause_text"],
                    "document_name": rc["document_name"],
                    "page_number": None,
                    "scope": "regulatory",
                    "inherited_from": "Regulatory Rule Pack",
                    "embedding": None
                })

        if not candidate_clauses:
            return []

        # 3. Compute Sparse BM25 Rankings
        bm25_ranked = self._compute_bm25_ranking(query_text, candidate_clauses, min_score)

        # 4. Attempt Dense Semantic Embedding Rankings
        dense_ranked: Optional[List[Tuple[Dict[str, Any], float]]] = None
        if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip():
            dense_ranked = self._compute_dense_ranking(query_text, candidate_clauses)

        # 5. Combine rankings via Reciprocal Rank Fusion (RRF) or use BM25 fallback
        if dense_ranked is not None:
            combined = self._reciprocal_rank_fusion(bm25_ranked, dense_ranked, k=60)
            retrieval_method = "hybrid_rrf"
        else:
            combined = bm25_ranked
            retrieval_method = "keyword_lexical"

        # If zero matches found (e.g. novel text), fallback to top_k default items
        if not combined:
            return [
                RetrievedClause(
                    clause_id=c["id"],
                    clause_identifier=c["identifier"],
                    clause_text=c["text"],
                    document_name=c["document_name"],
                    page_number=c["page_number"],
                    relevance_score=0.1,
                    retrieval_method=retrieval_method,
                    inheritance_scope=c["scope"],
                    inherited_from_document=c["inherited_from"]
                )
                for c in candidate_clauses[:top_k]
            ]

        results = []
        for c, score in combined[:top_k]:
            results.append(RetrievedClause(
                clause_id=c["id"],
                clause_identifier=c["identifier"],
                clause_text=c["text"],
                document_name=c["document_name"],
                page_number=c["page_number"],
                relevance_score=round(score, 4),
                retrieval_method=retrieval_method,
                inheritance_scope=c["scope"],
                inherited_from_document=c["inherited_from"]
            ))

        return results

    def _compute_bm25_ranking(
        self,
        query_text: str,
        clauses: List[Dict[str, Any]],
        min_score: float
    ) -> List[Tuple[Dict[str, Any], float]]:
        query_tokens = tokenize(query_text)
        if not query_tokens:
            return [(c, 1.0) for c in clauses]

        N = len(clauses)
        doc_freq = {}
        for c in clauses:
            tokens = set(tokenize(c["text"]))
            for t in set(query_tokens):
                if t in tokens:
                    doc_freq[t] = doc_freq.get(t, 0) + 1

        trigger_keywords = {
            "#1": ["superlative", "ranking", "number one", "#1", "first"],
            "fastest": ["speed", "fastest", "performance", "benchmark", "latency"],
            "best": ["superlative", "best", "quality", "unmatched"],
            "guarantee": ["guarantee", "warranty", "sla", "commitment"],
            "cheap": ["pricing", "cost", "cheap", "affordable", "tone"]
        }
        bonus_tokens = set()
        for q_word in query_tokens:
            for trigger, expansions in trigger_keywords.items():
                if trigger in q_word:
                    bonus_tokens.update(expansions)

        scored = []
        k1 = 1.5
        b = 0.75
        avg_len = 35.0

        for c in clauses:
            clause_tokens = tokenize(c["text"])
            if not clause_tokens:
                continue

            doc_len = len(clause_tokens)
            token_counts = {}
            for t in clause_tokens:
                token_counts[t] = token_counts.get(t, 0) + 1

            score = 0.0
            for t in query_tokens:
                if t in token_counts:
                    tf = token_counts[t]
                    df = doc_freq.get(t, 1)
                    idf = math.log((N - df + 0.5) / (df + 0.5) + 1.0)
                    tf_norm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (doc_len / avg_len)))
                    score += idf * tf_norm

            for bt in bonus_tokens:
                if bt in token_counts:
                    score += 1.5

            if score > min_score:
                scored.append((c, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored

    def _compute_dense_ranking(
        self,
        query_text: str,
        clauses: List[Dict[str, Any]]
    ) -> Optional[List[Tuple[Dict[str, Any], float]]]:
        """Generates dense vector embeddings via Gemini text-embedding-004 and ranks by cosine similarity."""
        try:
            from google import genai
            client = genai.Client(api_key=settings.GEMINI_API_KEY)

            # Embed query
            query_embed_resp = client.models.embed_content(
                model="text-embedding-004",
                contents=query_text
            )
            query_vector = query_embed_resp.embedding.values if hasattr(query_embed_resp, "embedding") else None
            if not query_vector:
                return None

            scored = []
            for c in clauses:
                cid = c["id"]
                vector = _CLAUSE_VECTOR_CACHE.get(cid)
                if not vector and c.get("embedding"):
                    try:
                        vector = json.loads(c["embedding"])
                        _CLAUSE_VECTOR_CACHE[cid] = vector
                    except Exception:
                        vector = None

                if not vector:
                    # Generate embedding and cache
                    try:
                        resp = client.models.embed_content(
                            model="text-embedding-004",
                            contents=c["text"]
                        )
                        if hasattr(resp, "embedding") and resp.embedding.values:
                            vector = resp.embedding.values
                            _CLAUSE_VECTOR_CACHE[cid] = vector
                    except Exception as embed_err:
                        logger.debug(f"Clause embedding failed for {cid}: {embed_err}")
                        vector = None

                if vector:
                    sim = cosine_similarity(query_vector, vector)
                    scored.append((c, sim))

            scored.sort(key=lambda x: x[1], reverse=True)
            return scored
        except Exception as e:
            logger.debug(f"Dense vector retrieval unavailable: {e}. Falling back to BM25.")
            return None

    def _reciprocal_rank_fusion(
        self,
        ranked_list1: List[Tuple[Dict[str, Any], float]],
        ranked_list2: List[Tuple[Dict[str, Any], float]],
        k: int = 60
    ) -> List[Tuple[Dict[str, Any], float]]:
        """
        Reciprocal Rank Fusion (RRF) combines two rankings:
        Score(d) = sum(1 / (k + rank_i(d)))
        """
        scores: Dict[str, float] = {}
        clause_map: Dict[str, Dict[str, Any]] = {}

        for rank, (c, _) in enumerate(ranked_list1, 1):
            cid = c["id"]
            clause_map[cid] = c
            scores[cid] = scores.get(cid, 0.0) + (1.0 / (k + rank))

        for rank, (c, _) in enumerate(ranked_list2, 1):
            cid = c["id"]
            clause_map[cid] = c
            scores[cid] = scores.get(cid, 0.0) + (1.0 / (k + rank))

        combined = [(clause_map[cid], score) for cid, score in scores.items()]
        combined.sort(key=lambda x: x[1], reverse=True)
        return combined


guideline_retriever = GuidelineRetriever()
