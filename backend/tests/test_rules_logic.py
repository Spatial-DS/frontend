import pytest
import pandas as pd
from floorplan.rules import RuleEngine
from floorplan.data_models import RoomData

@pytest.fixture
def mock_room_data():
    # Create a synthetic room definition
    room_df = pd.DataFrame({
        "short": ["ent", "gen", "stf"],
        "shape": ["organic", "square", "round"],
        "default_val": [10, 20, 15],
        "default_unit": ["sqm", "sqm", "sqm"]
    })
    
    # Empty rules matrix
    rules_df = pd.DataFrame(0.0, index=["ent", "gen", "stf"], columns=["ent", "gen", "stf"])
    
    # Empty selected zones (defaults to all)
    selected = pd.DataFrame({
        "short": ["ent", "gen", "stf"],
        "area": [10, 20, 15],
        "unit": ["sqm", "sqm", "sqm"]
    })
    
    return RoomData(room_df, rules_df, selected)

def test_adjacency_parsing(mock_room_data):
    engine = RuleEngine()
    text = "make ent repel gen with strength 5"
    
    mod_rules, _ = engine.parse_text(text, mock_room_data)
    
    # Check symmetric update
    assert mod_rules.loc["ent", "gen"] == 5.0
    assert mod_rules.loc["gen", "ent"] == 5.0

def test_shape_keyword_parsing_square(mock_room_data):
    engine = RuleEngine()
    text = "ensure ent is square with weight 2.0"
    
    _, dyn_rules = engine.parse_text(text, mock_room_data)
    
    rect_rules = dyn_rules.get("rectangularity", [])
    found = next((r for r in rect_rules if r["zone"] == "ent"), None)
    
    assert found is not None
    assert found["weight"] == 2.0

def test_shape_keyword_parsing_compact(mock_room_data):
    engine = RuleEngine()
    text = "ensure gen is compact with weight 3.0"
    
    _, dyn_rules = engine.parse_text(text, mock_room_data)
    
    comp_rules = dyn_rules.get("compactness", [])
    found = next((r for r in comp_rules if r["zone"] == "gen"), None)
    
    assert found is not None
    assert found["weight"] == 3.0

def test_default_shape_application(mock_room_data):
    """
    Verify that rules are automatically generated based on the 'shape' column
    in room_df even if no text prompt is provided.
    """
    engine = RuleEngine()
    # No text prompt
    _, dyn_rules = engine.parse_text("", mock_room_data)
    
    # 'gen' is defined as 'square' in the fixture
    rect_rules = dyn_rules.get("rectangularity", [])
    gen_rule = next((r for r in rect_rules if r["zone"] == "gen"), None)
    assert gen_rule is not None
    assert gen_rule["weight"] > 0 # Should have a default positive weight
    
    # 'ent' is 'organic' -> should be in compactness with low/negative weight or ignored
    # For this implementation, let's say 'organic' gets a distribution rule (negative compactness)
    comp_rules = dyn_rules.get("compactness", [])
    ent_rule = next((r for r in comp_rules if r["zone"] == "ent"), None)
    assert ent_rule is not None
    assert ent_rule["weight"] <= 0.1 # Low or negative
