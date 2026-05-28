# Convenience commands. Run from the project root.
#
#   make up        — start the whole stack
#   make down      — stop everything
#   make logs      — tail logs from all services
#   make logs-be   — tail just the backend
#   make migrate   — apply DB schema (idempotent)
#   make seed      — load sample content
#   make rebuild   — rebuild images and restart
#   make shell     — open a psql shell into the database
#   make clean     — wipe everything (data too — careful)

.PHONY: up down logs logs-be migrate seed rebuild shell clean

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

logs-be:
	docker compose logs -f --tail=100 backend workers

migrate:
	docker compose exec -T backend node src/db/migrate.js

seed:
	docker compose exec -T backend node src/db/seed.js

rebuild:
	docker compose build
	docker compose up -d

shell:
	docker compose exec postgres psql -U mindful -d mindful

clean:
	docker compose down -v
	rm -f .seeded
