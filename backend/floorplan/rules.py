import json
import os
import typing

import google.generativeai as genai
import pandas as pd
from pydantic import BaseModel, Field

from floorplan.data_models import RoomData

# --- UPDATED SCHEMAS ---


class AdjacencyRule(BaseModel):
    zone_source: str = Field(description="The first zone code")
    zone_target: str = Field(description="The second zone code")
    relation: typing.Literal["attract", "repel"]
    strength: float


class ShapeRule(BaseModel):
    zone: str
    shape_type: typing.Literal["compact", "rectangular", "organic"]
    weight: float


class CountRule(BaseModel):
    zone: str
    count: int
    weight: float


class RuleParsingResponse(BaseModel):
    # --- TRICK: "remarks" is now FIRST ---
    # This forces the LLM to write the explanation before it can write "success: false"
    remarks: str = Field(
        ...,  # The '...' explicitly marks this as REQUIRED
        description="Chain of Thought: Explain your reasoning here. If rejecting, explain exactly why (e.g. 'Pool is not a valid zone').",
    )
    success: bool = Field(
        ...,
        description="Set to True if the request was successfully mapped to rules. Set to False if rejected.",
    )
    # Lists default to empty
    adjacency_rules: list[AdjacencyRule] = Field(default_factory=list)
    shape_rules: list[ShapeRule] = Field(default_factory=list)
    count_rules: list[CountRule] = Field(default_factory=list)


# --- ENGINE ---


class RuleEngine:
    def __init__(self):
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY environment variable not found.")

        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model_name="gemini-2.5-flash-lite")

    def parse_text(
        self, text_prompt: str, room_data: RoomData
    ) -> tuple[pd.DataFrame, dict]:
        modified_rules_df = room_data.rules_df.copy()
        dynamic_rules = {
            "compactness": [],
            "count_per_floor": [],
            "rectangularity": [],
            "metadata": {"success": True, "remarks": "No custom rules applied."},
        }

        # 1. Prepare Zone Context
        zone_info = []
        valid_codes = []
        name_col = "name" if "name" in room_data.room_df.columns else "short"

        for _, row in room_data.room_df.iterrows():
            code = row["short"]
            name = row.get(name_col, code)
            valid_codes.append(code)
            zone_info.append(f"- {name} ('{code}')")

        valid_zones_str = "\n".join(zone_info)

        # ---------------------------------------------------------
        # 2A. Apply Defaults from 'shape' column
        # ---------------------------------------------------------
        if "shape" in room_data.room_df.columns:
            for _, row in room_data.room_df.iterrows():
                zone = row["short"]
                shape = str(row["shape"]).lower().strip()
                if shape in ["square", "rect", "rectangular"]:
                    dynamic_rules["rectangularity"].append(
                        {"zone": zone, "weight": 2.0}
                    )
                elif shape == "round":
                    dynamic_rules["compactness"].append({"zone": zone, "weight": 1.0})
                elif shape == "organic":
                    dynamic_rules["compactness"].append({"zone": zone, "weight": 0.0})

        # ---------------------------------------------------------
        # 2B. Apply Defaults from 'count_per_floor' column (NEW)
        # ---------------------------------------------------------
        if "count_per_floor" in room_data.room_df.columns:
            for _, row in room_data.room_df.iterrows():
                val = row["count_per_floor"]
                # Check if value is valid (not NaN, not empty, > 0)
                if pd.notna(val) and str(val).strip() != "":
                    try:
                        count_val = int(val)
                        if count_val > 0:
                            dynamic_rules["count_per_floor"].append(
                                {
                                    "zone": row["short"],
                                    "target": count_val,
                                    "weight": 5.0,  # High priority for CSV defaults
                                }
                            )
                    except ValueError:
                        pass  # Ignore non-integer values

        # 3. Prompt Construction & LLM Call
        if not text_prompt or not text_prompt.strip():
            return modified_rules_df, dynamic_rules

        prompt = f"""
        You are a strict configuration parser for a Library Floorplan Engine.
        
        ### Valid Zones
        {valid_zones_str}

        ### Instructions
        1. Analyze the "User Request".
        2. **First**, fill the `remarks` field explaining your reasoning.
        3. **Second**, set `success`.
        4. **Third**, map valid rules.

        ### Rules
        - **Adjacency**: Attract/Repel. Strength 0.0-1.0.
        - **Shape**: Rectangular/Compact/Organic. Weight 1.0-5.0.
        - **Counts**: Target number per floor. Weight 5.0.

        ### User Request
        "{text_prompt}"
        """

        try:
            response = self.model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=RuleParsingResponse,
                ),
            )

            data_dict = json.loads(response.text)
            print(f"\n[LLM RESPONSE]: {json.dumps(data_dict, indent=2)}\n")

            llm_success = data_dict.get("success", True)
            llm_remarks = data_dict.get(
                "remarks", "Input rejected by AI (No reason provided)."
            )

            dynamic_rules["metadata"] = {"success": llm_success, "remarks": llm_remarks}

            if not llm_success:
                return modified_rules_df, dynamic_rules

            # 4. Apply Logic (Overrides)

            # Adjacency
            for rule in data_dict.get("adjacency_rules", []):
                z1, z2 = rule["zone_source"], rule["zone_target"]
                if z1 in modified_rules_df.index and z2 in modified_rules_df.columns:
                    raw_strength = rule["strength"]
                    direction = -1.0 if rule["relation"] == "attract" else 1.0
                    val = raw_strength * direction
                    modified_rules_df.loc[z1, z2] = val
                    modified_rules_df.loc[z2, z1] = val

            # Shape (Clear defaults if overridden)
            for rule in data_dict.get("shape_rules", []):
                zone = rule["zone"]
                if zone in valid_codes:
                    dynamic_rules["compactness"] = [
                        r for r in dynamic_rules["compactness"] if r["zone"] != zone
                    ]
                    dynamic_rules["rectangularity"] = [
                        r for r in dynamic_rules["rectangularity"] if r["zone"] != zone
                    ]

                    if rule["shape_type"] == "rectangular":
                        dynamic_rules["rectangularity"].append(
                            {"zone": zone, "weight": rule["weight"]}
                        )
                    elif rule["shape_type"] == "compact":
                        dynamic_rules["compactness"].append(
                            {"zone": zone, "weight": rule["weight"]}
                        )
                    elif rule["shape_type"] == "organic":
                        dynamic_rules["compactness"].append(
                            {"zone": zone, "weight": -rule["weight"]}
                        )

            # Counts (Clear defaults if overridden)
            for rule in data_dict.get("count_rules", []):
                zone = rule["zone"]
                if zone in valid_codes:
                    # REMOVE existing default from CSV to allow LLM override
                    dynamic_rules["count_per_floor"] = [
                        r for r in dynamic_rules["count_per_floor"] if r["zone"] != zone
                    ]

                    dynamic_rules["count_per_floor"].append(
                        {
                            "zone": zone,
                            "target": rule["count"],
                            "weight": rule["weight"],
                        }
                    )

        except Exception as e:
            print(f"LLM Error: {e}")
            dynamic_rules["metadata"] = {
                "success": False,
                "remarks": f"System Error: {str(e)}",
            }
            return modified_rules_df, dynamic_rules

        return modified_rules_df, dynamic_rules
