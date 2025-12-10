import io
import os
import sys
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

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
    # Create a dummy file object
    dummy_excel = io.BytesIO(b"fake excel data")

    # Add 'collection_mix' to the files dictionary
    files = {
        "raw_data": (
            "raw.xlsx",
            dummy_excel,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
        "holdings": (
            "holdings.xlsx",
            dummy_excel,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
        "labels": (
            "labels.xlsx",
            dummy_excel,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
        "collection_mix": (
            "mix.xlsx",
            dummy_excel,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
    }

    # Non-file parameters go here
    data = {
        "target_size": "1000",
        "current_size": "800",
        "months": "12",
    }

    # 1. Mock the REPORTS_FOLDER to point to our temp dir
    with patch("app.REPORTS_FOLDER", str(tmp_path)):
        # Define side_effect to create the expected output file
        def create_dummy_output(*args, **kwargs):
            output_path = kwargs.get("output_path")
            # Ensure the directory exists (though tmp_path should exist)
            if output_path:
                with open(output_path, "wb") as f:
                    f.write(b"dummy docx content")

        mock_calc.side_effect = create_dummy_output

        # Send request
        response = client.post("/calculate-shelf", data=data, files=files)

    # Verify expectations
    assert mock_calc.called
    assert response.status_code == 200
    assert (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        in response.headers["content-type"]
    )


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
    assert (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        in response.headers["content-type"]
    )


def test_download_report_not_found(tmp_path):
    """Test downloading a non-existent report."""
    with patch("app.REPORTS_FOLDER", str(tmp_path)):
        response = client.get("/download-report/missing.docx")

    assert response.status_code == 404
    assert response.json()["detail"] == "File not found"
