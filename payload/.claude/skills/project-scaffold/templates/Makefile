# The only human interface. Targets delegate to compose — never to the host.
.DEFAULT_GOAL := help
.DELETE_ON_ERROR:
.PHONY: help up down logs sh build test lint format typecheck docs docs-build migrate ci

DC  := docker compose
RUN := $(DC) run --rm dev

help:  ## List targets
	@grep -hE '^[a-z][a-zA-Z0-9_-]*:.*##' $(MAKEFILE_LIST) \
	 | sed -E 's/:.*## /\t/' | expand -t22

up:  ## Start the stack
	$(DC) up -d --wait

down:  ## Stop the stack
	$(DC) down

logs:  ## Follow the stack logs
	$(DC) logs -f

sh:  ## Shell in the dev container
	$(RUN) bash

build:  ## Build the images
	$(DC) build

test:  ## Run the test suite
	$(RUN) <TEST_COMMAND>

lint:  ## Lint and check formatting
	$(RUN) <LINT_COMMAND>

format:  ## Apply formatting
	$(RUN) <FORMAT_COMMAND>

typecheck:  ## Static types
	$(RUN) <TYPECHECK_COMMAND>

docs:  ## Serve the documentation site
	$(DC) up docs

docs-build:  ## Build the docs strictly — what CI runs
	$(RUN) mkdocs build --strict

migrate:  ## Apply database migrations
	$(RUN) <MIGRATE_COMMAND>

ci: lint typecheck test docs-build build  ## Every gate, cheapest first
	@echo "ci: green"
