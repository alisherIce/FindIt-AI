pipeline {
    agent any

    environment {
        IMAGE_API = "ghcr.io/alisherice/findit-ai-api"
        IMAGE_WEB = "ghcr.io/alisherice/findit-ai-web"
        DATABASE_URL = "postgresql+psycopg://findit:findit_dev_password@localhost:5432/findit"
    }

    stages {
        stage("Checkout") {
            steps {
                checkout scm
            }
        }

        stage("Backend tests") {
            steps {
                sh "docker compose up -d db"
                sh '''
                    python3 -m venv .venv-jenkins
                    . .venv-jenkins/bin/activate
                    python -m pip install --upgrade pip
                    python -m pip install fastapi pillow httpx pytest python-multipart sqlalchemy "psycopg[binary]" pgvector
                    python -m pytest -q tests/
                '''
            }
        }

        stage("Frontend build") {
            steps {
                sh '''
                    docker run --rm                       -v "$WORKSPACE/frontend:/app"                       -w /app                       node:22-alpine                       sh -c "npm install && npm run build"
                '''
            }
        }

        stage("Build container images") {
            steps {
                sh '''
                    docker build -f backend/Dockerfile -t "$IMAGE_API:$BUILD_NUMBER" .
                    docker build -f frontend/Dockerfile -t "$IMAGE_WEB:$BUILD_NUMBER" frontend
                '''
            }
        }

        stage("Push images to GHCR") {
            when {
                branch "main"
            }
            steps {
                withCredentials([usernamePassword(
                    credentialsId: "ghcr-credentials",
                    usernameVariable: "GHCR_USER",
                    passwordVariable: "GHCR_TOKEN"
                )]) {
                    sh '''
                        echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
                        docker push "$IMAGE_API:$BUILD_NUMBER"
                        docker push "$IMAGE_WEB:$BUILD_NUMBER"
                        docker logout ghcr.io
                    '''
                }
            }
        }

        stage("Deploy to Kubernetes") {
            when {
                branch "main"
            }
            steps {
                withCredentials([file(
                    credentialsId: "findit-kubeconfig",
                    variable: "KUBECONFIG"
                )]) {
                    sh '''
                        kubectl apply -k k8s
                        kubectl -n findit set image deployment/findit-api api="$IMAGE_API:$BUILD_NUMBER"
                        kubectl -n findit set image deployment/findit-web web="$IMAGE_WEB:$BUILD_NUMBER"
                        kubectl -n findit rollout status deployment/findit-api --timeout=5m
                        kubectl -n findit rollout status deployment/findit-web --timeout=3m
                    '''
                }
            }
        }
    }

    post {
        always {
            sh "docker compose down || true"
        }
    }
}
