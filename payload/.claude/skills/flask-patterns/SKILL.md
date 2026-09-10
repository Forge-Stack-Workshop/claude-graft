---
name: flask-patterns
description: Flask routing, blueprints, Jinja templating, extensions (SQLAlchemy, Login, Admin), forms, authentication, error handling, testing, and production deployment patterns.
origin: biblio (Flask Framework Cookbook)
---

# Flask Patterns

Practical, production-oriented patterns for structuring, extending, testing, and
deploying a Flask application. Covers the application factory, blueprints,
templating, ORM integration, auth, REST APIs, error handling, testing, and
deployment. Framework-agnostic to any specific project — apply directly.

## Prerequisites (preflight)

Check that `flask` is installed:
```bash
python -c "import flask" || echo "WARN: pip install flask"
```

If missing, install via `pip install flask`.

## Application factory

Never create the `Flask` app at module import time. Use a factory function so
the app can be instantiated multiple times with different configs (tests,
dev, prod) without import-order side effects or circular imports.

```python
# my_app/__init__.py
from flask import Flask
from my_app.extensions import db, login_manager

def create_app(config_object="my_app.config.ProductionConfig"):
    app = Flask(__name__)
    app.config.from_object(config_object)

    db.init_app(app)
    login_manager.init_app(app)

    from my_app.catalog.views import catalog_bp
    from my_app.auth.views import auth_bp
    app.register_blueprint(catalog_bp, url_prefix="/catalog")
    app.register_blueprint(auth_bp, url_prefix="/auth")

    register_error_handlers(app)
    return app
```

- Extension instances (`db = SQLAlchemy()`, `login_manager = LoginManager()`)
  live in a separate `extensions.py`, created unbound, and are bound via
  `.init_app(app)` inside the factory — this is what makes multiple app
  instances and clean test isolation possible.
- Config as a class hierarchy (`Config` → `DevelopmentConfig` /
  `TestingConfig` / `ProductionConfig`), selected by env var
  (`FLASK_CONFIG` or `FLASK_ENV`) or an explicit factory argument — never
  hardcode secrets or DB URLs in the class body; read them from environment
  variables with `os.environ["..."]` (fail loud if missing in prod).
- WSGI entry point (`wsgi.py`) calls `create_app()` once, exposing `app` for
  Gunicorn/uWSGI — keep it a thin one-liner.

## Routing

- Prefer `@app.route` / `@bp.route` decorators over `add_url_rule` unless
  building routes dynamically or from a table.
- Type-convert path segments with converters: `<int:product_id>`,
  `<float:price>`, `<uuid:token>`, custom converters registered via
  `app.url_map.converters["...] = ...` for domain types (e.g. slugs with a
  regex constraint).
- Restrict `methods=[...]` explicitly; do not rely on the GET-only default
  when a view also handles POST — Flask returns 405 automatically for
  unlisted methods, don't reimplement that check.
- `url_for(endpoint, **values)` for every internal link/redirect — never
  hardcode a path string. With blueprints, the endpoint is
  `blueprint_name.view_function_name`.
- One view = one responsibility. Split "read form + validate + persist +
  redirect" into a form-handling helper and a thin view function once the
  view exceeds ~20 lines.

```python
@catalog_bp.route("/products/<int:product_id>", methods=["GET", "POST"])
def product_detail(product_id):
    product = Product.query.get_or_404(product_id)
    if request.method == "POST":
        return _update_product(product)
    return render_template("catalog/product.html", product=product)
```

## Blueprints

Blueprints are the unit of modularity — one blueprint per feature/domain,
not per HTTP verb.

```
my_app/
├── __init__.py            # create_app()
├── extensions.py          # db, login_manager, migrate, ...
├── config.py
├── catalog/
│   ├── __init__.py
│   ├── models.py
│   ├── views.py           # catalog_bp = Blueprint("catalog", __name__)
│   ├── forms.py
│   └── templates/catalog/
├── auth/
│   ├── views.py           # auth_bp = Blueprint("auth", __name__)
│   └── models.py
└── templates/
    └── base.html
```

- Each blueprint owns its own `templates/<blueprint_name>/` folder — Flask
  merges template search paths, so namespacing by folder avoids collisions
  between blueprints that both ship a `list.html`.
- Blueprint-local `static_folder` when a feature ships its own JS/CSS bundle;
  otherwise share the app-level `static/`.
