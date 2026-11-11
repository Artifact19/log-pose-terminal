import os
from typing import Optional, Dict, Any
import jwt
from jwt import PyJWKClient, PyJWTError
from fastapi import Header, HTTPException, status
from backend.app.config import settings

_jwks_client: Optional[PyJWKClient] = None


def get_jwks_client() -> Optional[PyJWKClient]:
    """Initialize or return the cached PyJWKClient for Supabase JWKS."""
    global _jwks_client
    supabase_url = settings.SUPABASE_URL.strip()
    if not supabase_url:
        return None
    if _jwks_client is None:
        jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True, cache_jwk_set=True, lifespan=300)
    return _jwks_client


def _decode_token_verified(token: str) -> Optional[Dict[str, Any]]:
    """Decode and verify Supabase JWT token with strictly verified signature.
    
    Supports:
    1. HS256 with SUPABASE_JWT_SECRET.
    2. Asymmetric signing keys (RS256/ES256) via JWKS at {SUPABASE_URL}/auth/v1/.well-known/jwks.json.
    Audience must be 'authenticated'.
    Does NOT decode without signature verification and does NOT use raw base64 parsing.
    """
    try:
        unverified_header = jwt.get_unverified_header(token)
    except PyJWTError:
        return None

    alg = unverified_header.get("alg")

    # 1. HS256 with SUPABASE_JWT_SECRET
    if alg == "HS256" and settings.SUPABASE_JWT_SECRET:
        try:
            return jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
        except PyJWTError:
            return None

    # 2. Asymmetric keys via PyJWKClient
    client = get_jwks_client()
    if client:
        try:
            signing_key = client.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256", "HS256"],
                audience="authenticated",
            )
        except Exception:
            return None

    # Fallback to HS256 if alg was unspecified or secret is configured
    if settings.SUPABASE_JWT_SECRET:
        try:
            return jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
        except PyJWTError:
            return None

    return None


def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    """Extract and properly verify Supabase JWT token from the Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        return None

    parts = authorization.split(" ", 1)
    if len(parts) < 2:
        return None
    token = parts[1].strip()
    if not token:
        return None

    payload = _decode_token_verified(token)
    if not payload:
        return None

    return {
        "id": payload.get("sub"),
        "email": payload.get("email", ""),
        "role": payload.get("role", "authenticated"),
        "app_metadata": payload.get("app_metadata", {}),
        "user_metadata": payload.get("user_metadata", {}),
    }


def require_admin(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Ensure the requester is the authorized administrator.
    
    Dev bypass only applies when ENV == 'dev' is explicitly set and no authorization header is supplied.
    Invalid or missing token gives 401. Wrong email gives 403.
    """
    if not authorization:
        if settings.ENV == "dev":
            return {"email": settings.ADMIN_EMAIL, "role": "admin", "is_dev_bypass": True}
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in as administrator.",
        )

    user = get_current_user(authorization)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        )

    user_email = user.get("email", "").lower().strip()
    admin_email = settings.ADMIN_EMAIL.lower().strip()

    if user_email != admin_email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Administrator privileges required ({settings.ADMIN_EMAIL}).",
        )

    return user
