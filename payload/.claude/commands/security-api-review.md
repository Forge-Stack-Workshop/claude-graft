---
description: Audit a REST API endpoint for authN/authZ, input validation, rate limiting, and data protection
argument-hint: <path>
---

# REST API Security Review

Audit a REST API endpoint for authentication, authorization, data protection, and attack prevention.
Usable as a Claude Code slash command: `/security-api-review <path>`

______________________________________________________________________

## Instructions for Claude Code

Run during PR review of API endpoints, before shipping public APIs, or during security audits. Related files: `.claude/rules/secrets-config.md`, `.claude/rules/drf-performance.md`.

Ensure the target REST API meets Padam-AV's security standards across these dimensions:

1. **Authentication** (Who are you?)

   - Token validation (JWT, session cookies)
   - OAuth2 / OpenID Connect (if applicable)
   - API key management (if applicable)

1. **Authorization** (What can you do?)

   - Role-based access control (RBAC)
   - Permission checking on every endpoint
   - Super-user restrictions for admin endpoints

1. **Input Validation** (Is this safe data?)

   - Validate all request parameters (query, body, headers)
   - Sanitize user input to prevent injection attacks
   - Type checking and range validation

1. **Data Protection** (Is data encrypted?)

   - HTTPS enforcement (no HTTP)
   - No secrets in logs or error messages
   - Encrypt sensitive data at rest (passwords, tokens)
   - Secure password hashing (bcrypt, argon2)

1. **Rate Limiting** (Prevent abuse?)

   - Throttle requests per user/IP
   - Prevent brute-force attacks
   - Implement exponential backoff for retries

1. **Monitoring** (Can we detect attacks?)

   - Log all authentication failures
   - Alert on suspicious patterns (too many failed logins, etc.)
   - Monitor for SQL injection, XSS, CSRF attempts

______________________________________________________________________

## API Security Checklist

```
✅ All endpoints require authentication (@permission_classes)
✅ All endpoints check user permissions (HasPermission or similar)
✅ Superuser-only endpoints marked with IsAdminUser
✅ All input validated (serializer validators, not just .is_valid())
✅ No hardcoded secrets in code or configs
✅ All responses sanitized (no stack traces, no secrets in errors)
✅ Rate limiting enabled (DRF throttle_classes)
✅ HTTPS enforced in production (Django SECURE_SSL_REDIRECT)
✅ CORS properly configured (not wildcard *)
✅ Security headers set (X-Frame-Options, CSP, etc.)
✅ Passwords hashed with Django's PASSWORD_HASHERS
✅ All external API calls timeout-protected
✅ Error responses don't leak sensitive info
```

______________________________________________________________________

## Common Vulnerabilities to Check

**Input Validation**:

```python
# ❌ BAD (no validation)
def create_item(request):
    data = request.data
    Item.objects.create(**data)  # Unsafe!

# ✅ GOOD (validate with serializer)
class ItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = ['name', 'description']

def create_item(request):
    serializer = ItemSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save()
```

**Error Response Safety**:

```python
# ❌ BAD (exposes internal details)
except Exception as e:
    return Response({"error": str(e)})  # Stack trace leakage

# ✅ GOOD (generic error message)
except Exception as e:
    logger.exception("Operation failed")  # Log internally
    return Response({"error": "Operation failed"}, status=400)
```

**Rate Limiting**:

```python
# ✅ GOOD (prevent brute force)
class ItemListView(viewsets.ViewSet):
    throttle_classes = [UserRateThrottle]
    permission_classes = [IsAuthenticated]
```

______________________________________________________________________

## Expected Output

After reviewing an API endpoint, report on:

- ✅ Authentication method validated (token, session, API key)
- ✅ Authorization check confirmed (who can access)
- ✅ Input validation complete (all params checked)
- ✅ Error messages safe (no secrets or stack traces)
- ✅ Rate limiting configured
- ✅ No hardcoded secrets found
- ✅ Security headers present (prod)
- ✅ Logs don't contain sensitive data
- ✅ Ready for code review and deployment

______________________________________________________________________

## Usage

```bash
# Invoke on a specific file:
# /security-api-review {app}/views.py

# Or test an endpoint manually:
curl -X GET http://localhost:8000/api/items/  # Should require auth
curl -H "Authorization: Bearer invalid" http://localhost:8000/api/items/  # Should fail
```
