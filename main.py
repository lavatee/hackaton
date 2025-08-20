from flask import Flask, render_template, request, jsonify
from PIL import Image
import pytesseract
import requests
import time
import json
import os

with open("requirements_for_product.json", "r", encoding="utf-8") as f:
    WHO_REQS = f.read()

PROMPT = f"""
проанализируй продукт согласно требованиям ВОЗ:
{WHO_REQS}

текст на упаковке:
%text%

выведи в формате json типа
{{
    "category": "только код категории",
    "g_per_100g": {{
        "proteins": 12,
        "fats": 45,
        "carbohydrates": 78
    }},
    "percent_of_daily_norm": {{
        "proteins": 12,
        "fats": 34,
        "carbohydrates": 56
    }},
    "requirements": [
        {{
            "criterion": "...",
            "verdict": true если всё хорошо, иначе false
        }},
        ...
    ]
}}

только json, без комментариев, без markdown, без "```"
категорию в виде строки (в кавычках)
g_per_100g это граммы белков/жиров/углеводов на 100г продукта
percent_of_daily_norm это процент белков/жиров/углеводов от суточной нормы
в requirements укажи как выполненые так и невыполненые требования
критерии пиши на русском
"""

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
        img = Image.open(file)

        # somehow this improves the ocr accuracy
        img = img.resize((img.size[0] * 2, img.size[1] * 2), Image.LANCZOS)

        # --oem 2 = 2 = Tesseract + LSTM.
        # --psm 12 = Sparse text with OSD.
        text = pytesseract.image_to_string(img, config="--oem 2 --psm 12", lang="rus")

        start_time = time.time()
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": "Bearer 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",
                "Content-Type": "application/json"
            },
            data=json.dumps({
                "model": "deepseek/deepseek-r1-0528-qwen3-8b:free",
                "messages": [
                    {
                        "role": "user",
                        "content": PROMPT.replace("%text%", text)
                    }
                ]
            })
        )

        print(f"deepseek took {time.time() - start_time}s")
        return jsonify({"info": response.json()["choices"][0]["message"]["content"]}), 200
    else:
        return jsonify({"error": "File type not allowed"}), 400


if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True)
