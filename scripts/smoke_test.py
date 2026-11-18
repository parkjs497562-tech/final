"""Bloomy 스모크 테스트 — 01-기획서 v0.5 / 04-API-스펙 기준.

HTTP 소켓 대신 main.dispatch()를 직접 호출해 전 엔드포인트 +
분기 규칙 엔진(5.4: C>B>A, 공백/중복 해소) + 3단계 코치(6.3) +
자동화(6.5)를 검증한다.

실행: ./.venv/bin/python scripts/smoke_test.py
전부 통과하면 exit 0, 하나라도 실패하면 exit 1.

결정성: OPENAI_API_KEY 제거 → 내장 룰베이스 코치 + 키워드 의도 분류기.
"""
import datetime as dt
import json
import os
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
sys.path.insert(0, BACKEND)

TEST_DB = os.path.join(BACKEND, ".smoke_test.db")
os.environ["BLOOMY_DB"] = TEST_DB
os.environ.pop("OPENAI_API_KEY", None)  # 룰베이스 코치로 확정
os.environ.pop("BLOOMY_CRON_SECRET", None)
if os.path.exists(TEST_DB):
    os.remove(TEST_DB)

import catalog  # noqa: E402
import coach  # noqa: E402
import main as bloomy_main  # noqa: E402
import scheduler  # noqa: E402
import store  # noqa: E402

PASS = 0
FAIL = 0
AI_LABEL = "AI가 작성한 코칭 메시지입니다."
DIAG_KEYS = ("alphabet", "phonics", "readers", "response", "focus")


