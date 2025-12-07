# ./app.py
import matplotlib
# 1. Force non-interactive backend immediately
matplotlib.use("Agg")

import os
import shutil
import tempfile
from contextlib import asynccontextmanager
from datetime import datetime

import uvicorn
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

# Import your modules
# Ensure these imports match your folder structure
from floorplan.database import Base, engine, get_db, Job
from floorplan.data_models import OptimizationRequest
from floorplan.worker import process_optimization_job

# Import the shelf calculator logic
from shelf_run import run_shelf_calculator

# --- CONFIGURATION ---
REPORTS_FOLDER = os.path.join(os.getcwd(), "generated_reports")
os.makedirs(REPORTS_FOLDER, exist_ok=True)


# --- LIFECYCLE ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create DB tables if they don't exist
    Base.metadata.create_all(bind=engine)
    yield


# --- APP INITIALIZATION ---
app = FastAPI(title="Unified API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
#  ENDPOINT GROUP 1: SHELF CALCULATOR
# ==========================================

@app.post("/calculate-shelf")
def calculate_shelf(
    target_size: float = Form(...),
    current_size: float = Form(...),
    months: int = Form(...),
    raw_data: UploadFile = File(...),
    holdings: UploadFile = File(...),
    labels: UploadFile = File(...)
):
    """
    Handles file uploads and generating the shelf report docx.
    Replaces the old Flask route.
    """
    try:
        # Use a temporary directory to process input files safely
        with tempfile.TemporaryDirectory() as temp_dir:
            # Helper to save uploaded file to temp path
            def save_upload(upload_file: UploadFile, dest_path: str):
                with open(dest_path, "wb") as buffer:
                    shutil.copyfileobj(upload_file.file, buffer)

            # Define paths
            raw_path = os.path.join(temp_dir, raw_data.filename)
            holdings_path = os.path.join(temp_dir, holdings.filename)
            labels_path = os.path.join(temp_dir, labels.filename)

            # Save inputs
            save_upload(raw_data, raw_path)
            save_upload(holdings, holdings_path)
            save_upload(labels, labels_path)

            # Generate output filename
            date_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            output_filename = f"Shelf_Run_{date_str}.docx"
            output_path = os.path.join(REPORTS_FOLDER, output_filename)

            # Run Logic (This assumes run_shelf_calculator is synchronous/blocking)
            run_shelf_calculator(
                label_path=labels_path,
                dataset_path=raw_path,
                holdings_path=holdings_path,
                output_path=output_path,
                target_size=target_size,
                current_size=current_size,
                months=months,
            )

            # Return file
            return FileResponse(
                path=output_path,
                filename=output_filename,
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )

    except Exception as e:
        # Print error to console for debugging
        print(f"Error in calculate-shelf: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/download-report/{filename}")
def download_report(filename: str):
    """
    Re-download a previously generated report.
    """
    file_path = os.path.join(REPORTS_FOLDER, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


# ==========================================
#  ENDPOINT GROUP 2: FLOORPLAN OPTIMIZATION
# ==========================================

@app.post("/optimize", status_code=202)
def submit_optimization_job(
    payload: OptimizationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    try:
        # Create Job Record
        job = Job(input_payload=payload.model_dump())
        db.add(job)
        db.commit()
        db.refresh(job)

        # Trigger Background Task
        background_tasks.add_task(process_optimization_job, job.id, db)

        return {
            "job_id": job.id,
            "status": "queued",
            "message": "Optimization job submitted successfully.",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Submission failed: {str(e)}")


@app.get("/jobs/{job_id}")
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    response = {
        "job_id": job.id,
        "status": job.status,
        "created_at": job.created_at,
        "result": None,
        "error": None,
    }

    if job.status == "completed":
        response["result"] = job.result
    elif job.status == "failed":
        response["error"] = job.error_message

    return response


@app.get("/health")
def health_check():
    return {"status": "ok"}


# --- MAIN ENTRY POINT ---
if __name__ == "__main__":
    # FastAPI typically runs on 8000, but set to 5000 if your frontend expects it
    uvicorn.run(app, host="0.0.0.0", port=8000)
