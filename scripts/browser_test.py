"""Browser E2E for BLOOMY's onboarding, learning, storage, and AI UI.

Run with: python -m pip install -r requirements-dev.txt
          python -m playwright install chromium
          python scripts/browser_test.py

Uses an isolated temporary SQLite database and a fresh browser context. The
real AI endpoint is exercised in no-key fallback mode; a separate intercepted
response verifies that the UI only applies a successful server AI result.
"""
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

from playwright.sync_api import sync_playwright


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def check(name, condition, details=""):
    if not condition:
        raise AssertionError("FAIL %s %s" % (name, details))
    print("PASS %s" % name)


def wait_for_server(url, process):
    for _ in range(80):
        if process.poll() is not None:
            raise RuntimeError("BLOOMY server exited early")
        try:
            with urllib.request.urlopen(url + "/api/health", timeout=1) as response:
                if response.status == 200:
                    return
        except (OSError, urllib.error.URLError):
            time.sleep(0.25)
    raise TimeoutError("BLOOMY server did not start")


def main():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    with tempfile.TemporaryDirectory(prefix="bloomy-browser-test-") as tmp:
        env = os.environ.copy()
        env["BLOOMY_DB"] = os.path.join(tmp, "isolated.sqlite3")
        env["BLOOMY_PEPPER"] = "bloomy-browser-test-only-pepper"
        env.pop("OPENAI_API_KEY", None)
        env.pop("DATABASE_URL", None)
        server = subprocess.Popen(
            [sys.executable, os.path.join(ROOT, "backend", "main.py"), "--host", "127.0.0.1", "--port", str(port)],
            cwd=ROOT,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        url = "http://127.0.0.1:%d" % port
        try:
            wait_for_server(url, server)
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(viewport={"width": 1365, "height": 900})
                page = context.new_page()
                page.set_default_timeout(8000)
                page.set_default_navigation_timeout(12000)
                page_errors = []
                page.on("pageerror", lambda error: page_errors.append(str(error)))
                page.goto(url, wait_until="networkidle")
                check("온보딩 화면 표시", page.locator("#profileScreen.active-screen").count() == 1)

                page.locator('[data-group="age"] [data-value="5세"]').click()
                page.locator('[data-group="experience"] [data-value="처음 시작해요"]').click()
                page.locator('[data-group="studyTime"] [data-value="10분"]').click()
                page.locator('.interest-item').filter(has_text="우주").click()
                page.locator("#onboardingForm button[type=submit]").click()
                check("5문항 진단 진입", page.locator("#diagnosisScreen:not(.hidden-screen)").count() == 1)
                for question in ("q1", "q2", "q3", "q4", "q5"):
                    page.locator('.answer-btn[data-question="%s"]' % question).first.click()
                check("진단 5문항 저장", page.locator("#nextDiagnosisBtn").is_enabled())
                page.locator("#nextDiagnosisBtn").click()
                check("진단 결과 표시", page.locator("#resultSummary:not(.hidden)").count() == 1)
                page.locator("#showCurriculumBtn").click()
                check("4주 커리큘럼 표시", page.locator("#curriculumList .curriculum-week").count() == 4)
                page.locator("#goTodayLearningBtn").click()
                check("학습 홈 진입", page.locator("#startLearningPagesBtn").is_visible())
                check("규칙 추천 초기 표시", "규칙 기반" in page.locator("#recommendationSource").inner_text())
                check("진단 기반 기초 난이도", page.locator("#recommendationLevel").inner_text() == "기초")

                page.locator("#parentDashboardBtn").click()
                page.locator("#aiAuthModeBtn").click()
                page.locator("#aiAuthEmail").fill("parent@example.test")
                page.locator("#aiAuthPassword").fill("secret123")
                page.locator("#aiAuthForm button[type=submit]").click()
                page.wait_for_function("document.querySelector('#aiRecommendationStatus').textContent.includes('규칙 기반 추천')")
                check("실제 API 키 없음 시 규칙 추천 대체", "AI 코치가 설정되지 않았습니다" in page.locator("#aiRecommendationStatus").inner_text())
                check("부모님 대시보드 데이터 없음 처리", "데이터 없음" in page.locator("#dashboardSummaryCards").inner_text())

                ai_request_payload = {}
                ai_copy_test = {"unsafe": False}

                def mock_ai(route):
                    data = json.loads(route.request.post_data)
                    ai_request_payload.update(data)
                    route.fulfill(status=200, content_type="application/json", body=json.dumps({
                        "provider": "server_ai",
                        "summary": "실패했어요. 너무 많이 틀렸어요." if ai_copy_test["unsafe"] else "관심사 단어를 잘 골랐어요.",
                        "strengths": ["그림과 단어를 연결했어요."],
                        "supportNeeds": ["Star 소리를 천천히 들어봐요."],
                        "nextLearning": "단어를 듣고 그림 퀴즈로 복습해요.",
                        "reason": "초기 진단과 우주 관심사를 반영했어요.",
                        "difficulty": "기초",
                        "estimatedMinutes": 8,
                        "historyCount": 0,
                        "words": list(reversed(data["words"])),
                        "phrases": list(reversed(data["phrases"])),
                    }, ensure_ascii=False))

                page.route("**/api/learning/recommendation", mock_ai)
                page.locator("#dashboardAiRefreshBtn").click()
                page.wait_for_function("document.querySelector('#dashboardAiSource').textContent.includes('실제 서버 AI 분석 완료')")
                check("AI 성공 응답 분석 표시", "관심사 단어를 잘 골랐어요" in page.locator("#dashboardAnalysisText").inner_text())
                check("AI 요청에 개인정보 이름 없음", "name" not in ai_request_payload.get("profile", {}) and "childName" not in ai_request_payload)
                check("진단과 학습 요약 서버 전달", ai_request_payload.get("profile", {}).get("age") == 5 and len(ai_request_payload.get("diagnosis", {})) == 5)
                ai_copy_test["unsafe"] = True
                page.locator("#aiRecommendationStatus").evaluate("element => element.textContent = '검증 중'")
                page.locator("#dashboardAiRefreshBtn").click()
                page.wait_for_function("document.querySelector('#aiRecommendationStatus').textContent.includes('AI 코치 분석이 완료됐어요')")
                check("부정적 AI 문장을 안전 문구로 대체", "실패" not in page.locator("#dashboardAnalysisText").inner_text() and "실패" not in page.locator("#aiRecommendationStatus").inner_text() and "관심사에 맞는 단어와 표현을 골랐어요" in page.locator("#dashboardAnalysisText").inner_text())
                ai_copy_test["unsafe"] = False
                page.locator("#aiAuthDisconnectBtn").click()
                check("보호자 계정 연결 해제 후 로그인 폼", page.locator("#aiAuthForm").is_visible())
                page.locator("#aiAuthModeBtn").click()
                page.locator("#aiAuthEmail").fill("parent@example.test")
                page.locator("#aiAuthPassword").fill("secret123")
                page.locator("#aiAuthForm button[type=submit]").click()
                page.wait_for_function("document.querySelector('#aiAuthStatus').textContent.includes('parent@example.test')")
                check("기존 보호자 계정 로그인", "parent@example.test" in page.locator("#aiAuthStatus").inner_text())

                page.locator("#dashboardBackBtn").click()
                page.wait_for_function("location.hash.startsWith('#learning-0')")
                page.go_forward()
                page.wait_for_function("location.hash === '#parent-dashboard'")
                check("브라우저 뒤로/앞으로 대시보드 이동", page.locator("#parentDashboardScreen:not(.hidden-screen)").count() == 1)
                page.go_back()
                page.wait_for_function("location.hash.startsWith('#learning-0')")

                page.locator("#startLearningPagesBtn").click()
                check("단어 3개 화면", page.locator("#wordCardList .word-card").count() == 3)
                shown_words = page.locator("#wordCardList .word-card h4").all_text_contents()
                expected_ai_words = [item["word"] for item in reversed(ai_request_payload["words"])]
                check("AI 추천 단어가 다음 학습에 반영", shown_words == expected_ai_words, str(shown_words))
                page.locator("#wordBackBtn").click()
                check("학습 중단 시 저장·이어하기 안내", "저장했어요" in page.locator("#todayLearningSummary").inner_text())
                page.locator("#startLearningPagesBtn").click()
                check("중단한 학습 이어서 시작", page.locator("#learningProgressLabel").inner_text() == "오늘의 단어")
                first_image = page.locator("#wordCardList .learning-art").first
                page.wait_for_function("img => img.complete && (img.naturalWidth > 0 || img.hidden)", arg=first_image.element_handle())
                check("단어 로컬 이미지 또는 대체 표시", first_image.evaluate("img => img.naturalWidth > 0 || (img.hidden && !img.nextElementSibling.hidden)"))
                speech_button = page.locator("#wordCardList .speech-action").first
                speech_button.click()
                page.wait_for_timeout(300)
                check("단어 음성 버튼 무오류", not page_errors, str(page_errors))
                check("음성 지원 또는 대체 안내", page.locator("#wordCardList .speech-status").first.inner_text() != "")
                page.evaluate("""() => {
                  Object.defineProperty(window.speechSynthesis, 'speak', {
                    configurable: true, value: () => { window.__speechSpeakCount = (window.__speechSpeakCount || 0) + 1; }
                  });
                  Object.defineProperty(window.speechSynthesis, 'cancel', {
                    configurable: true, value: () => { window.__speechCancelCount = (window.__speechCancelCount || 0) + 1; }
                  });
                }""")
                page.locator('#wordCardList .speech-action[data-speed="0.7"]').first.click()
                page.locator("#wordCardList .speech-repeat-count").first.select_option("3")
                page.locator("#wordCardList .speech-repeat-speed").first.select_option("0.7")
                page.locator("#wordCardList .speech-repeat-btn").first.click()
                check("느린 속도 및 반복 듣기 조작", page.evaluate("window.__speechSpeakCount >= 2") and page.locator("#wordCardList .speech-status").first.inner_text() != "")
                stop_button = page.locator("#wordCardList .speech-stop-btn").first
                stop_button.click()
                check("재생 중단 버튼 동작", page.evaluate("window.__speechCancelCount >= 2"))
                page.locator("#wordNextBtn").click()
                check("표현 2개 화면", page.locator("#phraseList .phrase-item").count() == 2)
                page.locator("#phraseList .speech-action").first.click()
                page.locator("#phraseNextBtn").click()
                desktop_metrics = page.evaluate("({width: innerWidth, scroll: document.documentElement.scrollWidth, image: document.querySelector('.quiz-illustration').getBoundingClientRect().width, option: document.querySelector('.quiz-option').getBoundingClientRect().height})")
                check("PC 화면 그림 및 선택 영역", desktop_metrics["scroll"] <= desktop_metrics["width"] and desktop_metrics["image"] >= 300 and desktop_metrics["option"] >= 100, str(desktop_metrics))

                repeat_wrong_word = None
                for index in range(3):
                    answer = page.locator(".quiz-illustration").get_attribute("aria-label")
                    options = page.locator(".quiz-option")
                    if index == 1:
                        repeat_wrong_word = answer
                        wrong = page.locator('.quiz-option:not([data-option="%s"])' % answer).first
                        wrong.click()
                        check("퀴즈 오답 긍정 피드백", "괜찮아요" in page.locator("#quizFeedback").inner_text())
                    else:
                        page.locator('.quiz-option[data-option="%s"]' % answer).click()
                        check("퀴즈 정답 피드백 %d" % (index + 1), "정답" in page.locator("#quizFeedback").inner_text())
                    page.locator("#checkQuizBtn").click()

                check("학습 완료 및 별 누적", page.locator("#completionStep:not(.hidden)").count() == 1 and page.locator("#finalStarCount").inner_text() == "2")
                stored = page.evaluate("JSON.parse(localStorage.getItem('bloomy.learningRecords'))")
                profile = stored["profiles"][stored["activeProfileId"]]
                session = profile["sessions"][-1]
                check("학습 기록과 퀴즈 3건 저장", session["completed"] and len(session["quizAttempts"]) == 3)
                check("정답률과 정오답 데이터", sum(1 for attempt in session["quizAttempts"] if attempt["correct"]) == 2)
                page.reload(wait_until="networkidle")
                check("새로고침 후 학습 기록 복원", page.locator("#curriculumScreen:not(.hidden-screen)").count() == 1)
                page.locator("#goTodayLearningBtn").click()
                page.locator("#parentDashboardBtn").click()
                check("대시보드에 저장된 학습일 표시", "1일" in page.locator("#dashboardSummaryCards").inner_text())
                page.unroute("**/api/learning/recommendation")
                page.route("**/api/learning/recommendation", lambda route: route.fulfill(
                    status=502, content_type="application/json",
                    body=json.dumps({"error": "테스트용 AI 응답 오류"}, ensure_ascii=False),
                ))
                page.locator("#dashboardAiRefreshBtn").click()
                page.wait_for_function("document.querySelector('#dashboardAiSource').textContent.includes('규칙 기반 추천 사용')")
                check("AI 오류 후 규칙 추천 복귀", "테스트용 AI 응답 오류" in page.locator("#aiRecommendationStatus").inner_text())

                page.set_viewport_size({"width": 390, "height": 844})
                page.reload(wait_until="networkidle")
                page.locator("#goTodayLearningBtn").click()
                page.locator("#startLearningPagesBtn").click()
                page.locator("#wordNextBtn").click()
                page.locator("#phraseNextBtn").click()
                page.wait_for_timeout(200)
                metrics = page.evaluate("({width: innerWidth, scroll: document.documentElement.scrollWidth, image: document.querySelector('.quiz-illustration').getBoundingClientRect().width, option: document.querySelector('.quiz-option').getBoundingClientRect().height})")
                check("모바일 너비에서 가로 넘침 없음", metrics["scroll"] <= metrics["width"], str(metrics))
                check("모바일 퀴즈 터치 영역 확보", metrics["image"] >= 200 and metrics["option"] >= 48, str(metrics))
                repeated_target_answered = False
                for index in range(3):
                    answer = page.locator(".quiz-illustration").get_attribute("aria-label")
                    if answer == repeat_wrong_word:
                        page.locator('.quiz-option:not([data-option="%s"])' % answer).first.click()
                        repeated_target_answered = True
                    else:
                        page.locator('.quiz-option[data-option="%s"]' % answer).click()
                    page.locator("#checkQuizBtn").click()
                check("반복 오답 단어를 다음 학습에서 다시 확인", repeated_target_answered)
                if page.locator("#completionStep:not(.hidden)").count():
                    page.locator("#completionHomeBtn").click()
                else:
                    page.locator("#learningHomeBtn").click()
                page.locator("#parentDashboardBtn").click()
                check("반복 오답이 대시보드 복습 목록에 표시", repeat_wrong_word in page.locator("#weakWordList").inner_text())
                check("브라우저 JavaScript 오류 없음", not page_errors, str(page_errors))
                print("Browser E2E completed")
                context.close()
                browser.close()
        finally:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()


if __name__ == "__main__":
    main()
