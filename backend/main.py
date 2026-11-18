"""Bloomy(꽃피다) 웹 서버 — 표준 라이브러리만 사용.

- `dispatch(method, path, headers, body)`가 모든 라우팅·업로드 로직을 갖고,
  HTTP 핸들러는 그 결과를 바이트로 넘기는 얇은 껍질 역할만 한다.
  (스케줄러/스모크 테스트는 소켓 없이 dispatch를 직접 호출한다.)
- Bearer 토큰 인증 (auth.check_token), 모든 자식 관련 API는 계정 소유 여부 검사
- /api/... 는 JSON API, 그 외 GET은 루트 정적 파일 (SPA 폴백: index.html)

API 스펙: 04-API-스펙.md (F·A·Q가 의존하는 계약 문서)

실행: python3 backend/main.py [--port 8787]
"""
import argparse
import datetime as dt
import hmac
import json
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import auth  # noqa: E402
import branch  # noqa: E402
import catalog  # noqa: E402
import coach  # noqa: E402
import diagnosis  # noqa: E402
import scheduler  # noqa: E402
import store  # noqa: E402

# 정적 파일 위치: 로컬에서는 루트(frontend 파일을 루트에 둬 Vercel 정적 서빙과 동일).
# 과거 frontend/ 디렉터리가 있으면 그걸로도 fallback.
_FRONT = os.path.normpath(os.path.join(HERE, ".."))
_FE = os.path.normpath(os.path.join(HERE, "..", "frontend"))
FRONTEND_DIR = _FE if os.path.isfile(os.path.join(_FE, "index.html")) else _FRONT

JSON = "application/json; charset=utf-8"
STATIC_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
}

COMPLETIONS = ("full", "partial", "none")  # 잘 따라옴 / 일부 / 못 함
SESSION_LENGTHS = (10, 15, 20)
EXPOSURES = ("none", "some", "much")
DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")
MONTH_RE = re.compile(r"\d{4}-\d{2}")


# ---------------------------------------------------------------------------
# 공통 헬퍼
# ---------------------------------------------------------------------------

def _qint(q, key):
    try:
        return int(q.get(key, [None])[0])
    except (TypeError, ValueError):
        return None


def _qint_1to5(v):
    try:
        iv = int(v)
    except (TypeError, ValueError):
        return None
    return iv if 1 <= iv <= 5 else None


def _email_ok(email):
    return isinstance(email, str) and re.fullmatch(
        r"[^@\s]+@[^@\s]+\.[^@\s]+", email.strip()
    )


def _account_from(headers):
    h = headers.get("Authorization") or ""
    if not h.startswith("Bearer "):
        return None
    user_id = auth.check_token(h[7:].strip())
    if not user_id:
        return None
    return store.get_user(user_id)


def _own_child(headers, child_id):
    """(account, child) 성공 / (None, None, code, msg) 실패"""
    acc = _account_from(headers)
    if not acc:
        return None, None, 401, "로그인이 필요합니다"
    child = store.get_child(child_id)
    if not child or child["user_id"] != acc["id"]:
        return None, None, 404, "존재하지 않는 대상입니다"
    return acc, child, None, None


def _plan_rows(plan_id, child_id, cards):
    """cards: generate_plan/수기 days 형식 → DB 업서트 후 (plan, cards)."""
    store.add_cards(
        plan_id, child_id,
        [(c["date"], c["content_id"], c["task"], c["minutes"], c["check_point"])
         for c in cards],
    )
    return store.get_plan(plan_id), store.cards_for_plan(plan_id)


# ---------------------------------------------------------------------------
# 엔드포인트 (dispatch의 실제 로직)
# ---------------------------------------------------------------------------

def ep_health():
    return 200, {"ok": True, "service": "bloomy",
                 "time": dt.datetime.now().isoformat()}, JSON