- Register blueprint-specific error handlers with
  `@bp.app_errorhandler(code)` when the handling differs by area (e.g. JSON
  errors for an API blueprint, HTML errors for the web blueprint) — don't
  put IF/ELSE branching by request path in one global handler.
- Package as an installable distribution (`setup.py` / `pyproject.toml`
  with `packages=find_packages()`) once the app is deployed anywhere beyond
  a single dev machine — this is what makes `pip install -e .` and
  reproducible deploys possible instead of `sys.path` hacks.

## Jinja templating

- One `base.html` with `{% block %}` regions (`title`, `content`, `scripts`);
  every page template `{% extends "base.html" %}` and overrides only the
  blocks it needs.
- `{% include %}` for repeated fragments (nav, flash messages), `{% macro %}`
  for parameterized reusable snippets (e.g. a form-field renderer used across
  every form template).
- Autoescaping is on by default for `.html`/`.xml` — never disable it
  globally; use `Markup(...)` or `|safe` only on content you fully control
  and have already sanitized (this is the primary XSS control in Flask apps).
- Flash messages: set with `flash(message, category)` in the view, render
  once in `base.html`:

```jinja
{% with messages = get_flashed_messages(with_categories=true) %}
  {% for category, message in messages %}
    <div class="alert alert-{{ category }}">{{ message }}</div>
  {% endfor %}
{% endwith %}
```

- Custom filters/globals registered via `app.template_filter()` /
  `app.template_global()` in the factory — keep template logic to
  formatting only; business logic belongs in the view or service layer, not
  in a Jinja expression.
- Context processors (`@app.context_processor`) inject variables available
  to every template (e.g. `current_year`, `nav_items`) — use sparingly,
  each one runs on every render.

## Forms (WTForms / Flask-WTF)

```python
from flask_wtf import FlaskForm
from wtforms import StringField, DecimalField, FileField
from wtforms.validators import DataRequired, NumberRange

class ProductForm(FlaskForm):
    name = StringField("Name", validators=[DataRequired()])
    price = DecimalField("Price", validators=[NumberRange(min=0)])
    image = FileField("Image")
```

```python
@catalog_bp.route("/products/new", methods=["GET", "POST"])
def new_product():
    form = ProductForm()
    if form.validate_on_submit():
        product = Product(name=form.name.data, price=form.price.data)
        db.session.add(product)
        db.session.commit()
        flash("Product created", "success")
        return redirect(url_for("catalog.product_detail", product_id=product.id))
    return render_template("catalog/new_product.html", form=form)
```

- `Flask-WTF` adds CSRF protection automatically to every `FlaskForm` — do
  not disable `WTF_CSRF_ENABLED` outside tests.
- Re-render the same template with the bound `form` object on validation
  failure so field-level errors (`form.field.errors`) are shown inline —
  never redirect-then-re-render with a blank form.
- Validate server-side always, even when client-side JS validation exists —
  the server is the trust boundary.

## SQLAlchemy

```python
# extensions.py
from flask_sqlalchemy import SQLAlchemy
db = SQLAlchemy()
```

```python
# catalog/models.py
from my_app.extensions import db

class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey("category.id"))
    category = db.relationship("Category", backref=db.backref("products", lazy="dynamic"))
```

- One model per logical entity; group related models in the owning
  blueprint's `models.py`, imported into a shared `db.Model` metadata via the
  single `db` instance in `extensions.py` — never create more than one
  `SQLAlchemy()` instance per app.
- Use `db.Model.query.get_or_404(id)` in views instead of manual
  `get()` + `abort(404)` boilerplate.
- Use `lazy="dynamic"` on a `relationship`/`backref` when the collection is
  large and needs further filtering (`product.category.products.filter_by(...)`)
  rather than loading the full collection into memory.
- Migrations via `Flask-Migrate` (Alembic wrapper): `flask db init`,
  `flask db migrate -m "message"`, `flask db upgrade` — never hand-edit the
  schema in production; every schema change is a migration file, reviewed
  and reversible.
- Wrap multi-step writes in `db.session.begin_nested()` / a single
  `db.session.commit()` at the end of the request, not one commit per write
  — partial commits leave the DB in an inconsistent state on error.
- Close/remove the session on app/request teardown
  (`@app.teardown_appcontext`) — Flask-SQLAlchemy does this automatically
  when `db.init_app(app)` is used; don't add a second manual teardown that
  double-closes the session.

