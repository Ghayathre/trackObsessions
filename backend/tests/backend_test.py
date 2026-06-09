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
    # ensure auto_accept off so scan creates a pending suggestion (old flow)
    requests.patch(f"{API}/auth/settings", headers=admin_headers, json={"auto_accept": False})
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
    # restore auto_accept
    requests.patch(f"{API}/auth/settings", headers=admin_headers, json={"auto_accept": True})


# ---------- Theme ----------
def test_patch_theme(admin_headers):
    r = requests.patch(f"{API}/auth/theme", headers=admin_headers, json={"theme": "sakura-noir"})
    assert r.status_code == 200 and r.json()["theme"] == "sakura-noir"
    me = requests.get(f"{API}/auth/me", headers=admin_headers).json()
    assert me["theme"] == "sakura-noir"
    # restore
    requests.patch(f"{API}/auth/theme", headers=admin_headers, json={"theme": "tokyo-twilight"})


# ---------- NEW FEATURES: Settings, Public profile, Auto-accept ----------

@pytest.fixture(scope="session")
def reset_admin_settings(admin_headers):
    """Ensure admin starts with profile_public=True and auto_accept=True (per request),
    and restore after tests."""
    # snapshot
    me = requests.get(f"{API}/auth/me", headers=admin_headers).json()
    yield
    # restore
    requests.patch(f"{API}/auth/settings", headers=admin_headers, json={
        "profile_public": me.get("profile_public", True),
        "auto_accept": me.get("auto_accept", True),
    })


