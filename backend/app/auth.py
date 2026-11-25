"""JWT auth & bcrypt password hashing (local prototype). Production: Supabase Auth."""
import re
from datetime import datetime, timedelta, timezone
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from .config import settings
from .database import get_conn

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def validate_password_strength(pw: str) -> list[str]:
    """Return a list of unmet password strength rules (empty list = valid)."""
    errors: list[str] = []
    if len(pw) < 8:
        errors.append("Password must be at least 8 characters long.")
    if len(pw.encode("utf-8")) > 72:
        errors.append("Password must be at most 72 bytes.")
    if not re.search(r"[A-Z]", pw):
        errors.append("Password must include at least one uppercase letter.")
    if not re.search(r"[a-z]", pw):
        errors.append("Password must include at least one lowercase letter.")
    if not re.search(r"[0-9]", pw):
        errors.append("Password must include at least one number.")
    if not re.search(r"[^A-Za-z0-9]", pw):
        errors.append("Password must include at least one special character.")
    return errors


def hash_password(pw: str) -> str:
    """Hash password with bcrypt directly (compatible with bcrypt 4.x/5.x)."""
    pw_bytes = pw.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify plaintext password against stored bcrypt hash."""
    if not plain or not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8")[:72], hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: dict, remember_me: bool = False) -> str:
    to_encode = data.copy()
    minutes = settings.access_token_expire_minutes * 7 if remember_me else settings.access_token_expire_minutes
    expire = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def get_current_user(token: str = Depends(oauth2_scheme)):
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated. Please log in.")
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token.")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired or invalid. Please log in again.")
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT id, email, full_name, created_at FROM users WHERE id=?",
            (user_id,),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account not found.")
    return dict(row)
