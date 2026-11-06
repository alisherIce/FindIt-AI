# FindIt AI — Smart Campus Lost & Found

FindIt AI is a campus lost-and-found application. Students can report lost or found items with a photo, and a pretrained CLIP model ranks visually similar reports to help people find possible matches.

## Current features

- React + TypeScript campus dashboard and report form
- FastAPI backend for lost/found reports
- PostgreSQL with pgvector for report metadata and 512-dimensional image embeddings
- CLIP-based visual similarity search between opposite report types
- Image validation, server-generated filenames, and metadata-stripping re-encoding
- Docker Compose stack for PostgreSQL, API, and frontend
- GitHub Actions workflows for backend tests and frontend builds

## Run the full application with Docker

Requirements: Docker Desktop with Docker Compose.

From the repository root:

```bash
docker compose up --build
```

Then open:

- Frontend: <http://localhost:8080>
- Backend API docs: <http://localhost:8000/docs>
- Backend health: <http://localhost:8000/api/health>

The first AI matching request downloads the pretrained CLIP weights into a persistent Docker volume and may take longer. Image inference runs on CPU inside this initial Docker setup.

To stop the services:

```bash
docker compose down
```

To stop and delete the local database, uploaded images, and cached model weights as well:

```bash
docker compose down -v
```

The second command permanently deletes the local Docker volumes.

## Run the backend without Docker

Start PostgreSQL with pgvector:

```bash
docker compose up -d db
```

Activate your Python virtual environment, install dependencies, and start FastAPI:

```bash
python -m pip install -r requirements.txt
export DATABASE_URL="postgresql+psycopg://findit:findit_dev_password@localhost:5432/findit"
uvicorn backend.main:app --reload
```

## Run the frontend without Docker

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies API requests to the local FastAPI server on port 8000.

## Main API routes

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Backend health check |
| POST | `/api/upload` | Validate and save a standalone image |
| POST | `/api/items` | Create a lost/found report and generate its embedding |
| GET | `/api/items` | List active reports |
| GET | `/api/items/{id}/matches` | Rank possible opposite-type matches |
| PATCH | `/api/items/{id}/resolve` | Mark a report as resolved |

## Project structure

```text
FindIt-AI/
├── backend/              # FastAPI, database and SQLAlchemy models
├── frontend/             # React + TypeScript + Vite
├── ml/                   # CLIP image embedding and matching
├── tests/                # Backend API tests
├── .github/workflows/    # Backend and frontend CI
├── docker-compose.yml    # Local multi-service stack
├── requirements.txt
└── README.md
```

## Kubernetes deployment

Kubernetes manifests and the Jenkins pipeline are provided in `k8s/` and `Jenkinsfile`. See [k8s/README.md](k8s/README.md) for cluster setup, secret creation, image publishing, and Jenkins credentials. The Kubernetes Services are internal-only; use port-forwarding for a local demo.

## Important MVP limitations

This is a course-project MVP, not yet a production-ready public service. Authentication, per-user authorization, private messaging, moderation, rate limiting, database migrations, and durable cloud object storage still need to be implemented. The current local development endpoints allow reports to be created and marked resolved without accounts, so do not expose this stack publicly or enter sensitive personal information.

CLIP similarity is a visual ranking signal, not a probability of ownership or proof. Users should verify an item privately before arranging a handover. Public descriptions should not contain serial numbers, secret identifying details, or personal contact information.
