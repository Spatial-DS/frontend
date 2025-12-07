import pytest
from fastapi.testclient import TestClient
    
import sys
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)

if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from app import app
from floorplan.database import Base, engine

@pytest.fixture
def sample_floorplan_payload():
    return {
        "floor_plans": [
            {
                "name": "Level 2",
                "boundary": [[-10, -36], [-10, -34.4], [10, 37.16], [16.05, 22.33], [-9.82, -38.81]],
                "fixed_elements": {
                    "ent": [[13.7, 37.56], [-9.9, -37.43]],
                    "bdr": [[-13.3, -30.46]]
                },
                "connections": [
                    {"coord": [0, -35], "connection_id": "l", "type_name": "lif"}
                ]
            }
        ],
        "constraints": [
            {"short_code": "ent", "area_value": 50, "unit": "sqm"},
            {"short_code": "gen", "area_value": 20, "unit": "percent"}
        ],
        "global_parameters": {
            "total_gfa": 10900.0,
            "target_node_counts": [50],
            "text_prompt": "ensure gen is compact"
        }
    }

@pytest.fixture
def client():
    # Setup in-memory SQLite for testing
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)
