from celery_app import celery_app
from utils import preprocess, ocr
import redis
import re
from io import BytesIO
import requests
import json
import os

cache = redis.Redis(host="redis", port=6379, db=0, decode_responses=True)

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

def ai_prompt(text):
    return requests.post(
        url="https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": "Bearer " + os.environ["OPENROUTER_TOKEN"],
            "Content-Type": "application/json"
        },
        data=json.dumps({
            "model": os.environ["OPENROUTER_MODEL"],
            "messages": [
                {
                    "role": "user",
                    "content": PROMPT.replace("%text%", text)
                }
            ]
        })
    )

@celery_app.task(bind=True, name="process_image_task")
def process_image_task(self, sha256, file_content):
    try:
        file = BytesIO(file_content)

        img = preprocess(file)
        text = ocr(img)
        response = ai_prompt(text)

        info = response.json()["choices"][0]["message"]["content"]
        info = re.search(r"{[\s\S]+}", info).group()

        cache.set(sha256, info)

        return info

    except Exception as e:
        raise self.retry(exc=e, countdown=60, max_retries=3)

__all__ = ['celery_app', 'process_image_task']