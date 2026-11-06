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
    """Enable pgvector and create the MVP tables once per process."""
    # Import models so their tables are registered on Base.metadata.
    from backend import models  # noqa: F401

    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        Base.metadata.create_all(bind=connection)


def get_db():
    initialize_database()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
