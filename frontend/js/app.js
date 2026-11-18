const form = document.getElementById('onboardingForm');
const formMessage = document.getElementById('formMessage');
const summaryCard = document.getElementById('resultSummary');
const summaryList = document.getElementById('summaryList');
const profileScreen = document.getElementById('profileScreen');
const diagnosisScreen = document.getElementById('diagnosisScreen');
const curriculumScreen = document.getElementById('curriculumScreen');
const todayLearningScreen = document.getElementById('todayLearningScreen');
const backToProfileBtn = document.getElementById('backToProfileBtn');
const nextDiagnosisBtn = document.getElementById('nextDiagnosisBtn');
const diagnosisMessage = document.getElementById('diagnosisMessage');
const stepBadge = document.getElementById('stepBadge');
const showCurriculumBtn = document.getElementById('showCurriculumBtn');
const curriculumProfile = document.getElementById('curriculumProfile');
const curriculumList = document.getElementById('curriculumList');
const backToDiagnosisBtn = document.getElementById('backToDiagnosisBtn');
const curriculumParentDashboardBtn = document.getElementById('curriculumParentDashboardBtn');
const goTodayLearningBtn = document.getElementById('goTodayLearningBtn');
const startLearningPagesBtn = document.getElementById('startLearningPagesBtn');
const learningHomeBtn = document.getElementById('learningHomeBtn');
const parentDashboardBtn = document.getElementById('parentDashboardBtn');
const parentDashboardScreen = document.getElementById('parentDashboardScreen');
const dashboardBackBtn = document.getElementById('dashboardBackBtn');
const dashboardRefreshBtn = document.getElementById('dashboardRefreshBtn');
const dashboardSummaryCards = document.getElementById('dashboardSummaryCards');
const weeklyChart = document.getElementById('weeklyChart');
const wordAchievementList = document.getElementById('wordAchievementList');
const weakWordList = document.getElementById('weakWordList');
const dashboardFeedback = document.getElementById('dashboardFeedback');
const aiAuthForm = document.getElementById('aiAuthForm');
const aiAuthEmail = document.getElementById('aiAuthEmail');
const aiAuthPassword = document.getElementById('aiAuthPassword');
const aiAuthStatus = document.getElementById('aiAuthStatus');
const aiAuthSubmitBtn = document.getElementById('aiAuthSubmitBtn');
const aiAuthModeBtn = document.getElementById('aiAuthModeBtn');
const aiAuthDisconnectBtn = document.getElementById('aiAuthDisconnectBtn');
const aiRecommendationStatus = document.getElementById('aiRecommendationStatus');
const refreshAiRecommendationBtn = document.getElementById('refreshAiRecommendationBtn');
const dashboardAiRefreshBtn = document.getElementById('dashboardAiRefreshBtn');
const todayLearningSummary = document.getElementById('todayLearningSummary');
const learningStorageMessage = document.getElementById('learningStorageMessage');
const wordCardList = document.getElementById('wordCardList');
const phraseList = document.getElementById('phraseList');
const quizList = document.getElementById('quizList');
const quizFeedback = document.getElementById('quizFeedback');
const checkQuizBtn = document.getElementById('checkQuizBtn');
const completionStep = document.getElementById('completionStep');
const finalStarCount = document.getElementById('finalStarCount');
const completionSummary = document.getElementById('completionSummary');
const completionList = document.getElementById('completionList');
const completionPhraseList = document.getElementById('completionPhraseList');
const learningProgressLabel = document.getElementById('learningProgressLabel');
const learningProgressBar = document.getElementById('learningProgressBar');
const learningStarCount = document.getElementById('learningStarCount');
const quizQuestionCount = document.getElementById('quizQuestionCount');
const wordNextBtn = document.getElementById('wordNextBtn');
const wordBackBtn = document.getElementById('wordBackBtn');
const phraseNextBtn = document.getElementById('phraseNextBtn');
const phraseBackBtn = document.getElementById('phraseBackBtn');
const quizBackBtn = document.getElementById('quizBackBtn');
const completionBackBtn = document.getElementById('completionBackBtn');
const completionHomeBtn = document.getElementById('completionHomeBtn');
const learningSteps = Array.from(todayLearningScreen.querySelectorAll(':scope > .learning-step'));
let currentLearningStep = 0;
let activeQuizIndex = 0;
let currentQuizQuestions = [];
let speechPlaybackId = 0;
let activeSpeech = null;
let currentRecommendation = null;
let currentLearningContent = null;
let currentAiRecommendation = null;
let aiAuthMode = 'login';
let aiRequestController = null;
const COACH_AUTH_KEY = 'bloomy.coachAuth.v1';

const selectionGroups = {
  age: null,
  experience: null,
  studyTime: null,
};

const diagnosisAnswers = {};
const quizState = {
  starCount: 0,
  answeredQuestions: 0,
};

function selectChoice(groupName, value) {
  const groupButtons = document.querySelectorAll(`[data-group="${groupName}"] .choice-btn`);

  groupButtons.forEach((button) => {
    const isSelected = button.dataset.value === value;
    button.classList.toggle('selected', isSelected);
    button.setAttribute('aria-pressed', String(isSelected));
  });

  selectionGroups[groupName] = value;
}

function bindChoiceButtons() {
  document.querySelectorAll('.choice-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const groupName = button.closest('[data-group]')?.dataset.group;
      const value = button.dataset.value;

      if (!groupName || !value) {
        return;
      }

      selectChoice(groupName, value);
      clearMessage();
    });
  });
}

function getSelectedInterests() {
  const checkedInputs = document.querySelectorAll('.interest-item input:checked');
  return Array.from(checkedInputs).map((input) => input.value);
}

function saveCurrentProfile() {
  clearCachedAiRecommendation();
  window.BloomyLearningData.saveProfile(getChildProfileSnapshot(), diagnosisAnswers);
  const storage = window.BloomyLearningData.getStorageStatus();
  learningStorageMessage.textContent = storage.message;
  learningStorageMessage.classList.toggle('hidden', !storage.message);
}

function clearMessage() {
  formMessage.textContent = '';
  formMessage.classList.remove('success');
}

function showMessage(message, isSuccess = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle('success', isSuccess);
}

function validateForm() {
  const selectedAge = selectionGroups.age;
  const selectedExperience = selectionGroups.experience;
  const selectedInterests = getSelectedInterests();
  const selectedStudyTime = selectionGroups.studyTime;

  if (!selectedAge || !selectedExperience || selectedInterests.length === 0 || !selectedStudyTime) {
    return '모든 항목을 선택해 주세요. 관심사는 최소 1개 이상 선택해야 합니다.';
  }

  return '';
}

function showDiagnosisScreen() {
  profileScreen.classList.add('hidden-screen');
  diagnosisScreen.classList.remove('hidden-screen');
  diagnosisScreen.classList.add('active-screen');
  stepBadge.textContent = '2/2 단계';
}

function showProfileScreen() {
  diagnosisScreen.classList.add('hidden-screen');
  profileScreen.classList.remove('hidden-screen');
  profileScreen.classList.add('active-screen');
  stepBadge.textContent = '1/2 단계';
}

function showCurriculumScreen() {
  diagnosisScreen.classList.add('hidden-screen');
  summaryCard.classList.add('hidden');
  curriculumScreen.classList.remove('hidden-screen');
  curriculumScreen.classList.add('active-screen');
  stepBadge.textContent = '3/3 단계';
  renderCurriculum();
}

function showTodayLearningScreen() {
  stopSpeech('학습 화면으로 이동해요.');
  curriculumScreen.classList.add('hidden-screen');
  parentDashboardScreen.classList.add('hidden-screen');
  todayLearningScreen.classList.remove('hidden-screen');
  todayLearningScreen.classList.add('active-screen');
  renderTodayLearning({ session: window.BloomyLearningData.getActiveSession() });
  window.history.pushState({ bloomy: 'curriculum' }, '', '#curriculum');
  navigateLearningPage(0);
}

function updateDiagnosisProgress() {
  const totalQuestions = 5;
  const answeredCount = Object.keys(diagnosisAnswers).length;

  if (answeredCount === totalQuestions) {
    diagnosisMessage.textContent = '모든 문항을 답하셨습니다. 결과를 확인해 보세요.';
    diagnosisMessage.classList.remove('success');
    nextDiagnosisBtn.disabled = false;
    return;
  }

  diagnosisMessage.textContent = `${answeredCount}/${totalQuestions} 문항 답변 완료`;
  nextDiagnosisBtn.disabled = true;
}

