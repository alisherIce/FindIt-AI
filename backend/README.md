# FindIt AI API

The FastAPI service accepts item photos for the local development MVP.

## Run locally

Activate the project virtual environment, then install the project dependencies:

```bash
python -m pip install -r requirements.txt
uvicorn backend.main:app --reload
```

Open the interactive API documentation at <http://127.0.0.1:8000/docs>.

## Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/` | Service welcome message |
| GET | `/api/health` | Health check |
| POST | `/api/upload` | Validate and save an item photo |\n| GET | `/api/matches/{filename}` | Rank other uploaded photos using CLIP (optional `limit` from 1 to 10) |

The upload endpoint accepts JPEG, PNG, and WEBP images up to 5 MB and 20 megapixels. It checks the decoded image format, generates its own filename, and re-encodes the image to remove embedded metadata. Files are stored in the ignored local `uploads/` directory and are not exposed through a public static-file route.

## Run API tests

```bash
python -m pytest -q tests/
```

## Current MVP limitation

Uploads are stored on the local filesystem only. Uploads and match candidates are currently read from the local filesystem; there is no user authentication, database record, or object-storage integration yet. The first matching request loads the pretrained CLIP model and may take longer while model weights are downloaded. Similarity scores rank visual resemblance only; they are not ownership probabilities or proof. Local filesystem storage is not suitable for a multi-instance production deployment.
