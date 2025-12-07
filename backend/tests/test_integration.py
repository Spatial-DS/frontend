import time
from unittest.mock import patch

import pandas as pd
import pytest
from app import app
from fastapi.testclient import TestClient
from floorplan.database import Base, SessionLocal, engine
from floorplan.worker import process_optimization_job


@pytest.fixture
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def real_workload_payload():
    return {
        "floor_plans": [
            {
                "name": "Test Level",
                "boundary": [[0, 0], [0, 10], [10, 10], [10, 0]],
                "fixed_elements": {"ent": [[1, 1]]},
                "connections": [],
            }
        ],
        "constraints": [
            {"short_code": "ent", "area_value": 20, "unit": "sqm"},
            {"short_code": "gen", "area_value": 50, "unit": "sqm"},
        ],
        "global_parameters": {
            "total_gfa": 100.0,
            "target_node_counts": [25],
            "generations": [3],
            "pop_sizes": [5],
            "text_prompt": "ensure gen is compact",
        },
    }


# Mock Dataframes to replace CSV loading
def mock_static_data():
    room_df = pd.DataFrame(
        {
            "short": ["ent", "gen"],
            "full": ["Entrance", "General"],
            "color": ["#3366cc", "#cc9933"],
            "default_val": [10, 20],
            "default_unit": ["sqm", "sqm"],
            "shape": ["round", "square"],
        }
    )

    rules_df = pd.DataFrame(
        [[-1.0, 0.0], [0.0, -1.0]], index=["ent", "gen"], columns=["ent", "gen"]
    )
    return room_df, rules_df


@patch("floorplan.worker._load_static_data")
def test_full_integration_run(mock_load, client, real_workload_payload):
    """
    Submits a job and runs the REAL worker logic (algorithm)
    but mocks the file I/O for configuration (CSVs).
    """
    # Setup Mock
    mock_load.return_value = mock_static_data()

    # 1. Submit Job
    response = client.post("/optimize", json=real_workload_payload)
    assert response.status_code == 202
    job_id = response.json()["job_id"]

    # 2. Run Worker synchronously
    db = SessionLocal()
    try:
        process_optimization_job(job_id, db)
    except Exception as e:
        pytest.fail(f"Worker crashed during execution: {e}")
    finally:
        db.close()

    # 3. Check Results
    status_resp = client.get(f"/jobs/{job_id}")
    data = status_resp.json()

    if data["status"] == "failed":
        print(f"\n[Worker Error Log]:\n{data.get('error')}")
        pytest.fail("Job status is 'failed'")

    assert data["status"] == "completed"

    # Handle new 'variations' structure
    result = data["result"]
    assert "variations" in result
    assert len(result["variations"]) > 0

    variation = result["variations"][0]

    # 4. Verify Geometry Output
    layouts = variation["layouts"]
    assert len(layouts) == 1
    zones = layouts[0]["zones"]

    zone_types = [z["type"] for z in zones]
    # Check that at least one zone was generated.
    # (Exact zones depend on GA convergence, but usually both appear)
    assert len(zone_types) > 0

    # Verify polygon structure
    if len(zones) > 0:
        poly = zones[0]["polygon"]
        assert len(poly) >= 3
        assert isinstance(poly[0][0], float)

    print(f"\nIntegration Test Success! Fitness: {variation['fitness']}")