def check(name, cond, extra=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("PASS  %s" % name)
    else:
        FAIL += 1
        print("FAIL  %s  %s" % (name, extra))


def req(method, path, token=None, body=None):
    """(status, parsed_json_or_text) 반환 — dispatch 직접 호출."""
    headers = {}
    if token:
        headers["Authorization"] = "Bearer " + token
    code, payload, ctype = bloomy_main.dispatch(method, path, headers, body)
    if ctype == bloomy_main.JSON:
        if isinstance(payload, (dict, list)):
            return code, payload
        return code, json.loads(payload)
    return code, payload.decode("utf-8", "replace") if isinstance(payload, bytes) else str(payload)


def iso(d):
    return d.isoformat()


def main():
    store.init()
    catalog.load()
    today = dt.date.today()
    suffix = dt.datetime.now().strftime("%H%M%S")

    # 과거 계획 앵커: 최근 월요일(<= 오늘-7). d0..d4 = 월~금 모두 과거,
    # d5 = 그 다음 주 월요일(계획 내, 피드백 없음) — 요일에 무관하게 결정적.
    base = today - dt.timedelta(days=7)
    m = base - dt.timedelta(days=base.weekday())
    d0, d1, d2, d3, d4 = (m + dt.timedelta(days=i) for i in range(5))
    d5 = d4 + dt.timedelta(days=3)  # 금 → 다음 월

    # 1. health / 정적 페이지
    st, d = req("GET", "/api/health")
    check("health", st == 200 and d.get("ok") is True, str(d))
    st, d = req("GET", "/")
    check("frontend /", st == 200 and "<title>Bloomy" in d, "status=%s" % st)
    st, d = req("GET", "/css/style.css")
    check("frontend /css/style.css", st == 200 and "--bg-cream" in d, "status=%s" % st)
    st, d = req("GET", "/js/app.js")
    check("frontend /app.js", st == 200 and "Bloomy" in d, "status=%s" % st)

    # 2. 회원가입 / 로그인
    email1 = "parent%s@test.bloomy" % suffix
    st, d = req("POST", "/api/register",
                body={"email": email1, "password": "secret123"})
    check("register", st == 201 and "token" in d, str(d)[:200])
    token1 = d.get("token")
    st, d = req("POST", "/api/register",
                body={"email": email1, "password": "secret123"})
    check("register duplicate -> 409", st == 409, str(d))
    st, d = req("POST", "/api/login",
                body={"email": email1, "password": "wrongpw!"})
    check("login wrong pw -> 401", st == 401, str(d))
    st, d = req("POST", "/api/login",
                body={"email": email1, "password": "secret123"})
    check("login", st == 200 and "token" in d, str(d)[:200])
    token1 = d.get("token", token1)
    st, d = req("GET", "/api/me", token=token1)
    check("me", st == 200 and d["account"]["email"] == email1, str(d)[:200])
    st, d = req("GET", "/api/me")
    check("me without token -> 401", st == 401)

    # 2.1 authenticated, privacy-filtered learning AI recommendation endpoint
    ai_payload = {
        "profile": {"age": 5, "experience": "가끔 해봤어요", "interests": ["우주"], "studyTime": 10},
        "diagnosis": {
            "q1": "일부 알파벳을 알아요.",
            "q2": "아직 접해본 적 없어요.",
            "q3": "거의 없어요.",
            "q4": "거의 반응하지 않아요.",
            "q5": "아는 표현이 거의 없어요.",
        },
        "stats": {"recentAttemptCount": 3, "recentAccuracy": 2 / 3,
                  "previousTrend": 10, "weakWords": ["Star"],
                  "words": [{"word": "Star", "accuracy": 0.5, "correct": 1, "wrong": 1}],
                  "completionRate": 0.5},
        "words": [{"word": "Star", "meaning": "별", "image": "star.svg", "emoji": "⭐"}],
        "phrases": [{"english": "Hello, Star!", "korean": "안녕, 별아!"}],
        "child_name_must_not_be_sent": "가상 개인정보",
    }
    st, d = req("POST", "/api/learning/recommendation", body=ai_payload)
    check("learning AI requires account auth", st == 401, str(d))
    st, d = req("POST", "/api/learning/recommendation", token=token1,
                body={"profile": {"age": 99}})
    check("learning AI validates profile before key check", st == 400, str(d))
    st, d = req("POST", "/api/learning/recommendation", token=token1,
                body=ai_payload)
    check("learning AI missing key returns fallback signal", st == 503, str(d))

    old_llm_call = coach._call_llm
    llm_prompts = []
    def mocked_llm(system, user, timeout=40):
        llm_prompts.append(user)
        prompt = json.loads(user)
        return json.dumps({
            "summary": "관심사 단어를 잘 골랐어요.",
            "strengths": ["그림을 보고 단어를 찾았어요."],
            "supportNeeds": ["Star 소리를 한 번 더 들어봐요."],
            "nextLearning": "우주 단어를 그림으로 복습해요.",
            "recommendedWords": [prompt["candidateWords"][0]["word"]],
            "recommendedPhrases": [prompt["candidatePhrases"][0]["english"]],
            "difficulty": "기초",
            "estimatedMinutes": 8,
            "reason": "우주 관심사와 현재 학습 이력을 반영했어요.",
        }, ensure_ascii=False)
    coach._call_llm = mocked_llm
    os.environ["OPENAI_API_KEY"] = "test-only-mock-key"
    st, d = req("POST", "/api/learning/recommendation", token=token1,
                body=ai_payload)
    check("learning AI mocked response validated", st == 200
          and d.get("provider") == "server_ai"
          and d.get("words", [{}])[0].get("word") == "Star", str(d)[:200])
    check("learning AI prompt excludes child identifier", bool(llm_prompts)
          and "가상 개인정보" not in llm_prompts[-1], "identifier found in prompt")
    art_payload = json.loads(json.dumps(ai_payload, ensure_ascii=False))
    art_payload["profile"]["interests"] = ["미술"]
    art_payload["words"] = [
        {"word": "Paint", "meaning": "물감"},
        {"word": "Color", "meaning": "색칠하다"},
        {"word": "Smile", "meaning": "웃다"},
    ]
    art_payload["phrases"] = [
        {"english": "Let's draw!", "korean": "함께 그려 보자!"},
        {"english": "I like colors!", "korean": "나는 여러 색을 좋아해!"},
    ]
    st, d = req("POST", "/api/learning/recommendation", token=token1,
                body=art_payload)
    check("learning AI accepts added interest-specific phrases", st == 200
          and d.get("phrases", [{}])[0].get("english") == "Let's draw!", str(d)[:200])
    coach._call_llm = lambda system, user, timeout=40: json.dumps({
        "summary": "잘했어요", "strengths": [], "supportNeeds": [],
        "nextLearning": "복습해요", "recommendedWords": ["Not a candidate"],
        "recommendedPhrases": ["Hello, Star!"], "difficulty": "기초",
        "estimatedMinutes": 8, "reason": "후보 검증",
    }, ensure_ascii=False)
    st, d = req("POST", "/api/learning/recommendation", token=token1,
                body=ai_payload)
    check("learning AI rejects unlisted recommendations", st == 502, str(d))
    coach._call_llm = old_llm_call
    os.environ.pop("OPENAI_API_KEY", None)

    # 3. 진단 5문항 정의 (F 온보딩 UI용)
    st, d = req("GET", "/api/diagnosis/questions")
    keys = [q["key"] for q in d.get("questions", [])]
    check("diagnosis questions 5", st == 200 and keys == list(DIAG_KEYS),
          str(keys))

    # 4. 온보딩 (5.1) — child1: 4세, 5문항 모두 none → L1 가설, draft 계획
    diag_none = {k: "none" for k in DIAG_KEYS}
    st, d = req("POST", "/api/children", token=token1, body={
        "name": "우리별", "age": 4, "ek_kindergarten": 1, "exposure": "none",
        "session_length": 10, "diagnosis": diag_none})
    check("onboarding create child", st == 201 and d["child"]["age"] == 4,
          str(d)[:200])
    child1 = d["child"]["id"]
    check("diagnosis L1 (가설)", d["diagnosis"]["score"] == 0
          and d["diagnosis"]["level"] == 1, str(d["diagnosis"]))
    plan1_id = d["plan"]["id"]
    check("plan draft 20 cards", d["plan"]["status"] == "draft"
          and len(d["cards"]) == 20,
          "%s n=%d" % (d["plan"]["status"], len(d["cards"])))
    c0 = d["cards"][0]
    check("plan starts today+ (weekdays only)",
          c0["date"] >= iso(today)
          and dt.date.fromisoformat(c0["date"]).weekday() < 5, c0["date"])
    wed = [c for c in d["cards"]
           if dt.date.fromisoformat(c["date"]).weekday() == 2 and c["content_id"]]
    check("wednesday L1 warm-up", len(wed) >= 1 and all(
        catalog.find_item(c["content_id"])["level"] == 1 for c in wed),
          "wed=%d" % len(wed))

    # 온보딩 입력 검증
    st, d = req("POST", "/api/children", token=token1,
                body={"name": "x", "age": 3, "diagnosis": diag_none})
    check("child age 3 -> 400", st == 400, str(d))
    st, d = req("POST", "/api/children", token=token1,
                body={"name": "x", "age": 5})
    check("child missing diagnosis -> 400", st == 400, str(d))
    st, d = req("POST", "/api/children", token=token1,
                body={"name": "x", "age": 5, "session_length": 7,
                      "diagnosis": diag_none})
    check("child bad session_length -> 400", st == 400, str(d))

    # 승인 전 today: draft만 노출
    st, d = req("GET", "/api/children/%d/today" % child1, token=token1)
    check("today before approve: draft only",
          st == 200 and d["plan"] is None and d["draft_plan"] is not None
          and d["draft_plan"]["id"] == plan1_id, str(d)[:160])

    # 승인 게이트 (6.1)
    st, d = req("POST", "/api/children/%d/plans/%d/approve" % (child1, plan1_id),
                token=token1, body={})
    check("approve plan", st == 200 and d["plan"]["status"] == "approved"
          and len(d["cards"]) == 20, str(d)[:160])
    st, d = req("POST", "/api/children/%d/plans/%d/approve" % (child1, plan1_id),
                token=token1, body={})
    check("approve twice -> 409", st == 409, str(d))

    # 설정 변경 / 재계획
    st, d = req("POST", "/api/children/%d/settings" % child1, token=token1,
                body={"name": "별별", "session_length": 15})
    check("settings", st == 200 and d["name"] == "별별"
          and d["session_length"] == 15, str(d)[:160])
    st, d = req("POST", "/api/children/%d/replan" % child1, token=token1,
                body={})
    check("replan draft 20", st == 200 and d["plan"]["status"] == "draft"
          and len(d["cards"]) == 20, str(d)[:160])

    # 5. child2 — A의 RAG 계획 업로드(6.2) + 피드백 E2E (5.3, 5.4, 6.3)
    diag_some = {k: "some" for k in DIAG_KEYS}
    st, d = req("POST", "/api/children", token=token1, body={
        "name": "별이", "age": 5, "ek_kindergarten": 0, "exposure": "some",
        "session_length": 10, "diagnosis": diag_some})
    child2 = d["child"]["id"]
    check("child2 level L3 (score 5)", d["diagnosis"]["level"] == 3,
          str(d["diagnosis"]))

    def _alt(it, age):
        pool = [x for x in (catalog.items_by_level(it["level"], age)
                            or catalog.items_by_level(it["level"]))
                if x["id"] != it["id"]]
        return pool[0] if pool else None

    cand = catalog.search(age=5) or catalog.search()
    item0 = next((i for i in cand if _alt(i, 5)), cand[0])

    # RAG 계획: 과거 20평일 (content_id는 카탈로그 내 항목만 허용, 6.6)
    days = [{"date": x.isoformat(), "content_id": item0["id"]}
            for x in catalog.next_weekdays(m, 20)]
    st, d = req("POST", "/api/children/%d/plans" % child2, token=token1,
                body={"days": days, "explanation": "smoke", "base_level": 1})
    check("rag plan create", st == 201 and d["plan"]["status"] == "draft"
          and len(d["cards"]) == 20, str(d)[:160])
    plan2_id = d["plan"]["id"]
    st, d = req("POST", "/api/children/%d/plans" % child2, token=token1,
                body={"days": [{"date": iso(m), "content_id": "nope"}]})
    check("rag plan unknown content -> 400 (6.6)", st == 400, str(d))
    st, d = req("POST", "/api/children/%d/plans" % child2, token=token1,
                body={"days": "x"})
    check("rag plan bad days -> 400", st == 400, str(d))
    st, d = req("POST", "/api/children/%d/plans/%d/approve"
                % (child2, plan2_id), token=token1, body={})
    check("approve child2 plan", st == 200
          and d["plan"]["status"] == "approved", str(d)[:160])
    st, pd = req("GET", "/api/children/%d/plan" % child2, token=token1)
    orig = {c["date"]: c for c in pd["cards"]}

    def fb(date, **kw):
        body = {"date": iso(date)}
        body.update(kw)
        return req("POST", "/api/children/%d/feedback" % child2,
                   token=token1, body=body)

    # d0(월): 잘 따라옴+흥미2(단발) → A + interest_dip (공백 해소, 5.4)
    st, d = fb(d0, completion="full", satisfaction=4, interest=2,
               comprehension=4)
    check("d0 case A (단발 흥미 저하 — C 아님)",
          st == 201 and d["case"] == "A", str(d)[:200])
    check("d0 no adjust", d.get("adjust", {}).get("type") == "none",
          str(d.get("adjust")))
    check("d0 AI label", AI_LABEL in (d.get("message") or ""),
          str(d.get("message", ""))[:120])
    check("d0 확신 문구 없음 (데이터 조건부, 6.6)",
          "옳은 길" not in (d.get("message") or ""), "")
    check("d0 tomorrow = d1", d.get("tomorrow") is not None
          and d["tomorrow"]["date"] == iso(d1), str(d.get("tomorrow")))
    check("d0 intent none", d["memo_intent"] == "none"
          and d["record"]["memo_intent"] == "none", str(d)[:160])

    # d1(화): 흥미2 2일 연속 → C → 내일 카드 swap
    st, d = fb(d1, completion="full", satisfaction=3, interest=2,
               comprehension=4)
    check("d1 case C (흥미≤2 2일 연속)", st == 201 and d["case"] == "C",
          str(d)[:200])
    check("d1 swap adjust", d["adjust"]["type"] in ("swap", "swap_easy")
          and d["adjust"]["dates"] == [iso(d2)], str(d["adjust"]))
    check("d1 tomorrow swapped", d["tomorrow"] is not None
          and d["tomorrow"]["content_id"] != item0["id"],
          str(d.get("tomorrow")))

    # d2(수): 일부완료 + 변경요청 메모 → C + B 중복, 제안만 (자동 적용 X, 6.1)
    st, d = fb(d2, completion="partial", satisfaction=3, interest=3,
               comprehension=4, memo="너무 어려워서요. 쉬운 걸로 바꿔주세요")
    check("d2 memo intent change_request",
          d["memo_intent"] == "change_request", str(d)[:200])
    check("d2 case C (C 우선, B 중복)", st == 201 and d["case"] == "C",
          str(d)[:200])
    check("d2 propose only (자동 적용 X)",
          d["adjust"]["type"] == "propose_swap" and d["adjust"]["dates"] == [],
          str(d["adjust"]))

    # d3(목): 이해도 2 → B → 내일 분량 축소
    st, d = fb(d3, completion="full", satisfaction=3, interest=4,
               comprehension=2)
    check("d3 case B (이해도<3)", st == 201 and d["case"] == "B",
          str(d)[:200])
    check("d3 shrink adjust", d["adjust"]["type"] == "shrink"
          and d["adjust"]["dates"] == [iso(d4)], str(d["adjust"]))
    check("d3 tomorrow shrunk", d["tomorrow"]["minutes"] ==
          max(5, orig[iso(d4)]["minutes"] - 5),
          str(d.get("tomorrow")))

    # d4(금): 휴식일 → SKIP (메시지 없음, 성취 분모 제외, 5.4)
    st, d = fb(d4, rest_day=True)
    check("d4 rest day SKIP", st == 201 and d["case"] == "SKIP"
          and d["message"] is None, str(d)[:200])
    check("d4 record rest_day", d["record"]["rest_day"] is True,
          str(d["record"]))

    # 피드백 검증
    st, d = fb(d0, completion="full", satisfaction=4, interest=4,
               comprehension=4)
    check("duplicate record -> 409", st == 409, str(d))
    st, d = req("POST", "/api/children/%d/feedback" % child2, token=token1,
                body={"date": "2999-01-01", "completion": "full",
                      "satisfaction": 4, "interest": 4, "comprehension": 4})
    check("future date -> 400", st == 400, str(d))
    st, d = fb(d0 - dt.timedelta(days=1), completion="weird",
               satisfaction=4, interest=4, comprehension=4)
    check("bad completion -> 400", st == 400, str(d))

    # 메시지 이력 (SKIP는 메시지 없음)
    st, d = req("GET", "/api/children/%d/messages" % child2, token=token1)
    check("messages 4 (SKIP excluded)", st == 200 and len(d) == 4,
          "n=%s" % len(d))
    check("message branch order B,C,C,A",
          [x["branch"] for x in d] == ["B", "C", "C", "A"],
          str([x["branch"] for x in d]))
    check("message AI label + rules version",
          AI_LABEL in d[0]["body"]
          and d[0]["prompt_version"] == "bloomy-coach-v2-rules",
          str(d[0])[:160])

    # 조정 반영 확인 (카드 변경)
    st, pd = req("GET", "/api/children/%d/plan" % child2, token=token1)
    cards2 = {c["date"]: c for c in pd["cards"]}
    check("d2 card swapped (적용됨)",
          cards2[iso(d2)]["content_id"] != item0["id"],
          str(cards2[iso(d2)])[:160])
    check("d3 card unchanged (제안만)",
          cards2[iso(d3)]["content_id"] == item0["id"],
          str(cards2[iso(d3)])[:160])
    check("d4 card shrunk",
          cards2[iso(d4)]["minutes"] == max(5, orig[iso(d4)]["minutes"] - 5),
          str(cards2[iso(d4)])[:160])

    # 주간 리포트 (5.5) — 확신 문구는 데이터 조건부
    st, d = req("GET", "/api/children/%d/report?week_start=%s"
                % (child2, iso(d0)), token=token1)
    check("weekly report", st == 200 and d["record_days"] == 4
          and d["branch_counts"] == {"A": 1, "B": 1, "C": 2, "SKIP": 0},
          str({k: d.get(k) for k in ("record_days", "branch_counts")}))
    check("weekly 확신 문구 없음 + honest_note",
          d.get("confidence_sentence") == "" and bool(d.get("honest_note")),
          str(d.get("honest_note")))
    check("weekly one_step", bool(d.get("one_step")), str(d)[:160])

    # 월간 성취 (요금 무관) / 대시보드
    st, d = req("GET", "/api/children/%d/achievement?month=%s"
                % (child2, d0.strftime("%Y-%m")), token=token1)
    check("monthly achievement (요금 없음)",
          st == 200 and "next_fee" not in d and "요금" in d["note"],
          str(d)[:160])
    st, d = req("GET", "/api/children/%d/stats" % child2, token=token1)
    check("stats dashboard", st == 200 and "record_rate" in d
          and "streak" in d, str(d)[:160])

    # 6. 카탈로그 검색
    st, d = req("GET", "/api/catalog?level=1")
    check("catalog level=1", st == 200 and isinstance(d, list) and len(d) > 0
          and all(i["level"] == 1 for i in d), "n=%s" % len(d))
    st, d = req("GET", "/api/catalog?age=4&level=1")
    check("catalog age+level", st == 200 and isinstance(d, list)
          and all(i["age_min"] <= 4 <= i["age_max"] for i in d),
          "n=%s" % len(d))
    st, d = req("GET", "/api/catalog?keyword="
                + urllib.parse.quote(item0["title"][:4]))
    check("catalog keyword", st == 200 and isinstance(d, list), "")

    # 7. 알림 (환영·계획) + 읽음 처리
    st, d = req("GET", "/api/notifications", token=token1)
    kinds = {n["kind"] for n in d["items"]}
    check("notifications welcome+plan",
          st == 200 and "welcome" in kinds and "plan" in kinds,
          str(kinds))
    st, _ = req("POST", "/api/notifications/read", token=token1, body={})
    st, d = req("GET", "/api/notifications", token=token1)
    check("notifications read", d["unread"] == 0, str(d["unread"]))

    # 8. 타 계정 접근 차단
    email2 = "parent2%s@test.bloomy" % suffix
    st, d = req("POST", "/api/register",
                body={"email": email2, "password": "secret123"})
    token2 = d.get("token")
    st, d = req("GET", "/api/children/%d/today" % child1, token=token2)
    check("other account today -> 404", st == 404, str(d))
    st, d = req("GET", "/api/children/99999/today", token=token1)
    check("unknown child -> 404", st == 404, str(d))
    st, d = req("POST", "/api/children/%d/feedback" % child2, token=token2,
                body={"date": iso(d5), "completion": "full",
                      "satisfaction": 4, "interest": 4, "comprehension": 4})
    check("other account feedback -> 404", st == 404, str(d))

    # 9. 자동화 (6.5) — 스케줄러 직접 호출
    scheduler.daily(date=iso(d5))
    scheduler.remind(date=iso(d5))
    st, d = req("GET", "/api/notifications", token=token1)
    n_daily = sum(1 for n in d["items"] if n["kind"] == "daily")
    n_remind = sum(1 for n in d["items"] if n["kind"] == "remind")
    check("scheduler daily card sent", n_daily >= 1, "n=%s" % n_daily)
    check("scheduler remind sent", n_remind >= 1, "n=%s" % n_remind)
    scheduler.remind(date=iso(d5))  # 1회만 (meta 중복 방지)
    st, d2 = req("GET", "/api/notifications", token=token1)
    check("remind once only (dedup)",
          sum(1 for n in d2["items"] if n["kind"] == "remind") == n_remind,
          "")
    scheduler.weekly(date=iso(m + dt.timedelta(days=6)))  # 일요일
    st, d3 = req("GET", "/api/notifications", token=token1)
    check("weekly report notification",
          any(n["kind"] == "report" for n in d3["items"]),
          str([n["kind"] for n in d3["items"]]))

    # 10. Vercel Cron 엔드포인트
    st, d = req("POST", "/api/cron", body={"job": "daily"})
    check("cron without secret -> 401", st == 401, str(d))
    os.environ["BLOOMY_CRON_SECRET"] = "smoke-sec"
    st, d = req("POST", "/api/cron", token="smoke-sec", body={"job": "daily"})
    check("cron daily -> 200", st == 200 and d.get("ok"), str(d))
    st, d = req("POST", "/api/cron", token="wrong", body={"job": "daily"})
    check("cron wrong secret -> 401", st == 401, str(d))
    st, d = req("POST", "/api/cron", token="smoke-sec", body={"job": "bogus"})
    check("cron unknown job -> 400", st == 400, str(d))
    st, d = req("POST", "/api/cron", token="smoke-sec",
                body={"job": "weekly", "date": iso(m + dt.timedelta(days=6))})
    check("cron weekly -> 200", st == 200, str(d))
    st, d = req("POST", "/api/cron", token="smoke-sec",
                body={"job": "monthly", "date": "2026-11-01"})
    check("cron monthly -> 200", st == 200, str(d))
    os.environ.pop("BLOOMY_CRON_SECRET", None)

    try:
        os.remove(TEST_DB)
    except OSError:
        pass
    print("\n%d passed, %d failed" % (PASS, FAIL))
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
