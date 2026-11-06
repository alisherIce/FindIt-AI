# Kubernetes and Jenkins deployment

The manifests deploy the API, frontend, and pgvector PostgreSQL database into the `findit` namespace. Services are ClusterIP-only; this setup does not expose the application publicly.

## Prerequisites

- A working Kubernetes cluster and `kubectl` context
- A default StorageClass that can provision ReadWriteOnce PVCs
- Container images pushed to GHCR:
  - `ghcr.io/alisherice/findit-ai-api`
  - `ghcr.io/alisherice/findit-ai-web`

The GHCR packages must be public for the manifests to pull them without extra configuration. If you keep them private, create a Kubernetes `docker-registry` pull secret and add it as `imagePullSecrets` to both application pod specs.

## Create the database secret

Create the namespace first, then create a strong password and the Kubernetes Secret. This example uses OpenSSL to generate a URL-safe hexadecimal password:

```bash
kubectl apply -f k8s/namespace.yaml

DB_PASSWORD="$(openssl rand -hex 24)"
kubectl create secret generic findit-secrets \
  --namespace findit \
  --from-literal=postgres-user=findit \
  --from-literal=postgres-password="$DB_PASSWORD" \
  --from-literal=database-url="postgresql+psycopg://findit:${DB_PASSWORD}@findit-db:5432/findit" \
  --dry-run=client -o yaml | kubectl apply -f -
```

Keep the generated password in a secure password manager. Do not commit a Kubernetes Secret manifest or put production credentials in Git.

## Apply the application

After publishing both images to GHCR:

```bash
kubectl apply -k k8s
kubectl -n findit get pods
kubectl -n findit get services
```

Wait for the database and API readiness probes to pass. The first CLIP inference may download model weights into the persistent model-cache volume.

For a local browser demo:

```bash
kubectl -n findit port-forward service/findit-web 8080:80
```

Open <http://localhost:8080>. To inspect the API directly:

```bash
kubectl -n findit port-forward service/api 8000:8000
```

Then open <http://localhost:8000/docs>.

## Jenkins setup

Create these Jenkins credentials:

1. `ghcr-credentials`: Username with a GitHub Personal Access Token that can publish packages (`write:packages`; include `read:packages` if needed).
2. `findit-kubeconfig`: Secret file containing a kubeconfig for the target cluster, scoped to the deployment namespace where possible.

The Jenkins agent needs Python 3.11, Docker with Compose, `kubectl`, and permission to build/push images and deploy to the cluster. Create a Multibranch Pipeline job pointing to this repository so the `main` branch deploy stage is recognized.

Before the first Jenkins deployment:
- Create the `findit-secrets` Secret in the cluster using the command above.
- Ensure the GHCR image packages are public or configure a registry pull secret.
- Ensure the cluster has a default StorageClass.
- Configure Jenkins credentials exactly as named above.

The pipeline runs backend tests against a temporary local Compose database, builds the frontend, builds and pushes versioned API/web images, then updates the Kubernetes Deployments on `main`.

## Important limitations

This is a course-project deployment baseline. It uses one API replica because local uploaded-image storage is a ReadWriteOnce volume. Production should use managed PostgreSQL, private object storage, a secrets manager, authentication/authorization, TLS ingress, resource tuning, backups, database migrations, and observability. Do not expose the current unauthenticated MVP to the public internet.