function bindDiagnosisButtons() {
  document.querySelectorAll('.answer-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const question = button.dataset.question;
      const value = button.dataset.value;

      if (!question || !value) {
        return;
      }

      diagnosisAnswers[question] = value;
      saveCurrentProfile();

      const questionButtons = document.querySelectorAll(`.answer-btn[data-question="${question}"]`);
      questionButtons.forEach((answerButton) => {
        const isSelected = answerButton.dataset.value === value;
        answerButton.classList.toggle('selected', isSelected);
        answerButton.setAttribute('aria-pressed', String(isSelected));
      });

      updateDiagnosisProgress();
    });
  });
}

function renderResultSummary() {
  summaryList.innerHTML = '';

  const resultItems = [
    `아이 나이: ${selectionGroups.age}`,
    `영어 학습 경험: ${selectionGroups.experience}`,
    `관심사: ${getSelectedInterests().join(', ')}`,
    `하루 학습 시간: ${selectionGroups.studyTime}`,
    `진단 답변: ${Object.values(diagnosisAnswers).join(' / ')}`,
  ];

  resultItems.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    summaryList.appendChild(li);
  });

  summaryCard.classList.remove('hidden');
}

function buildCurriculumData() {
  const interests = getSelectedInterests();
  const favoriteTopic = interests.length > 0 ? interests[0] : '동물';
  const todayContent = getTodayLearningContent();

  const weekData = [
    {
      week: 1,
      title: '영어와 친해지기',
      goal: '영어 인사와 친숙한 영어 소리 경험하기',
      detail: [
        '영어 인사 표현을 함께 따라 말해요: Hello, Hi, Bye',
        '짧은 영어 노래와 음성과 리듬을 익혀요.',
        '부모가 천천히 말하고 아이가 따라 해 보는 놀이를 해요.',
      ],
      time: '10~15분',
      activity: '노래, 인사, 반복 말하기'
    },
    {
      week: 2,
      title: '알파벳 만나기',
      goal: '알파벳 모양과 소리 알아보기',
      detail: [
        '알파벳 모양을 흥미롭게 익혀요.',
        'A, B, C처럼 자주 쓰는 소리를 듣고 따라 해요.',
        '플래시카드로 알파벳 찾기 게임을 해요.',
      ],
      time: '10~15분',
      activity: '알파벳 카드, 소리 따라 읽기'
    },
    {
      week: 3,
      title: '관심사 기반 영어 단어',
      goal: `아이가 좋아하는 ${favoriteTopic} 주제와 관련된 영어 단어 배우기`,
      detail: [
        `${favoriteTopic} 관련 단어를 익혀요: 예시로 ${favoriteTopic === '우주' ? 'Star, Moon, Sun' : favoriteTopic === '동물' ? 'Bear, Cat, Dog' : favoriteTopic === '공룡' ? 'Dino, Roar, Egg' : favoriteTopic === '운동' ? 'Run, Ball, Kick' : favoriteTopic === '음악' ? 'Sing, Song, Dance' : 'Color, Paint, Smile'}`,
        '그림을 보며 단어를 연결해 느껴요.',
        '짧은 문장으로 말해보고 함께 따라 읽어요.',
      ],
      time: '15~20분',
      activity: '그림 카드, 단어 연결 활동'
    },
    {
      week: 4,
      title: '배운 표현 복습하기',
      goal: '그림책과 놀이를 통해 배운 내용 다시 경험하기',
      detail: [
        '배운 표현을 그림책 속 장면과 연결해요.',
        '영어 문장을 짧게 따라 말하며 복습해요.',
        '짧은 미션형 놀이로 다짐해 보고 표현을 다시 익혀요.',
      ],
      time: '10~20분',
      activity: '그림책 읽기, 복습 놀이'
    },
  ];

  weekData[2].detail = [
    `다음 추천 단어: ${todayContent.words.map((item) => item.word).join(', ')}`,
    `추천 근거: ${todayContent.recommendation.reasons.join(' ')}`,
    `${todayContent.recommendation.level} 난이도 · 약 ${todayContent.recommendation.estimatedMinutes}분`,
  ];

  return weekData;
}

function renderCurriculum() {
  const profileItems = [
    { label: '아이 나이', value: selectionGroups.age },
    { label: '영어 학습 경험', value: selectionGroups.experience },
    { label: '관심사', value: getSelectedInterests().join(', ') },
    { label: '하루 학습 시간', value: selectionGroups.studyTime },
  ];

  curriculumProfile.innerHTML = profileItems
    .map(
      (item) => `
        <div class="profile-summary-item">
          <label>${item.label}</label>
          <strong>${item.value}</strong>
        </div>
      `
    )
    .join('');

  const weeks = buildCurriculumData();

  curriculumList.innerHTML = weeks
    .map(
      (week, index) => `
        <article class="curriculum-week ${index === 0 ? 'open' : ''}">
          <button type="button" class="week-toggle-btn" data-week="${week.week}">
            <div class="week-summary">
              <div class="week-badge">${week.week}</div>
              <div class="week-info">
                <h3>${week.title}</h3>
                <p>${week.goal}</p>
              </div>
              <span class="week-toggle">${index === 0 ? '−' : '+'}</span>
            </div>
          </button>
          <div class="week-detail">
            <h4>학습 목표</h4>
            <ul>
              <li>${week.goal}</li>
            </ul>
            <div class="time-pill">활동 시간: ${week.time}</div>
            <h4 style="margin-top: 12px;">학습 활동</h4>
            <ul>
              ${week.detail.map((item) => `<li>${item}</li>`).join('')}
            </ul>
            <div class="time-pill">추천 활동: ${week.activity}</div>
          </div>
        </article>
      `
    )
    .join('');

  document.querySelectorAll('.week-toggle-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const card = button.closest('.curriculum-week');
      const isOpen = card.classList.contains('open');

      document.querySelectorAll('.curriculum-week').forEach((item) => {
        item.classList.remove('open');
        item.querySelector('.week-toggle').textContent = '+';
      });

      if (!isOpen) {
        card.classList.add('open');
        button.querySelector('.week-toggle').textContent = '−';
      }
    });
  });
}

function getChildProfileSnapshot() {
  return {
    age: selectionGroups.age || '',
    experience: selectionGroups.experience || '',
    interests: getSelectedInterests(),
    studyTime: selectionGroups.studyTime || '10분',
  };
}

