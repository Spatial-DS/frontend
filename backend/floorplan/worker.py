import os# floorplan/worker.py
import traceback
import pandas as pd
from sqlalchemy.orm import Session

from floorplan.api import run_multi_resolution_optimization
from floorplan.data_models import (
    OptimizationRequest, 
    RoomData, 
    OptimizationResult,
    ZoneConstraint
)
from floorplan.database import Job

# --- Helper: Static Data Loading ---
def _load_static_data() -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Loads the static configuration files. 
    In a production app, these might be cached or loaded at startup.
    """
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Determine project root (e.g., /backend)
        project_root = os.path.dirname(current_dir)
        
        # Define paths
        rooms_path = os.path.join(project_root, "floorplan", "rooms.csv")
        rules_path = os.path.join(project_root, "floorplan", "rules.csv")

        print(rooms_path)

        # Fallback: if not in root, try current working directory
        if not os.path.exists(rooms_path):
            rooms_path = "rooms.csv"
            rules_path = "rules.csv"

        print(f"Loading data from: {rooms_path}") # Debug log

        room_df = pd.read_csv(rooms_path)
        
        # Ensure rules_df matches the shape required
        rules_df_raw = pd.read_csv(rules_path, index_col=0)
        
        # Initialize a full matrix if needed, similar to main.py
        rules_df = pd.DataFrame(0.0, index=room_df["short"], columns=room_df["short"])
        np_fill = -1.0 
        # Using numpy to fill diagonal slightly faster
        import numpy as np
        np.fill_diagonal(rules_df.values, np_fill)
        
        # Update with loaded values
        rules_df.update(rules_df_raw)
        
        return room_df, rules_df
    except Exception as e:
        raise RuntimeError(f"Failed to load static CSV data: {e}")


def _prepare_room_data(
    static_room_df: pd.DataFrame, 
    static_rules_df: pd.DataFrame, 
    constraints: list[ZoneConstraint]
) -> RoomData:
    """
    Merges static definitions with the dynamic per-request constraints.
    """
    # Convert Pydantic constraints to DataFrame matching 'selected_zones.csv' format
    data = []
    for c in constraints:
        data.append({
            "short": c.short_code,
            "area": c.area_value if c.area_value is not None else float('nan'),
            "unit": c.unit
        })
    
    selected_zones_df = pd.DataFrame(data)
    
    return RoomData(
        room_df=static_room_df,
        rules_df=static_rules_df,
        selected_zones_df=selected_zones_df
    )


# --- Main Worker Task ---
def process_optimization_job(job_id: str, db: Session):
    """
    Retrieved the job from DB, runs the heavy optimization, and saves output.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        return

    try:
        # 1. Update Status
        job.status = "processing"
        db.commit()

        # 2. Parse Input (JSON -> Pydantic)
        # SQLAlchemy stores JSON, we convert it back to our Model for type safety
        request_data = OptimizationRequest(**job.input_payload)
        
        # 3. Load Data & Prepare Context
        room_df, rules_df = _load_static_data()
        room_data = _prepare_room_data(room_df, rules_df, request_data.constraints)

        # 4. Run Optimization (Headless)
        # We take the final result from the multi-stage process
        results_list = run_multi_resolution_optimization(
            plans=request_data.floor_plans,
            room_data=room_data,
            target_node_counts=request_data.global_parameters.target_node_counts,
            generations=request_data.global_parameters.generations,
            pop_sizes=request_data.global_parameters.pop_sizes,
            total_gfa=request_data.global_parameters.total_gfa,
            text_prompt=request_data.global_parameters.text_prompt,
            interactive=request_data.global_parameters.interactive,
            show_progress=False # Force off for background workers
        )

        if not results_list:
            raise ValueError("Optimization returned no results.")

        # 5. Serialize Output
        # We pick the best result (index 0 usually sorted by fitness)
        best_result: OptimizationResult = results_list[0]
        
        # Convert Area DataFrame to list of dicts for JSON
        area_stats = best_result.area_distribution.to_dict(orient="records")
        
        # Serialize Pydantic models for floor layouts
        # model_dump() is for Pydantic v2, dict() for v1. Using dict() for broader compat.
        layouts_json = [layout.model_dump() for layout in best_result.floor_layouts]

        final_output = {
            "fitness": float(best_result.fitness),
            "area_stats": area_stats,
            "layouts": layouts_json
        }

        # 6. Save to DB
        job.result = final_output
        job.status = "completed"
        db.commit()

    except Exception as e:
        db.rollback()
        error_trace = traceback.format_exc()
        print(f"Job {job_id} Failed:\n{error_trace}")
        
        # Re-query job to ensure session is attached if rollback happened
        job = db.query(Job).filter(Job.id == job_id).first()
        job.status = "failed"
        job.error_message = str(e)
        db.commit()
