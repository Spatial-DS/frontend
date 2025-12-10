import pytest
import pandas as pd
import json
import os
from unittest.mock import MagicMock, patch
from floorplan.rules import RuleEngine
from floorplan.data_models import RoomData

# --- Fixtures ---

@pytest.fixture
def mock_room_data():
    """Creates synthetic room data for testing."""
    room_df = pd.DataFrame({
        "short": ["ent", "gen", "stf"],
        "shape": ["organic", "square", "round"],
        "default_val": [10, 20, 15],
        "default_unit": ["sqm", "sqm", "sqm"]
    })
    
    rules_df = pd.DataFrame(0.0, index=["ent", "gen", "stf"], columns=["ent", "gen", "stf"])
    
    selected = pd.DataFrame({
        "short": ["ent", "gen", "stf"],
        "area": [10, 20, 15],
        "unit": ["sqm", "sqm", "sqm"]
    })
    
    return RoomData(room_df, rules_df, selected)

@pytest.fixture
def mock_llm_engine(monkeypatch):
    """
    Creates a RuleEngine that does NOT hit the real Google API.
    
    1. Sets a dummy GOOGLE_API_KEY environment variable.
    2. Patches the 'GenerativeModel' class so the engine gets a fake model.
    3. Yields the engine and the mock model instance for configuration in tests.
    """
    # 1. Bypass the check in RuleEngine.__init__
    monkeypatch.setenv("GOOGLE_API_KEY", "dummy_test_key_for_stubbing")

    # 2. Patch the library where RuleEngine calls it
    # We patch 'google.generativeai.GenerativeModel' so that when 
    # self.model = genai.GenerativeModel(...) is run, it returns our mock.
    with patch("google.generativeai.GenerativeModel") as MockModelClass:
        
        # Instantiate the engine. It will use the mocked class.
        engine = RuleEngine()
        
        # Capture the specific instance created inside the engine
        mock_model_instance = MockModelClass.return_value
        
        yield engine, mock_model_instance

# --- Helper to create fake LLM responses ---

def create_mock_response(adjacency=[], shape=[], count=[], success=True, remarks="Test"):
    """
    Constructs a fake response object that mimics what the Google SDK returns.
    The SDK returns an object with a .text property containing the JSON string.
    """
    # The JSON structure expected by the Pydantic parser
    data = {
        "adjacency_rules": adjacency,
        "shape_rules": shape,
        "count_rules": count,
        "success": success,
        "remarks": remarks
    }
    
    # Create a mock object to represent the SDK response
    mock_response = MagicMock()
    # Set the .text attribute to the JSON string
    mock_response.text = json.dumps(data)
    
    return mock_response

# --- Tests ---

def test_adjacency_parsing(mock_room_data, mock_llm_engine):
    engine, mock_model = mock_llm_engine
    
    # STUB: Tell the mock what to return when generate_content is called
    mock_model.generate_content.return_value = create_mock_response(
        adjacency=[
            {
                "zone_source": "ent", 
                "zone_target": "gen", 
                "relation": "repel", 
                "strength": 5.0
            }
        ]
    )
    
    # ACTION: Call the method under test
    text = "make ent repel gen with strength 5"
    mod_rules, _ = engine.parse_text(text, mock_room_data)
    
    # ASSERT: Verify logic was applied
    assert mod_rules.loc["ent", "gen"] == 5.0
    assert mod_rules.loc["gen", "ent"] == 5.0
    
    # ASSERT: Verify the "LLM" was actually called with the text
    args, _ = mock_model.generate_content.call_args
    assert "make ent repel gen" in args[0]  # The prompt contains the user text

def test_shape_keyword_parsing_square(mock_room_data, mock_llm_engine):
    engine, mock_model = mock_llm_engine
    
    # STUB: Return a rectangular rule
    mock_model.generate_content.return_value = create_mock_response(
        shape=[
            {
                "zone": "ent",
                "shape_type": "rectangular",
                "weight": 2.0
            }
        ]
    )
    
    text = "ensure ent is square"
    _, dyn_rules = engine.parse_text(text, mock_room_data)
    
    rect_rules = dyn_rules.get("rectangularity", [])
    found = next((r for r in rect_rules if r["zone"] == "ent"), None)
    
    assert found is not None
    assert found["weight"] == 2.0

def test_shape_keyword_parsing_compact(mock_room_data, mock_llm_engine):
    engine, mock_model = mock_llm_engine
    
    # STUB: Return a compact rule
    mock_model.generate_content.return_value = create_mock_response(
        shape=[
            {
                "zone": "gen",
                "shape_type": "compact",
                "weight": 3.0
            }
        ]
    )
    
    text = "ensure gen is compact"
    _, dyn_rules = engine.parse_text(text, mock_room_data)
    
    comp_rules = dyn_rules.get("compactness", [])
    found = next((r for r in comp_rules if r["zone"] == "gen"), None)
    
    assert found is not None
    assert found["weight"] == 3.0

def test_shape_keyword_parsing_organic(mock_room_data, mock_llm_engine):
    """Test mapping 'organic' -> negative compactness"""
    engine, mock_model = mock_llm_engine
    
    # STUB: Return an organic rule
    mock_model.generate_content.return_value = create_mock_response(
        shape=[
            {
                "zone": "stf",
                "shape_type": "organic",
                "weight": 1.5
            }
        ]
    )
    
    text = "allow stf to sprawl"
    _, dyn_rules = engine.parse_text(text, mock_room_data)
    
    comp_rules = dyn_rules.get("compactness", [])
    found = next((r for r in comp_rules if r["zone"] == "stf"), None)
    
    assert found is not None
    # Verify the Logic Engine flipped the weight to negative
    assert found["weight"] == -1.5 

def test_default_shape_application(mock_room_data, mock_llm_engine):
    """
    Verify defaults are applied from CSV even without LLM input.
    """
    engine, mock_model = mock_llm_engine
    
    # Pass empty text -> Engine should skip LLM call
    _, dyn_rules = engine.parse_text("", mock_room_data)
    
    # Verify LLM was NOT called
    mock_model.generate_content.assert_not_called()
    
    # Verify 'gen' (square in mock CSV) got default rectangular rule
    rect_rules = dyn_rules.get("rectangularity", [])
    gen_rule = next((r for r in rect_rules if r["zone"] == "gen"), None)
    assert gen_rule is not None
    assert gen_rule["weight"] == 2.0

def test_api_failure_fallback(mock_room_data, mock_llm_engine):
    """Ensure that if the Google API throws an error, we don't crash."""
    engine, mock_model = mock_llm_engine
    
    # STUB: Make the API raise an exception
    mock_model.generate_content.side_effect = Exception("API Quota Exceeded")
    
    text = "make ent repel gen"
    # Should not crash
    _, dyn_rules = engine.parse_text(text, mock_room_data)
    
    # Verify we still got defaults
    rect_rules = dyn_rules.get("rectangularity", [])
    assert len(rect_rules) > 0
    
    # Verify metadata indicates failure
    assert dyn_rules["metadata"]["success"] is False
    assert "API Quota Exceeded" in dyn_rules["metadata"]["remarks"]
