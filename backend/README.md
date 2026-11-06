# FindIt AI API

FastAPI backend for the Smart Lost and Found platform.

## Local setup

1. Start PostgreSQL with the pgvector extension from the project root:

```bash
docker compose up -d db
```

2. Activate your Python virtual environment and install dependencies:

```bash
python -m pip install -r requirements.txt
```

3. Set the database connection string. The default in `backend/database.py` matches the local Docker Compose database. For a custom database, copy `.env.example` to `.env` and export its value in your shell (the app does not automatically load dotenv files):

```bash
export DATABASE_URL="postgresql+psycopg://findit:findit_dev_password@localhost:5432/findit"
```

4. Run the API:

```bash
uvicorn backend.main:app --reload
```

Open <http://127.0.0.1:8000/docs> for interactive API documentation.

## Authentication

The API supports account registration, OAuth2 password login, and bearer-token authentication. Creating reports requires a valid access token; only the report owner can mark their report as resolved. Access tokens expire after 60 minutes. Set a strong, unique `JWT_SECRET_KEY` in any shared environment.

## Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/` | Service welcome message |
| GET | `/api/health` | Health check (does not require a database query) |
| POST | `/api/auth/register` | Register a user account |\n| POST | `/api/auth/login` | Sign in and receive a bearer token |\n| GET | `/api/auth/me` | Read the authenticated account |\n| POST | `/api/upload` | Validate and save a standalone image |
| POST | `/api/items` | Create an authenticated lost/found report and save its CLIP embedding |
| GET | `/api/items` | List active reports; optional `item_type=lost` or `found` |
| GET | `/api/items/{id}/matches` | Find nearest active reports of the opposite type |
| PATCH | `/api/items/{id}/resolve` | Mark your own report as resolved |

The item creation form requires `item_type` (`lost` or `found`), `title`, `category`, `campus`, `location`, and an image file. Description is optional. The first item submission loads the pretrained CLIP model and may take longer while model weights are downloaded.

## Data model

PostgreSQL stores report metadata and a 512-dimensional CLIP embedding in a pgvector column. The matching endpoint uses cosine distance and only compares lost reports with found reports. Images remain in the local ignored `uploads/` folder for this development milestone.

## Tests

The test workflow starts PostgreSQL with pgvector automatically. To run tests locally, make sure the database is running and `DATABASE_URL` points to it:

```bash
python -m pytest -q tests/
```

## MVP limitations and safety

- This milestone does not yet include accounts, authentication, authorization, private messaging, or staff review. Do not deploy it publicly with real personal information yet.
- Images are stored on the local filesystem; use private object storage for a multi-instance deployment.
- The development database password in Docker Compose is not suitable for production.
- Visual similarity is only a way to rank possible matches. It is not an ownership probability or proof. Verify items privately before handover.
- Public item descriptions should not reveal serial numbers, unique identifying details, or private contact information.
- Database tables are created automatically for this MVP. A migration system should replace this approach before production.
