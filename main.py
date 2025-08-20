from flask import Flask, render_template, request, jsonify
from PIL import Image
import pytesseract
import time

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}
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
            img = Image.open(file)

            # somehow this improves the ocr accuracy
            img = img.resize((img.size[0] * 2, img.size[1] * 2), Image.LANCZOS)

            # --oem 2 = 2 = Tesseract + LSTM.
            # --psm 12 = Sparse text with OSD.
            text = pytesseract.image_to_string(img, config="--oem 2 --psm 12", lang="rus")

            # Имитация обработки для демонстрации
            time.sleep(1)

            # Тут нужно сделать проверку соответствия ВОЗ
            matches_rules = False

            return jsonify({
                "success": True,
                "filename": file.filename,
                "text": text,
                "matches_rules": matches_rules
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

if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True)