import os
import time
import traceback

import numpy as np  # Ensure numpy is imported
import pandas as pd
from sqlalchemy.orm import Session

from floorplan.api import run_multi_resolution_optimization
from floorplan.data_models import OptimizationRequest, RoomData, ZoneConstraint
from floorplan.database import Job
from floorplan.rules import RuleEngine


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
            data.append(
                {
                    "short": c.short_code,
                    "area": c.area_value,  # Can be None
                    "unit": c.unit,
                }
            )

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
            selected_zones_df["area"] = 10  # Fallback

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
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        return

    try:
        job.status = "processing"
        job.progress = 0.0  # Reset
        db.commit()

        request_data = OptimizationRequest(**job.input_payload)
        room_df, rules_df = _load_static_data()
        room_data = _prepare_room_data(room_df, rules_df, request_data.constraints)

        # 1. LLM Parsing
        rule_engine = RuleEngine()
        modified_rules_df, dynamic_rules = rule_engine.parse_text(
            request_data.global_parameters.text_prompt, room_data
        )

        # --- FAIL FAST CHECK ---
        metadata = dynamic_rules.get("metadata", {})
        if metadata.get("success") is False:
            # Clean up the message
            reason = metadata.get("remarks", "Unknown error.")
            # This string is what appears in your red Error Modal
            raise ValueError(f"AI Input Rejection: {reason}")
        # -----------------------
        room_data.rules_df = modified_rules_df
        llm_metadata = dynamic_rules.pop("metadata", {})

        # 2. Define Progress Callback with Throttling
        last_update_time = 0

        def db_progress_callback(progress_float: float):
            nonlocal last_update_time
            current_time = time.time()

            # Update only if 1 second has passed OR progress is complete (1.0)
            if (current_time - last_update_time > 1.0) or (progress_float >= 1.0):
                try:
                    # Need to query/refresh job to avoid detached instance errors if session flushed
                    # But typically updating the object attached to session is fine.
                    job.progress = round(progress_float, 2)
                    # We use commit() to save state visible to API readers
                    db.commit()
                    last_update_time = current_time
                except Exception:
                    # Fail silently on progress update to not kill the job
                    db.rollback()

        # 3. Run Optimization with Callback
        results_list = run_multi_resolution_optimization(
            plans=request_data.floor_plans,
            room_data=room_data,
            target_node_counts=request_data.global_parameters.target_node_counts,
            generations=request_data.global_parameters.generations,
            pop_sizes=request_data.global_parameters.pop_sizes,
            total_gfa=request_data.global_parameters.total_gfa,
            dynamic_rules=dynamic_rules,
            interactive=request_data.global_parameters.interactive,
            show_progress=False,
            num_layouts=3,
            progress_callback=db_progress_callback,  # <-- Pass the callback here
        )

        if not results_list:
            raise ValueError("Optimization returned no results.")

        variations = []
        for res in results_list:
            area_stats = res.area_distribution.to_dict(orient="records")
            layouts_json = [layout.model_dump() for layout in res.floor_layouts]
            variations.append(
                {
                    "fitness": float(res.fitness),
                    "area_stats": area_stats,
                    "layouts": layouts_json,
                }
            )

        # 5. Save Results WITH LLM Feedback
        job.result = {
            "variations": variations,
            "llm_feedback": {
                "success": llm_metadata.get("success", True),
                "remarks": llm_metadata.get("remarks", "No remarks."),
            },
        }
        job.progress = 1.0
        job.status = "completed"
        db.commit()

    except ValueError as ve:
        # NEW: Handle "Expected" errors cleanly (No Traceback)
        db.rollback()
        job = db.query(Job).filter(Job.id == job_id).first()
        job.status = "failed"

        # If it's our specific AI rejection, just show the message
        error_str = str(ve)
        if "AI Input Rejection" in error_str:
            job.error_message = error_str
        else:
            # For other unexpected code crashes, keep the traceback for debugging
            job.error_message = (
                error_str + "\n\nDebug Trace:\n" + traceback.format_exc()
            )

        db.commit()

    except Exception as e:
        # Catch-all for other crashes
        db.rollback()
        job = db.query(Job).filter(Job.id == job_id).first()
        job.status = "failed"
        job.error_message = (
            f"System Error: {str(e)}\n\nDebug Trace:\n{traceback.format_exc()}"
        )
        db.commit()
