import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, DateTime
from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class WebhookEventLog(Base):
    __tablename__ = "webhook_event_logs"

    event_id = Column(String(255), primary_key=True, index=True)
    provider = Column(String(50), nullable=False)  # "contentful", "strapi", "generic_cms"
    audit_decision = Column(String(50), nullable=False, default="approved")  # "approved", "blocked", "warning"
    blocking_violations_count = Column(Integer, nullable=False, default=0)
    findings_count = Column(Integer, nullable=False, default=0)
    payload_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