def ep_diagnosis_questions():
    """온보딩 5문항 정의 (F UI용)."""
    return 200, {"questions": diagnosis.questions_payload()}, JSON


def ep_catalog(q):
    items = catalog.search(
        age=_qint(q, "age"),
        level=_qint(q, "level"),
        skill=q.get("skill", [None])[0],
        type_=q.get("type", [None])[0],
        keyword=q.get("keyword", [None])[0],
    )
    return 200, items, JSON


def ep_me(headers):
    acc = _account_from(headers)
    if not acc:
        return 401, {"error": "로그인이 필요합니다"}, JSON
    return 200, {
        "account": {"id": acc["id"], "email": acc["email"]},
        "children": [store.child_public(c) for c in store.get_children(acc["id"])],
    }, JSON


def ep_register(body):
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    if not _email_ok(email):
        return 400, {"error": "올바른 이메일을 입력해주세요"}, JSON
    if len(password) < 6:
        return 400, {"error": "비밀번호는 6자 이상이어야 합니다"}, JSON
    if store.get_user_by_email(email):
        return 409, {"error": "이미 가입된 이메일입니다"}, JSON
    salt = auth.new_salt()
    store.create_user(email, auth.hash_password(password, salt), salt)
    acc = store.get_user_by_email(email)
    return 201, {
        "token": auth.make_token(acc["id"]),
        "account": {"id": acc["id"], "email": acc["email"]},
        "children": [],
    }, JSON


def ep_login(body):
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    acc = store.get_user_by_email(email)
    if not acc:
        return 401, {"error": "이메일 또는 비밀번호가 올바르지 않습니다"}, JSON
    digest = auth.hash_password(password, acc["salt"])
    if not hmac.compare_digest(digest, acc["password_hash"]):
        return 401, {"error": "이메일 또는 비밀번호가 올바르지 않습니다"}, JSON
    return 200, {
        "token": auth.make_token(acc["id"]),
        "account": {"id": acc["id"], "email": acc["email"]},
        "children": [store.child_public(c) for c in store.get_children(acc["id"])],
    }, JSON


def ep_create_child(headers, body):
    """온보딩 (5.1): 프로필 + 5문항 진단 → 계획 초안(draft).

    승인을 거쳐야 카드가 활성화된다 (6.1 승인 게이트)."""
    acc = _account_from(headers)
    if not acc:
        return 401, {"error": "로그인이 필요합니다"}, JSON
    name = str(body.get("name") or "").strip()[:20]
    try:
        age = int(body.get("age"))
    except (TypeError, ValueError):
        return 400, {"error": "올바른 나이를 입력해주세요 (만 4~7세)"}, JSON
    if not (4 <= age <= 7):
        return 400, {"error": "나이는 만 4~7세여야 합니다"}, JSON
    try:
        birth_year = int(body.get("birth_year")) if body.get("birth_year") else None
    except (TypeError, ValueError):
        return 400, {"error": "올바른 출생 연도를 입력해주세요"}, JSON
    ek = 1 if body.get("ek_kindergarten") in (1, True, "1", "true") else 0
    exposure = body.get("exposure") or "none"
    if exposure not in EXPOSURES:
        return 400, {"error": "올바르지 않은 영어 노출 정도입니다"}, JSON
    session_length = body.get("session_length", 10)
    if session_length not in SESSION_LENGTHS:
        return 400, {"error": "하루 학습 시간은 10/15/20분 중 하나여야 합니다"}, JSON
    answers = body.get("diagnosis")
    try:
        diag = diagnosis.diagnose(answers, exposure)
    except ValueError as exc:
        return 400, {"error": "5문항 진단이 올바르지 않습니다 (%s)" % exc}, JSON
    materials = str(body.get("materials") or "").strip()[:200]
    favorite_topics = str(body.get("favorite_topics") or "").strip()[:200]

    child_id = store.create_child(
        acc["id"], name, age, birth_year, ek, exposure, materials,
        favorite_topics, session_length, json.dumps(diag, ensure_ascii=False),
        diag["level"],
    )
    child = store.get_child(child_id)
    plan_data = catalog.generate_plan(child, dt.date.today())
    plan_id = store.create_plan(
        child_id, plan_data["cards"][0]["date"], "onboarding_rule",
        plan_data["base_level"], plan_data["explanation"], status="draft",
    )
    plan, cards = _plan_rows(plan_id, child_id, plan_data["cards"])
    store.add_notification(
        acc["id"],
        "환영합니다 · %s" % (name or "우리 아이"),
        "4주 학습 계획 초안을 준비했어요. 확인 후 승인해 주시면 첫 학습일부터 "
        "카드가 도착해요.\n\n시작 단계는 5문항 진단 기반의 가정(hypothesis)이고, "
        "2주간의 실제 반응 데이터로 조정돼요. 🌱",
        kind="welcome",
    )
    return 201, {
        "child": store.child_public(child),
        "diagnosis": diag,
        "plan": plan,
        "cards": cards,
    }, JSON


