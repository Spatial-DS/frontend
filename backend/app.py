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
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.orm import Session

# Import floorplan modules
from floorplan.database import Base, SessionLocal, engine, get_db, Job, GeneratedLayout
from floorplan.data_models import OptimizationRequest
from floorplan.worker import process_optimization_job

# Import user log-in modules
from users.models import User
# Import password hashing function
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# Import the shelf calculator logic
from shelfrun.shelf_run import run_shelf_calculator
from shelfrun.models import ShelfReport



# --- CONFIGURATION ---
REPORTS_FOLDER = os.path.join(os.getcwd(), "generated_reports")
os.makedirs(REPORTS_FOLDER, exist_ok=True)

GENERATED_LAYOUT_FOLDER = "generated_layout"
os.makedirs(GENERATED_LAYOUT_FOLDER, exist_ok=True)



# --- LIFECYCLE ---
@asynccontextmanager
# async def lifespan(app: FastAPI):
#     # Create DB tables if they don't exist
#     Base.metadata.create_all(bind=engine)
#     yield
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Create demo user if not exists -> Loads once
    db = SessionLocal()
    
    demo_username = "tampines"
    demo_password = "tampineslibrary"
    
    hashed_pw = pwd_context.hash(demo_password)

    if not db.query(User).filter(User.username == demo_username).first():
        db.add(User(username=demo_username, password_hash=hashed_pw))
        db.commit()
    db.close()
    yield


# --- APP INITIALIZATION ---
# Create DB tables if they don't exist + Initialise default user and password
app = FastAPI(title="Unified API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- EXCEPTION HANDLER FOR 422 VALIDATION ERRORS ---
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Log the full error details to the console for debugging
    print(f"Validation Error: {exc.errors()}")
    # Return a JSON response with the error details
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": str(exc.body)}, # Convert body to string to avoid serialization errors
    )

# ==========================================
#  ENDPOINT GROUP 1: SHELF CALCULATOR
# ==========================================

