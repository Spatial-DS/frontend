
from sqlalchemy import Column, String, DateTime
from floorplan.database import Base
import datetime
import uuid

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=True) # Not-supported
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.now())