def ep_create_plan(headers, child, body):
    """A의 RAG 추천 계획 업로드용 (6.2) — 같은 cards 형식으로 draft 생성.

    content_id는 **카탈로그에 있는 항목만** 허용한다 (6.6 근거 없는 추천 금지)."""
    days = body.get("days")
    if not isinstance(days, list) or not days:
        return 400, {"error": "days(학습일 카드 목록)가 필요합니다"}, JSON
    cards = []
    for i, d in enumerate(days):
        date = str(d.get("date") or "")
        if not DATE_RE.fullmatch(date):
            return 400, {"error": "days[%d].date 형식이 올바르지 않습니다" % i}, JSON
        item = catalog.find_item(d.get("content_id"))
        if item is None:
            return 400, {"error": "days[%d].content_id는 카탈로그에 없습니다 (6.6)" % i}, JSON
        task, check = catalog.card_text(item)
        minutes = d.get("minutes") or min(
            int(item.get("session_minutes") or 10), int(child.get("session_length") or 10))
        try:
            minutes = int(minutes)
        except (TypeError, ValueError):
            return 400, {"error": "days[%d].minutes가 올바르지 않습니다" % i}, JSON
        cards.append({
            "date": date,
            "content_id": item["id"],
            "task": str(d.get("task") or task),
            "minutes": max(5, minutes),
            "check_point": str(d.get("check_point") or check),
        })
    # 기존 draft는 superseded 처리 (동시 draft 1개)
    store.execute(
        "UPDATE plans SET status='superseded' WHERE child_id=? AND status='draft'",
        (child["id"],),
    )
    try:
        base_level = int(body.get("base_level") or child.get("level") or 1)
    except (TypeError, ValueError):
        base_level = int(child.get("level") or 1)
    plan_id = store.create_plan(
        child["id"], cards[0]["date"], "rag_onboarding", base_level,
        str(body.get("explanation") or ""), status="draft",
    )
    plan, plan_cards = _plan_rows(plan_id, child["id"], cards)
    return 201, {"plan": plan, "cards": plan_cards}, JSON


def ep_approve_plan(headers, child, plan_id):
    plan = store.get_plan(plan_id)
    if not plan or plan["child_id"] != child["id"]:
        return 404, {"error": "존재하지 않는 계획입니다"}, JSON
    if plan["status"] != "draft":
        return 409, {"error": "승인할 수 없는 상태의 계획입니다 (%s)" % plan["status"]}, JSON
    p = store.approve_plan(plan_id)
    if not p:
        return 409, {"error": "승인에 실패했습니다"}, JSON
    cards = store.cards_for_plan(plan_id)
    acc = store.get_user_by_child(child["id"])
    if acc:
        store.add_notification(
            acc["id"],
            "계획 승인 · %s" % (child.get("name") or "우리 아이"),
            "계획이 승인되어 카드가 활성화되었어요. 매 학습일 아침에 도착해요.",
            kind="plan",
        )
    return 200, {"plan": p, "cards": cards}, JSON