function getTodayLearningContent(session = null) {
  if (session?.contentSnapshot?.words?.length) {
    currentRecommendation = session.recommendationSnapshot || session.contentSnapshot.recommendation || null;
    return session.contentSnapshot;
  }
  const interests = getSelectedInterests();
  const selectedInterest = interests[0] || '우주';
  const experience = selectionGroups.experience || '처음 시작해요';

  const wordMap = {
    우주: [
      { word: 'Star', meaning: '별', emoji: '⭐', image: 'star.svg', pronunciation: '스타' },
      { word: 'Moon', meaning: '달', emoji: '🌙', image: 'moon.svg', pronunciation: '문' },
      { word: 'Rocket', meaning: '로켓', emoji: '🚀', image: 'rocket.svg', pronunciation: '로켓' },
    ],
    동물: [
      { word: 'Cat', meaning: '고양이', emoji: '🐱', image: 'cat.svg', pronunciation: '캣' },
      { word: 'Dog', meaning: '강아지', emoji: '🐶', image: 'dog.svg', pronunciation: '도그' },
      { word: 'Rabbit', meaning: '토끼', emoji: '🐰', image: 'rabbit.svg', pronunciation: '래빗' },
    ],
    공룡: [
      { word: 'Dinosaur', meaning: '공룡', emoji: '🦖', image: 'dinosaur.svg', pronunciation: '다이너소어' },
      { word: 'Egg', meaning: '알', emoji: '🥚', image: 'egg.svg', pronunciation: '에그' },
      { word: 'Roar', meaning: '으르렁', emoji: '🦁', image: 'roar.svg', pronunciation: '로어' },
    ],
    운동: [
      { word: 'Run', meaning: '달리다', emoji: '🏃', image: 'run.svg', pronunciation: '런' },
      { word: 'Ball', meaning: '공', emoji: '⚽', image: 'ball.svg', pronunciation: '볼' },
      { word: 'Jump', meaning: '뛰다', emoji: '🦘', image: 'jump.svg', pronunciation: '점프' },
    ],
    음악: [
      { word: 'Song', meaning: '노래', emoji: '🎵', image: 'song.svg', pronunciation: '송' },
      { word: 'Dance', meaning: '춤추다', emoji: '💃', image: 'dance.svg', pronunciation: '댄스' },
      { word: 'Music', meaning: '음악', emoji: '🎶', image: 'music.svg', pronunciation: '뮤직' },
    ],
    미술: [
      { word: 'Paint', meaning: '물감', emoji: '🎨', image: 'paint.svg', pronunciation: '페인트' },
      { word: 'Color', meaning: '색칠하다', emoji: '🖍️', image: 'color.svg', pronunciation: '컬러' },
      { word: 'Smile', meaning: '웃다', emoji: '😊', image: 'smile.svg', pronunciation: '스마일' },
    ],
  };

  const phraseMap = {
    우주: [
      { english: 'Hello, Star!', korean: '안녕, 별아!', pronunciation: '헬로 스타' },
      { english: 'I love space!', korean: '나는 우주를 좋아해!', pronunciation: '아이 러브 스페이스' },
    ],
    동물: [
      { english: 'Hi, puppy!', korean: '안녕, 강아지!', pronunciation: '하이 퍼피' },
      { english: 'I love cats!', korean: '나는 고양이를 좋아해!', pronunciation: '아이 러브 캣츠' },
    ],
    공룡: [
      { english: 'Big dinosaur!', korean: '큰 공룡!', pronunciation: '빅 다이노서' },
      { english: 'I like eggs!', korean: '나는 알을 좋아해!', pronunciation: '아이 라이크 에그스' },
    ],
    운동: [
      { english: 'I can run!', korean: '나는 달릴 수 있어!', pronunciation: '아이 캔 런' },
      { english: "Let's jump!", korean: '함께 뛰어 보자!', pronunciation: '렛츠 점프' },
    ],
    음악: [
      { english: 'I like music!', korean: '나는 음악이 좋아!', pronunciation: '아이 라이크 뮤직' },
      { english: "Let's sing!", korean: '함께 노래하자!', pronunciation: '렛츠 싱' },
    ],
    미술: [
      { english: "Let's draw!", korean: '함께 그려 보자!', pronunciation: '렛츠 드로' },
      { english: 'I like colors!', korean: '나는 여러 색을 좋아해!', pronunciation: '아이 라이크 컬러스' },
    ],
    기본: [
      { english: 'Hello, friend!', korean: '안녕, 친구!', pronunciation: '헬로 프렌드' },
      { english: 'I love learning!', korean: '나는 배우는 게 좋아!', pronunciation: '아이 러브 러닝' },
    ],
  };

  const profile = getChildProfileSnapshot();
  const stats = window.BloomyLearningData.getDashboardStats();
  const selectedTopicWords = [...new Map(interests.flatMap((topic) => wordMap[topic] || []).map((item) => [item.word, item])).values()];
  const recommendation = window.BloomyRecommender.getRecommendation({
    profile,
    diagnosis: diagnosisAnswers,
    stats,
    words: selectedTopicWords.length ? selectedTopicWords : wordMap.우주,
    phrases: phraseMap[selectedInterest] || phraseMap.기본,
  });
  currentRecommendation = recommendation;
  let phrases = recommendation.phrases;
  if (recommendation.level === '기초') {
    phrases = phrases.map((item) => ({ ...item, english: item.english.replace(/^I love /, 'I like ') }));
  }
  const age = Number.parseInt(selectionGroups.age, 10) || 5;
  const baseLevel = recommendation.level === '기초' ? 'easy' : recommendation.level === '도전' ? 'confident' : 'normal';
  const content = {
    words: recommendation.words,
    phrases,
    baseLevel,
    selectedInterest,
    age,
    studyTime: selectionGroups.studyTime || '10분',
    recommendation: { ...recommendation, phrases },
  };
  return applyCachedAiRecommendation(content);
}

function getAiRecommendationCacheKey() {
  const profile = window.BloomyLearningData.getActiveProfile();
  return profile?.id ? `bloomy.aiRecommendation.${profile.id}` : null;
}

function readCachedAiRecommendation() {
  const key = getAiRecommendationCacheKey();
  if (!key) return null;
  try {
    const cached = JSON.parse(window.localStorage.getItem(key) || 'null');
    if (!cached?.recommendation || Date.now() - cached.savedAt > 24 * 60 * 60 * 1000) return null;
    const signature = JSON.stringify({ profile: getChildProfileSnapshot(), diagnosis: diagnosisAnswers });
    if (cached.profileSignature !== signature) return null;
    return cached.recommendation;
  } catch (error) {
    return null;
  }
}

function applyCachedAiRecommendation(content) {
  const cached = readCachedAiRecommendation();
  if (!cached || !Array.isArray(cached.words) || !Array.isArray(cached.phrases)) return content;
  const recommendation = sanitizeAiRecommendation(cached);
  const availableWords = new Map(content.words.map((item) => [item.word, item]));
  const availablePhrases = new Map(content.phrases.map((item) => [item.english, item]));
  const words = recommendation.words.map((item) => availableWords.get(item.word)).filter(Boolean);
  const phrases = recommendation.phrases.map((item) => availablePhrases.get(item.english)).filter(Boolean);
  if (!words.length || !phrases.length) return content;
  currentAiRecommendation = recommendation;
  currentRecommendation = recommendation;
  return {
    ...content,
    words,
    phrases,
    baseLevel: recommendation.level === '기초' ? 'easy' : recommendation.level === '도전' ? 'confident' : 'normal',
    recommendation: { ...recommendation, words, phrases },
  };
}

function getSpeechSynthesis() {
  try {
    return window.speechSynthesis && window.SpeechSynthesisUtterance
      ? window.speechSynthesis
      : null;
  } catch (error) {
    return null;
  }
}

function updateSpeechStatus(control, message, isPlaying = false) {
  if (!control) return;
  const status = control.querySelector('.speech-status');
  if (status) status.textContent = message;
  control.classList.toggle('is-speaking', isPlaying);
  control.querySelectorAll('.speech-stop-btn').forEach((button) => {
    button.disabled = !isPlaying;
  });
}

function stopSpeech(message = '재생을 멈췄어요.') {
  const previousSpeech = activeSpeech;
  speechPlaybackId += 1;
  activeSpeech = null;
  if (previousSpeech?.timer) window.clearTimeout(previousSpeech.timer);
  const synthesis = getSpeechSynthesis();
  if (synthesis) synthesis.cancel();
  if (previousSpeech?.control) updateSpeechStatus(previousSpeech.control, message, false);
}

function chooseEnglishVoice(synthesis) {
  try {
    const voices = synthesis.getVoices();
    return voices.find((voice) => voice.lang?.toLowerCase() === 'en-us')
      || voices.find((voice) => voice.lang?.toLowerCase().startsWith('en-'))
      || voices.find((voice) => voice.lang?.toLowerCase() === 'en')
      || null;
  } catch (error) {
    return null;
  }
}

function playSpeech(text, control, speed = 1, repeatCount = 1) {
  const synthesis = getSpeechSynthesis();
  if (!synthesis) {
    updateSpeechStatus(control, '이 기기에서는 음성 재생을 지원하지 않아요. 문장을 함께 읽어 볼까요?');
    return;
  }

  stopSpeech('새 발음을 재생해요.');
  const playbackId = speechPlaybackId;
  activeSpeech = { id: playbackId, control, text, speed, repeatCount, currentRepeat: 0, timer: null };
  updateSpeechStatus(control, '재생을 준비하고 있어요…', true);

  const speakNextRepeat = () => {
    if (!activeSpeech || activeSpeech.id !== playbackId) return;
    const SpeechUtterance = window.SpeechSynthesisUtterance;
    if (!SpeechUtterance) {
      updateSpeechStatus(control, '이 기기에서는 음성 재생을 지원하지 않아요.');
      activeSpeech = null;
      return;
    }

    activeSpeech.currentRepeat += 1;
    updateSpeechStatus(control, `재생 중 · ${activeSpeech.currentRepeat}/${activeSpeech.repeatCount}회`, true);
    const utterance = new SpeechUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = speed;
    utterance.pitch = 1.08;
    const voice = chooseEnglishVoice(synthesis);
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      if (!activeSpeech || activeSpeech.id !== playbackId) return;
      if (activeSpeech.currentRepeat < activeSpeech.repeatCount) {
        activeSpeech.timer = window.setTimeout(speakNextRepeat, 240);
      } else {
        updateSpeechStatus(control, '다 들었어요! 다시 들어 볼까요?');
        activeSpeech = null;
      }
    };
    utterance.onerror = (event) => {
      if (!activeSpeech || activeSpeech.id !== playbackId) return;
      const message = event.error === 'not-allowed'
        ? '음성 재생이 허용되지 않았어요. 다시 눌러 주세요.'
        : '음성을 재생하지 못했어요. 다시 눌러 주세요.';
      updateSpeechStatus(control, message);
      activeSpeech = null;
    };
    try {
      synthesis.speak(utterance);
    } catch (error) {
      updateSpeechStatus(control, '음성을 재생하지 못했어요. 다시 눌러 주세요.');
      activeSpeech = null;
    }
  };

  speakNextRepeat();
}