def test_patch_settings_updates_fields(admin_headers):
    r = requests.patch(f"{API}/auth/settings", headers=admin_headers,
                       json={"profile_public": True, "auto_accept": True, "name": "Admin"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["profile_public"] is True
    assert body["auto_accept"] is True
    assert body["name"] == "Admin"
    assert "username" in body and body["username"]

    me = requests.get(f"{API}/auth/me", headers=admin_headers).json()
    assert me["profile_public"] is True
    assert me["auto_accept"] is True


def test_patch_settings_username_taken_returns_400(admin_headers):
    # create another user and try to take their username from admin
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    rr = requests.post(f"{API}/auth/register", json={"email": email, "password": "secret123", "name": "Conflict User"})
    assert rr.status_code == 200
    other_username = rr.json()["user"]["username"]
    assert other_username

    r = requests.patch(f"{API}/auth/settings", headers=admin_headers,
                       json={"username": other_username})
    assert r.status_code == 400, r.text
    assert "taken" in r.json().get("detail", "").lower()


def test_register_two_users_same_name_unique_usernames():
    name = f"DupName{uuid.uuid4().hex[:4]}"
    e1 = f"test_{uuid.uuid4().hex[:8]}@example.com"
    e2 = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r1 = requests.post(f"{API}/auth/register", json={"email": e1, "password": "secret123", "name": name})
    r2 = requests.post(f"{API}/auth/register", json={"email": e2, "password": "secret123", "name": name})
    assert r1.status_code == 200 and r2.status_code == 200
    u1 = r1.json()["user"]["username"]
    u2 = r2.json()["user"]["username"]
    assert u1 and u2 and u1 != u2


def test_public_profile_404_when_private(admin_headers):
    # Set private then GET public should 404
    requests.patch(f"{API}/auth/settings", headers=admin_headers, json={"profile_public": False})
    me = requests.get(f"{API}/auth/me", headers=admin_headers).json()
    username = me["username"]
    r = requests.get(f"{API}/public/u/{username}")
    assert r.status_code == 404
    # restore
    requests.patch(f"{API}/auth/settings", headers=admin_headers, json={"profile_public": True})


def test_public_profile_returns_data_when_public(admin_headers):
    requests.patch(f"{API}/auth/settings", headers=admin_headers, json={"profile_public": True})
    me = requests.get(f"{API}/auth/me", headers=admin_headers).json()
    username = me["username"]

    r = requests.get(f"{API}/public/u/{username}")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "user" in data and "categories" in data and "total" in data
    assert data["user"]["username"] == username
    assert isinstance(data["categories"], list)
    assert isinstance(data["total"], int)


def test_public_titles_strips_notes(admin_headers):
    requests.patch(f"{API}/auth/settings", headers=admin_headers, json={"profile_public": True})
    me = requests.get(f"{API}/auth/me", headers=admin_headers).json()
    username = me["username"]
    cats = requests.get(f"{API}/categories", headers=admin_headers).json()
    kd = next(c for c in cats if c["slug"] == "kdramas")
    # add a title with notes
    tt = requests.post(f"{API}/titles", headers=admin_headers, json={
        "title": f"TEST_Public_{uuid.uuid4().hex[:5]}", "category_id": kd["id"],
        "notes": "PRIVATE_NOTE_SECRET",
    })
    assert tt.status_code == 200
    tid = tt.json()["id"]

    r = requests.get(f"{API}/public/u/{username}/titles", params={"category_id": kd["id"]})
    assert r.status_code == 200
    items = r.json()
    found = [x for x in items if x["id"] == tid]
    assert found, "newly created title not visible in public titles"
    assert "notes" not in found[0], "notes should be stripped from public titles"

    # cleanup
    requests.delete(f"{API}/titles/{tid}", headers=admin_headers)


def test_extension_scan_auto_accept_creates_title_directly(admin_headers):
    # enable auto_accept on admin
    requests.patch(f"{API}/auth/settings", headers=admin_headers, json={"auto_accept": True})

    # create an API key
    rk = requests.post(f"{API}/api-keys", headers=admin_headers, json={"label": "TEST_auto"})
    assert rk.status_code == 200
    raw = rk.json()["key"]; key_id = rk.json()["id"]

    unique_title = f"Itaewon Class {uuid.uuid4().hex[:5]}"
    s = requests.post(f"{API}/extension/scan", headers={"X-API-Key": raw}, json={
        "title": unique_title, "category_hint": "kdrama", "season": 1, "episode": 1,
    })
    assert s.status_code == 200, s.text
    body = s.json()
    assert body.get("auto_accepted") is True
    assert body.get("title_id")
    title_id = body["title_id"]

    # title should appear in kdramas
    cats = requests.get(f"{API}/categories", headers=admin_headers).json()
    kd = next(c for c in cats if c["slug"] == "kdramas")
    titles = requests.get(f"{API}/titles?category_id={kd['id']}", headers=admin_headers).json()
    assert any(t["id"] == title_id and t["title"] == unique_title for t in titles)

    # pending suggestions should NOT include this title
    pend = requests.get(f"{API}/suggestions?status=pending", headers=admin_headers).json()
    assert not any(p.get("title") == unique_title for p in pend), "auto-accepted scan should not appear in pending"

    # cleanup
    requests.delete(f"{API}/titles/{title_id}", headers=admin_headers)
    requests.delete(f"{API}/api-keys/{key_id}", headers=admin_headers)


def test_extension_scan_without_auto_accept_creates_only_pending(admin_headers):
    # disable auto_accept
    requests.patch(f"{API}/auth/settings", headers=admin_headers, json={"auto_accept": False})
    rk = requests.post(f"{API}/api-keys", headers=admin_headers, json={"label": "TEST_no_auto"})
    raw = rk.json()["key"]; key_id = rk.json()["id"]

    unique_title = f"TEST_NoAuto_{uuid.uuid4().hex[:5]}"
    s = requests.post(f"{API}/extension/scan", headers={"X-API-Key": raw}, json={
        "title": unique_title, "category_hint": "kdrama", "season": 1, "episode": 1,
    })
    assert s.status_code == 200
    body = s.json()
    assert not body.get("auto_accepted"), "should not be auto-accepted when flag off"
    sug_id = body["suggestion_id"]

    # should be in pending
    pend = requests.get(f"{API}/suggestions?status=pending", headers=admin_headers).json()
    assert any(p["id"] == sug_id for p in pend)

    # no title should exist with that name
    cats = requests.get(f"{API}/categories", headers=admin_headers).json()
    kd = next(c for c in cats if c["slug"] == "kdramas")
    titles = requests.get(f"{API}/titles?category_id={kd['id']}", headers=admin_headers).json()
    assert not any(t["title"] == unique_title for t in titles)

    # cleanup: reject suggestion + revoke key + re-enable auto_accept
    requests.post(f"{API}/suggestions/{sug_id}/act", headers=admin_headers, json={"action": "reject"})
    requests.delete(f"{API}/api-keys/{key_id}", headers=admin_headers)
    requests.patch(f"{API}/auth/settings", headers=admin_headers, json={"auto_accept": True})



# ---------- NEW FEATURES (iteration 3): Activity log + Hours stats ----------

def _register_fresh_user():
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": "secret123", "name": "Activity Tester"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["user"]["id"]


def test_stats_returns_hours_and_by_category_shape(admin_headers):
    r = requests.get(f"{API}/stats", headers=admin_headers)
    assert r.status_code == 200, r.text
    s = r.json()
    for k in ("hours", "minutes", "by_category"):
        assert k in s, f"missing {k}"
    assert isinstance(s["by_category"], list)
    assert isinstance(s["hours"], (int, float))
    assert isinstance(s["minutes"], int)
    assert abs(s["hours"] - round(s["minutes"] / 60, 1)) < 1e-6
    for row in s["by_category"]:
        for k in ("id", "slug", "name", "kind", "count", "minutes", "hours"):
            assert k in row, f"missing {k} in by_category row"


def test_kdrama_two_episodes_yield_120_minutes_2_hours():
    headers, _ = _register_fresh_user()
    cats = requests.get(f"{API}/categories", headers=headers).json()
    kd = next(c for c in cats if c["slug"] == "kdramas")
    tr = requests.post(f"{API}/titles", headers=headers, json={
        "title": "TEST_HoursDrama", "category_id": kd["id"], "status": "watching", "progress": 2,
    })
    assert tr.status_code == 200, tr.text

    s = requests.get(f"{API}/stats", headers=headers).json()
    kd_row = next(c for c in s["by_category"] if c["slug"] == "kdramas")
    assert kd_row["minutes"] == 120, f"expected 120, got {kd_row}"
    assert kd_row["hours"] == 2.0, f"expected 2.0h, got {kd_row['hours']}"
    assert s["minutes"] >= 120
    assert s["hours"] >= 2.0


def test_activity_requires_auth():
    r = requests.get(f"{API}/activity")
    assert r.status_code == 401


def test_activity_logs_lifecycle_events_and_limit_capping():
    headers, _ = _register_fresh_user()
    cats = requests.get(f"{API}/categories", headers=headers).json()
    kd = next(c for c in cats if c["slug"] == "kdramas")

    title_name = f"TEST_Lifecycle_{uuid.uuid4().hex[:5]}"
    tr = requests.post(f"{API}/titles", headers=headers, json={
        "title": title_name, "category_id": kd["id"], "status": "watching", "progress": 1,
    })
    tid = tr.json()["id"]
    requests.patch(f"{API}/titles/{tid}", headers=headers, json={"progress": 5})
    requests.patch(f"{API}/titles/{tid}", headers=headers, json={"status": "on_hold"})
    requests.patch(f"{API}/titles/{tid}", headers=headers, json={"status": "completed"})
    requests.delete(f"{API}/titles/{tid}", headers=headers)

    time.sleep(0.3)
    r = requests.get(f"{API}/activity", headers=headers, params={"limit": 50})
    assert r.status_code == 200
    items = r.json()
    types = [a["type"] for a in items if a.get("title") == title_name]
    for expected in ("add", "progress", "status", "complete", "remove"):
        assert expected in types, f"missing '{expected}' in {types}"

    prog = next(a for a in items if a.get("title") == title_name and a["type"] == "progress")
    assert prog["extra"]["from"] == 1 and prog["extra"]["to"] == 5
    comp = next(a for a in items if a.get("title") == title_name and a["type"] == "complete")
    assert comp["extra"]["to"] == "completed"

    r2 = requests.get(f"{API}/activity", headers=headers, params={"limit": 2}).json()
    assert len(r2) <= 2

    r3 = requests.get(f"{API}/activity", headers=headers, params={"limit": 9999})
    assert r3.status_code == 200
    assert len(r3.json()) <= 200


def test_activity_logged_for_suggestion_accept_and_auto_accept():
    headers, _ = _register_fresh_user()

    requests.patch(f"{API}/auth/settings", headers=headers, json={"auto_accept": False})
    rk = requests.post(f"{API}/api-keys", headers=headers, json={"label": "TEST_act_key"})
    raw = rk.json()["key"]

    sug_title = f"TEST_SugAccept_{uuid.uuid4().hex[:5]}"
    s = requests.post(f"{API}/extension/scan", headers={"X-API-Key": raw},
                      json={"title": sug_title, "category_hint": "kdrama", "episode": 1})
    sug_id = s.json()["suggestion_id"]
    a = requests.post(f"{API}/suggestions/{sug_id}/act", headers=headers, json={"action": "accept"})
    assert a.status_code == 200

    time.sleep(0.3)
    items = requests.get(f"{API}/activity", headers=headers).json()
    accepted = [x for x in items if x.get("title") == sug_title and x["type"] == "extension_add"]
    assert accepted, "manual accept should log extension_add"
    assert accepted[0]["extra"].get("auto") is not True

    requests.patch(f"{API}/auth/settings", headers=headers, json={"auto_accept": True})
    auto_title = f"TEST_AutoAccept_{uuid.uuid4().hex[:5]}"
    s2 = requests.post(f"{API}/extension/scan", headers={"X-API-Key": raw},
                       json={"title": auto_title, "category_hint": "anime", "episode": 1})
    assert s2.json().get("auto_accepted") is True

    time.sleep(0.3)
    items2 = requests.get(f"{API}/activity", headers=headers).json()
    auto = [x for x in items2 if x.get("title") == auto_title and x["type"] == "extension_add"]
    assert auto, "auto-accept should log extension_add"
    assert auto[0]["extra"].get("auto") is True



# ---------- NEW FEATURES (iteration 4): Google OAuth session, AniList import, per-collection share ----------

# --- Google OAuth: unhappy paths only (no real OAuth flow) ---
def test_google_session_missing_session_id_returns_400():
    r = requests.post(f"{API}/auth/google/session", json={})
    assert r.status_code == 400, r.text
    assert "session_id" in r.json().get("detail", "").lower()


def test_google_session_invalid_session_id_returns_401():
    r = requests.post(f"{API}/auth/google/session", json={"session_id": "bogus-invalid-session-xyz"})
    # Emergent's session-data endpoint should reject the bogus id with non-200, which we map to 401.
    # 502 is acceptable only if Emergent infra is unreachable.
    assert r.status_code in (401, 502), r.text
    if r.status_code == 401:
        assert "google" in r.json().get("detail", "").lower() or "invalid" in r.json().get("detail", "").lower()


# --- Public per-collection (category_slug) on the existing public profile route ---
def test_public_titles_filter_by_category_slug(admin_headers):
    # Ensure admin profile is public
    requests.patch(f"{API}/auth/settings", headers=admin_headers, json={"profile_public": True})
    me = requests.get(f"{API}/auth/me", headers=admin_headers).json()
    username = me["username"]

    cats = requests.get(f"{API}/categories", headers=admin_headers).json()
    kd = next(c for c in cats if c["slug"] == "kdramas")
    anime = next(c for c in cats if c["slug"] == "anime")

    # Seed one title in each category
    t_kd = requests.post(f"{API}/titles", headers=admin_headers, json={
        "title": f"TEST_PCS_KD_{uuid.uuid4().hex[:5]}", "category_id": kd["id"], "status": "watching",
    }).json()
    t_an = requests.post(f"{API}/titles", headers=admin_headers, json={
        "title": f"TEST_PCS_AN_{uuid.uuid4().hex[:5]}", "category_id": anime["id"], "status": "watching",
    }).json()

    try:
        r = requests.get(f"{API}/public/u/{username}/titles", params={"category_slug": "kdramas"})
        assert r.status_code == 200, r.text
        items = r.json()
        # every returned title must belong to the kdramas category
        assert all(t["category_id"] == kd["id"] for t in items), "category_slug filter did not scope correctly"
        assert any(t["id"] == t_kd["id"] for t in items)
        assert not any(t["id"] == t_an["id"] for t in items), "anime title leaked into kdramas filter"

        # nonexistent slug → 404
        r404 = requests.get(f"{API}/public/u/{username}/titles", params={"category_slug": "nonexistent-cat"})
        assert r404.status_code == 404

        # category_id still works (regression)
        rid = requests.get(f"{API}/public/u/{username}/titles", params={"category_id": kd["id"]})
        assert rid.status_code == 200
        assert all(t["category_id"] == kd["id"] for t in rid.json())
    finally:
        requests.delete(f"{API}/titles/{t_kd['id']}", headers=admin_headers)
        requests.delete(f"{API}/titles/{t_an['id']}", headers=admin_headers)


def test_public_titles_with_category_slug_unrelated_public_user():
    # Create a second user, make profile public, add titles, query by slug.
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    rr = requests.post(f"{API}/auth/register", json={"email": email, "password": "secret123", "name": "Pub Tester"})
    assert rr.status_code == 200, rr.text
    tok = rr.json()["token"]
    username = rr.json()["user"]["username"]
    H = {"Authorization": f"Bearer {tok}"}
    requests.patch(f"{API}/auth/settings", headers=H, json={"profile_public": True})

    cats = requests.get(f"{API}/categories", headers=H).json()
    manga = next(c for c in cats if c["slug"] == "manga")
    t = requests.post(f"{API}/titles", headers=H, json={
        "title": f"TEST_OtherUser_{uuid.uuid4().hex[:5]}", "category_id": manga["id"], "status": "watching",
    }).json()

    r = requests.get(f"{API}/public/u/{username}/titles", params={"category_slug": "manga"})
    assert r.status_code == 200, r.text
    items = r.json()
    assert any(x["id"] == t["id"] for x in items)
    assert all(x["category_id"] == manga["id"] for x in items)


# --- AniList import: validation + 404 + dedup ---
def test_anilist_import_validates_required_fields(admin_headers):
    cats = requests.get(f"{API}/categories", headers=admin_headers).json()
    manga_cat = next(c for c in cats if c["slug"] == "manga")

    # missing username
    r = requests.post(f"{API}/import/anilist", headers=admin_headers,
                      json={"type": "MANGA", "category_id": manga_cat["id"]})
    assert r.status_code == 400, r.text

    # bad type
    r = requests.post(f"{API}/import/anilist", headers=admin_headers,
                      json={"username": "Hanabi", "type": "BOOKS", "category_id": manga_cat["id"]})
    assert r.status_code == 400

    # missing category
    r = requests.post(f"{API}/import/anilist", headers=admin_headers,
                      json={"username": "Hanabi", "type": "MANGA"})
    assert r.status_code == 400

    # category not owned by user → 404
    r = requests.post(f"{API}/import/anilist", headers=admin_headers,
                      json={"username": "Hanabi", "type": "MANGA",
                            "category_id": "ffffffffffffffffffffffff"})
    assert r.status_code in (400, 404)


def test_anilist_import_nonexistent_user_returns_404(admin_headers):
    cats = requests.get(f"{API}/categories", headers=admin_headers).json()
    manga_cat = next(c for c in cats if c["slug"] == "manga")
    bogus = f"hanabi_no_such_user_{uuid.uuid4().hex[:10]}"
    r = requests.post(f"{API}/import/anilist", headers=admin_headers,
                      json={"username": bogus, "type": "MANGA", "category_id": manga_cat["id"]})
    # 404 expected; 502 acceptable if AniList is unreachable
    assert r.status_code in (404, 502), r.text


def test_anilist_import_manga_and_dedup(admin_headers):
    """Import twice and assert second run imports 0 (dedup by external_id)."""
    # Use a fresh user + fresh category to keep this isolated and deterministic.
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    rr = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": "secret123", "name": "AniList Tester"})
    assert rr.status_code == 200
    H = {"Authorization": f"Bearer {rr.json()['token']}"}

    cats = requests.get(f"{API}/categories", headers=H).json()
    manga_cat = next(c for c in cats if c["slug"] == "manga")

    # Try a well-known public AniList user; if AniList unreachable / empty, soft-pass.
    target_username = "Josh"  # fallback known public list; small/stable
    r1 = requests.post(f"{API}/import/anilist", headers=H,
                       json={"username": target_username, "type": "MANGA", "category_id": manga_cat["id"]})

    if r1.status_code == 502:
        pytest.skip("AniList unreachable in this environment (502)")
    if r1.status_code == 404:
        # try another well-known username
        target_username = "Hanabi"
        r1 = requests.post(f"{API}/import/anilist", headers=H,
                           json={"username": target_username, "type": "MANGA", "category_id": manga_cat["id"]})
        if r1.status_code in (404, 502):
            pytest.skip(f"AniList username unreachable for both fallbacks (status {r1.status_code})")

    assert r1.status_code == 200, r1.text
    body1 = r1.json()
    assert "imported" in body1 and "skipped" in body1 and body1["category_id"] == manga_cat["id"]

    # Verify any imported titles are in the manga category and have source='anilist'
    titles = requests.get(f"{API}/titles?category_id={manga_cat['id']}", headers=H).json()
    if body1["imported"] > 0:
        assert all(t["category_id"] == manga_cat["id"] for t in titles)
        # at least one should be source=anilist
        assert any(t.get("source") == "anilist" for t in titles), "expected source='anilist' on imported titles"

    # Second run: dedup → 0 imported
    r2 = requests.post(f"{API}/import/anilist", headers=H,
                       json={"username": target_username, "type": "MANGA", "category_id": manga_cat["id"]})
    assert r2.status_code == 200, r2.text
    body2 = r2.json()
    if body1["imported"] > 0:
        assert body2["imported"] == 0, f"dedup failed: 2nd run imported {body2['imported']} (1st: {body1['imported']})"
    else:
        # If user had 0 entries, both runs should be 0
        assert body2["imported"] == 0