def ep_replan(headers, child):
    """규칙 기반 새 계획 초안. 기존 approved는 done 처리."""
    old = store.approved_plan(child["id"])
    if old:
        store.finish_plan(old["id"], "done")
    child = store.get_child(child["id"])
    plan_data = catalog.generate_plan(child, dt.date.today())
    plan_id = store.create_plan(
        child["id"], plan_data["cards"][0]["date"], "onboarding_rule",
        plan_data["base_level"], plan_data["explanation"], status="draft",
    )
    plan, cards = _plan_rows(plan_id, child["id"], plan_data["cards"])
    acc = store.get_user_by_child(child["id"])
    if acc:
        store.add_notification(
            acc["id"],
            "새 계획 · %s" % (child.get("name") or "우리 아이"),
            "새 4주 계획 초안을 만들었어요. 확인 후 승인해 주세요.",
            kind="plan",
        )
    return 200, {"plan": plan, "cards": cards}, JSON


def ep_plan(child):
    plan = store.approved_plan(child["id"]) or store.latest_plan(child["id"])
    if not plan:
        return 404, {"error": "계획이 없습니다"}, JSON
    return 200, {"plan": plan, "cards": store.cards_for_plan(plan["id"])}, JSON


def ep_today(child):
    today = dt.date.today().isoformat()
    plan = store.approved_plan(child["id"])
    cards = store.cards_for_plan(plan["id"]) if plan else []
    day = next((c for c in cards if c["date"] == today), None)
    draft = None
    if not plan:
        lp = store.latest_plan(child["id"])
        if lp and lp["status"] == "draft":
            draft = lp
    return 200, {
        "date": today,
        "plan": plan,
        "draft_plan": draft,
        "card": day,
        "record": store.get_feedback(child["id"], today),
        "message": store.latest_message(child["id"]),
    }, JSON


def ep_report(child, q):
    week_start = (q.get("week_start", [None])[0] or "").strip()
    if week_start and not DATE_RE.fullmatch(week_start):
        return 400, {"error": "week_start 형식이 올바르지 않습니다 (YYYY-MM-DD)"}, JSON
    return 200, coach.weekly_report(child, week_start or None), JSON


def ep_achievement(child, q):
    month = (q.get("month", [None])[0] or "").strip()
    if month and not MONTH_RE.fullmatch(month):
        return 400, {"error": "month 형식이 올바르지 않습니다 (YYYY-MM)"}, JSON
    return 200, coach.monthly_achievement(child, month or None), JSON


def ep_stats(child):
    return 200, coach.stats_payload(child), JSON


def ep_learning_recommendation(headers, body):
    """학습 화면의 익명 요약만 받는 계정 인증 추천 API."""
    account = _account_from(headers)
    if not account:
        return 401, {"error": "로그인이 필요합니다"}, JSON
    try:
        result = coach.learning_recommendation(body)
    except ValueError as exc:
        return 400, {"error": str(exc)}, JSON
    if not coach._llm_available():
        return 503, {"error": "AI 코치가 설정되지 않았습니다"}, JSON
    if not result:
        return 502, {"error": "AI 응답을 확인하지 못했습니다"}, JSON
    return 200, result, JSON


