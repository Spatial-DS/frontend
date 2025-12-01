import time

import pytest

# Standard setup imports
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
    """
    A minimal but valid geometry and constraint set.
    """
    return {
        "floor_plans": [
            {
                "name": "Test Level",
                # A simple 10x10 square
                "boundary": [[0, 0], [0, 10], [10, 10], [10, 0]],
                "fixed_elements": {
                    # Entrance fixed at bottom left
                    "ent": [[1, 1]]
                },
                "connections": [],
            }
        ],
        "constraints": [
            # Two zones: Entrance (ent) and General (gen)
            {"short_code": "ent", "area_value": 20, "unit": "sqft"},
            {"short_code": "gen", "area_value": 50, "unit": "sqft"},
        ],
        "global_parameters": {
            "total_gfa": 100.0,
            # Use small numbers for speed
            "target_node_counts": [25],  # ~5x5 grid
            "generations": [3],  # Very few generations
            "pop_sizes": [5],  # Tiny population
            "text_prompt": "ensure gen is compact",
        },
    }


def test_full_integration_run(client, real_workload_payload):
    """
    Submits a job and runs the REAL worker (no mocks).
    Verifies that the algorithm actually produces polygons.
    """
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

    # If status is failed, print the internal error message
    if data["status"] == "failed":
        print(f"\n[Worker Error Log]:\n{data.get('error')}")
        pytest.fail("Job status is 'failed'")

    assert data["status"] == "completed"
    result = data["result"]

    # 4. Verify Geometry Output
    layouts = result["layouts"]
    assert len(layouts) == 1
    zones = layouts[0]["zones"]

    # We expect 'ent' and 'gen' zones.
    # Note: Genetic Algorithms are stochastic. In a tiny grid with few generations,
    # it is strictly possible (though unlikely) a zone might get squeezed out.
    # But usually we should see both.
    zone_types = [z["type"] for z in zones]
    assert "ent" in zone_types
    assert "gen" in zone_types

    # Verify polygon structure (list of list of floats)
    gen_poly = next(z["polygon"] for z in zones if z["type"] == "gen")
    assert len(gen_poly) >= 3  # A valid polygon has at least 3 points
    assert isinstance(gen_poly[0][0], float)

    print(f"\nIntegration Test Success! Fitness: {result['fitness']}")
