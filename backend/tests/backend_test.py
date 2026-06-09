"""Hanabi backend API tests"""
import os, uuid, time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://track-obsessions.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@hanabi.app"
ADMIN_PASSWORD = "hanabi123"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Auth & seeding ----------
def test_register_new_user_seeds_categories():
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "secret123", "name": "Tester"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "token" in body and body["user"]["email"] == email
    token = body["token"]
    cats = requests.get(f"{API}/categories", headers={"Authorization": f"Bearer {token}"}).json()
    names = {c["name"] for c in cats}
    for expected in ["K-Dramas", "Thai BLs", "Anime", "Manga", "Books"]:
        assert expected in names, f"missing {expected} in {names}"


def test_login_admin_and_me(admin_headers):
    r = requests.get(f"{API}/auth/me", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN_EMAIL


# ---------- Categories ----------
def test_create_list_delete_category(admin_headers):
    name = f"TEST_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/categories", json={"name": name, "kind": "custom"}, headers=admin_headers)
    assert r.status_code == 200
    cat_id = r.json()["id"]
    lst = requests.get(f"{API}/categories", headers=admin_headers).json()
    assert any(c["id"] == cat_id for c in lst)
    d = requests.delete(f"{API}/categories/{cat_id}", headers=admin_headers)
    assert d.status_code == 200


# ---------- Titles & Stats ----------
def test_title_crud_and_stats(admin_headers):
    cats = requests.get(f"{API}/categories", headers=admin_headers).json()
    kd = next(c for c in cats if c["slug"] == "kdramas")
    r = requests.post(f"{API}/titles", headers=admin_headers, json={
        "title": "TEST_Weak Hero", "category_id": kd["id"], "status": "watching",
        "progress": 1, "season": 1, "cover_url": "https://example.com/x.jpg",
    })
    assert r.status_code == 200, r.text
    tid = r.json()["id"]
    p = requests.patch(f"{API}/titles/{tid}", headers=admin_headers, json={"progress": 5, "status": "watching"})
    assert p.status_code == 200 and p.json()["progress"] == 5

    stats = requests.get(f"{API}/stats", headers=admin_headers).json()
    assert stats["total"] >= 1 and "recent" in stats

    d = requests.delete(f"{API}/titles/{tid}", headers=admin_headers)
    assert d.status_code == 200


# ---------- Metadata ----------
def test_metadata_search(admin_headers):
    r = requests.get(f"{API}/metadata/search", headers=admin_headers, params={"q": "naruto", "kind": "anime"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)  # may be [] if external API unreachable


# ---------- API key + extension + suggestion flow ----------
def test_apikey_extension_suggestion_flow(admin_headers):
    # create key
    r = requests.post(f"{API}/api-keys", headers=admin_headers, json={"label": "TEST_ext"})
    assert r.status_code == 200, r.text
    key_id = r.json()["id"]; raw = r.json()["key"]
    assert raw.startswith("hnb_")

    # ping with key
    p = requests.get(f"{API}/extension/ping", headers={"X-API-Key": raw})
    assert p.status_code == 200 and p.json()["ok"] is True

    # scan creates suggestion
    s = requests.post(f"{API}/extension/scan", headers={"X-API-Key": raw}, json={
        "title": f"TEST_WH_{uuid.uuid4().hex[:5]}", "category_hint": "kdrama", "season": 1, "episode": 2,
    })
    assert s.status_code == 200
    sug_id = s.json()["suggestion_id"]

    # list suggestions
    lst = requests.get(f"{API}/suggestions?status=pending", headers=admin_headers).json()
    assert any(x["id"] == sug_id for x in lst)

    # accept
    a = requests.post(f"{API}/suggestions/{sug_id}/act", headers=admin_headers, json={"action": "accept"})
    assert a.status_code == 200
    new_title_id = a.json()["title_id"]
    # verify title in K-Dramas
    cats = requests.get(f"{API}/categories", headers=admin_headers).json()
    kd = next(c for c in cats if c["slug"] == "kdramas")
    titles = requests.get(f"{API}/titles?category_id={kd['id']}", headers=admin_headers).json()
    assert any(t["id"] == new_title_id for t in titles)
    # cleanup
    requests.delete(f"{API}/titles/{new_title_id}", headers=admin_headers)

    # revoke key
    rv = requests.delete(f"{API}/api-keys/{key_id}", headers=admin_headers)
    assert rv.status_code == 200
    # subsequent ping returns 401
    p2 = requests.get(f"{API}/extension/ping", headers={"X-API-Key": raw})
    assert p2.status_code == 401


# ---------- Theme ----------
def test_patch_theme(admin_headers):
    r = requests.patch(f"{API}/auth/theme", headers=admin_headers, json={"theme": "sakura-noir"})
    assert r.status_code == 200 and r.json()["theme"] == "sakura-noir"
    me = requests.get(f"{API}/auth/me", headers=admin_headers).json()
    assert me["theme"] == "sakura-noir"
    # restore
    requests.patch(f"{API}/auth/theme", headers=admin_headers, json={"theme": "tokyo-twilight"})
