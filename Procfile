web: cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT
worker: cd backend && python main.py ingest
release: python -c "print('release phase complete')"
