import pytest
import uuid
import json
import pandas as pd
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Import the actual models
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
            {"short_code": "ent", "area_value": 50, "unit": "sqm"},
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
    # 1. SETUP: Mock the Heavy Lifting
    mock_result = MagicMock()
    mock_result.fitness = 95.5
    
    mock_result.area_distribution = pd.DataFrame({
        "Zone": ["ent", "gen"],
        "Proportion": [0.1, 0.2],
        "Calculated GFA": [100.0, 200.0]
    })

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

    # 2. SUBMIT
    response = client.post("/optimize", json=sample_payload)
    assert response.status_code == 202
    job_id = response.json()["job_id"]

    # 3. PROCESS
    from floorplan.database import SessionLocal
    from floorplan.worker import process_optimization_job
    
    db = SessionLocal()
    process_optimization_job(job_id, db)
    db.close()

    # 4. VERIFY
    result_resp = client.get(f"/jobs/{job_id}")
    assert result_resp.status_code == 200
    data = result_resp.json()

    if data["status"] == "failed":
        pytest.fail(f"Worker failed with error: {data.get('error')}")

    assert data["status"] == "completed"
    assert data["result"] is not None

    # --- FIX: Handle 'variations' list ---
    res_root = data["result"]
    assert "variations" in res_root
    assert len(res_root["variations"]) > 0
    
    variation = res_root["variations"][0]

    # B. Check Metrics
    assert variation["fitness"] == 95.5
    
    # C. Check Area Stats
    stats = variation["area_stats"]
    assert len(stats) == 2
    assert stats[0]["Zone"] == "ent"

    # D. Check Geometry
    layouts = variation["layouts"]
    assert len(layouts) == 1
    assert layouts[0]["floor_name"] == "Level 1"
    
    zones = layouts[0]["zones"]
    assert len(zones) == 2
    
    ent_zone = next(z for z in zones if z["type"] == "ent")
    assert ent_zone["polygon"] == [[1.0, 1.0], [1.0, 2.0], [2.0, 2.0], [2.0, 1.0]]
