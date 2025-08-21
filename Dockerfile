FROM python:alpine

RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-rus

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000
ENV PYTHONUNBUFFERED=1
CMD ["python3", "main.py"]
