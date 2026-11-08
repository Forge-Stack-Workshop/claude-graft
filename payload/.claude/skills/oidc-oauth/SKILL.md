---
name: oidc-oauth
description: OAuth2 grant types (authorization_code + PKCE, client_credentials, refresh_token), OpenID Connect (id_token, scopes, claims, discovery, JWKS), token validation, provider vs client roles, session vs JWT tradeoffs, rotation/revocation, and redirect/state/nonce security for any stack.
origin: authored
---

# OIDC & OAuth2

Protocol-level guidance for implementing or integrating OAuth2 authorization and
OpenID Connect authentication, on either the provider (authorization server) side
or the client (relying party) side.

## When to Activate

- Implementing or reviewing an OAuth2 authorization server or OIDC provider.
- Integrating a client/app against an external IdP (Google, Okta, Auth0, Keycloak,
  a partner's own OIDC provider).
- Choosing or reviewing a grant type for a new integration (web app, SPA, mobile,
  machine-to-machine, CLI).
- Validating tokens (JWT signature, claims) on a resource server.
- Designing token/session storage, refresh, rotation, or revocation.
- Debugging `invalid_grant`, `redirect_uri_mismatch`, expired-token, or
  signature-validation failures.

## Core Concepts

**OAuth2** is an *authorization* framework: it grants a client delegated access to
a resource (an API) on behalf of a resource owner, via an access token. It says
nothing about who the user is.

**OpenID Connect (OIDC)** is an *authentication* layer on top of OAuth2. It adds
the `id_token` (a signed JWT describing who authenticated), standardized scopes
(`openid`, `profile`, `email`), and discovery metadata. If you need to know "who
is this user," you need OIDC, not bare OAuth2.

| Token | Purpose | Consumer | Format |
| --- | --- | --- | --- |
| Access token | Authorize an API call | Resource server | Opaque or JWT |
| ID token | Assert user identity | Client (RP) only — never send to an API | Always JWT |
| Refresh token | Obtain new access/ID tokens without re-auth | Authorization server only | Opaque, long-lived |

## Roles

| Role | Responsibility |
| --- | --- |
| Authorization Server / Provider (OP) | Authenticates the user, issues tokens, exposes `.well-known` + JWKS, enforces consent |
| Resource Server | Hosts the protected API, validates access tokens on every request |
| Client / Relying Party (RP) | Initiates the flow, exchanges codes for tokens, never sees the user's credentials |
| Resource Owner | The end user (or, for `client_credentials`, the system itself) |

A single service can be both provider and resource server (common in a first-party
API + login stack); keep the code paths conceptually separate anyway — token
issuance and token validation are different trust boundaries.

## Grant Types

### Authorization Code + PKCE (default for anything with a redirect)

Use for web apps, SPAs, and mobile apps. PKCE (`code_verifier` / `code_challenge`,
S256) is mandatory for public clients (SPA, mobile — no client secret) and strongly
recommended even for confidential clients, per current OAuth2 Security BCP.

```text
1. Client generates code_verifier (random, 43-128 chars) and
   code_challenge = BASE64URL(SHA256(code_verifier))
2. Client redirects user to /authorize with:
   response_type=code, client_id, redirect_uri, scope, state, nonce,
   code_challenge, code_challenge_method=S256
3. User authenticates + consents at the provider
4. Provider redirects back to redirect_uri with ?code=...&state=...
5. Client verifies state, then POSTs to /token:
   grant_type=authorization_code, code, redirect_uri, client_id, code_verifier
6. Provider verifies code_verifier against stored code_challenge, returns
   access_token (+ id_token if openid scope, + refresh_token if offline_access)
```

### Client Credentials

Machine-to-machine, no user involved. The client authenticates with its own
`client_id` + `client_secret` (or a private-key JWT / mTLS for higher assurance)
and gets an access token scoped to itself.

```text
POST /token
grant_type=client_credentials&client_id=...&client_secret=...&scope=orders:read
```

No refresh token — the client just requests a new access token when it needs one.
Never use this grant to impersonate a user.

### Refresh Token

Exchanges a refresh token for a new access token (and, for OIDC, a new id_token)
without re-prompting the user.

```text
POST /token
grant_type=refresh_token&refresh_token=...&client_id=...&scope=...
```

Only issue refresh tokens to clients that can store them securely (confidential
clients, or public clients with rotation — see below). Requesting a narrower
`scope` on refresh is allowed; requesting a broader one is not.

### Deprecated / avoid

- **Implicit** (`response_type=token`/`id_token` returned directly in the
  fragment) — tokens leak via browser history/referrer; superseded by
  authorization_code + PKCE.
- **Resource Owner Password Credentials** — the client handles the user's raw
  password; only acceptable for legacy first-party migration paths, never for
  third parties.

## OpenID Connect Specifics

- **Discovery**: `GET /.well-known/openid-configuration` returns the provider's
  endpoints (`authorization_endpoint`, `token_endpoint`, `jwks_uri`,
  `userinfo_endpoint`), supported scopes, response types, and signing algorithms.
  Clients should consume this instead of hardcoding endpoint URLs.
- **JWKS**: `jwks_uri` exposes the provider's public signing keys (`kid`-indexed).
  Clients cache the key set and refresh it on a `kid` cache miss (never on every
  request — that's a DoS vector against the provider).
- **Scopes → claims**: `openid` (mandatory, triggers id_token issuance),
  `profile` (name, picture, etc.), `email` (email + email_verified),
  `offline_access` (refresh token). Custom scopes map to custom claims — document
  the mapping explicitly.
- **id_token claims**: `iss`, `sub`, `aud`, `exp`, `iat`, `nonce` (must echo the
  request nonce), `auth_time` (if `max_age` requested). `sub` is the stable,
  opaque user identifier — never the email, which can change.

## Token Validation (Resource Server Side)

Validate every token on every request; never trust a token just because it
parses as a JWT.

1. **Signature**: verify against the provider's current JWKS, matched by `kid`.
   Reject `alg: none`. Pin the expected algorithm (RS256/ES256) — never accept
   whatever `alg` the token itself claims (algorithm-confusion attack).
2. **`iss`**: matches the expected authorization server exactly.
3. **`aud`**: contains this resource server's identifier — a token issued for a
   different API must be rejected even if the signature is valid.
4. **`exp`** / **`nbf`**: token is not expired and not used before its validity
   window; allow a small clock-skew tolerance (30-60s), not more.
5. **`iat`**: sanity-check against an expected max token age if the provider
   allows very long-lived tokens.
6. For id_tokens specifically: verify `nonce` matches the one sent at
   authorization time (replay protection).

```python
# Pattern: reject before decoding claims
decoded = jwt.decode(
    token,
    key=jwks_client.get_signing_key_from_jwt(token).key,
    algorithms=["RS256"],       # pinned, not read from the token header
    audience=EXPECTED_AUDIENCE,
    issuer=EXPECTED_ISSUER,
)
```

## Sessions vs JWT Access Tokens

| | Server-side session | JWT access token |
| --- | --- | --- |
| Revocation | Immediate (delete session record) | Only at expiry, unless a blacklist/introspection call is added |
| Scaling | Needs shared session store (Redis) across instances | Stateless, no shared store needed |
| Payload | Opaque ID only | Self-contained claims, larger, cacheable by resource servers |
| Best for | First-party web app with its own login | Cross-service APIs, multiple resource servers, mobile/SPA |

A common hybrid: session cookie between browser and first-party BFF, JWT access
token between BFF and backend APIs. Don't put a long-lived JWT directly in a
browser-accessible cookie or `localStorage` if it holds sensitive claims — see
storage pitfalls below.

## Rotation, Refresh, Revocation

- **Refresh token rotation**: issue a new refresh token on every use, invalidate
  the previous one. If a rotated-out refresh token is presented again, treat it
  as a stolen-token signal and revoke the entire token family for that session.
- **Revocation endpoint** (`RFC 7009`): support `POST /revoke` for both access
  and refresh tokens — required for logout, password change, and admin-forced
  session termination.
- **Blacklist for JWTs**: if using opaque revocation for otherwise stateless
  JWTs, keep the blacklist keyed by `jti` with a TTL equal to the token's
  remaining lifetime — don't grow it unbounded.
- **Key rotation**: rotate signing keys periodically; publish the new key in
  JWKS *before* switching, keep the old key available until all outstanding
  tokens signed with it have expired.

## Security Checklist

- [ ] PKCE (S256) enforced on every authorization_code flow, public and confidential clients alike.
- [ ] `state` generated per-request, cryptographically random, verified on callback — CSRF protection.
- [ ] `nonce` generated per-request, verified inside the id_token — replay protection.
- [ ] `redirect_uri` validated by **exact string match** against a pre-registered allow-list — no wildcard subdomains, no partial matches.
- [ ] Access token `aud`/`iss`/`exp`/signature validated on every resource-server request, not cached past token expiry.
- [ ] Signing algorithm pinned server-side; `alg: none` and unexpected algorithms rejected.
- [ ] Refresh tokens rotated on use; reuse of a retired refresh token revokes the whole family.
- [ ] Tokens never logged, never placed in URL query strings past the initial redirect.
- [ ] id_token never sent to a resource server or used as an API access token.
- [ ] Client secrets stored server-side only; public clients (SPA/mobile) never hold a secret.
- [ ] Short access-token lifetime (minutes), longer refresh-token lifetime, both explicitly configured — not framework defaults left unexamined.
- [ ] Revocation endpoint wired into logout and admin session-termination flows.

## Common Pitfalls

- **Storing tokens in `localStorage`** — accessible to any injected script (XSS);
  prefer an `HttpOnly`, `Secure`, `SameSite=Strict/Lax` cookie for browser
  contexts, or in-memory storage for SPAs with short-lived tokens.
- **Confusing access token and id_token** — sending the id_token to an API as a
  bearer token, or validating an access token's claims as if it had OIDC
  semantics (`aud` means different things for each).
- **Skipping `aud` validation** — a token stolen from one API works against
  another API trusting the same issuer.
- **Loose `redirect_uri` matching** (prefix match, missing path, allowing any
  subdomain) — open redirect and authorization-code interception.
- **Refetching JWKS on every request** — turns key rotation into a DoS surface
  against the provider; cache with `kid`-miss-triggered refresh only.
- **Long-lived access tokens "for convenience"** — removes the main benefit of
  short-lived tokens (bounded blast radius on leak); use refresh tokens instead.
- **Treating `client_credentials` as a user-impersonation shortcut** — it has no
  `sub` for a real user; don't use it where you need per-user authorization.
- **Not rotating refresh tokens** — a single leaked refresh token then has
  unlimited lifetime.
