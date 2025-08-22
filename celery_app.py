from celery import Celery
import os

redis_host = os.environ.get('REDIS_HOST', 'redis')

celery_app = Celery(
    'tasks',
    broker=f'redis://{redis_host}:6379/0',
    backend=f'redis://{redis_host}:6379/1',
    include=['tasks']
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,
    result_backend=f'redis://{redis_host}:6379/1',
    broker_connection_retry_on_startup=True,
)