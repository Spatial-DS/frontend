import re
import pandas as pd
from floorplan.data_models import RoomData

class RuleEngine:
    def parse_text(
        self, text_prompt: str, room_data: RoomData
    ) -> tuple[pd.DataFrame, dict]:
        
        modified_rules_df = room_data.rules_df.copy()
        dynamic_rules = {
            "compactness": [], 
            "count_per_floor": [],
            "rectangularity": [] # New Category
        }
        all_zones = room_data.room_df["short"].values
        
        # 1. Apply Defaults from 'shape' column in CSV
        # This ensures rooms behave according to their static definition 
        # unless overridden by text.
        if "shape" in room_data.room_df.columns:
            for _, row in room_data.room_df.iterrows():
                zone = row["short"]
                shape = str(row["shape"]).lower().strip()
                
                if shape in ["square", "rect", "rectangular"]:
                    # Default: Moderate encouragement to be square
                    dynamic_rules["rectangularity"].append({"zone": zone, "weight": 2.0})
                elif shape == "round":
                    # Default: Standard clustering
                    dynamic_rules["compactness"].append({"zone": zone, "weight": 1.0})
                elif shape == "organic":
                    # Default: Allow sprawl (negative compactness or zero)
                    dynamic_rules["compactness"].append({"zone": zone, "weight": 0.0})

        # 2. Parse Text Prompts (Overrides)
        
        num_pattern = r"(\d+\.?\d*)"

        # Adjacency
        adj_pattern = re.compile(
            r"make\s+(\w+)\s+(repel|attract)\s+(\w+)\s+with\s+strength\s+" + num_pattern,
            re.IGNORECASE,
        )
        for match in adj_pattern.finditer(text_prompt):
            zone1, rel, zone2, val = match.groups()
            strength = float(val) * (-1 if rel.lower() == "attract" else 1)
            if zone1 in modified_rules_df.index and zone2 in modified_rules_df.columns:
                modified_rules_df.loc[zone1, zone2] = strength
                modified_rules_df.loc[zone2, zone1] = strength
                print(f"Rule: '{zone1}' <-> '{zone2}' strength {strength}")

        # Compactness (Round/Clustered)
        compact_pattern = re.compile(
            r"ensure\s+(\w+)\s+is\s+compact\s+with\s+weight\s+" + num_pattern,
            re.IGNORECASE,
        )
        for match in compact_pattern.finditer(text_prompt):
            zone, weight_str = match.groups()
            if zone in all_zones:
                # Remove existing default if present
                dynamic_rules["compactness"] = [r for r in dynamic_rules["compactness"] if r["zone"] != zone]
                dynamic_rules["compactness"].append({"zone": zone, "weight": float(weight_str)})
                print(f"Rule: '{zone}' compactness {weight_str}")

        # Rectangularity (Square/Rectangular) - NEW
        rect_pattern = re.compile(
            r"ensure\s+(\w+)\s+is\s+(?:square|rectangular)\s+with\s+weight\s+" + num_pattern,
            re.IGNORECASE,
        )
        for match in rect_pattern.finditer(text_prompt):
            zone, weight_str = match.groups()
            if zone in all_zones:
                # Remove existing rectangularity rule if present
                dynamic_rules["rectangularity"] = [r for r in dynamic_rules["rectangularity"] if r["zone"] != zone]
                dynamic_rules["rectangularity"].append({"zone": zone, "weight": float(weight_str)})
                
                # Also ensure standard compactness is low/off so it doesn't fight the square shape
                # (optional, but squares usually shouldn't be forced to be circles)
                dynamic_rules["compactness"] = [r for r in dynamic_rules["compactness"] if r["zone"] != zone]
                
                print(f"Rule: '{zone}' rectangularity {weight_str}")

        # Distribution (Sprawl/Organic)
        dist_pattern = re.compile(
            r"(?:distribute|ensure)\s+(\w+)\s+(?:with\s+weight|is\s+organic)\s+" + num_pattern, re.IGNORECASE
        )
        for match in dist_pattern.finditer(text_prompt):
            zone, weight_str = match.groups()
            if zone in all_zones:
                dynamic_rules["compactness"] = [r for r in dynamic_rules["compactness"] if r["zone"] != zone]
                # Negative compactness encourages perimeter growth
                dynamic_rules["compactness"].append({"zone": zone, "weight": -float(weight_str)})
                print(f"Rule: '{zone}' distribution {-float(weight_str)}")

        # Count Per Floor
        count_pattern = re.compile(
            r"ensure\s+(\d+)\s+(\w+)\s+per\s+floor\s+with\s+weight\s+" + num_pattern,
            re.IGNORECASE,
        )
        for match in count_pattern.finditer(text_prompt):
            count, zone, weight_str = match.groups()
            if zone in all_zones:
                dynamic_rules["count_per_floor"].append(
                    {"zone": zone, "target": int(count), "weight": float(weight_str)}
                )

        return modified_rules_df, dynamic_rules