## Authentication (Flask-Login)

```python
# extensions.py
from flask_login import LoginManager
login_manager = LoginManager()
login_manager.login_view = "auth.login"
```

```python
# auth/models.py
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from my_app.extensions import db, login_manager

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))
```

```python
@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user and user.check_password(form.password.data):
            login_user(user, remember=form.remember.data)
            next_page = request.args.get("next")
            return redirect(next_page or url_for("catalog.index"))
        flash("Invalid credentials", "danger")
    return render_template("auth/login.html", form=form)
```

- Never store plaintext or reversibly-encrypted passwords — always
  `generate_password_hash` (PBKDF2/scrypt via Werkzeug) or a dedicated
  library (`argon2-cffi`, `bcrypt`).
- Protect views with `@login_required`; check `next` redirect targets are
  local (`werkzeug.urls.url_has_allowed_host_and_scheme` or equivalent)
  before redirecting — an unchecked `next` param is an open-redirect
  vector.
- Role/permission checks as a decorator (`@roles_required("admin")`) or a
  small authorization service, not scattered `if current_user.role == ...`
  checks across views.
- For pure API auth (no session/cookies), prefer token-based auth
  (JWT via `Flask-JWT-Extended`, or API keys validated in a
  `before_request` hook on the API blueprint) instead of Flask-Login's
  session cookies.

## REST APIs

```python
from flask import Blueprint, request, jsonify
from my_app.extensions import db
from my_app.catalog.models import Product

api_bp = Blueprint("api", __name__)

@api_bp.route("/products", methods=["GET"])
def list_products():
    products = Product.query.all()
    return jsonify([p.to_dict() for p in products])

@api_bp.route("/products", methods=["POST"])
def create_product():
    payload = request.get_json(silent=True)
    if not payload or "name" not in payload:
        return jsonify(error="name is required"), 400
    product = Product(name=payload["name"], price=payload["price"])
    db.session.add(product)
    db.session.commit()
    return jsonify(product.to_dict()), 201

@api_bp.route("/products/<int:product_id>", methods=["GET"])
def get_product(product_id):
    product = Product.query.get(product_id)
    if product is None:
        return jsonify(error="not found"), 404
    return jsonify(product.to_dict())
```

- Always call `request.get_json(silent=True)` (never bare `request.json`)
  and check for `None` before use — a malformed/missing body must produce a
  clean 400, not an unhandled exception.
- Return the correct status code per verb: 200 (GET/PUT success), 201
  (POST create), 204 (DELETE success, empty body), 400 (bad input), 401/403
  (auth), 404 (missing resource), 409 (conflict).
- Give every model a `to_dict()`/serialization method (or use a schema
  library — Marshmallow, Pydantic) instead of hand-building dicts inline in
  every view — keeps the wire format consistent and testable in isolation.
- Class-based views (`flask.views.MethodView`) reduce boilerplate when a
  resource needs the full CRUD verb set:

```python
from flask.views import MethodView

class ProductAPI(MethodView):
    def get(self, product_id):
        ...
    def post(self):
        ...
    def delete(self, product_id):
        ...

api_bp.add_url_rule(
    "/products", view_func=ProductAPI.as_view("product_api"),
    methods=["GET", "POST"],
)
```

- For anything beyond a handful of endpoints, prefer a REST extension
  (Flask-RESTful, Flask-Smorest) over hand-rolled `MethodView` — they add
  request parsing, OpenAPI generation, and consistent error formatting.
- Rate-limit and version (`/api/v1/...`) public APIs from day one — retrofitting
  versioning after clients exist is expensive.

## Error handling & logging

```python
@app.errorhandler(404)
def not_found(error):
    if request.path.startswith("/api/"):
        return jsonify(error="not found"), 404
    return render_template("errors/404.html"), 404

@app.errorhandler(500)
def server_error(error):
    app.logger.exception("Unhandled error")
    return render_template("errors/500.html"), 500
```

- Register handlers per status code (`@app.errorhandler(404)`) and per
  exception class (`@app.errorhandler(MyDomainError)`) — exception-class
  handlers let a service layer raise typed domain errors instead of
  returning ad-hoc tuples.
- Branch the response format on `request.path` or `request.accept_mimetypes`
  when the same app serves both HTML and JSON — an API blueprint should
  never render an HTML error page.
