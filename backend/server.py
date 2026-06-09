from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import re
import logging
import secrets
import base64
import json as _json
from typing import List, Optional, Annotated
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
import httpx
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Header, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, BeforeValidator, ConfigDict, EmailStr, Field

# ---------- Mongo ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ---------- Constants ----------
JWT_ALGORITHM = "HS256"
ACCESS_TTL_MIN = 60 * 24 * 7  # 7 days for hobby app convenience
DEFAULT_CATEGORIES = [
    {"slug": "kdramas", "name": "K-Dramas", "icon": "Clapperboard", "kind": "video", "minutes_per_unit": 60},
    {"slug": "thai-bl", "name": "Thai BLs", "icon": "Heart", "kind": "video", "minutes_per_unit": 45},
    {"slug": "anime", "name": "Anime", "icon": "Sparkles", "kind": "video", "minutes_per_unit": 24},
    {"slug": "manga", "name": "Manga", "icon": "BookOpen", "kind": "reading", "minutes_per_unit": 8},
    {"slug": "books", "name": "Books", "icon": "Library", "kind": "reading", "minutes_per_unit": 3},
]

DEFAULT_MINUTES = {"video": 40, "reading": 5, "custom": 20}

# ---------- Helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


# ---------- Image detection (GPT-5.4 vision) ----------
DETECT_SYSTEM_PROMPT = """You are Hanabi's media identifier. Given an image (usually a screenshot or photo of a tv/anime scene, a book cover, or a manga page), identify what's on screen.

Return a STRICT JSON object with EXACTLY these fields and nothing else:
{
  "title": string,                // best-guess title; "" if unsure
  "type": "anime"|"kdrama"|"thai-bl"|"manga"|"book"|"tv"|"unknown",
  "characters": [string],         // visible character or actor names
  "year": string,                 // 4-digit year if certain, else ""
  "country": string,              // primary country / origin if known, else ""
  "synopsis": string,             // 1-2 sentence context, else ""
  "confident": boolean,           // true ONLY if title AND visible characters belong to the same work
  "reason": string                // 1 line explaining the decision (for debugging)
}

Rules:
- If you can read a title in subtitles, channel watermark, or on a book/manga cover, treat that as strong evidence.
- If characters/actors visible don't match the title you're guessing, set confident=false and explain why.
- For Thai BL or K-drama, prefer the original (Korean/Thai) title over English where applicable.
- Do not invent characters or actors you don't see.
- NEVER output anything except the JSON object — no markdown fences, no prose."""

async def _gpt5_detect(image_bytes: bytes, mime: str) -> dict:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    b64 = base64.b64encode(image_bytes).decode()
    chat = LlmChat(
        api_key=key,
        session_id=f"hanabi-detect-{secrets.token_hex(6)}",
        system_message=DETECT_SYSTEM_PROMPT,
    ).with_model("openai", "gpt-4o")
    msg = UserMessage(
        text="Identify the title shown. Respond with the JSON object only.",
        file_contents=[ImageContent(image_base64=b64)],
    )
    text = await chat.send_message(msg)
    if not isinstance(text, str):
        text = str(text)
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE | re.MULTILINE).strip()
    try:
        return _json.loads(cleaned)
    except Exception:
        m = re.search(r"\{[\s\S]*\}", cleaned)
        if m:
            try:
                return _json.loads(m.group(0))
            except Exception:
                pass
        return {"title": "", "type": "unknown", "characters": [], "confident": False,
                "reason": "Model returned non-JSON.", "raw": cleaned[:400]}


# ---------- Activity log ----------
async def log_activity(user_id, type_: str, *, title: str = "", title_id=None,
                       category_id=None, category_name: str = "",
                       extra: Optional[dict] = None):
    """Best-effort activity log entry. Never raises."""
    try:
        await db.activity.insert_one({
            "user_id": user_id,
            "type": type_,  # add | progress | status | complete | remove | extension_add
            "title": title,
            "title_id": str(title_id) if title_id else None,
            "category_id": category_id,
            "category_name": category_name,
            "extra": extra or {},
            "created_at": now_iso(),
        })
    except Exception:
        logging.exception("activity log failed")

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TTL_MIN),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

import re
def slugify_username(base: str) -> str:
    s = re.sub(r"[^a-z0-9_-]+", "-", (base or "").lower()).strip("-_")
    return s[:30] or "user"

async def unique_username(base: str) -> str:
    candidate = slugify_username(base)
    if not await db.users.find_one({"username": candidate}):
        return candidate
    i = 2
    while True:
        c = f"{candidate}-{i}"
        if not await db.users.find_one({"username": c}):
            return c
        i += 1

def oid(s: str) -> ObjectId:
    try:
        return ObjectId(s)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")

def serialize(doc: dict) -> dict:
    if not doc:
        return doc
    d = dict(doc)
    if "_id" in d:
        d["id"] = str(d["_id"])
        del d["_id"]
    if "user_id" in d and isinstance(d["user_id"], ObjectId):
        d["user_id"] = str(d["user_id"])
    d.pop("password_hash", None)
    d.pop("key_hash", None)
    return d


# ---------- Models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: Optional[str] = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class CategoryIn(BaseModel):
    name: str
    icon: Optional[str] = "Sparkles"
    kind: Optional[str] = "video"  # video | reading | custom

class TitleIn(BaseModel):
    title: str
    category_id: str
    status: Optional[str] = "watching"  # watching | completed | plan | dropped | on_hold
    progress: Optional[int] = 0  # episode or chapter
    total: Optional[int] = None
    season: Optional[int] = None
    rating: Optional[float] = None
    notes: Optional[str] = ""
    cover_url: Optional[str] = ""
    source: Optional[str] = "manual"  # manual | extension
    external_id: Optional[str] = None
    external_source: Optional[str] = None  # jikan | tvmaze | openlibrary | anilist
    synopsis: Optional[str] = ""
    year: Optional[str] = ""
    country: Optional[str] = ""

class TitleUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    progress: Optional[int] = None
    total: Optional[int] = None
    season: Optional[int] = None
    rating: Optional[float] = None
    notes: Optional[str] = None
    cover_url: Optional[str] = None

class ThemeIn(BaseModel):
    theme: str

class SettingsIn(BaseModel):
    auto_accept: Optional[bool] = None
    profile_public: Optional[bool] = None
    name: Optional[str] = None
    username: Optional[str] = None
    style: Optional[str] = None

class SuggestionIn(BaseModel):
    title: str
    category_slug: Optional[str] = None
    category_hint: Optional[str] = None  # extension's guess: "anime", "kdrama"
    season: Optional[int] = None
    episode: Optional[int] = None
    cover_url: Optional[str] = None
    source_url: Optional[str] = None

class SuggestionAction(BaseModel):
    action: str  # accept | reject
    category_id: Optional[str] = None  # optional override on accept


# ---------- Auth deps ----------
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_user_by_api_key(x_api_key: Annotated[Optional[str], Header()] = None) -> dict:
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header")
    # Look up by SHA256 hash? Simpler: store the key directly with a prefix that's a lookup field
    # Use the key prefix (first 8 chars) for index, then verify the full key by hash
    import hashlib
    digest = hashlib.sha256(x_api_key.encode()).hexdigest()
    rec = await db.api_keys.find_one({"key_hash": digest, "revoked": {"$ne": True}})
    if not rec:
        raise HTTPException(status_code=401, detail="Invalid API key")
    user = await db.users.find_one({"_id": rec["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="User for key not found")
    # update last_used
    await db.api_keys.update_one({"_id": rec["_id"]}, {"$set": {"last_used_at": now_iso()}})
    return user


# ---------- App / Router ----------
app = FastAPI(title="Hanabi Hobby Tracker")
api = APIRouter(prefix="/api")


# ---------- Auth Routes ----------
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    username = await unique_username(payload.name or email.split("@")[0])
    doc = {
        "email": email,
        "username": username,
        "name": payload.name or email.split("@")[0],
        "password_hash": hash_password(payload.password),
        "theme": "tokyo-twilight",
        "auto_accept": False,
        "profile_public": False,
        "created_at": now_iso(),
    }
    res = await db.users.insert_one(doc)
    user_id = str(res.inserted_id)
    # seed default categories for this user
    cats = [
        {**c, "user_id": ObjectId(user_id), "is_default": True, "created_at": now_iso()}
        for c in DEFAULT_CATEGORIES
    ]
    await db.categories.insert_many(cats)
    token = create_access_token(user_id, email)
    response.set_cookie("access_token", token, httponly=True, secure=False, samesite="lax",
                        max_age=ACCESS_TTL_MIN * 60, path="/")
    return {"user": serialize({**doc, "_id": res.inserted_id}), "token": token}

@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(str(user["_id"]), email)
    response.set_cookie("access_token", token, httponly=True, secure=False, samesite="lax",
                        max_age=ACCESS_TTL_MIN * 60, path="/")
    return {"user": serialize(user), "token": token}

@api.post("/auth/logout")
async def logout(response: Response, _user=Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return serialize(user)

@api.patch("/auth/theme")
async def set_theme(payload: ThemeIn, user=Depends(get_current_user)):
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"theme": payload.theme}})
    return {"ok": True, "theme": payload.theme}

@api.post("/auth/google/session")
async def google_session(payload: dict, response: Response):
    """Exchange an Emergent Google OAuth session_id for our own access_token cookie.
    REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    """
    session_id = (payload or {}).get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")
    try:
        async with httpx.AsyncClient(timeout=10.0) as cli:
            r = await cli.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id},
            )
    except Exception:
        raise HTTPException(status_code=502, detail="Could not reach auth provider")
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired Google session")
    data = r.json() or {}
    email = (data.get("email") or "").lower().strip()
    name = (data.get("name") or "").strip()
    picture = data.get("picture") or ""
    if not email:
        raise HTTPException(status_code=400, detail="Google account had no email")

    user = await db.users.find_one({"email": email})
    if not user:
        username = await unique_username(name or email.split("@")[0])
        doc = {
            "email": email,
            "username": username,
            "name": name or email.split("@")[0],
            "picture": picture,
            "google_linked": True,
            "theme": "tokyo-twilight",
            "auto_accept": False,
            "profile_public": False,
            "created_at": now_iso(),
        }
        res = await db.users.insert_one(doc)
        cats = [
            {**c, "user_id": res.inserted_id, "is_default": True, "created_at": now_iso()}
            for c in DEFAULT_CATEGORIES
        ]
        await db.categories.insert_many(cats)
        user = await db.users.find_one({"_id": res.inserted_id})
    else:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"google_linked": True, "picture": picture or user.get("picture", "")}},
        )

    token = create_access_token(str(user["_id"]), email)
    response.set_cookie(
        "access_token", token, httponly=True, secure=False, samesite="lax",
        max_age=ACCESS_TTL_MIN * 60, path="/",
    )
    return {"user": serialize(user), "token": token}

@api.patch("/auth/settings")
async def update_settings(payload: SettingsIn, user=Depends(get_current_user)):
    update: dict = {}
    if payload.auto_accept is not None:
        update["auto_accept"] = bool(payload.auto_accept)
    if payload.profile_public is not None:
        update["profile_public"] = bool(payload.profile_public)
    if payload.name is not None and payload.name.strip():
        update["name"] = payload.name.strip()[:60]
    if payload.username is not None:
        new_u = slugify_username(payload.username)
        if not new_u:
            raise HTTPException(status_code=400, detail="Invalid username")
        existing = await db.users.find_one({"username": new_u, "_id": {"$ne": user["_id"]}})
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        update["username"] = new_u
    if payload.style is not None:
        update["style"] = payload.style.strip()[:40] or "default"
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.users.update_one({"_id": user["_id"]}, {"$set": update})
    fresh = await db.users.find_one({"_id": user["_id"]})
    return serialize(fresh)


