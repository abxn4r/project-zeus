# /data/local/server/apps/

## Purpose
Primary workspace directory for application microservices, Node.js applications, Python projects, web bots, and AI agent frameworks.

## Directory Isolation & Guidelines
- Each project/application should reside in its own subdirectory (e.g. `/data/local/server/apps/my-api/`).
- Python applications should use dedicated virtual environments (`python3 -m venv venv`).
- Background app services can be registered into `/data/local/server/services/*.conf` for automatic boot execution and Watchdog supervisor tracking.
