import os
import io
from flask import Flask, request, send_file, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from shelf_run import run_shelf_calculator

app = Flask(__name__)
CORS(app)

# --- CONFIGURATION ---
# Create a permanent folder for reports
REPORTS_FOLDER = os.path.join(os.getcwd(), 'generated_reports')
os.makedirs(REPORTS_FOLDER, exist_ok=True)

@app.route('/calculate-shelf', methods=['POST'])
def calculate_shelf():
    try:
        # 1. Get Parameters
        target_size = request.form.get('target_size')
        current_size = request.form.get('current_size')
        months = request.form.get('months')

        if 'raw_data' not in request.files or 'holdings' not in request.files or 'labels' not in request.files:
            return jsonify({"error": "Missing files"}), 400

        raw_file = request.files['raw_data']
        holdings_file = request.files['holdings']
        labels_file = request.files['labels']

        # 2. Define Paths (Save inputs temporarily, output permanently)
        # For inputs, we can still use temp to keep things clean, or save them if you want audit trails
        import tempfile
        with tempfile.TemporaryDirectory() as temp_dir:
            raw_path = os.path.join(temp_dir, secure_filename(raw_file.filename))
            holdings_path = os.path.join(temp_dir, secure_filename(holdings_file.filename))
            labels_path = os.path.join(temp_dir, secure_filename(labels_file.filename))
            
            # Generate a unique filename for the output
            from datetime import datetime
            date_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            output_filename = f"Shelf_Run_{date_str}.docx"
            output_path = os.path.join(REPORTS_FOLDER, output_filename)

            raw_file.save(raw_path)
            holdings_file.save(holdings_path)
            labels_file.save(labels_path)

            # 3. Run Logic
            run_shelf_calculator(
                label_path=labels_path,
                dataset_path=raw_path,
                holdings_path=holdings_path,
                output_path=output_path, # Save to permanent folder
                target_size=float(target_size),
                current_size=float(current_size),
                months=int(months)
            )

            # 4. Return the filename so frontend can save it to history
            # We also send the file content for the immediate download
            return send_file(
                output_path, 
                as_attachment=True, 
                download_name=output_filename,
                mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

# --- NEW ROUTE: Re-download History ---
@app.route('/download-report/<filename>', methods=['GET'])
def download_report(filename):
    try:
        # This serves the file from the generated_reports folder
        return send_from_directory(REPORTS_FOLDER, filename, as_attachment=True)
    except Exception as e:
        return jsonify({"error": "File not found"}), 404

if __name__ == '__main__':
    app.run(debug=True, port=5000)