# ---------- Categories ----------
@api.get("/categories")
async def list_categories(user=Depends(get_current_user)):
    cats = await db.categories.find({"user_id": user["_id"]}).sort("created_at", 1).to_list(500)
    # add counts
    out = []
    for c in cats:
        count = await db.titles.count_documents({"user_id": user["_id"], "category_id": c["_id"]})
        out.append({**serialize(c), "count": count})
    return out

@api.post("/categories")
async def create_category(payload: CategoryIn, user=Depends(get_current_user)):
    slug = payload.name.lower().replace(" ", "-")
    doc = {
        "user_id": user["_id"],
        "slug": slug,
        "name": payload.name,
        "icon": payload.icon or "Sparkles",
        "kind": payload.kind or "custom",
        "is_default": False,
        "created_at": now_iso(),
    }
    res = await db.categories.insert_one(doc)
    return serialize({**doc, "_id": res.inserted_id, "count": 0})

@api.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, user=Depends(get_current_user)):
    _id = oid(cat_id)
    cat = await db.categories.find_one({"_id": _id, "user_id": user["_id"]})
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.titles.delete_many({"user_id": user["_id"], "category_id": _id})
    await db.category_links.delete_many({"user_id": user["_id"], "category_id": _id})
    await db.categories.delete_one({"_id": _id})
    return {"ok": True}


# ---------- Category links (per-collection bookmarks) ----------
@api.get("/categories/{cat_id}/links")
async def list_category_links(cat_id: str, user=Depends(get_current_user)):
    _id = oid(cat_id)
    if not await db.categories.find_one({"_id": _id, "user_id": user["_id"]}):
        raise HTTPException(status_code=404, detail="Category not found")
    links = await db.category_links.find(
        {"user_id": user["_id"], "category_id": _id}
    ).sort("created_at", 1).to_list(200)
    out = []
    for l in links:
        d = serialize(l)
        d["category_id"] = str(l["category_id"])
        out.append(d)
    return out

