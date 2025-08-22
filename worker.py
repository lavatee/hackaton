from celery_app import celery_app
from main import process_image_task

if __name__ == "__main__":
    celery_app.worker_main()