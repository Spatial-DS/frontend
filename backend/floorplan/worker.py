import os
import traceback
import pandas as pd
import numpy as np # Ensure numpy is imported
from sqlalchemy.orm import Session
from floorplan.api import run_multi_resolution_optimization
from floorplan.data_models import OptimizationRequest, RoomData, ZoneConstraint
from floorplan.database import Job

def _load_static_data() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Loads rooms.csv and rules.csv."""
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(current_dir)
        rooms_path = os.path.join(project_root, "floorplan", "rooms.csv")
        rules_path = os.path.join(project_root, "floorplan", "rules.csv")

        # Fallback for standalone execution
        if not os.path.exists(rooms_path):
            rooms_path = "rooms.csv"
            rules_path = "rules.csv"

        room_df = pd.read_csv(rooms_path)
        rules_df_raw = pd.read_csv(rules_path, index_col=0)
        
        # Ensure symmetric square matrix
        rules_df = pd.DataFrame(0.0, index=room_df["short"], columns=room_df["short"])
        np.fill_diagonal(rules_df.values, -1.0)
        rules_df.update(rules_df_raw)
        
        return room_df, rules_df
    except Exception as e:
        raise RuntimeError(f"Failed to load static CSV data: {e}")

def _prepare_room_data(
    static_room_df: pd.DataFrame,
    static_rules_df: pd.DataFrame,
    constraints: list[ZoneConstraint] | None,
) -> RoomData:
    """
    Merges static definitions with dynamic constraints.
    If constraints is None/Empty, uses all zones from static_room_df.
    """
    data = []
    
    # 1. Map Inputs if present
    if constraints:
        for c in constraints:
            data.append({
                "short": c.short_code,
                "area": c.area_value, # Can be None
                "unit": c.unit
            })
    
    # 2. Build DataFrame
    if data:
        selected_zones_df = pd.DataFrame(data)
    else:
        # DEFAULT: Use everything in rooms.csv
        # We assume rooms.csv has 'default_val' and 'default_unit'
        print("No constraints provided. Using defaults from rooms.csv.")
        selected_zones_df = static_room_df.copy()
        
        # Rename columns to match expected schema if they exist
        if "default_val" in selected_zones_df.columns:
            selected_zones_df["area"] = selected_zones_df["default_val"]
        else:
            selected_zones_df["area"] = 10 # Fallback
            
        if "default_unit" in selected_zones_df.columns:
            selected_zones_df["unit"] = selected_zones_df["default_unit"]
        else:
            selected_zones_df["unit"] = "sqm"

    return RoomData(
        room_df=static_room_df,
        rules_df=static_rules_df,
        selected_zones_df=selected_zones_df,
    )

def process_optimization_job(job_id: str, db: Session):
    # (Identical logic, just ensure _prepare_room_data calls match new signature)
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job: return

    try:
        job.status = "processing"
        db.commit()

        request_data = OptimizationRequest(**job.input_payload)
        room_df, rules_df = _load_static_data()
        
        # Pass the constraints list directly
        room_data = _prepare_room_data(room_df, rules_df, request_data.constraints)

        results_list = run_multi_resolution_optimization(
            plans=request_data.floor_plans,
            room_data=room_data,
            target_node_counts=request_data.global_parameters.target_node_counts,
            generations=request_data.global_parameters.generations,
            pop_sizes=request_data.global_parameters.pop_sizes,
            total_gfa=request_data.global_parameters.total_gfa,
            text_prompt=request_data.global_parameters.text_prompt,
            interactive=request_data.global_parameters.interactive,
            show_progress=False,
            num_layouts=3,
        )

        if not results_list: raise ValueError("Optimization returned no results.")

        variations = []
        for res in results_list:
            area_stats = res.area_distribution.to_dict(orient="records")
            layouts_json = [layout.model_dump() for layout in res.floor_layouts]
            variations.append({
                "fitness": float(res.fitness),
                "area_stats": area_stats,
                "layouts": layouts_json,
            })

        job.result = {"variations": variations}
        job.status = "completed"
        db.commit()

    except Exception as e:
        db.rollback()
        # Re-query
        job = db.query(Job).filter(Job.id == job_id).first()
        job.status = "failed"
        job.error_message = str(e) + "\n" + traceback.format_exc()
        db.commit()
