from typing import Optional, Dict, Any
import jwt
from fastapi import Header, HTTPException, status
from backend.app.config import settings


def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    """Extract and decode Supabase JWT token from the Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.split(" ")[1].strip()
    if not token:
        return None

    try:
        if settings.SUPABASE_JWT_SECRET:
            # Verify signature with Supabase JWT Secret
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
        else:
            # Dev mode fallback: decode without signature verification
            payload = jwt.decode(token, options={"verify_signature": False})

        return {
            "id": payload.get("sub"),
            "email": payload.get("email", ""),
            "role": payload.get("role", "authenticated"),
            "app_metadata": payload.get("app_metadata", {}),
            "user_metadata": payload.get("user_metadata", {}),
        }
    except Exception:
        # Invalid or expired token
        return None


def require_admin(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Ensure the requester is the authorized administrator (arnavraut4567@gmail.com)."""
    user = get_current_user(authorization)

    # In local development without Supabase secret configured, permit if header explicitly bypasses or matches
    if user is None:
        if settings.ENV == "dev" and not settings.SUPABASE_JWT_SECRET:
            # Permitted in local offline dev mode
            return {"email": settings.ADMIN_EMAIL, "role": "admin", "is_dev_bypass": True}
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in as administrator.",
        )

    user_email = user.get("email", "").lower().strip()
    admin_email = settings.ADMIN_EMAIL.lower().strip()

    if user_email != admin_email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Administrator privileges required ({settings.ADMIN_EMAIL}).",
        )

    return user
