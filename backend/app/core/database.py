import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

logger = logging.getLogger(__name__)

engine_kwargs = {}
if settings.DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL connection pooling optimizations
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initializes all database tables and ensures non-breaking schema additions."""
    import app.models.guideline  # noqa: F401
    import app.models.review  # noqa: F401
    import app.models.campaign  # noqa: F401
    import app.models.asset  # noqa: F401
    import app.models.integration  # noqa: F401
    Base.metadata.create_all(bind=engine)

    # Safe migration for non-breaking schema additions
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(engine)
        table_names = inspector.get_table_names()

        with engine.begin() as conn:
            if "findings" in table_names:
                existing_cols = [c["name"] for c in inspector.get_columns("findings")]
                if "evidence_tier" not in existing_cols:
                    conn.execute(text("ALTER TABLE findings ADD COLUMN evidence_tier VARCHAR(50) DEFAULT 'VERIFIED'"))
                if "evidence_provenance" not in existing_cols:
                    conn.execute(text("ALTER TABLE findings ADD COLUMN evidence_provenance TEXT DEFAULT NULL"))

            if "guideline_documents" in table_names:
                doc_cols = [c["name"] for c in inspector.get_columns("guideline_documents")]
                if "policy_scope" not in doc_cols:
                    conn.execute(text("ALTER TABLE guideline_documents ADD COLUMN policy_scope VARCHAR(50) DEFAULT 'corporate'"))
                if "parent_document_id" not in doc_cols:
                    conn.execute(text("ALTER TABLE guideline_documents ADD COLUMN parent_document_id VARCHAR(36) DEFAULT NULL"))
                if "region_code" not in doc_cols:
                    conn.execute(text("ALTER TABLE guideline_documents ADD COLUMN region_code VARCHAR(50) DEFAULT NULL"))
                if "product_line" not in doc_cols:
                    conn.execute(text("ALTER TABLE guideline_documents ADD COLUMN product_line VARCHAR(100) DEFAULT NULL"))

            if "guideline_clauses" in table_names:
                clause_cols = [c["name"] for c in inspector.get_columns("guideline_clauses")]
                if "embedding" not in clause_cols:
                    conn.execute(text("ALTER TABLE guideline_clauses ADD COLUMN embedding TEXT DEFAULT NULL"))
    except Exception as e:
        logger.debug(f"Migration note: {e}")

    logger.info("Database tables initialized successfully.")