def ep_feedback(headers, child, body):
    """1분 피드백 (5.3) → 3단계 코치 (6.3) → 조정·메시지.

    rest_day=true면 분기 건너뜀(SKIP): 메시지 미생성, 성취 분모 제외 (5.4)."""
    today = dt.date.today().isoformat()
    date = str(body.get("date") or today)
    if not DATE_RE.fullmatch(date):
        return 400, {"error": "날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)"}, JSON
    if date > today:
        return 400, {"error": "미래 날짜에는 기록할 수 없습니다"}, JSON
    if store.get_feedback(child["id"], date):
        return 409, {"error": "해당 날짜에는 이미 기록이 있습니다"}, JSON

    rest = bool(body.get("rest_day"))
    memo = str(body.get("memo") or "").strip()[:500]
    if rest:
        completion, satisfaction, interest, comprehension = "", 0, 0, 0
    else:
        if body.get("completion") not in COMPLETIONS:
            return 400, {"error": "완료도는 full/partial/none 여야 합니다"}, JSON
        satisfaction = _qint_1to5(body.get("satisfaction"))
        interest = _qint_1to5(body.get("interest"))
        comprehension = _qint_1to5(body.get("comprehension"))
        if satisfaction is None or interest is None or comprehension is None:
            return 400, {"error": "만족도·흥미·이해도는 1~5점이어야 합니다"}, JSON
        completion = body["completion"]

    card = store.get_card_for_child(child["id"], date)
    card_id = card["id"] if card else None

    # 1단계: 메모 의도 분류 (6.3 — 별도 스키마-제약 호출)
    if rest:
        intent, intent_reason = "none", "휴식일"
    else:
        intent, intent_reason = coach.classify_memo_intent(memo)

    # 2단계: 분기 판정 (순 규칙 — LLM 불참)
    prev = store.last_feedback_before(child["id"], date)
    decision = branch.decide(
        date=date,
        completion=completion or "full",
        interest=interest or 5,
        comprehension=comprehension or 5,
        intent=intent,
        prev=prev,
        rest_day=rest,
    )

    rec_id = store.add_feedback(
        child["id"], card_id, date, completion, satisfaction or 0,
        interest or 0, comprehension or 0, memo, rest, memo_intent=intent,
    )
    rec = store.get_feedback(child["id"], date)
    item = catalog.find_item(card["content_id"]) if card and card.get("content_id") else None

    adjust = {"type": "none", "reason": "", "dates": []}
    message = None
    if decision["case"] != "SKIP":
        # 조정 → 다음 카드 반영
        tomorrow = store.next_card_for_child(child["id"], date)
        adjust = coach.apply_adjustment(child, rec, decision, tomorrow)
        tomorrow = store.next_card_for_child(child["id"], date)
        # 3단계: 메시지 생성 (규칙 case 우선, 확신 문구 데이터 조건부)
        conf = coach.confidence_ok(child["id"], dt.date.fromisoformat(date))
        decision = dict(decision)
        decision["intent_reason"] = intent_reason
        msg = coach.build_message(child, rec, decision, item, tomorrow, adjust, conf)
        message = msg["message"]
        store.add_coach_message(
            child["id"], rec_id, date, decision["case"], intent, message,
            msg["model"], msg["prompt_version"], msg["is_ai_generated"],
        )
    coach.write_memory(child, rec, decision, item)

    return 201, {
        "record": {
            "id": rec["id"],
            "date": rec["date"],
            "content_id": card["content_id"] if card else None,
            "completion": rec["completion"],
            "satisfaction": rec["satisfaction"],
            "interest": rec["interest"],
            "comprehension": rec["comprehension"],
            "memo": rec["memo"],
            "rest_day": bool(rec["rest_day"]),
            "memo_intent": rec["memo_intent"],
        },
        "case": decision["case"],
        "memo_intent": intent,
        "message": message,
        "adjust": adjust,
        "tomorrow": coach.tomorrow_payload(store.next_card_for_child(child["id"], date)),
    }, JSON


def ep_settings(child, body):
    name = body.get("name")
    session_length = body.get("session_length")
    if name is not None:
        name = str(name).strip()
        if len(name) > 20:
            return 400, {"error": "이름은 20자 이내여야 합니다"}, JSON
    if session_length is not None and session_length not in SESSION_LENGTHS:
        return 400, {"error": "하루 학습 시간은 10/15/20분 중 하나여야 합니다"}, JSON
    store.update_child_settings(child["id"], name=name,
                                session_length=session_length)
    return 200, store.child_public(store.get_child(child["id"])), JSON


