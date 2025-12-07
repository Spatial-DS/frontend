import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
import io
import sys
import os

# Ensure app can be imported
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from app import app

client = TestClient(app)

@patch("app.run_shelf_calculator")
def test_calculate_shelf_endpoint(mock_calc, tmp_path):
    """
    Test the /calculate-shelf endpoint accepts files and parameters.
    We create a real temporary output file so FileResponse is happy.
    """
    dummy_excel = io.BytesIO(b"fake excel data")
    
    files = {
        "raw_data": ("raw.xlsx", dummy_excel, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        "holdings": ("holdings.xlsx", dummy_excel, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        "labels": ("labels.xlsx", dummy_excel, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    }
    
    data = {
        "target_size": "1000",
        "current_size": "800",
        "months": "12"
    }

    # 1. Mock the REPORTS_FOLDER to point to our temp dir
    with patch("app.REPORTS_FOLDER", str(tmp_path)):
        def create_dummy_output(*args, **kwargs):
            output_path = kwargs.get("output_path")
            with open(output_path, "wb") as f:
                f.write(b"dummy docx content")

        mock_calc.side_effect = create_dummy_output

        response = client.post("/calculate-shelf", data=data, files=files)
    
    assert mock_calc.called
    assert response.status_code == 200
    # Verify it is treated as a file download
    assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in response.headers["content-type"]

def test_download_report_success(tmp_path):
    """Test downloading an existing report using real temp files."""
    # 1. Create a dummy report in the temp dir
    filename = "test_report.docx"
    file_path = tmp_path / filename
    file_path.write_bytes(b"docx content")

    # 2. Patch REPORTS_FOLDER to point to tmp_path
    with patch("app.REPORTS_FOLDER", str(tmp_path)):
        response = client.get(f"/download-report/{filename}")
        
    assert response.status_code == 200
    assert response.content == b"docx content"
    assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in response.headers["content-type"]

def test_download_report_not_found(tmp_path):
    """Test downloading a non-existent report."""
    with patch("app.REPORTS_FOLDER", str(tmp_path)):
        response = client.get("/download-report/missing.docx")
    
    assert response.status_code == 404
    assert response.json()["detail"] == "File not found"
