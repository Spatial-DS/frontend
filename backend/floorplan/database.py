# floorplan/database.py
import datetime
import uuid

from sqlalchemy import JSON, Column, DateTime, String, Float, Text, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# 1. Setup SQLite Engine
# check_same_thread=False is needed for SQLite to work with FastAPI's multithreading
SQLALCHEMY_DATABASE_URL = "sqlite:///./floorplan.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# 2. Define Job Model
class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    # Statuses: "queued", "processing", "completed", "failed"
    status = Column(String, index=True, default="queued")

    progress = Column(Float, default=0.0) 

    created_at = Column(DateTime, default=datetime.datetime.now())
    updated_at = Column(
        DateTime, default=datetime.datetime.now(), onupdate=datetime.datetime.now()
    )

    # Store the full input Pydantic model as a JSON dict
    input_payload = Column(JSON)

    # Store the final OptimizationResult (polygons, stats) as JSON
    result = Column(JSON, nullable=True)

    # Capture exception traces if something breaks
    error_message = Column(Text, nullable=True)


# 3. Define Job Model
class GeneratedLayout(Base):
    __tablename__ = "generated_layouts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.now())
    username = Column(String, nullable=False)


# 4. Dependency for FastAPI Routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