def ep_notifications(headers):
    acc = _account_from(headers)
    if not acc:
        return 401, {"error": "로그인이 필요합니다"}, JSON
    items = store.get_notifications(acc["id"])
    return 200, {"items": items, "unread": store.count_unread(acc["id"])}, JSON


def ep_notifications_read(headers):
    acc = _account_from(headers)
    if not acc:
        return 401, {"error": "로그인이 필요합니다"}, JSON
    store.mark_notifications_read(acc["id"])
    return 200, {"ok": True}, JSON


def ep_cron(headers, body):
    """Vercel Cron 대상 엔드포인트. Bearer BLOOMY_CRON_SECRET 검증.

    body: {"job": "daily"|"remind"|"weekly"|"monthly",
            "date": "YYYY-MM-DD"(선택, daily/remind)}
    무료 티어는 크론 1회/일이므로 daily 잡이 리마인더·주간·월간을 내부에서
    조건 분기해 일괄 처리한다 (6.5)."""
    secret = os.environ.get("BLOOMY_CRON_SECRET", "")
    h = headers.get("Authorization") or ""
    if not secret or not h.startswith("Bearer ") or not hmac.compare_digest(
        h[7:].strip(), secret
    ):
        return 401, {"error": "크론 인증 실패"}, JSON
    job = (body or {}).get("job", "daily")
    date = (body or {}).get("date")

    if job == "daily":
        scheduler.run_daily(date=date)
    elif job == "remind":
        scheduler.remind(date=date)
    elif job == "weekly":
        scheduler.weekly(date=date)
    elif job == "monthly":
        scheduler.monthly(date=date)
    else:
        return 400, {"error": "알 수 없는 잡: %s" % job}, JSON
    return 200, {"ok": True, "job": job}, JSON


def serve_static(path):
    if path == "/":
        path = "/index.html"
    rel = path.lstrip("/")
    fp = os.path.normpath(os.path.join(FRONTEND_DIR, rel))
    if not (fp == FRONTEND_DIR or fp.startswith(FRONTEND_DIR + os.sep)):
        return 403, json.dumps({"error": "Forbidden"}).encode("utf-8"), JSON
    if os.path.isfile(fp):
        ctype = STATIC_TYPES.get(
            os.path.splitext(fp)[1].lower(), "application/octet-stream"
        )
        with open(fp, "rb") as f:
            return 200, f.read(), ctype
    # SPA 폴백
    idx = os.path.join(FRONTEND_DIR, "index.html")
    with open(idx, "rb") as f:
        return 200, f.read(), "text/html; charset=utf-8"


# ---------------------------------------------------------------------------
# dispatch — (status, payload, content_type) 반환
# ---------------------------------------------------------------------------