- Configure logging handlers (file, syslog, or an external service such as
  Sentry) in the factory, not via `print()` — attach a `RotatingFileHandler`
  or the Sentry SDK's Flask integration during `create_app()`, gated by
  config so dev doesn't spam production sinks.
- Log the full exception (`app.logger.exception(...)` or
  `logger.error(..., exc_info=True)`) plus request context (path, method,
  user id) on every 500 — silent failures are the most expensive class of
  production bug to diagnose after the fact.
- Never leave `app.config["DEBUG"] = True` or the Werkzeug debugger enabled
  in production — the interactive debugger allows arbitrary code execution
  if reachable.

## Testing

```python
# conftest.py
import pytest
from my_app import create_app
from my_app.extensions import db as _db

@pytest.fixture
def app():
    app = create_app("my_app.config.TestingConfig")
    with app.app_context():
        _db.create_all()
        yield app
        _db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()
```

```python
def test_create_product(client):
    response = client.post("/api/products", json={"name": "Widget", "price": "9.99"})
    assert response.status_code == 201
    assert response.get_json()["name"] == "Widget"

def test_missing_name_returns_400(client):
    response = client.post("/api/products", json={"price": "9.99"})
    assert response.status_code == 400
```

- `TestingConfig` sets `TESTING = True` (propagates exceptions instead of
  rendering the 500 page, easing assertions) and points at an isolated
  test database (in-memory SQLite for pure unit tests, a disposable
  Postgres schema when the app relies on Postgres-only features).
- Use `app.test_client()` for request/response-level tests and
  `app.test_request_context()` when a unit test needs `request`/`g`/`session`
  without an actual HTTP call.
- Assert on status code, JSON/HTML body, and resulting DB state — a test
  that only checks `status_code == 200` misses regressions in payload shape.
- Cover both success and failure paths per endpoint (missing fields, wrong
  type, not-found, unauthorized) — a single happy-path test per endpoint is
  not sufficient coverage.
- Isolate test data per test (fresh `create_all()`/`drop_all()` per test, or
  a transaction rolled back after each test) — shared mutable fixtures
  across tests cause order-dependent flakiness.

## Deployment

- Never serve with the Werkzeug dev server (`app.run()`) in production —
  it is single-threaded by default and not hardened against malformed
  input. Use Gunicorn or uWSGI behind Nginx (or an equivalent reverse
  proxy) as the production stack.
- WSGI entry point: `wsgi.py` exposing `app = create_app()`; run via
  `gunicorn -w 4 -b 0.0.0.0:8000 wsgi:app`. Tune worker count from CPU
  count and workload (CPU-bound vs I/O-bound) rather than guessing.
- Externalize all configuration via environment variables (`DATABASE_URL`,
  `SECRET_KEY`, `SENTRY_DSN`, …) — never bake secrets into the config
  module or the Docker image.
- Health-check endpoint (`GET /healthz` returning 200 + minimal DB
  connectivity check) so an orchestrator can detect and restart unhealthy
  instances automatically.
- Run `flask db upgrade` as a release-phase step (before new instances
  receive traffic), not inside the application's request path.
- Put static assets behind a CDN or the reverse proxy's static handler —
  don't serve them through the WSGI app in production.
- Log to stdout/stderr in containerized deployments and let the platform's
  log collector aggregate — avoid writing to a local file that disappears
  with the container.

## Common pitfalls (reject in review)

- Creating the `Flask()` app or extension instances at module import time
  instead of inside an application factory — breaks test isolation and
  causes circular imports as the app grows.
- Multiple `SQLAlchemy()` instances instead of one shared `db` bound via
  `init_app()`.
- Business logic embedded in Jinja templates instead of the view/service
  layer.
- Trusting `request.get_json()` without checking for `None`/missing keys
  before use.
- Disabling CSRF protection or template autoescaping outside a narrowly
  scoped, justified exception.
- An unchecked `next=` redirect parameter after login (open redirect).
- Serving with `app.run()` or `debug=True` in production.
- One commit per DB write inside a loop instead of a single commit per
  logical operation, or (for genuine bulk writes) `bulk_save_objects`.
- Silent `except Exception: pass` around request handling instead of
  logging and returning a proper error response.
- Skipping negative-path tests (bad input, auth failure, not-found) for an
  endpoint.
