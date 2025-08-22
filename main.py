from flask import Flask, render_template, request, jsonify
import redis
from celery.result import AsyncResult
from utils import hash_file
from tasks import process_image_task, celery_app
from io import BytesIO

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}
cache = redis.Redis(host="redis", port=6379, db=0, decode_responses=True)
app = Flask(__name__)

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    if file and allowed_file(file.filename):
        try:
            file_content = file.read()
            file_for_hash = BytesIO(file_content)
            sha256 = hash_file(file_for_hash)

            info = cache.get(sha256)

            if info is None:
                task = process_image_task.delay(sha256, file_content)
                return jsonify({
                    "success": True,
                    "filename": file.filename,
                    "task_id": task.id,
                    "status": "processing"
                }), 202

            return jsonify({
                "success": True,
                "filename": file.filename,
                "text": info,
                "status": "completed"
            }), 200

        except Exception as e:
            return jsonify({
                "success": False,
                "filename": file.filename,
                "error": str(e)
            }), 500
    else:
        return jsonify({
            "success": False,
            "filename": file.filename if file else "unknown",
            "error": "File type not allowed"
        }), 400


@app.route("/task-status/<task_id>")
def task_status(task_id):
    task_result = AsyncResult(task_id, app=celery_app)

    response = {
        "task_id": task_id,
        "status": task_result.status,
    }

    if task_result.status == 'SUCCESS':
        response["result"] = task_result.result
    elif task_result.status == 'FAILURE':
        response["error"] = str(task_result.result)

    return jsonify(response)


if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True)