def dispatch(method, path, headers, body):
    """모든 요청을 처리하는 단일 진입점. 소켓 없이 테스트 가능."""
    u = urlparse(path)
    p, q = u.path, parse_qs(u.query)
    try:
        if method == "GET":
            if p == "/api/health":
                return ep_health()
            if p == "/api/diagnosis/questions":
                return ep_diagnosis_questions()
            if p == "/api/catalog":
                return ep_catalog(q)
            if p == "/api/me":
                return ep_me(headers)
            m = re.fullmatch(
                r"/api/children/(\d+)/(today|plan|messages|report|achievement|stats)", p)
            if m:
                child_id_, what = int(m.group(1)), m.group(2)
                _acc, child, err_code, err = _own_child(headers, child_id_)
                if err:
                    return err_code, {"error": err}, JSON
                if what == "today":
                    return ep_today(child)
                if what == "plan":
                    return ep_plan(child)
                if what == "messages":
                    return 200, store.get_messages(child["id"]), JSON
                if what == "report":
                    return ep_report(child, q)
                if what == "achievement":
                    return ep_achievement(child, q)
                if what == "stats":
                    return ep_stats(child)
            if p == "/api/notifications":
                return ep_notifications(headers)
            if p.startswith("/api/"):
                return 404, {"error": "경로를 찾을 수 없습니다"}, JSON
            return serve_static(p)

        if method == "POST":
            if not isinstance(body, dict):
                return 400, {"error": "잘못된 요청 본문입니다"}, JSON
            if p == "/api/register":
                return ep_register(body)
            if p == "/api/login":
                return ep_login(body)
            if p == "/api/children":
                return ep_create_child(headers, body)
            m = re.fullmatch(r"/api/children/(\d+)/plans/(\d+)/approve", p)
            if m:
                child_id_, plan_id_ = int(m.group(1)), int(m.group(2))
                _acc, child, err_code, err = _own_child(headers, child_id_)
                if err:
                    return err_code, {"error": err}, JSON
                return ep_approve_plan(headers, child, plan_id_)
            m = re.fullmatch(r"/api/children/(\d+)/plans", p)
            if m:
                _acc, child, err_code, err = _own_child(headers, int(m.group(1)))
                if err:
                    return err_code, {"error": err}, JSON
                return ep_create_plan(headers, child, body)
            m = re.fullmatch(r"/api/children/(\d+)/(feedback|replan|settings)", p)
            if m:
                child_id_, what = int(m.group(1)), m.group(2)
                _acc, child, err_code, err = _own_child(headers, child_id_)
                if err:
                    return err_code, {"error": err}, JSON
                if what == "feedback":
                    return ep_feedback(headers, child, body)
                if what == "replan":
                    return ep_replan(headers, child)
                if what == "settings":
                    return ep_settings(child, body)
            if p == "/api/notifications/read":
                return ep_notifications_read(headers)
            if p == "/api/learning/recommendation":
                return ep_learning_recommendation(headers, body)
            if p == "/api/cron":
                return ep_cron(headers, body)
            return 404, {"error": "경로가 없습니다"}, JSON
        return 405, {"error": "METHOD NOT ALLOWED"}, JSON
    except Exception as exc:  # noqa: BLE001
        print("[bloomy] %s %s error: %s" % (method, p, exc))
        return 500, {"error": "서버 오류가 발생했습니다"}, JSON


# ---------------------------------------------------------------------------
# HTTP 껍질
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    server_version = "Bloomy/1.0"

    def log_message(self, fmt, *args):
        sys.stderr.write("[bloomy] " + (fmt % args) + "\n")

    def _send(self, code, data, ctype):
        if isinstance(data, str):
            data = data.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _route(self, method):
        body = None
        if method == "POST":
            try:
                n = int(self.headers.get("Content-Length") or 0)
                raw = self.rfile.read(n) if n else b""
                body = json.loads(raw or b"{}")
            except Exception:  # noqa: BLE002
                body = None
        code, payload, ctype = dispatch(method, self.path, self.headers, body)
        if ctype == JSON and isinstance(payload, (dict, list)):
            payload = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._send(code, payload, ctype)

    def do_GET(self):
        self._route("GET")

    def do_POST(self):
        self._route("POST")


def main():
    ap = argparse.ArgumentParser(description="Bloomy(꽃피다) 서버")
    ap.add_argument("--port", type=int, default=int(os.environ.get("BLOOMY_PORT", "8787")))
    ap.add_argument("--host", default=os.environ.get("BLOOMY_HOST", "127.0.0.1"))
    args = ap.parse_args()
    store.init()
    catalog.load()
    scheduler.start()
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    print("🌷 꽃피다(Bloomy) 서버 시작: http://%s:%d" % (args.host, args.port))
    httpd.serve_forever()


if __name__ == "__main__":
    main()