@api.post("/categories/{cat_id}/links")
async def create_category_link(cat_id: str, payload: dict, user=Depends(get_current_user)):
    _id = oid(cat_id)
    if not await db.categories.find_one({"_id": _id, "user_id": user["_id"]}):
        raise HTTPException(status_code=404, detail="Category not found")
    url = (payload or {}).get("url", "").strip()
    label = (payload or {}).get("label", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required")
    # normalize URL (add https:// if missing)
    if not re.match(r"^https?://", url, flags=re.I):
        url = "https://" + url
    if not label:
        # derive label from host
        m = re.match(r"^https?://([^/]+)", url, flags=re.I)
        label = (m.group(1) if m else url)[:60]
    doc = {
        "user_id": user["_id"],
        "category_id": _id,
        "label": label[:120],
        "url": url[:2000],
        "created_at": now_iso(),
    }
    res = await db.category_links.insert_one(doc)
    out = serialize({**doc, "_id": res.inserted_id})
    out["category_id"] = str(_id)
    return out

@api.delete("/categories/{cat_id}/links/{link_id}")
async def delete_category_link(cat_id: str, link_id: str, user=Depends(get_current_user)):
    res = await db.category_links.delete_one({
        "_id": oid(link_id),
        "category_id": oid(cat_id),
        "user_id": user["_id"],
    })
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Link not found")
    return {"ok": True}


# ---------- Titles ----------
@api.get("/titles")
async def list_titles(
    user=Depends(get_current_user),
    category_id: Optional[str] = None,
    status: Optional[str] = None,
    q: Optional[str] = None,
):
    query: dict = {"user_id": user["_id"]}
    if category_id:
        query["category_id"] = oid(category_id)
    if status:
        query["status"] = status
    if q:
        query["title"] = {"$regex": q, "$options": "i"}
    items = await db.titles.find(query).sort("updated_at", -1).to_list(1000)
    out = []
    for t in items:
        d = serialize(t)
        if "category_id" in t:
            d["category_id"] = str(t["category_id"])
        out.append(d)
    return out

@api.post("/titles")
async def create_title(payload: TitleIn, user=Depends(get_current_user)):
    cat_id = oid(payload.category_id)
    cat = await db.categories.find_one({"_id": cat_id, "user_id": user["_id"]})
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    doc = {
        "user_id": user["_id"],
        "category_id": cat_id,
        "title": payload.title,
        "status": payload.status or "watching",
        "progress": payload.progress or 0,
        "total": payload.total,
        "season": payload.season,
        "rating": payload.rating,
        "notes": payload.notes or "",
        "cover_url": payload.cover_url or "",
        "source": payload.source or "manual",
        "external_id": payload.external_id,
        "external_source": payload.external_source,
        "synopsis": payload.synopsis or "",
        "year": payload.year or "",
        "country": payload.country or "",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    res = await db.titles.insert_one(doc)
    d = serialize({**doc, "_id": res.inserted_id})
    d["category_id"] = str(cat_id)
    await log_activity(user["_id"], "extension_add" if doc["source"] == "extension" else "add",
                       title=doc["title"], title_id=res.inserted_id,
                       category_id=str(cat_id), category_name=cat.get("name", ""))
    return d

@api.patch("/titles/{title_id}")
async def update_title(title_id: str, payload: TitleUpdate, user=Depends(get_current_user)):
    _id = oid(title_id)
    update = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    update["updated_at"] = now_iso()
    before = await db.titles.find_one({"_id": _id, "user_id": user["_id"]})
    if not before:
        raise HTTPException(status_code=404, detail="Title not found")
    await db.titles.update_one({"_id": _id, "user_id": user["_id"]}, {"$set": update})
    t = await db.titles.find_one({"_id": _id})
    cat = await db.categories.find_one({"_id": t["category_id"]})
    cat_name = cat.get("name", "") if cat else ""
    # log meaningful changes
    if "status" in update and update["status"] != before.get("status"):
        type_ = "complete" if update["status"] == "completed" else "status"
        await log_activity(user["_id"], type_, title=t["title"], title_id=t["_id"],
                           category_id=str(t["category_id"]), category_name=cat_name,
                           extra={"from": before.get("status"), "to": update["status"]})
    elif "progress" in update and (update["progress"] or 0) != (before.get("progress") or 0):
        await log_activity(user["_id"], "progress", title=t["title"], title_id=t["_id"],
                           category_id=str(t["category_id"]), category_name=cat_name,
                           extra={"from": before.get("progress") or 0, "to": update["progress"]})
    d = serialize(t)
    d["category_id"] = str(t["category_id"])
    return d

@api.delete("/titles/{title_id}")
async def delete_title(title_id: str, user=Depends(get_current_user)):
    _id = oid(title_id)
    before = await db.titles.find_one({"_id": _id, "user_id": user["_id"]})
    if not before:
        raise HTTPException(status_code=404, detail="Title not found")
    await db.titles.delete_one({"_id": _id})
    await log_activity(user["_id"], "remove", title=before.get("title", ""),
                       title_id=_id, category_id=str(before.get("category_id")))
    return {"ok": True}


async def _fetch_one_detail(external_source: str, external_id: str) -> Optional[dict]:
    """Fetch a single title's metadata from its source. Returns a dict of
    fields to merge into a title doc, or None."""
    if not external_id or not external_source:
        return None
    try:
        async with httpx.AsyncClient(timeout=8.0) as cli:
            if external_source in ("jikan-anime", "jikan-manga"):
                kind = external_source.split("-")[1]
                r = await cli.get(f"https://api.jikan.moe/v4/{kind}/{external_id}")
                if r.status_code != 200:
                    return None
                d = (r.json() or {}).get("data") or {}
                aired = d.get("aired") or d.get("published") or {}
                studios = d.get("studios") or []
                return {
                    "title": d.get("title") or d.get("title_english"),
                    "cover_url": (d.get("images", {}).get("jpg", {}) or {}).get("image_url"),
                    "total": d.get("episodes") if kind == "anime" else d.get("chapters"),
                    "synopsis": d.get("synopsis") or "",
                    "year": (aired.get("from") or "")[:4],
                    "country": (studios[0]["name"] if studios else ("Japan" if kind == "anime" else "")),
                }
            elif external_source == "tvmaze":
                tid = external_id.replace("tvmaze-", "")
                r = await cli.get(f"https://api.tvmaze.com/shows/{tid}")
                if r.status_code != 200:
                    return None
                s = r.json() or {}
                img = s.get("image") or {}
                # also fetch total episode count
                ep_count = None
                try:
                    er = await cli.get(f"https://api.tvmaze.com/shows/{tid}/episodes")
                    if er.status_code == 200:
                        ep_count = len(er.json() or [])
                except Exception:
                    pass
                return {
                    "title": s.get("name"),
                    "cover_url": img.get("original") or img.get("medium") or "",
                    "total": ep_count,
                    "synopsis": _strip_html(s.get("summary") or ""),
                    "year": (s.get("premiered") or "")[:4],
                    "country": ((s.get("network") or {}).get("country") or {}).get("name") or "",
                }
            elif external_source == "openlibrary":
                # external_id looks like "/works/OL12345W"
                path = external_id if external_id.startswith("/") else f"/works/{external_id}"
                r = await cli.get(f"https://openlibrary.org{path}.json")
                if r.status_code != 200:
                    return None
                d = r.json() or {}
                description = d.get("description")
                if isinstance(description, dict):
                    description = description.get("value", "")
                covers = d.get("covers") or []
                cover = f"https://covers.openlibrary.org/b/id/{covers[0]}-L.jpg" if covers else ""
                return {
                    "title": d.get("title"),
                    "cover_url": cover,
                    "synopsis": description or "",
                    "year": str(d.get("first_publish_date") or "")[:4],
                }
    except Exception:
        logging.exception("detail fetch failed")
        return None
    return None


@api.post("/titles/{title_id}/refresh")
async def refresh_title(title_id: str, user=Depends(get_current_user)):
    _id = oid(title_id)
    t = await db.titles.find_one({"_id": _id, "user_id": user["_id"]})
    if not t:
        raise HTTPException(status_code=404, detail="Title not found")
    src = t.get("external_source")
    ext = t.get("external_id")
    if not src or not ext:
        raise HTTPException(status_code=400, detail="This title has no linked source to refresh from. Re-add it via search.")
    detail = await _fetch_one_detail(src, ext)
    if not detail:
        raise HTTPException(status_code=502, detail="Could not fetch fresh details right now")
    update = {k: v for k, v in detail.items() if v not in (None, "")}
    update["updated_at"] = now_iso()
    await db.titles.update_one({"_id": _id}, {"$set": update})
    updated = await db.titles.find_one({"_id": _id})
    d = serialize(updated)
    d["category_id"] = str(updated["category_id"])
    return d


# ---------- Stats ----------
def _minutes_for(cat: dict) -> int:
    return int(cat.get("minutes_per_unit") or DEFAULT_MINUTES.get(cat.get("kind"), 30))

@api.get("/stats")
async def stats(user=Depends(get_current_user)):
    total = await db.titles.count_documents({"user_id": user["_id"]})
    watching = await db.titles.count_documents({"user_id": user["_id"], "status": "watching"})
    completed = await db.titles.count_documents({"user_id": user["_id"], "status": "completed"})
    plan = await db.titles.count_documents({"user_id": user["_id"], "status": "plan"})
    pending = await db.suggestions.count_documents({"user_id": user["_id"], "status": "pending"})
    recent = await db.titles.find({"user_id": user["_id"]}).sort("updated_at", -1).limit(8).to_list(8)
    recent_out = []
    for t in recent:
        d = serialize(t)
        d["category_id"] = str(t["category_id"])
        recent_out.append(d)

    # per-category breakdown + hours
    cats = await db.categories.find({"user_id": user["_id"]}).to_list(500)
    by_category = []
    total_minutes = 0
    for c in cats:
        titles_in = await db.titles.find(
            {"user_id": user["_id"], "category_id": c["_id"]},
            {"progress": 1, "total": 1, "status": 1},
        ).to_list(2000)
        mins_per = _minutes_for(c)
        units = 0
        for t in titles_in:
            # if completed and we know total, use total; else use progress
            if t.get("status") == "completed" and t.get("total"):
                units += int(t["total"] or 0)
            else:
                units += int(t.get("progress") or 0)
        minutes = units * mins_per
        total_minutes += minutes
        by_category.append({
            "id": str(c["_id"]),
            "slug": c.get("slug"),
            "name": c.get("name"),
            "kind": c.get("kind"),
            "count": len(titles_in),
            "minutes": minutes,
            "hours": round(minutes / 60, 1),
        })

    return {
        "total": total,
        "watching": watching,
        "completed": completed,
        "plan": plan,
        "pending_suggestions": pending,
        "minutes": total_minutes,
        "hours": round(total_minutes / 60, 1),
        "by_category": by_category,
        "recent": recent_out,
    }

@api.get("/activity")
async def activity(user=Depends(get_current_user), limit: int = 50):
    limit = min(max(limit, 1), 200)
    items = await db.activity.find({"user_id": user["_id"]}).sort("created_at", -1).limit(limit).to_list(limit)
    return [serialize(a) for a in items]


# ---------- Metadata search ----------
def _strip_html(s: str) -> str:
    if not s:
        return ""
    return re.sub(r"<[^>]+>", "", s)

@api.get("/metadata/search")
async def metadata_search(
    q: str = Query(..., min_length=1),
    kind: str = Query("anime"),  # anime | manga | tv | books
    _user=Depends(get_current_user),
):
    """Search third-party catalogues for a title.
    - anime/manga: Jikan (MyAnimeList)
    - tv: TVmaze (k-dramas, Thai BLs, c-dramas, western TV)
    - books: Open Library
    """
    try:
        async with httpx.AsyncClient(timeout=8.0) as cli:
            if kind in ("anime", "manga"):
                url = f"https://api.jikan.moe/v4/{kind}"
                r = await cli.get(url, params={"q": q, "limit": 8})
                data = r.json().get("data", [])
                out = []
                for d in data:
                    aired = d.get("aired") or d.get("published") or {}
                    year = (aired.get("from") or "")[:4]
                    studios = d.get("studios") or []
                    studio = studios[0]["name"] if studios else ""
                    out.append({
                        "title": d.get("title"),
                        "cover_url": (d.get("images", {}).get("jpg", {}) or {}).get("image_url"),
                        "external_id": str(d.get("mal_id")),
                        "external_source": f"jikan-{kind}",
                        "total": d.get("episodes") if kind == "anime" else d.get("chapters"),
                        "synopsis": d.get("synopsis"),
                        "year": year,
                        "country": studio or ("Japan" if kind == "anime" else ""),
                        "source": "jikan",
                    })
                return out
            elif kind == "tv":
                r = await cli.get("https://api.tvmaze.com/search/shows", params={"q": q})
                arr = r.json() or []
                out = []
                for row in arr[:12]:
                    s = row.get("show") or {}
                    img = s.get("image") or {}
                    out.append({
                        "title": s.get("name"),
                        "cover_url": img.get("original") or img.get("medium") or "",
                        "external_id": f"tvmaze-{s.get('id')}",
                        "external_source": "tvmaze",
                        "total": s.get("runtime"),  # minutes per ep — informational
                        "synopsis": _strip_html(s.get("summary") or ""),
                        "year": (s.get("premiered") or "")[:4],
                        "country": ((s.get("network") or {}).get("country") or {}).get("name"),
                        "source": "tvmaze",
                    })
                return out
            elif kind == "books":
                r = await cli.get("https://openlibrary.org/search.json", params={"q": q, "limit": 8})
                docs = r.json().get("docs", [])
                out = []
                for d in docs:
                    cover_id = d.get("cover_i")
                    cover = f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg" if cover_id else ""
                    out.append({
                        "title": d.get("title"),
                        "cover_url": cover,
                        "external_id": d.get("key", ""),
                        "external_source": "openlibrary",
                        "total": d.get("number_of_pages_median"),
                        "synopsis": (d.get("author_name") or [""])[0],
                        "year": str(d.get("first_publish_year") or ""),
                        "country": "",
                        "source": "openlibrary",
                    })
                return out
            else:
                return []
    except Exception:
        logging.exception("metadata search failed")
        return []


# ---------- API Keys (for Hanabi extension) ----------
@api.get("/api-keys")
async def list_keys(user=Depends(get_current_user)):
    keys = await db.api_keys.find({"user_id": user["_id"]}).sort("created_at", -1).to_list(50)
    out = []
    for k in keys:
        out.append({
            "id": str(k["_id"]),
            "label": k.get("label"),
            "prefix": k.get("prefix"),
            "created_at": k.get("created_at"),
            "last_used_at": k.get("last_used_at"),
            "revoked": k.get("revoked", False),
        })
    return out

@api.post("/api-keys")
async def create_key(payload: dict, user=Depends(get_current_user)):
    import hashlib
    raw = "hnb_" + secrets.token_urlsafe(28)
    digest = hashlib.sha256(raw.encode()).hexdigest()
    doc = {
        "user_id": user["_id"],
        "label": payload.get("label") or "Hanabi extension",
        "prefix": raw[:10],
        "key_hash": digest,
        "created_at": now_iso(),
        "last_used_at": None,
        "revoked": False,
    }
    res = await db.api_keys.insert_one(doc)
    return {
        "id": str(res.inserted_id),
        "label": doc["label"],
        "prefix": doc["prefix"],
        "key": raw,  # shown ONCE
        "created_at": doc["created_at"],
    }

@api.delete("/api-keys/{key_id}")
async def revoke_key(key_id: str, user=Depends(get_current_user)):
    res = await db.api_keys.update_one(
        {"_id": oid(key_id), "user_id": user["_id"]}, {"$set": {"revoked": True}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Key not found")
    return {"ok": True}


# ---------- Suggestions (Hanabi inbox) ----------
@api.get("/suggestions")
async def list_suggestions(user=Depends(get_current_user), status: Optional[str] = "pending"):
    q: dict = {"user_id": user["_id"]}
    if status:
        q["status"] = status
    items = await db.suggestions.find(q).sort("created_at", -1).limit(100).to_list(100)
    return [serialize(s) for s in items]

@api.post("/suggestions/{sug_id}/act")
async def act_on_suggestion(sug_id: str, payload: SuggestionAction, user=Depends(get_current_user)):
    _id = oid(sug_id)
    sug = await db.suggestions.find_one({"_id": _id, "user_id": user["_id"]})
    if not sug:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    if payload.action == "reject":
        await db.suggestions.update_one({"_id": _id}, {"$set": {"status": "rejected"}})
        return {"ok": True}
    if payload.action != "accept":
        raise HTTPException(status_code=400, detail="Unknown action")

    # determine category
    cat = None
    if payload.category_id:
        cat = await db.categories.find_one({"_id": oid(payload.category_id), "user_id": user["_id"]})
    if not cat and sug.get("category_slug"):
        cat = await db.categories.find_one({"user_id": user["_id"], "slug": sug["category_slug"]})
    if not cat:
        # fallback to first user category
        cat = await db.categories.find_one({"user_id": user["_id"]})
    if not cat:
        raise HTTPException(status_code=400, detail="No category available")

    # if title already exists in that category, update progress; else create
    existing = await db.titles.find_one({
        "user_id": user["_id"],
        "category_id": cat["_id"],
        "title": {"$regex": f"^{sug['title']}$", "$options": "i"},
    })
    if existing:
        update = {"updated_at": now_iso(), "source": "extension"}
        if sug.get("episode") is not None:
            update["progress"] = max(existing.get("progress") or 0, sug["episode"])
        if sug.get("season") is not None:
            update["season"] = sug["season"]
        await db.titles.update_one({"_id": existing["_id"]}, {"$set": update})
        title_id = str(existing["_id"])
    else:
        doc = {
            "user_id": user["_id"],
            "category_id": cat["_id"],
            "title": sug["title"],
            "status": "watching",
            "progress": sug.get("episode") or 0,
            "season": sug.get("season"),
            "cover_url": sug.get("cover_url") or "",
            "source": "extension",
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        r = await db.titles.insert_one(doc)
        title_id = str(r.inserted_id)

    await db.suggestions.update_one({"_id": _id}, {"$set": {"status": "accepted", "title_id": title_id}})
    await log_activity(user["_id"], "extension_add", title=sug.get("title", ""),
                       title_id=title_id, category_id=str(cat["_id"]),
                       category_name=cat.get("name", ""))
    return {"ok": True, "title_id": title_id}


# ---------- Extension endpoints (X-API-Key) ----------
@api.get("/extension/ping")
async def extension_ping(user=Depends(get_user_by_api_key)):
    return {"ok": True, "user": {"id": str(user["_id"]), "email": user["email"]}}

@api.post("/extension/scan")
async def extension_scan(payload: SuggestionIn, user=Depends(get_user_by_api_key)):
    """Called by the Hanabi browser extension when it detects media on screen.
    Creates a pending suggestion the user can accept/reject from the inbox.
    If auto_accept policy is on, may auto-add. For MVP we always create a suggestion."""

    # try to resolve category from hint
    cat_slug = payload.category_slug
    if not cat_slug and payload.category_hint:
        hint = payload.category_hint.lower()
        mapping = {
            "anime": "anime", "manga": "manga", "kdrama": "kdramas",
            "korean drama": "kdramas", "thai bl": "thai-bl", "bl": "thai-bl",
            "book": "books", "novel": "books",
        }
        for k, v in mapping.items():
            if k in hint:
                cat_slug = v
                break

    # Dedup: if a pending suggestion with same title already exists, just update episode.
    existing = await db.suggestions.find_one({
        "user_id": user["_id"],
        "title": payload.title,
        "status": "pending",
    })
    if existing:
        update = {"updated_at": now_iso()}
        if payload.episode is not None:
            update["episode"] = payload.episode
        if payload.season is not None:
            update["season"] = payload.season
        if payload.cover_url:
            update["cover_url"] = payload.cover_url
        await db.suggestions.update_one({"_id": existing["_id"]}, {"$set": update})
        return {"ok": True, "suggestion_id": str(existing["_id"]), "deduped": True}

    doc = {
        "user_id": user["_id"],
        "title": payload.title,
        "category_slug": cat_slug,
        "category_hint": payload.category_hint,
        "season": payload.season,
        "episode": payload.episode,
        "cover_url": payload.cover_url or "",
        "source_url": payload.source_url,
        "status": "pending",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    res = await db.suggestions.insert_one(doc)
    suggestion_id = str(res.inserted_id)

    # Auto-accept policy: if user has enabled it AND we resolved a category,
    # convert this suggestion straight into a title.
    if user.get("auto_accept") and cat_slug:
        cat = await db.categories.find_one({"user_id": user["_id"], "slug": cat_slug})
        if cat:
            existing_title = await db.titles.find_one({
                "user_id": user["_id"],
                "category_id": cat["_id"],
                "title": {"$regex": f"^{re.escape(payload.title)}$", "$options": "i"},
            })
            if existing_title:
                t_update = {"updated_at": now_iso(), "source": "extension"}
                if payload.episode is not None:
                    t_update["progress"] = max(existing_title.get("progress") or 0, payload.episode)
                if payload.season is not None:
                    t_update["season"] = payload.season
                await db.titles.update_one({"_id": existing_title["_id"]}, {"$set": t_update})
                title_id = str(existing_title["_id"])
            else:
                t_doc = {
                    "user_id": user["_id"],
                    "category_id": cat["_id"],
                    "title": payload.title,
                    "status": "watching",
                    "progress": payload.episode or 0,
                    "season": payload.season,
                    "cover_url": payload.cover_url or "",
                    "source": "extension",
                    "created_at": now_iso(),
                    "updated_at": now_iso(),
                }
                tr = await db.titles.insert_one(t_doc)
                title_id = str(tr.inserted_id)
            await db.suggestions.update_one(
                {"_id": res.inserted_id},
                {"$set": {"status": "accepted", "title_id": title_id, "auto_accepted": True}},
            )
            await log_activity(user["_id"], "extension_add", title=payload.title,
                               title_id=title_id, category_id=str(cat["_id"]),
                               category_name=cat.get("name", ""), extra={"auto": True})
            return {"ok": True, "suggestion_id": suggestion_id, "auto_accepted": True, "title_id": title_id}

    return {"ok": True, "suggestion_id": suggestion_id}


# ---------- Public profile (no auth) ----------
async def _public_user_or_404(username: str) -> dict:
    u = await db.users.find_one({"username": username})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if not u.get("profile_public"):
        raise HTTPException(status_code=404, detail="Profile is private")
    return u

@api.get("/public/u/{username}")
async def public_profile(username: str):
    u = await _public_user_or_404(username)
    cats = await db.categories.find({"user_id": u["_id"]}).sort("created_at", 1).to_list(500)
    cats_out = []
    for c in cats:
        count = await db.titles.count_documents({"user_id": u["_id"], "category_id": c["_id"]})
        cats_out.append({**serialize(c), "count": count})
    total = await db.titles.count_documents({"user_id": u["_id"]})
    return {
        "user": {
            "username": u.get("username"),
            "name": u.get("name"),
            "theme": u.get("theme") or "tokyo-twilight",
            "style": u.get("style") or "default",
            "created_at": u.get("created_at"),
        },
        "categories": cats_out,
        "total": total,
    }

@api.get("/public/u/{username}/titles")
async def public_titles(username: str, category_id: Optional[str] = None,
                        category_slug: Optional[str] = None, status: Optional[str] = None):
    u = await _public_user_or_404(username)
    q: dict = {"user_id": u["_id"]}
    if category_id:
        q["category_id"] = oid(category_id)
    elif category_slug:
        cat = await db.categories.find_one({"user_id": u["_id"], "slug": category_slug})
        if not cat:
            raise HTTPException(status_code=404, detail="Collection not found")
        q["category_id"] = cat["_id"]
    if status:
        q["status"] = status
    items = await db.titles.find(q).sort("updated_at", -1).limit(500).to_list(500)
    out = []
    for t in items:
        d = serialize(t)
        d["category_id"] = str(t["category_id"])
        d.pop("notes", None)
        out.append(d)
    return out


# ---------- Imports (AniList) ----------
ANILIST_STATUS_MAP = {
    "CURRENT": "watching", "REPEATING": "watching",
    "PLANNING": "plan",
    "COMPLETED": "completed",
    "DROPPED": "dropped",
    "PAUSED": "on_hold",
}

@api.post("/import/anilist")
async def import_anilist(payload: dict, user=Depends(get_current_user)):
    """Import a public AniList user's anime or manga list into a target category."""
    al_username = ((payload or {}).get("username") or "").strip()
    media_type = ((payload or {}).get("type") or "ANIME").upper()
    target_cat_id = (payload or {}).get("category_id")
    if not al_username or media_type not in ("ANIME", "MANGA") or not target_cat_id:
        raise HTTPException(status_code=400, detail="username, type (ANIME|MANGA) and category_id are required")
    cat = await db.categories.find_one({"_id": oid(target_cat_id), "user_id": user["_id"]})
    if not cat:
        raise HTTPException(status_code=404, detail="Target category not found")

    query = """
    query ($userName: String, $type: MediaType) {
      MediaListCollection(userName: $userName, type: $type) {
        lists {
          name
          entries {
            status progress score
            media { id title { romaji english } episodes chapters coverImage { large } }
          }
        }
      }
    }
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as cli:
            r = await cli.post(
                "https://graphql.anilist.co",
                json={"query": query, "variables": {"userName": al_username, "type": media_type}},
                headers={"Content-Type": "application/json"},
            )
    except Exception:
        raise HTTPException(status_code=502, detail="Could not reach AniList")
    if r.status_code == 404:
        raise HTTPException(status_code=404, detail="AniList user not found")
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"AniList error ({r.status_code})")
    body = r.json() or {}
    if body.get("errors"):
        msg = body["errors"][0].get("message", "AniList error")
        raise HTTPException(status_code=400, detail=msg)
    collection = (body.get("data") or {}).get("MediaListCollection") or {}
    lists = collection.get("lists") or []

    imported = 0
    skipped = 0
    for lst in lists:
        for e in (lst.get("entries") or []):
            m = e.get("media") or {}
            title = (m.get("title") or {}).get("english") or (m.get("title") or {}).get("romaji")
            if not title:
                skipped += 1
                continue
            ext_id = f"al-{m.get('id')}"
            # dedup on external_id within this category
            existing = await db.titles.find_one({
                "user_id": user["_id"],
                "category_id": cat["_id"],
                "external_id": ext_id,
            })
            if existing:
                skipped += 1
                continue
            doc = {
                "user_id": user["_id"],
                "category_id": cat["_id"],
                "title": title,
                "status": ANILIST_STATUS_MAP.get(e.get("status"), "plan"),
                "progress": int(e.get("progress") or 0),
                "total": m.get("episodes") if media_type == "ANIME" else m.get("chapters"),
                "season": None,
                "rating": (float(e.get("score")) / 10.0) if e.get("score") else None,
                "notes": "",
                "cover_url": ((m.get("coverImage") or {}).get("large")) or "",
                "source": "anilist",
                "external_id": ext_id,
                "created_at": now_iso(),
                "updated_at": now_iso(),
            }
            await db.titles.insert_one(doc)
            imported += 1
    if imported:
        await log_activity(user["_id"], "add",
                           title=f"AniList import ({imported})",
                           category_id=str(cat["_id"]),
                           category_name=cat.get("name", ""),
                           extra={"source": "anilist", "count": imported})
    return {"imported": imported, "skipped": skipped, "category_id": str(cat["_id"])}


# ---------- Startup ----------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True, sparse=True)
    await db.categories.create_index([("user_id", 1), ("slug", 1)])
    await db.titles.create_index([("user_id", 1), ("category_id", 1)])
    await db.suggestions.create_index([("user_id", 1), ("status", 1)])
    await db.api_keys.create_index("key_hash")
    await db.activity.create_index([("user_id", 1), ("created_at", -1)])
    await db.category_links.create_index([("user_id", 1), ("category_id", 1)])

    # Backfill username for any user missing it (one-shot)
    async for u in db.users.find({"$or": [{"username": {"$exists": False}}, {"username": None}]}):
        new_u = await unique_username(u.get("name") or u.get("email", "").split("@")[0])
        await db.users.update_one({"_id": u["_id"]}, {"$set": {"username": new_u}})

    # seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@hanabi.app")
    admin_password = os.environ.get("ADMIN_PASSWORD", "hanabi123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        admin_username = await unique_username("admin")
        res = await db.users.insert_one({
            "email": admin_email,
            "username": admin_username,
            "name": "Admin",
            "password_hash": hash_password(admin_password),
            "theme": "tokyo-twilight",
            "auto_accept": False,
            "profile_public": False,
            "created_at": now_iso(),
        })
        cats = [
            {**c, "user_id": res.inserted_id, "is_default": True, "created_at": now_iso()}
            for c in DEFAULT_CATEGORIES
        ]
        await db.categories.insert_many(cats)

@app.on_event("shutdown")
async def shutdown():
    client.close()


# ---------- Image detection endpoint (uses helper defined above) ----------
@api.post("/detect/image")
async def detect_image(image: UploadFile = File(...), user=Depends(get_current_user)):
    if (image.content_type or "").lower() not in ("image/jpeg", "image/jpg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPEG/PNG/WEBP supported")
    raw = await image.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")
    try:
        result = await _gpt5_detect(raw, image.content_type)
    except HTTPException:
        raise
    except Exception:
        logging.exception("detect failed")
        raise HTTPException(status_code=502, detail="Detection service unavailable")

    poster = ""
    detail = None
    title = (result.get("title") or "").strip()
    rtype = (result.get("type") or "unknown").lower()
    kind_map = {"anime": "anime", "manga": "manga", "book": "books",
                "kdrama": "tv", "thai-bl": "tv", "tv": "tv"}
    kind = kind_map.get(rtype)
    if title and kind:
        try:
            async with httpx.AsyncClient(timeout=6.0) as cli:
                if kind in ("anime", "manga"):
                    r = await cli.get(f"https://api.jikan.moe/v4/{kind}", params={"q": title, "limit": 1})
                    data = (r.json() or {}).get("data") or []
                    if data:
                        d = data[0]
                        poster = ((d.get("images") or {}).get("jpg") or {}).get("image_url") or ""
                        detail = {
                            "external_id": str(d.get("mal_id")),
                            "external_source": f"jikan-{kind}",
                            "total": d.get("episodes") if kind == "anime" else d.get("chapters"),
                        }
                elif kind == "tv":
                    r = await cli.get("https://api.tvmaze.com/search/shows", params={"q": title})
                    arr = r.json() or []
                    if arr:
                        s = arr[0].get("show") or {}
                        img = s.get("image") or {}
                        poster = img.get("original") or img.get("medium") or ""
                        detail = {
                            "external_id": f"tvmaze-{s.get('id')}",
                            "external_source": "tvmaze",
                        }
                elif kind == "books":
                    r = await cli.get("https://openlibrary.org/search.json", params={"q": title, "limit": 1})
                    docs = (r.json() or {}).get("docs") or []
                    if docs:
                        d = docs[0]
                        cover_id = d.get("cover_i")
                        if cover_id:
                            poster = f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg"
                        detail = {
                            "external_id": d.get("key", ""),
                            "external_source": "openlibrary",
                        }
        except Exception:
            pass

    result["cover_url"] = poster
    if detail:
        result.update(detail)
    return result


# ---------- Register router + CORS ----------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
