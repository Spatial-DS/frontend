import pandas as pd
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app import app
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

def mock_static_data():
    room_df = pd.DataFrame({
        "short": ["ent", "gen"],
        "full": ["Entrance", "General"],
        "color": ["#3366cc", "#cc9933"],
        "default_val": [10, 20],
        "default_unit": ["sqm", "sqm"],
        "shape": ["round", "square"],
    })
    rules_df = pd.DataFrame(
        [[-1.0, 0.0], [0.0, -1.0]], 
        index=["ent", "gen"], 
        columns=["ent", "gen"]
    )
    return room_df, rules_df

def test_full_integration_run(client, real_workload_payload):
    """
    Submits a job and runs the REAL worker logic (algorithm)
    but mocks the file I/O (CSVs) and the LLM (RuleEngine).
    """
    
    # Define the side effect function to return FRESH data every time
    # This prevents 'pop' from affecting subsequent calls or inspections
    def parse_text_side_effect(*args, **kwargs):
        _, rules = mock_static_data()
        dynamic_rules = {
            "rectangularity": [],
            "compactness": [{"zone": "gen", "weight": 1.0}], 
            "count_per_floor": [],
            "metadata": {
                "success": True,
                "remarks": "Test: Enforced compactness on General."
            }
        }
        return (rules, dynamic_rules)

    # Use autospec=True to ensure the Mock mimics the real class structure
    with patch("floorplan.worker._load_static_data") as mock_load, \
         patch("floorplan.worker.RuleEngine", autospec=True) as MockRuleEngine:
        
        # 1. Configure Static Data Mock
        mock_load.return_value = mock_static_data()

        # 2. Configure LLM Mock
        # Configure the instance that calling RuleEngine() produces
        mock_engine_instance = MockRuleEngine.return_value
        mock_engine_instance.parse_text.side_effect = parse_text_side_effect

        # 3. Submit Job
        response = client.post("/optimize", json=real_workload_payload)
        assert response.status_code == 202
        job_id = response.json()["job_id"]

        # 4. Run Worker synchronously
        db = SessionLocal()
        try:
            process_optimization_job(job_id, db)
        except Exception as e:
            pytest.fail(f"Worker crashed during execution: {e}")
        finally:
            db.close()

        # 5. Verify the Mock was actually called
        # If this fails, the worker is using the real class (imports issue)
        assert MockRuleEngine.called, "RuleEngine was not instantiated by the worker"
        assert mock_engine_instance.parse_text.called, "parse_text was not called"

        # 6. Check Results
        status_resp = client.get(f"/jobs/{job_id}")
        data = status_resp.json()

        if data["status"] == "failed":
            print(f"\n[Worker Error Log]:\n{data.get('error')}")
            pytest.fail("Job status is 'failed'")

        assert data["status"] == "completed"

        # Verify LLM Feedback
        result = data["result"]
        assert "llm_feedback" in result
        assert result["llm_feedback"]["success"] is True
        assert "Enforced compactness" in result["llm_feedback"]["remarks"]

        # Verify Geometry Output
        assert "variations" in result
        assert len(result["variations"]) > 0
        print(f"\nIntegration Test Success! Fitness: {result['variations'][0]['fitness']}")

def test_failed_optimization_flow(client, real_workload_payload):
    """
    Tests that exceptions in the worker are correctly caught 
    and saved to the DB as 'failed'.
    """
    with patch("floorplan.worker._load_static_data") as mock_load, \
         patch("floorplan.worker.RuleEngine", autospec=True) as MockRuleEngine, \
         patch("floorplan.worker.run_multi_resolution_optimization") as mock_algo:
        
        # 1. Configure Mocks
        mock_load.return_value = mock_static_data()
        
        mock_engine_instance = MockRuleEngine.return_value
        # Return empty metadata to ensure it doesn't crash on 'pop'
        mock_engine_instance.parse_text.return_value = (mock_static_data()[1], {})
        
        # Force a crash in the algorithm
        mock_algo.side_effect = ValueError("Simulated Geometry Error")

        # 2. Submit & Run
        response = client.post("/optimize", json=real_workload_payload)
        job_id = response.json()["job_id"]

        db = SessionLocal()
        process_optimization_job(job_id, db)
        db.close()

        # 3. Verify Failure Handling
        status_resp = client.get(f"/jobs/{job_id}")
        data = status_resp.json()

        assert data["status"] == "failed"
        assert "Simulated Geometry Error" in data["error"]
