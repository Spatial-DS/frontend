import pytest
import uuid
import json
import pandas as pd
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Import the actual models to make the mock realistic
from floorplan.data_models import FloorLayout, ZonePolygon

@pytest.fixture
def sample_payload():
    return {
        "floor_plans": [
            {
                "name": "Level 1",
                "boundary": [[0, 0], [0, 10], [10, 10], [10, 0]],
                "fixed_elements": {"ent": [[1, 1]]},
                "connections": []
            }
        ],
        "constraints": [
            {"short_code": "ent", "area_value": 50, "unit": "sqft"},
            {"short_code": "gen", "area_value": 20, "unit": "percent"}
        ],
        "global_parameters": {
            "total_gfa": 1000.0,
            "target_node_counts": [50],
            "generations": [10],
            "text_prompt": "ensure gen is compact"
        }
    }

@patch("floorplan.worker.run_multi_resolution_optimization")
def test_full_job_lifecycle_with_output_verification(mock_algo, client, sample_payload):
    # -------------------------------------------------------------------------
    # 1. SETUP: Mock the Heavy Lifting
    # -------------------------------------------------------------------------
    mock_result = MagicMock()
    mock_result.fitness = 95.5
    
    mock_result.area_distribution = pd.DataFrame({
        "Zone": ["ent", "gen"],
        "Proportion": [0.1, 0.2],
        "Calculated GFA": [100.0, 200.0]
    })

    # --- FIX: Use actual Pydantic Models instead of dicts ---
    # The worker calls .model_dump() on these, so they must be objects.
    mock_result.floor_layouts = [
        FloorLayout(
            floor_name="Level 1",
            zones=[
                ZonePolygon(
                    type="ent", 
                    polygon=[[1.0, 1.0], [1.0, 2.0], [2.0, 2.0], [2.0, 1.0]] 
                ),
                ZonePolygon(
                    type="gen", 
                    polygon=[[5.0, 5.0], [5.0, 8.0], [8.0, 8.0], [8.0, 5.0]]
                )
            ]
        )
    ]
    
    mock_algo.return_value = [mock_result]

    # -------------------------------------------------------------------------
    # 2. SUBMIT: Post the Job
    # -------------------------------------------------------------------------
    response = client.post("/optimize", json=sample_payload)
    assert response.status_code == 202  # Expect 202 Accepted
    job_id = response.json()["job_id"]

    # -------------------------------------------------------------------------
    # 3. PROCESS: Trigger the Worker manually
    # -------------------------------------------------------------------------
    from floorplan.database import SessionLocal
    from floorplan.worker import process_optimization_job
    
    db = SessionLocal()
    process_optimization_job(job_id, db)
    db.close()

    # -------------------------------------------------------------------------
    # 4. VERIFY: Check the Output Structure
    # -------------------------------------------------------------------------
    result_resp = client.get(f"/jobs/{job_id}")
    assert result_resp.status_code == 200
    data = result_resp.json()

    # A. Check Status
    # If the worker failed, this will be "failed" and contain the error traceback
    if data["status"] == "failed":
        pytest.fail(f"Worker failed with error: {data.get('error')}")

    assert data["status"] == "completed"
    assert data["result"] is not None

    # B. Check Metrics
    res = data["result"]
    assert res["fitness"] == 95.5
    
    # C. Check Area Stats
    stats = res["area_stats"]
    assert len(stats) == 2
    assert stats[0]["Zone"] == "ent"

    # D. Check Geometry
    layouts = res["layouts"]
    assert len(layouts) == 1
    assert layouts[0]["floor_name"] == "Level 1"
    
    zones = layouts[0]["zones"]
    assert len(zones) == 2
    
    ent_zone = next(z for z in zones if z["type"] == "ent")
    assert ent_zone["polygon"] == [[1.0, 1.0], [1.0, 2.0], [2.0, 2.0], [2.0, 1.0]]
