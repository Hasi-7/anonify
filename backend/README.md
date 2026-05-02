# anonify Backend

`backend/` is the canonical Flask + SQLite backend for anonify.

## Responsibilities

- Flask HTTP API routes.
- SQLite persistence.
- Event, attendee, consent, photo, detection, and processing-result data.
- Event key generation and validation.
- Event-scoped access rules.
- Mock storage while the demo flow is still evolving.

## Local Development

Use this directory for backend work:

```sh
cd backend
```

Install Python dependencies from the project manifest when working on the backend or helper:

```sh
python -m pip install -r ../requirements.txt
```

Run the Flask app using the app module defined by the backend implementation:

```sh
flask --app app run --debug
```

SQLite uses Python's standard library. Keep database files and generated local state out of git.

## Framework Note

The backend is Flask, not FastAPI. FastAPI or Uvicorn dependencies, if present in the shared Python manifest, are for separate helper/server experiments and should not be treated as the canonical backend framework.
