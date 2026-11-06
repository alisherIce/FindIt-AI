import os
from functools import lru_cache

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://findit:findit_dev_password@localhost:5432/findit",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@lru_cache(maxsize=1)
def initialize_database():
    """Enable pgvector, create tables, and apply the small MVP schema update."""
    from backend import models  # noqa: F401

    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        Base.metadata.create_all(bind=connection)
        # create_all does not alter existing tables; keep upgrades idempotent for existing MVP DBs.
        connection.execute(
            text(
                "ALTER TABLE items ADD COLUMN IF NOT EXISTS "
                "owner_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL"
            )
        )
        connection.execute(
            text("CREATE INDEX IF NOT EXISTS ix_items_owner_id ON items(owner_id)")
        )


def get_db():
    initialize_database()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