function renderSpeechControls() {
  return `
    <div class="speech-controls">
      <div class="speech-main-actions">
        <button type="button" class="speech-action" data-speed="1">🔊 보통 듣기</button>
        <button type="button" class="speech-action" data-speed="0.7">🐢 천천히 듣기</button>
      </div>
      <div class="speech-repeat-settings">
        <label class="speech-repeat-control"><span>횟수</span><select class="speech-repeat-count" aria-label="반복 횟수"><option value="2">2회</option><option value="3">3회</option></select></label>
        <label class="speech-repeat-control"><span>속도</span><select class="speech-repeat-speed" aria-label="반복 재생 속도"><option value="1">보통</option><option value="0.7">천천히</option></select></label>
      </div>
      <div class="speech-repeat-actions">
        <button type="button" class="speech-repeat-btn">🔁 선택한 횟수로 듣기</button>
        <button type="button" class="speech-stop-btn" disabled>⏹ 멈추기</button>
      </div>
      <p class="speech-status" aria-live="polite">준비됐어요</p>
    </div>
  `;
}

function bindSpeechControls(container) {
  container.querySelectorAll('.speech-controls').forEach((control) => {
    const card = control.closest('.word-card, .phrase-item');
    const text = card?.dataset.speechText || '';
    const trackPractice = () => {
      if (card?.classList.contains('word-card')) {
        const word = currentLearningContent?.words.find((item) => item.word === text);
        if (word) window.BloomyLearningData.recordWord(word);
      } else if (card?.classList.contains('phrase-item')) {
        const phrase = currentLearningContent?.phrases.find((item) => item.english === text);
        if (phrase) window.BloomyLearningData.recordPhrase(phrase);
      }
      renderLearningHomeStats();
    };
    control.querySelectorAll('.speech-action').forEach((button) => {
      button.addEventListener('click', () => {
        trackPractice();
        playSpeech(text, control, Number(button.dataset.speed), 1);
      });
    });
    control.querySelector('.speech-repeat-btn')?.addEventListener('click', () => {
      const repeatCount = Number(control.querySelector('.speech-repeat-count').value) || 2;
      const repeatSpeed = Number(control.querySelector('.speech-repeat-speed').value) || 1;
      trackPractice();
      playSpeech(text, control, repeatSpeed, repeatCount);
    });
    control.querySelector('.speech-stop-btn')?.addEventListener('click', () => stopSpeech('재생을 멈췄어요.'));
  });
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function formatDuration(seconds) {
  const minutes = Math.floor((seconds || 0) / 60);
  return minutes > 0 ? `${minutes}분` : `${Math.max(0, Math.floor(seconds || 0))}초`;
}

function safeAiCoachText(value, fallback, maxLength = 110) {
  if (typeof value !== 'string') return fallback;
  const text = value.replace(/<[^>]*>/g, ' ').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (!text || /(실패|틀렸|틀린|잘못|오답|못했|못 풀|낙제|뒤처|문제아|부족한 아이)/.test(text)) return fallback;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function safeAiCoachList(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 3)
    .map((item) => safeAiCoachText(item, '', 90))
    .filter(Boolean);
}

function sanitizeAiRecommendation(recommendation) {
  if (recommendation?.provider !== 'server_ai') return recommendation;
  const summary = safeAiCoachText(recommendation.summary, '관심사에 맞는 단어와 표현을 골랐어요.');
  return {
    ...recommendation,
    summary,
    reasons: [safeAiCoachText(recommendation.reasons?.[0], '아이의 관심사와 학습 기록을 바탕으로 골랐어요.')],
    improvement: summary,
    strengths: safeAiCoachList(recommendation.strengths),
    supportNeeds: safeAiCoachList(recommendation.supportNeeds),
    nextLearning: safeAiCoachText(recommendation.nextLearning, '추천 단어와 표현을 가볍게 연습해요.'),
  };
}

function renderLearningHomeStats() {
  const stats = window.BloomyLearningData.getDashboardStats();
  renderRecommendation(getTodayLearningContent());
  document.getElementById('todayProgressValue').textContent = `${stats.todayProgress}%`;
  document.getElementById('todayStatusValue').textContent = stats.activeSession ? '학습 중' : stats.todayCompleted ? '완료' : '학습 전';
  document.getElementById('weeklyDaysValue').textContent = `${stats.weeklyDays}일`;
  document.getElementById('streakValue').textContent = `${stats.streak}일`;
  document.getElementById('totalWordsValue').textContent = `${stats.totalWords}개`;
  document.getElementById('totalPhrasesValue').textContent = `${stats.totalPhrases}개`;
  document.getElementById('recentAccuracyValue').textContent = stats.recentAccuracy == null ? '데이터 없음' : `${Math.round(stats.recentAccuracy * 100)}%`;
  const storage = window.BloomyLearningData.getStorageStatus();
  learningStorageMessage.textContent = storage.message;
  learningStorageMessage.classList.toggle('hidden', !storage.message);
  if (stats.activeSession) startLearningPagesBtn.textContent = '이어 학습하기 🚀';
  else if (stats.todayCompleted) startLearningPagesBtn.textContent = '다시 학습하기 🌟';
  else startLearningPagesBtn.textContent = '학습 시작하기 🌟';
}

function renderRecommendation(content) {
  const recommendation = content?.recommendation || currentRecommendation;
  if (!recommendation) return;
  document.getElementById('recommendationTitle').textContent = `${recommendation.interest} 관심사 · ${recommendation.level} 단계`;
  document.getElementById('recommendationLevel').textContent = recommendation.level;
  document.getElementById('recommendationReason').textContent = recommendation.reasons.join(' ');
  document.getElementById('recommendedWords').textContent = recommendation.words.map((item) => item.word).join(' · ') || '데이터 없음';
  document.getElementById('recommendedPhrases').textContent = recommendation.phrases.map((item) => item.english).join(' / ') || '데이터 없음';
  document.getElementById('recommendedTime').textContent = `${recommendation.estimatedMinutes}분 · 하루 학습 시간 설정 반영`;
  document.getElementById('recommendedImprovement').textContent = recommendation.improvement;
  document.getElementById('recommendationSource').textContent = recommendation.provider === 'server_ai'
    ? `서버 AI 코치 분석 완료 · 최근 퀴즈 ${recommendation.historyCount || 0}문항 반영`
    : `규칙 기반 추천 · ${recommendation.historyCount ? `기록 ${recommendation.historyCount}문항` : '초기 진단 기반'} · AI 코치 계정 연결 후 분석 가능`;
  const connected = Boolean(getCoachAuth());
  aiRecommendationStatus.textContent = recommendation.provider === 'server_ai'
    ? `AI 코치가 분석했어요 · ${recommendation.summary || recommendation.reasons.join(' ')}`
    : connected ? '규칙 기반 추천입니다. AI 코치 분석을 요청할 수 있어요.' : '부모님 대시보드에서 계정을 연결하면 AI 코치 분석을 사용할 수 있어요.';
  aiRecommendationStatus.setAttribute('aria-busy', 'false');
  refreshAiRecommendationBtn.disabled = !connected;
}

function getCoachAuth() {
  try {
    const auth = JSON.parse(window.localStorage.getItem(COACH_AUTH_KEY) || 'null');
    return auth?.token ? auth : null;
  } catch (error) {
    return null;
  }
}

function renderCoachAuth() {
  const auth = getCoachAuth();
  aiAuthForm.classList.toggle('hidden', Boolean(auth));
  aiAuthDisconnectBtn.classList.toggle('hidden', !auth);
  aiAuthModeBtn.classList.toggle('hidden', Boolean(auth));
  aiAuthStatus.textContent = auth
    ? `보호자 계정 ${auth.email}으로 연결되어 있어요.`
    : '로그인하거나 계정을 만들면 인증된 서버 AI 코치를 사용할 수 있어요.';
  aiAuthSubmitBtn.textContent = aiAuthMode === 'login' ? '로그인' : '계정 만들기';
  aiAuthModeBtn.textContent = aiAuthMode === 'login' ? '계정 만들기' : '로그인으로 변경';
}

async function apiPost(path, body, token, timeoutMs = 18000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let result;
    try { result = await response.json(); } catch (error) { result = {}; }
    if (!response.ok) {
      const error = new Error(result.error || `서버 요청에 실패했어요 (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return result;
  } finally {
    window.clearTimeout(timeout);
  }
}

function setAiStatus(message, busy = false) {
  aiRecommendationStatus.textContent = message;
  aiRecommendationStatus.setAttribute('aria-busy', String(busy));
  refreshAiRecommendationBtn.disabled = busy || !getCoachAuth();
}

function clearCachedAiRecommendation() {
  const key = getAiRecommendationCacheKey();
  if (key) {
    try { window.localStorage.removeItem(key); } catch (error) { /* Keep learning data if storage is unavailable. */ }
  }
  currentAiRecommendation = null;
}

async function refreshAiRecommendation() {
  const auth = getCoachAuth();
  if (!auth) {
    setAiStatus('AI 코치 연결이 필요해요. 부모님 대시보드에서 로그인해 주세요.');
    return null;
  }
  if (aiRequestController) aiRequestController.abort();
  const controller = new AbortController();
  aiRequestController = controller;
  const timeout = window.setTimeout(() => controller.abort(), 20000);
  refreshAiRecommendationBtn.disabled = true;
  dashboardAiRefreshBtn.disabled = true;
  setAiStatus('학습 기록을 살펴보고 맞춤 추천을 만들고 있어요…', true);
  aiAuthStatus.textContent = `보호자 계정 ${auth.email}으로 서버에 연결되어 있어요.`;
  try {
    const content = currentLearningContent || getTodayLearningContent();
    const stats = window.BloomyLearningData.getDashboardStats();
    const profile = getChildProfileSnapshot();
    const completedSessions = stats.sessions.filter((session) => session.completed).length;
    const payload = {
      profile: {
        age: Number.parseInt(profile.age, 10) || content.age || 5,
        experience: profile.experience,
        interests: profile.interests,
        studyTime: Number.parseInt(profile.studyTime, 10) || 10,
      },
      diagnosis: { ...diagnosisAnswers },
      stats: {
        recentAttemptCount: stats.recentAttemptCount,
        recentAccuracy: stats.recentAccuracy,
        previousTrend: stats.previousTrend,
        weakWords: stats.weakWords.map((item) => item.word),
        words: stats.words,
        completionRate: stats.sessions.length ? completedSessions / stats.sessions.length : 0,
      },
      words: content.words,
      phrases: content.phrases,
    };
    const response = await fetch('/api/learning/recommendation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    let data;
    try { data = await response.json(); } catch (error) { data = {}; }
    if (!response.ok) {
      const error = new Error(data.error || `서버 요청에 실패했어요 (${response.status})`);
      error.status = response.status;
      throw error;
    }
    const allowedDifficulties = ['기초', '차근차근', '도전'];
    const maxStudyMinutes = Number.parseInt(profile.studyTime, 10) || 10;
    if (data.provider !== 'server_ai'
      || !Array.isArray(data.words) || !Array.isArray(data.phrases)
      || !allowedDifficulties.includes(data.difficulty)
      || !Number.isInteger(data.estimatedMinutes) || data.estimatedMinutes < 5 || data.estimatedMinutes > maxStudyMinutes
      || !Number.isInteger(data.historyCount) || data.historyCount < 0
      || data.words.some((item) => !item || typeof item.word !== 'string')
      || data.phrases.some((item) => !item || typeof item.english !== 'string')) {
      throw new Error('AI 응답 형식이 올바르지 않아 규칙 기반 추천을 사용해요.');
    }

    const wordMap = new Map(content.words.map((item) => [item.word, item]));
    const phraseMap = new Map(content.phrases.map((item) => [item.english, item]));
    const words = data.words.map((item) => wordMap.get(item.word)).filter(Boolean);
    const phrases = data.phrases.map((item) => phraseMap.get(item.english)).filter(Boolean);
    if (!words.length || !phrases.length) throw new Error('AI 추천 후보가 현재 학습 콘텐츠와 맞지 않아 규칙 기반 추천을 사용해요.');
    const recommendation = {
      ...content.recommendation,
      provider: 'server_ai',
      interest: profile.interests[0] || content.selectedInterest,
      level: data.difficulty,
      words,
      phrases,
      reasons: [safeAiCoachText(data.reason, '아이의 관심사와 학습 기록을 바탕으로 골랐어요.')],
      improvement: safeAiCoachText(data.summary, '관심사에 맞는 단어와 표현을 골랐어요.'),
      summary: safeAiCoachText(data.summary, '관심사에 맞는 단어와 표현을 골랐어요.'),
      strengths: safeAiCoachList(data.strengths),
      supportNeeds: safeAiCoachList(data.supportNeeds),
      nextLearning: safeAiCoachText(data.nextLearning, '추천 단어와 표현을 가볍게 연습해요.'),
      estimatedMinutes: data.estimatedMinutes,
      historyCount: data.historyCount,
      enoughHistory: data.historyCount >= 5,
    };
    currentAiRecommendation = recommendation;
    const activeSession = window.BloomyLearningData.getActiveSession();
    if (!activeSession) {
      currentRecommendation = recommendation;
      currentLearningContent = {
        ...content,
        words,
        phrases,
        baseLevel: recommendation.level === '기초' ? 'easy' : recommendation.level === '도전' ? 'confident' : 'normal',
        recommendation,
      };
    }
    const cacheKey = getAiRecommendationCacheKey();
    if (cacheKey && !activeSession) {
      try { window.localStorage.setItem(cacheKey, JSON.stringify({
        savedAt: Date.now(),
        profileSignature: JSON.stringify({ profile: getChildProfileSnapshot(), diagnosis: diagnosisAnswers }),
        recommendation,
      })); }
      catch (error) { /* A fresh response is still used in memory when storage is full. */ }
    }
    renderRecommendation({ recommendation });
    renderParentDashboard();
    setAiStatus(`AI 코치 분석이 완료됐어요. ${recommendation.summary}`);
    const source = document.getElementById('dashboardAiSource');
    if (source) source.textContent = `실제 서버 AI 분석 완료 · 후보 단어와 표현은 기존 학습 자료에서 선택`;
    return recommendation;
  } catch (error) {
    if (aiRequestController !== controller) return null;
    if (error.status === 401) {
      try { window.localStorage.removeItem(COACH_AUTH_KEY); } catch (storageError) { /* Ignore unavailable storage. */ }
      renderCoachAuth();
    }
    const message = error.name === 'AbortError'
      ? 'AI 응답 시간이 초과되어 규칙 기반 추천을 사용해요.'
      : `AI 코치에 연결하지 못해 규칙 기반 추천을 사용해요. ${error.message}`;
    clearCachedAiRecommendation();
    currentAiRecommendation = null;
    if (!window.BloomyLearningData.getActiveSession()) {
      currentLearningContent = getTodayLearningContent();
      currentRecommendation = currentLearningContent.recommendation;
    }
    renderRecommendation(currentLearningContent);
    renderParentDashboard();
    setAiStatus(message);
    const source = document.getElementById('dashboardAiSource');
    if (source) source.textContent = `규칙 기반 추천 사용 · ${message}`;
    return null;
  } finally {
    window.clearTimeout(timeout);
    if (aiRequestController === controller) {
      aiRequestController = null;
      refreshAiRecommendationBtn.disabled = !getCoachAuth();
      dashboardAiRefreshBtn.disabled = !getCoachAuth();
    }
  }
}

function renderParentDashboard() {
  const stats = window.BloomyLearningData.getDashboardStats();
  const profileRecord = window.BloomyLearningData.getActiveProfile();
  const profile = profileRecord?.profile || getChildProfileSnapshot();
  const content = getTodayLearningContent();
  const recommendation = currentAiRecommendation || content.recommendation;
  const accuracy = stats.averageAccuracy == null ? '데이터 없음' : `${Math.round(stats.averageAccuracy * 100)}%`;
  const summary = [
    ['누적 학습 일수', `${stats.totalDays}일`],
    ['누적 학습 시간', formatDuration(stats.totalSeconds)],
    ['학습 단어 수', `${stats.totalWords}개`],
    ['학습 표현 수', `${stats.totalPhrases}개`],
    ['전체 정답률', accuracy],
    ['연속 학습', `${stats.streak}일`],
  ];
  dashboardSummaryCards.innerHTML = summary.map(([label, value]) => `<div class="dashboard-stat"><span>${label}</span><strong>${value}</strong></div>`).join('');
  document.getElementById('dashboardProfileLine').textContent = `${profile.age || '나이 미입력'} · ${(profile.interests || []).join(', ') || '관심사 미입력'} · 하루 ${profile.studyTime || '10분'}`;
  document.getElementById('weeklySummaryText').textContent = `이번 주 ${stats.weeklyDays}일 학습 · ${formatDuration(stats.weeklySeconds)} · 완료 ${stats.weekly.filter((day) => day.completed).length}회`;
  const maxSeconds = Math.max(1, ...stats.weekly.map((day) => day.seconds));
  const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
  weeklyChart.innerHTML = stats.weekly.map((day) => {
    const weekday = weekdayNames[new Date(`${day.date}T12:00:00`).getDay()];
    const height = day.seconds ? Math.max(6, Math.round((day.seconds / maxSeconds) * 100)) : 0;
    return `<div class="weekly-day"><span class="weekly-value">${day.seconds ? escapeHTML(formatDuration(day.seconds)) : '—'}</span><div class="weekly-bar-track"><span class="weekly-bar ${day.completed ? 'completed' : ''}" style="height:${height}%"></span></div><strong>${weekday}</strong><small>${day.completed ? '완료' : day.studied ? '학습' : '—'}</small></div>`;
  }).join('');

  if (!stats.words.length) {
    wordAchievementList.innerHTML = '<p class="dashboard-empty">아직 저장된 퀴즈 답변이 없어요.</p>';
  } else {
    wordAchievementList.innerHTML = stats.words.slice(0, 8).map((word) => `<div class="achievement-row"><div class="achievement-row-top"><span>${escapeHTML(word.word)}${word.meaning ? ` · ${escapeHTML(word.meaning)}` : ''}</span><span>${word.accuracy == null ? '데이터 없음' : `${Math.round(word.accuracy * 100)}%`}</span></div><div class="achievement-track"><span style="width:${Math.round((word.accuracy || 0) * 100)}%"></span></div><small>${word.correct} 정답 · ${word.wrong} 오답</small></div>`).join('');
  }
  if (!stats.totalQuiz) {
    weakWordList.innerHTML = '<p class="dashboard-empty">퀴즈 기록이 쌓이면 복습 단어를 보여드려요.</p>';
  } else if (!stats.weakWords.length) {
    weakWordList.innerHTML = '<p class="dashboard-empty">현재 반복 오답 기준에 해당하는 단어가 없어요.</p>';
  } else {
    weakWordList.innerHTML = stats.weakWords.map((word) => `<div class="weak-word-row"><strong>${escapeHTML(word.word)}${word.meaning ? ` · ${escapeHTML(word.meaning)}` : ''}</strong><span>${word.wrong}회 오답 · 정답률 ${Math.round(word.accuracy * 100)}% · 다음 학습에 복습으로 포함</span></div>`).join('');
  }

  document.getElementById('dashboardAnalysisTitle').textContent = stats.recentAttemptCount >= 5 ? `최근 퀴즈 ${stats.recentAttemptCount}문항 분석` : '초기 진단과 현재까지의 기록';
  document.getElementById('dashboardRecommendationLevel').textContent = recommendation.level;
  const analysis = recommendation.provider === 'server_ai'
    ? `${recommendation.summary} ${recommendation.reasons.join(' ')}`
    : stats.recentAttemptCount >= 5
      ? `${recommendation.reasons.join(' ')} ${recommendation.improvement}`
    : `실제 퀴즈 기록 ${stats.totalQuiz}문항만 확인했어요. 분석이 충분하지 않아 현재 추천은 진단과 관심사 기반의 규칙 추천입니다. ${recommendation.reasons.join(' ')}`;
  document.getElementById('dashboardAnalysisText').textContent = analysis;
  document.getElementById('aiStrengthsText').textContent = recommendation.provider === 'server_ai'
    ? (recommendation.strengths.join(' ') || '충분한 강점 정보가 없어 요약을 참고해 주세요.')
    : 'AI 코치 연결 전에는 규칙 추천만 제공해요.';
  document.getElementById('aiSupportNeedsText').textContent = recommendation.provider === 'server_ai'
    ? (recommendation.supportNeeds.join(' ') || '특정 보완 영역이 보고되지 않았어요.')
    : (stats.weakWords.length ? stats.weakWords.map((item) => item.word).join(', ') : 'AI 코치 연결 전에는 반복 오답 기록을 기준으로 안내해요.');
  document.getElementById('aiNextLearningText').textContent = recommendation.provider === 'server_ai'
    ? recommendation.nextLearning
    : `${recommendation.words.map((item) => item.word).join(', ')} · ${recommendation.phrases.map((item) => item.english).join(' / ')}`;
  const todaySessions = stats.sessions.filter((session) => session.date === stats.today);
  const todayWords = new Set(todaySessions.flatMap((session) => (session.learnedWords || []).map((word) => word.word)));
  const todayPhrases = new Set(todaySessions.flatMap((session) => (session.learnedPhrases || []).map((phrase) => phrase.english)));
  const latestToday = todaySessions[todaySessions.length - 1];
  const feedback = [
    ['오늘 학습 요약', latestToday ? `${latestToday.completed ? '학습을 완료했어요.' : '학습을 진행 중이에요.'} ${todayWords.size}개 단어, ${todayPhrases.size}개 표현을 열어 봤어요.` : '오늘 저장된 학습 세션이 없어요.'],
    ['잘한 점', stats.recentAttempts.length ? `${stats.recentAttempts.filter((item) => item.correct).length}/${stats.recentAttempts.length}개 최근 문제를 맞혔어요.` : '퀴즈 기록이 아직 없어 성취를 판단할 수 없어요.'],
    ['도움이 필요한 부분', stats.weakWords.length ? `${stats.weakWords.map((item) => item.word).join(', ')} 단어를 함께 복습해 주세요.` : stats.totalQuiz ? '반복 오답 단어가 아직 없어요.' : '퀴즈를 풀면 복습할 부분을 알려드려요.'],
    ['다음에 기대할 점', `${recommendation.words.map((item) => item.word).join(', ')} 단어와 관심사 표현을 ${recommendation.estimatedMinutes}분 학습하도록 추천해요.`],
  ];
  dashboardFeedback.innerHTML = feedback.map(([title, text]) => `<div class="parent-feedback-card"><strong>${title}</strong><span>${escapeHTML(text)}</span></div>`).join('');
  const storage = window.BloomyLearningData.getStorageStatus();
  const storageMessage = document.getElementById('dashboardStorageMessage');
  storageMessage.textContent = storage.message;
  storageMessage.classList.toggle('hidden', !storage.message);
  document.getElementById('dashboardAiSource').textContent = recommendation.provider === 'server_ai'
    ? `실제 서버 AI 분석 완료 · ${recommendation.estimatedMinutes}분 예상 · ${recommendation.historyCount || 0}문항 반영`
    : '브라우저 학습 기록 기반 규칙 분석 · AI 코치 미연결';
  renderCoachAuth();
}

function renderTodayLearning(options = {}) {
  stopSpeech('오늘의 학습을 준비하고 있어요.');
  const session = options.session || null;
  currentLearningContent = getTodayLearningContent(session);
  const { words, phrases, selectedInterest, baseLevel, age, studyTime } = currentLearningContent;

  wordCardList.innerHTML = words
    .map(
      (item) => `
        <div class="word-card" data-speech-text="${item.word}">
          <div class="word-visual" role="img" aria-label="${item.word}">
            <img class="learning-art" src="./assets/images/${item.image}" alt="" loading="lazy" hidden>
            <span class="word-icon" aria-hidden="true">${item.emoji}</span>
          </div>
          <h4>${item.word}</h4>
          <p>${item.meaning}</p>
          ${renderSpeechControls()}
        </div>
      `
    )
    .join('');
  initializeLearningImages(wordCardList);

  phraseList.innerHTML = phrases
    .map(
      (item) => `
        <div class="phrase-item" data-speech-text="${item.english}">
          <strong>${item.english}</strong>
          <span>${item.korean}</span>
          ${renderSpeechControls()}
        </div>
      `
    )
    .join('');

  currentQuizQuestions = words.map((word, index) => ({
    question: '큰 그림을 보고 알맞은 영어 단어를 골라요!', answer: word.word, icon: word.emoji, image: word.image,
    options: [word.word, words[(index + 1) % words.length].word, words[(index + 2) % words.length].word].sort(() => (index % 2 ? 1 : -1)),
  }));
  quizState.answers = [null, null, null];
  session?.quizAttempts?.forEach((attempt) => {
    if (attempt.questionIndex >= 0 && attempt.questionIndex < quizState.answers.length) {
      quizState.answers[attempt.questionIndex] = attempt.selected;
    }
  });
  quizState.starCount = session?.quizAttempts?.filter((attempt) => attempt.correct).length || 0;
  quizState.answeredQuestions = session?.quizAttempts?.length || 0;
  activeQuizIndex = session?.quizIndex ?? 0;
  quizFeedback.textContent = '';
  quizFeedback.classList.remove('success', 'error');
  renderQuizQuestion();

  completionStep.classList.add('hidden');

  todayLearningSummary.textContent = `${age}세, ${selectedInterest}를 좋아하는 아이를 위한 ${baseLevel === 'easy' ? '쉬운' : baseLevel === 'confident' ? '도전' : '차근차근'} 학습이에요. ${studyTime} 안에 가볍게 마쳐요.`;
  currentLearningStep = session?.currentPage ?? 0;
  setLearningStep(currentLearningStep);
  renderRecommendation(currentLearningContent);
  renderLearningHomeStats();

  bindSpeechControls(wordCardList);
  bindSpeechControls(phraseList);
}

function setLearningStep(index) {
  currentLearningStep = Math.max(0, Math.min(index, 4));
  learningSteps.forEach((step, stepIndex) => step.classList.toggle('hidden', stepIndex !== currentLearningStep));
  const pageLabels = ['학습 홈', '오늘의 단어', '오늘의 표현', '그림 퀴즈', '학습 완료'];
  learningProgressLabel.textContent = pageLabels[currentLearningStep];
  learningProgressBar.style.width = `${(currentLearningStep / 4) * 100}%`;
  learningStarCount.textContent = `⭐ ${quizState.starCount}`;
  learningHomeBtn.classList.toggle('hidden', currentLearningStep === 0 || currentLearningStep === 4);
}

function showPauseMessage(previousPage, nextPage) {
  if (nextPage === 0 && previousPage > 0 && previousPage < 4
    && window.BloomyLearningData.getActiveSession()) {
    todayLearningSummary.textContent = '여기까지 배운 내용은 저장했어요. 준비되면 이어서 해요. 🌱';
  }
}

function navigateLearningPage(index) {
  stopSpeech('페이지를 이동해 재생을 멈췄어요.');
  showPauseMessage(currentLearningStep, index);
  setLearningStep(index);
  recordPageExposure(index);
  window.BloomyLearningData.setCurrentPage(index, activeQuizIndex);
  if (index === 0 || index === 4) window.BloomyLearningData.pauseTimer();
  else window.BloomyLearningData.resumeTimer();
  window.history.pushState({ bloomy: 'learning', page: index, quizIndex: activeQuizIndex }, '', `#learning-${index}`);
  renderLearningHomeStats();
  todayLearningScreen.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function recordPageExposure(page) {
  if (page === 1) currentLearningContent?.words.forEach((word) => window.BloomyLearningData.recordWord(word));
  if (page === 2) currentLearningContent?.phrases.forEach((phrase) => window.BloomyLearningData.recordPhrase(phrase));
}

function showLearningPageFromHistory(state) {
  stopSpeech('페이지를 이동해 재생을 멈췄어요.');
  if (state?.bloomy === 'dashboard') {
    window.BloomyLearningData.pauseTimer();
    todayLearningScreen.classList.add('hidden-screen');
    curriculumScreen.classList.add('hidden-screen');
    parentDashboardScreen.classList.remove('hidden-screen');
    parentDashboardScreen.classList.add('active-screen');
    renderParentDashboard();
    return;
  }
  if (state?.bloomy === 'learning') {
    curriculumScreen.classList.add('hidden-screen');
    parentDashboardScreen.classList.add('hidden-screen');
    todayLearningScreen.classList.remove('hidden-screen');
    todayLearningScreen.classList.add('active-screen');
    if (typeof state.quizIndex === 'number') activeQuizIndex = state.quizIndex;
    showPauseMessage(currentLearningStep, state.page);
    setLearningStep(state.page);
    recordPageExposure(state.page);
    window.BloomyLearningData.setCurrentPage(state.page, activeQuizIndex);
    if (state.page === 0 || state.page === 4) window.BloomyLearningData.pauseTimer();
    else window.BloomyLearningData.resumeTimer();
    if (state.page === 3) renderQuizQuestion();
    renderLearningHomeStats();
    return;
  }
  if (state?.bloomy === 'curriculum') {
    window.BloomyLearningData.pauseTimer();
    todayLearningScreen.classList.add('hidden-screen');
    parentDashboardScreen.classList.add('hidden-screen');
    curriculumScreen.classList.remove('hidden-screen');
    curriculumScreen.classList.add('active-screen');
    return;
  }
  if (state?.bloomy === 'home') {
    todayLearningScreen.classList.add('hidden-screen');
    profileScreen.classList.remove('hidden-screen');
    return;
  }
  todayLearningScreen.classList.add('hidden-screen');
  curriculumScreen.classList.remove('hidden-screen');
}

function openParentDashboard(source = 'learning') {
  stopSpeech('부모님 대시보드로 이동해 음성을 멈췄어요.');
  window.BloomyLearningData.pauseTimer();
  const previousState = source === 'curriculum'
    ? { bloomy: 'curriculum' }
    : { bloomy: 'learning', page: currentLearningStep, quizIndex: activeQuizIndex };
  const previousHash = source === 'curriculum' ? '#curriculum' : `#learning-${currentLearningStep}`;
  window.history.pushState(previousState, '', previousHash);
  window.history.pushState({ bloomy: 'dashboard', from: source }, '', '#parent-dashboard');
  todayLearningScreen.classList.add('hidden-screen');
  curriculumScreen.classList.add('hidden-screen');
  parentDashboardScreen.classList.remove('hidden-screen');
  parentDashboardScreen.classList.add('active-screen');
  renderParentDashboard();
  parentDashboardScreen.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderQuizQuestion() {
  const item = currentQuizQuestions[activeQuizIndex];
  if (!item) return;
  quizQuestionCount.textContent = `문제 ${activeQuizIndex + 1} / ${currentQuizQuestions.length}`;
  const wordChoices = currentLearningContent?.words || getTodayLearningContent().words;
  quizList.innerHTML = `<div class="quiz-item"><div class="quiz-illustration" role="img" aria-label="${item.answer}"><img class="quiz-picture-image learning-art" src="./assets/images/${item.image}" alt="" hidden><span class="quiz-emoji" aria-hidden="true">${item.icon}</span></div><h4>${item.question}</h4><div class="quiz-options">${item.options.map((option) => {
    const choice = wordChoices.find((word) => word.word === option);
    return `<button type="button" class="quiz-option" data-option="${option}"><span class="quiz-option-visual" aria-hidden="true"><img class="learning-art" src="./assets/images/${choice?.image || ''}" alt="" hidden><span>${choice?.emoji || '✨'}</span></span><span>${option}</span></button>`;
  }).join('')}</div></div>`;
  initializeLearningImages(quizList);
  quizList.querySelectorAll('.quiz-option').forEach((button) => button.addEventListener('click', () => answerQuiz(button)));
  const previousAnswer = quizState.answers?.[activeQuizIndex];
  checkQuizBtn.disabled = true;
  checkQuizBtn.textContent = activeQuizIndex === 2 ? '학습 마치기' : '다음 문제';
  quizFeedback.textContent = '';
  quizFeedback.classList.remove('success', 'error');
  if (previousAnswer) {
    quizList.querySelectorAll('.quiz-option').forEach((option) => {
      option.disabled = true;
      if (option.dataset.option === item.answer) option.classList.add('correct');
      if (option.dataset.option === previousAnswer && previousAnswer !== item.answer) option.classList.add('wrong');
    });
    quizFeedback.textContent = previousAnswer === item.answer ? '정답이에요! 별을 하나 받았어요. ⭐' : `괜찮아요! 정답은 ${item.answer}예요.`;
    quizFeedback.classList.add(previousAnswer === item.answer ? 'success' : 'error');
    checkQuizBtn.disabled = false;
  }
}

function initializeLearningImages(container) {
  container.querySelectorAll('.learning-art').forEach((image) => {
    image.hidden = false;
    image.style.visibility = 'hidden';
    const showImage = () => {
      image.hidden = false;
      image.style.visibility = '';
      if (image.nextElementSibling) image.nextElementSibling.hidden = true;
    };
    const showFallback = () => {
      image.hidden = true;
      image.style.visibility = '';
      if (image.nextElementSibling) image.nextElementSibling.hidden = false;
    };
    image.addEventListener('load', showImage, { once: true });
    image.addEventListener('error', showFallback, { once: true });
    if (image.complete) {
      if (image.naturalWidth > 0) showImage();
      else showFallback();
    }
  });
}

function answerQuiz(button) {
  if (quizState.answers?.[activeQuizIndex]) return;
  const selected = button.dataset.option;
  const answer = currentQuizQuestions[activeQuizIndex].answer;
  quizState.answers[activeQuizIndex] = selected;
  quizList.querySelectorAll('.quiz-option').forEach((option) => {
    option.disabled = true;
    if (option.dataset.option === answer) option.classList.add('correct');
    else if (option === button) option.classList.add('wrong');
  });
  if (selected === answer) {
    quizState.starCount += 1;
    quizFeedback.textContent = '와, 정답이에요! 반짝 별 하나 획득! ⭐';
    quizFeedback.classList.add('success');
  } else {
    quizFeedback.textContent = `괜찮아요, 멋진 도전이에요! 정답은 ${answer}예요. 다음 문제도 해볼까요?`;
    quizFeedback.classList.add('error');
  }
  const wordDetails = currentLearningContent?.words.find((item) => item.word === answer);
  clearCachedAiRecommendation();
  window.BloomyLearningData.recordQuizAttempt({
    questionIndex: activeQuizIndex,
    word: answer,
    meaning: wordDetails?.meaning || '',
    selected,
    correct: selected === answer,
    wordDetails,
  });
  quizState.answeredQuestions = quizState.answers.filter(Boolean).length;
  learningStarCount.textContent = `⭐ ${quizState.starCount}`;
  renderLearningHomeStats();
  checkQuizBtn.disabled = false;
}

function restoreSavedProfile(saved) {
  if (!saved?.profile) return;
  const profile = saved.profile;
  ['age', 'experience', 'studyTime'].forEach((group) => {
    if (profile[group]) selectChoice(group, profile[group]);
  });
  const interests = new Set(profile.interests || []);
  document.querySelectorAll('.interest-item input').forEach((input) => {
    input.checked = interests.has(input.value);
  });
  Object.keys(diagnosisAnswers).forEach((key) => delete diagnosisAnswers[key]);
  Object.assign(diagnosisAnswers, saved.diagnosis || {});
  Object.entries(diagnosisAnswers).forEach(([question, value]) => {
    document.querySelectorAll(`.answer-btn[data-question="${question}"]`).forEach((button) => {
      const selected = button.dataset.value === value;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  });
}

function initializeFromSavedData() {
  const savedProfile = window.BloomyLearningData.getActiveProfile();
  restoreSavedProfile(savedProfile);
  renderTodayLearning();
  updateDiagnosisProgress();
  renderLearningHomeStats();

  if (!savedProfile) return;
  const hasFullDiagnosis = Object.keys(savedProfile.diagnosis || {}).length === 5;
  if (!hasFullDiagnosis) {
    showDiagnosisScreen();
    return;
  }

  renderResultSummary();
  showCurriculumScreen();
  const session = window.BloomyLearningData.getActiveSession();
  if (!session) return;

  curriculumScreen.classList.add('hidden-screen');
  todayLearningScreen.classList.remove('hidden-screen');
  todayLearningScreen.classList.add('active-screen');
  renderTodayLearning({ session });
  const page = session.currentPage || 0;
  if (page === 0 || page === 4) window.BloomyLearningData.pauseTimer();
  else window.BloomyLearningData.resumeTimer();
  setLearningStep(page);
  window.history.replaceState({ bloomy: 'learning', page, quizIndex: session.quizIndex }, '', `#learning-${page}`);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const validationMessage = validateForm();

  if (validationMessage) {
    showMessage(validationMessage);
    return;
  }

  saveCurrentProfile();
  showDiagnosisScreen();
  updateDiagnosisProgress();
});

backToProfileBtn.addEventListener('click', () => {
  showProfileScreen();
});

nextDiagnosisBtn.addEventListener('click', () => {
  const totalQuestions = 5;
  const answeredCount = Object.keys(diagnosisAnswers).length;

  if (answeredCount < totalQuestions) {
    diagnosisMessage.textContent = '모든 질문에 답한 뒤 결과를 확인할 수 있어요.';
    diagnosisMessage.classList.remove('success');
    return;
  }

  renderResultSummary();
  diagnosisScreen.classList.add('hidden-screen');
  summaryCard.classList.remove('hidden');
  diagnosisMessage.textContent = '';
});

showCurriculumBtn.addEventListener('click', () => {
  showCurriculumScreen();
});

backToDiagnosisBtn.addEventListener('click', () => {
  curriculumScreen.classList.add('hidden-screen');
  summaryCard.classList.remove('hidden');
  diagnosisScreen.classList.add('hidden-screen');
  profileScreen.classList.add('hidden-screen');
  showDiagnosisScreen();
  stepBadge.textContent = '2/2 단계';
});

goTodayLearningBtn.addEventListener('click', () => {
  showTodayLearningScreen();
});

checkQuizBtn.addEventListener('click', () => {
  if (!quizState.answers?.[activeQuizIndex]) return;
  if (activeQuizIndex < currentQuizQuestions.length - 1) {
    activeQuizIndex += 1;
    window.history.pushState({ bloomy: 'learning', page: 3, quizIndex: activeQuizIndex }, '', `#learning-3-${activeQuizIndex + 1}`);
    window.BloomyLearningData.setCurrentPage(3, activeQuizIndex);
    renderQuizQuestion();
    return;
  }

  finalStarCount.textContent = String(quizState.starCount);
  completionSummary.textContent = `오늘의 학습을 마쳤어요! 반짝 별 ${quizState.starCount}개를 모았어요!`;
  const { words, phrases } = currentLearningContent;
  completionList.innerHTML = words.map((item) => `<li>${item.emoji} <strong>${item.word}</strong> · ${item.meaning}</li>`).join('');
  completionPhraseList.innerHTML = phrases.map((item) => `<li><strong>${item.english}</strong> · ${item.korean}</li>`).join('');
  window.BloomyLearningData.completeSession();
  navigateLearningPage(4);
});

startLearningPagesBtn.addEventListener('click', () => {
  const existing = window.BloomyLearningData.getActiveSession();
  const session = window.BloomyLearningData.startOrResumeSession(getChildProfileSnapshot(), currentLearningContent);
  renderTodayLearning({ session });
  const destination = existing
    ? (session.currentPage === 0 ? session.resumePage : session.currentPage)
    : 1;
  navigateLearningPage(destination || 1);
});
wordBackBtn.addEventListener('click', () => navigateLearningPage(0));
wordNextBtn.addEventListener('click', () => navigateLearningPage(2));
phraseBackBtn.addEventListener('click', () => navigateLearningPage(1));
phraseNextBtn.addEventListener('click', () => navigateLearningPage(3));
quizBackBtn.addEventListener('click', () => navigateLearningPage(2));
completionBackBtn.addEventListener('click', () => navigateLearningPage(3));
learningHomeBtn.addEventListener('click', () => navigateLearningPage(0));
completionHomeBtn.addEventListener('click', () => {
  startLearningPagesBtn.textContent = '다시 학습하기 🌟';
  navigateLearningPage(0);
});
parentDashboardBtn.addEventListener('click', () => openParentDashboard('learning'));
curriculumParentDashboardBtn.addEventListener('click', () => openParentDashboard('curriculum'));
dashboardBackBtn.addEventListener('click', () => window.history.back());
dashboardRefreshBtn.addEventListener('click', renderParentDashboard);
dashboardAiRefreshBtn.addEventListener('click', refreshAiRecommendation);
refreshAiRecommendationBtn.addEventListener('click', refreshAiRecommendation);
aiAuthModeBtn.addEventListener('click', () => {
  aiAuthMode = aiAuthMode === 'login' ? 'register' : 'login';
  aiAuthPassword.autocomplete = aiAuthMode === 'login' ? 'current-password' : 'new-password';
  renderCoachAuth();
});
aiAuthForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  aiAuthSubmitBtn.disabled = true;
  aiAuthStatus.textContent = aiAuthMode === 'login' ? '계정에 연결하고 있어요…' : '보호자 계정을 만들고 있어요…';
  try {
    const result = await apiPost(aiAuthMode === 'login' ? '/api/login' : '/api/register', {
      email: aiAuthEmail.value.trim(),
      password: aiAuthPassword.value,
    }, null);
    window.localStorage.setItem(COACH_AUTH_KEY, JSON.stringify({ token: result.token, email: result.account.email }));
    aiAuthPassword.value = '';
    renderCoachAuth();
    await refreshAiRecommendation();
  } catch (error) {
    aiAuthStatus.textContent = error.message;
  } finally {
    aiAuthSubmitBtn.disabled = false;
  }
});
aiAuthDisconnectBtn.addEventListener('click', () => {
  if (aiRequestController) aiRequestController.abort();
  aiRequestController = null;
  try { window.localStorage.removeItem(COACH_AUTH_KEY); } catch (error) { /* Ignore unavailable storage. */ }
  renderCoachAuth();
  setAiStatus('계정 연결을 해제했어요. 현재 화면의 규칙 기반 추천은 계속 사용할 수 있어요.');
});
window.addEventListener('popstate', (event) => showLearningPageFromHistory(event.state));
window.addEventListener('pagehide', () => stopSpeech('페이지가 닫혀 재생을 멈췄어요.'));

bindChoiceButtons();
bindDiagnosisButtons();
initializeFromSavedData();
