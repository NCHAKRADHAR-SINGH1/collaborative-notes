# Collaborative Notes System

This repository contains a full-stack Collaborative Notes System.

Sections:
- `backend/` - Spring Boot (Java 21, Spring Boot 3) REST API with JWT auth and JPA entities.
- `frontend/` - React + Tailwind client app.

## Run locally (no Docker)

### Prerequisites
- Java 21
- Maven (or working `mvnw` wrapper)
- Node.js 18+

### 1) Start backend

```bash
cd backend
mvn clean package -DskipTests
java -jar target/collaborative-notes-backend-0.0.1-SNAPSHOT.jar
```

Backend runs on `http://localhost:8080`.

### 2) Start frontend (new terminal)

```bash
cd frontend
npm install
npm start
```

Frontend runs on `http://localhost:3000`.

Notes:
- This scaffold contains core authentication endpoints (`/api/auth/register`, `/api/auth/login`) and basic note CRUD endpoints under `/api/notes`.
- Sharing features are available: share by code, direct user sharing, editable/read-only access.

## Environment variables

Important backend env variables:
- `APP_JWT_SECRET` (required for secure deployment)
- `ALLOWED_ORIGINS` (comma-separated frontend origins)
- Optional DB vars if not using local H2 fallback:
	- `SPRING_DATASOURCE_URL`
	- `SPRING_DATASOURCE_USERNAME`
	- `SPRING_DATASOURCE_PASSWORD`

## Live deployment without Docker

Recommended simple hosting split:
- Backend: Render / Railway (Java service)
- Frontend: Netlify / Vercel (static React build)

Use frontend env var:
- `REACT_APP_API_BASE_URL=https://<your-backend-domain>/api`

Set backend CORS env var:
- `ALLOWED_ORIGINS=https://<your-frontend-domain>`
