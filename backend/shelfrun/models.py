
from sqlalchemy import Column, String, DateTime
import datetime
import uuid
from floorplan.database import Base

class ShelfReport(Base):
    __tablename__ = "shelf_reports"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.now)
    username = Column(String, nullable=False)