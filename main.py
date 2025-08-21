from flask import Flask, render_template, request, jsonify
from PIL import Image
import pytesseract
import requests
import time
import json
import os
import re

with open("requirements_for_product.json", "r", encoding="utf-8") as f:
    WHO_REQS = f.read()

PROMPT = f"""
проанализируй продукт согласно требованиям ВОЗ:
{WHO_REQS}

текст на упаковке:
%text%

выведи в формате json типа
{{
    "verdict": true если продукт в целом хороший, иначе false,
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
не забывай в строковых значениях ставить обратный слеш перед кавычками
этот вывод будет парситься через JSON.parse, важно чтобы не получилась ошибка
"""

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}
app = Flask(__name__)


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# there's probably some built-in decorator like this
def exectime(func):
    def wrapper(*args, **kwargs):
        start_time = time.time()
        retval = func(*args, **kwargs)
        print(f"{func.__name__} took {time.time() - start_time}s")
        return retval

    return wrapper


@exectime
def preprocess(file):
    img = Image.open(file)
    img = img.resize((img.size[0] * 2, img.size[1] * 2), Image.LANCZOS)  # somehow this improves the ocr accuracy
    return img


@exectime
def ocr(img):
    # --oem 2 = Tesseract + LSTM.
    # --psm 12 = Sparse text with OSD.
    return pytesseract.image_to_string(img, config="--oem 2 --psm 12", lang="rus")


@exectime
def ai_prompt(text):
    return requests.post(
        url="https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": "Bearer " + os.environ["OPENROUTER_TOKEN"],
            "Content-Type": "application/json"
        },
        data=json.dumps({
            "model": "deepseek/deepseek-r1-distill-llama-70b:free",
            "messages": [
                {
                    "role": "user",
                    "content": PROMPT.replace("%text%", text)
                }
            ]
        })
    )


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
            response = ai_prompt(ocr(preprocess(file)))

            print(response.text)
            info = response.json()["choices"][0]["message"]["content"]
            info = re.search(r"{[\s\S]+}", info).group()  # чудесным образом вычленяем json

            return jsonify({
                "success": True,
                "filename": file.filename,
                "text": info
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
