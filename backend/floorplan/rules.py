import re

import pandas as pd

from floorplan.data_models import RoomData


class RuleEngine:
    """
    Parses natural language instructions to modify optimization parameters,
    such as the rules DataFrame and dynamic rule configurations.
    """

    def parse_text(
        self, text_prompt: str, room_data: RoomData
    ) -> tuple[pd.DataFrame, dict]:
        """
        Parses a text prompt and returns a modified rules_df and a dictionary
        of dynamic rule data.
        """
        modified_rules_df = room_data.rules_df.copy()
        dynamic_rules = {"compactness": [], "count_per_floor": []}
        all_zones = room_data.room_df["short"].values

        # --- Adjacency/Separation Rule Parsing ---
        num_pattern = r"(\d+\.?\d*)"  # Define a robust pattern for numbers

        # --- Adjacency/Separation Rule Parsing ---
        adj_pattern = re.compile(
            r"make\s+(\w+)\s+(repel|attract)\s+(\w+)\s+with\s+strength\s+"
            + num_pattern,
            re.IGNORECASE,
        )
        for match in adj_pattern.finditer(text_prompt):
            zone1, rel, zone2, val = match.groups()
            strength = float(val) * (-1 if rel.lower() == "attract" else 1)
            if zone1 in modified_rules_df.index and zone2 in modified_rules_df.columns:
                modified_rules_df.loc[zone1, zone2] = strength
                modified_rules_df.loc[zone2, zone1] = strength
                print(
                    f"Rule Applied: Set affinity between '{zone1}' and '{zone2}' to {strength}"
                )

        # --- Compactness & Distribution Rule Parsing ---
        compact_pattern = re.compile(
            r"ensure\s+(\w+)\s+is\s+compact\s+with\s+weight\s+" + num_pattern,
            re.IGNORECASE,
        )
        for match in compact_pattern.finditer(text_prompt):
            zone, weight_str = match.groups()
            if zone in all_zones:
                rule = {"zone": zone, "weight": float(weight_str)}
                dynamic_rules["compactness"].append(rule)
                print(
                    f"Rule Applied: Set compactness for '{zone}' with weight {float(weight_str)}"
                )

        dist_pattern = re.compile(
            r"distribute\s+(\w+)\s+with\s+weight\s+" + num_pattern, re.IGNORECASE
        )
        for match in dist_pattern.finditer(text_prompt):
            zone, weight_str = match.groups()
            if zone in all_zones:
                rule = {"zone": zone, "weight": -float(weight_str)}
                dynamic_rules["compactness"].append(rule)
                print(
                    f"Rule Applied: Set distribution for '{zone}' with weight {-float(weight_str)}"
                )

        # --- Per-Floor Count Rule Parsing ---
        count_pattern = re.compile(
            r"ensure\s+(\d+)\s+(\w+)\s+per\s+floor\s+with\s+weight\s+" + num_pattern,
            re.IGNORECASE,
        )
        for match in count_pattern.finditer(text_prompt):
            count, zone, weight_str = match.groups()
            if zone in all_zones:
                rule = {"zone": zone, "target": int(count), "weight": float(weight_str)}
                dynamic_rules["count_per_floor"].append(rule)
                print(f"Rule Applied: Set count per floor for '{zone}' to {int(count)}")

        return modified_rules_df, dynamic_rules
