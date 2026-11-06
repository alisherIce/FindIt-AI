from datetime import datetime, timezone
from uuid import uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import CheckConstraint, DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class Item(Base):
    __tablename__ = "items"
    __table_args__ = (
        CheckConstraint("item_type IN ('lost', 'found')", name="ck_items_item_type"),
        CheckConstraint("status IN ('active', 'resolved')", name="ck_items_status"),
        Index("ix_items_type_status_created", "item_type", "status", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    item_type: Mapped[str] = mapped_column(String(10), nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(60), nullable=False)
    campus: Mapped[str] = mapped_column(String(120), nullable=False)
    location: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(String(1000), nullable=False, default="")
    image_filename: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    embedding: Mapped[list[float]] = mapped_column(Vector(512), nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