@app.post("/calculate-shelf")
def calculate_shelf(
    # Accept strings to prevent 422 if conversion is strict
    target_size: str = Form(...),
    current_size: str = Form(...),
    # months is optional now, defaulting to '12' if not provided
    months: str = Form("12"),
    raw_data: UploadFile = File(...),
    collection_mix: UploadFile = File(...), # Corrected parameter name
    labels: UploadFile = File(...),
    username: str = Form(...),
    db: Session = Depends(get_db),
):
    """
    Handles file uploads and generating the shelf report docx.
    Accepts string inputs for numbers to handle FormData properly and converts them manually.
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
            collection_mix_path = os.path.join(temp_dir, collection_mix.filename)
            labels_path = os.path.join(temp_dir, labels.filename)

            # Save inputs
            save_upload(raw_data, raw_path)
            save_upload(collection_mix, collection_mix_path)
            save_upload(labels, labels_path)

            # Generate output filename
            date_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            output_filename = f"Shelf_Run_{date_str}.docx"
            output_path = os.path.join(REPORTS_FOLDER, output_filename)

            # Convert form strings to numbers
            try:
                t_size = float(target_size)
                c_size = float(current_size)
                # Handle potential float input for months gracefully
                m_count = float(months) 
            except ValueError:
                return JSONResponse(status_code=400, content={"error": "Parameters must be valid numbers."})

            # Run Logic
            run_shelf_calculator(
                label_path=labels_path,
                dataset_path=raw_path,
                collection_mix_path=collection_mix_path, # Passed as collection_mix_path
                output_path=output_path,
                target_size=t_size,
                current_size=c_size,
                months=m_count,
            )

            # Save to output filepath to db
            try:
                # Create a new record
                report = ShelfReport(filename=output_filename, filepath=output_path, username=username)
                db.add(report)
                db.commit()
                db.refresh(report)

            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Submission failed: {str(e)}")

            # Return file
            return FileResponse(
                path=output_path,
                filename=output_filename,
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )

    except Exception as e:
        # Print error to console for debugging
        print(f"Error in calculate-shelf: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/download-report/{filename}")
def download_report(filename: str):
    """
    Re-download a previously generated report.
    """
    # Try REPORTS_FOLDER first
    file_path = os.path.join(REPORTS_FOLDER, filename)
    if not os.path.exists(file_path):
        # Try GENERATED_LAYOUT_FOLDER
        file_path = os.path.join(GENERATED_LAYOUT_FOLDER, filename)
        # File not found
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


@app.post("/upload-generated-layout")
async def upload_report(file: UploadFile = File(...), username: str = Form(...), db: Session = Depends(get_db)):
    file_name = file.filename
    file_path = os.path.join(GENERATED_LAYOUT_FOLDER, file_name)
    with open(file_path, "wb") as f:
        # Save file to directory
        f.write(await file.read())

        # Save filepath to db
        try:
            # Create a new record
            generated_layout = GeneratedLayout(filename=file_name, filepath=file_path, username=username)
            db.add(generated_layout)
            db.commit()
            db.refresh(generated_layout)

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Submission failed: {str(e)}")

    return JSONResponse({"message": "PDF uploaded successfully", "filename": file.filename})

# ==========================================
#  ENDPOINT GROUP 3: USER LOG-IN AND SIGN-UP
# ==========================================
@app.post("/userauth")
def get_job_status(
    username: str = Form(...),
    password: str = Form(...), 
    db: Session = Depends(get_db)):
    user_credentials = db.query(User).filter(User.username == username).first()

    response = {
        "result": "0", # Default, unsuccessful
        "error": None,
    }

    if not user_credentials:
        response["error"] = "Username does not exist."
        return response
    
    if pwd_context.verify(password, user_credentials.password_hash):
        response["result"] = "1" # Success
    else:
        response["error"] = "Invalid password."

    return response


@app.post("/resetpass")
def reset_password(
    username: str = Form(...),
    new_password: str = Form(...),
    confirm_password: str = Form(...),
    db: Session = Depends(get_db)
):
    response = {
        "result": "0", # Default, unsuccessful
        "error": None,
    }

    # Validate passwords match
    if new_password != confirm_password:
        response["error"] = "Passwords do not match"
        return response

    # Prevent resetting admin account
    if username == "tampines":
        response["error"] = "Cannot reset administrative account"
        return response

    # Check if user exists
    user = db.query(User).filter(User.username == username).first()
    if not user:
        response["error"] = "Username not found"
        return response

    # Hash new password and update
    user.password_hash = pwd_context.hash(new_password)
    db.commit()

    response["result"] = "1" # Success

    return response
    

@app.post("/updatepass")
def update_password(
    username: str = Form(...),
    old_password: str = Form(...),
    new_password: str = Form(...),
    confirm_password: str = Form(...),
    db: Session = Depends(get_db)
):
    response = {"result": "0", "error": None}

    # Validate new passwords match
    if new_password != confirm_password:
        response["error"] = "New passwords do not match"
        return response

    # Prevent changing admin account
    if username == "tampines":
        response["error"] = "Cannot update administrative account"
        return response

    # Check if user exists
    user = db.query(User).filter(User.username == username).first()
    if not user:
        response["error"] = "Username not found"
        return response

    # Verify old password
    if not pwd_context.verify(old_password, user.password_hash):
        response["error"] = "Old password is incorrect"
        return response

    # Update password
    user.password_hash = pwd_context.hash(new_password)
    db.commit()

    response["result"] = "1"  # Success
    return response


@app.post("/signup")
def signup(
    username: str = Form(...),
    password: str = Form(...),
    confirm_password: str = Form(...),
    db: Session = Depends(get_db)
):
    response = {
        "result": "0", # Default, unsuccessful
        "error": None,
    }

    # Validate passwords match
    if password != confirm_password:
        response["error"] = "Passwords do not match"
        return response

    # Prevent creating admin account
    if username == "tampines":
        response["error"] ="Cannot create administrative account"
        return response

    # Check if username already exists
    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        response["error"] ="Username already exists"
        return response

    # Hash password and save
    hashed_password = pwd_context.hash(password)
    new_user = User(username=username, password_hash=hashed_password)
    db.add(new_user)
    db.commit()

    return {"message": f"Account for {username} created successfully"}


# ========================================================
#  ENDPOINT GROUP 4: SHELF RUN & LAYOUT GENERATOR HISTORY
# ========================================================
@app.post("/shelf-run-history")
def get_reports(username: str = Form(...), db: Session = Depends(get_db)):
    reports = db.query(ShelfReport).filter(ShelfReport.username == username).order_by(ShelfReport.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "filename": r.filename,
            "created_at": r.created_at.strftime("%Y-%m-%d"),
        }
        for r in reports
    ]


@app.post("/generated-layout-history")
def get_reports(username: str = Form(...), db: Session = Depends(get_db)):
    layouts = db.query(GeneratedLayout).filter(GeneratedLayout.username == username).order_by(GeneratedLayout.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "filename": r.filename,
            "created_at": r.created_at.strftime("%Y-%m-%d"),
        }
        for r in layouts
    ]


@app.delete("/delete-history")
def delete_history(file_id: str, filename: str, db: Session = Depends(get_db)):
    # Try ShelfReport first
    shelf_record = db.query(ShelfReport).filter(ShelfReport.id == file_id, ShelfReport.filename == filename).first()
    if shelf_record:
        file_path = os.path.join(REPORTS_FOLDER, shelf_record.filename)
        if os.path.exists(file_path):
            os.remove(file_path)
        db.delete(shelf_record)
        db.commit()
        return {"message": f"Shelf report {shelf_record.filename} deleted successfully"}

    # Try GeneratedLayout next
    layout_record = db.query(GeneratedLayout).filter(GeneratedLayout.id == file_id, GeneratedLayout.filename == filename).first()
    if layout_record:
        file_path = os.path.join(GENERATED_LAYOUT_FOLDER, layout_record.filename)
        if os.path.exists(file_path):
            os.remove(file_path)
        db.delete(layout_record)
        db.commit()
        return {"message": f"Layout {layout_record.filename} deleted successfully"}

    raise HTTPException(status_code=404, detail="File not found in any history table")


# --- MAIN ENTRY POINT ---
if __name__ == "__main__":
    # FastAPI typically runs on 8000, but set to 5000 if your frontend expects it
    uvicorn.run(app, host="0.0.0.0", port=8000)