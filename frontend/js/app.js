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
const goTodayLearningBtn = document.getElementById('goTodayLearningBtn');
const backToCurriculumBtn = document.getElementById('backToCurriculumBtn');
const retryLearningBtn = document.getElementById('retryLearningBtn');
const returnHomeBtn = document.getElementById('returnHomeBtn');
const todayLearningSummary = document.getElementById('todayLearningSummary');
const wordCardList = document.getElementById('wordCardList');
const phraseList = document.getElementById('phraseList');
const quizList = document.getElementById('quizList');
const quizFeedback = document.getElementById('quizFeedback');
const checkQuizBtn = document.getElementById('checkQuizBtn');
const completionStep = document.getElementById('completionStep');
const finalStarCount = document.getElementById('finalStarCount');
const completionSummary = document.getElementById('completionSummary');
const completionList = document.getElementById('completionList');

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
  curriculumScreen.classList.add('hidden-screen');
  todayLearningScreen.classList.remove('hidden-screen');
  todayLearningScreen.classList.add('active-screen');
  renderTodayLearning();
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

function getTodayLearningContent() {
  const interests = getSelectedInterests();
  const selectedInterest = interests[0] || '우주';
  const experience = selectionGroups.experience || '처음 시작해요';

  const wordMap = {
    우주: [
      { word: 'Star', meaning: '별', emoji: '⭐', pronunciation: '스타' },
      { word: 'Moon', meaning: '달', emoji: '🌙', pronunciation: '문' },
      { word: 'Rocket', meaning: '로켓', emoji: '🚀', pronunciation: '로켓' },
    ],
    동물: [
      { word: 'Cat', meaning: '고양이', emoji: '🐱', pronunciation: '캣' },
      { word: 'Dog', meaning: '강아지', emoji: '🐶', pronunciation: '독' },
      { word: 'Rabbit', meaning: '토끼', emoji: '🐰', pronunciation: '래빗' },
    ],
    공룡: [
      { word: 'Dinosaur', meaning: '공룡', emoji: '🦖', pronunciation: '다이노서' },
      { word: 'Egg', meaning: '알', emoji: '🥚', pronunciation: '에그' },
      { word: 'Roar', meaning: '으르렁', emoji: '🌋', pronunciation: '로어' },
    ],
    운동: [
      { word: 'Run', meaning: '달리다', emoji: '🏃', pronunciation: '런' },
      { word: 'Ball', meaning: '공', emoji: '⚽', pronunciation: '볼' },
      { word: 'Jump', meaning: '뛰다', emoji: '🦘', pronunciation: '점프' },
    ],
    음악: [
      { word: 'Song', meaning: '노래', emoji: '🎵', pronunciation: '송' },
      { word: 'Dance', meaning: '춤', emoji: '💃', pronunciation: '댄스' },
      { word: 'Music', meaning: '음악', emoji: '🎶', pronunciation: '뮤직' },
    ],
    미술: [
      { word: 'Paint', meaning: '그리다', emoji: '🎨', pronunciation: '페인트' },
      { word: 'Color', meaning: '색깔', emoji: '🖍️', pronunciation: '컬러' },
      { word: 'Smile', meaning: '미소', emoji: '😊', pronunciation: '스마일' },
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
    기본: [
      { english: 'Hello, friend!', korean: '안녕, 친구!', pronunciation: '헬로 프렌드' },
      { english: 'I love learning!', korean: '나는 배움이 좋아!', pronunciation: '아이 러브 러닝' },
    ],
  };

  const words = wordMap[selectedInterest] || wordMap.우주;
  const phrases = phraseMap[selectedInterest] || phraseMap.기본;

  const baseLevel = experience.includes('처음') || experience.includes('가끔') ? 'easy' : 'normal';

  return { words, phrases, baseLevel, selectedInterest };
}

function speakText(text) {
  const speechSynthesisAPI = window.speechSynthesis;

  if (!speechSynthesisAPI) {
    window.alert('이 브라우저는 음성 재생을 지원하지 않습니다. 대신 글자를 읽어 주세요.');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  utterance.pitch = 1.2;
  speechSynthesisAPI.cancel();
  speechSynthesisAPI.speak(utterance);
}

function renderTodayLearning() {
  const { words, phrases, selectedInterest } = getTodayLearningContent();

  wordCardList.innerHTML = words
    .map(
      (item) => `
        <div class="word-card">
          <div class="word-icon">${item.emoji}</div>
          <h4>${item.word}</h4>
          <p>${item.meaning}</p>
          <button type="button" class="word-play-btn" data-text="${item.word}">발음 듣기</button>
        </div>
      `
    )
    .join('');

  phraseList.innerHTML = phrases
    .map(
      (item) => `
        <div class="phrase-item">
          <strong>${item.english}</strong>
          <span>${item.korean}</span>
          <button type="button" class="phrase-play-btn" data-text="${item.english}">발음 듣기</button>
        </div>
      `
    )
    .join('');

  const quizQuestions = [
    {
      question: '이 그림은 무엇일까요?',
      options: ['Star', 'Book', 'Cup'],
      answer: 'Star',
      icon: '⭐',
    },
    {
      question: '이 그림은 무엇일까요?',
      options: ['Moon', 'Tree', 'Car'],
      answer: 'Moon',
      icon: '🌙',
    },
    {
      question: '이 그림은 무엇일까요?',
      options: ['Rocket', 'Flower', 'Ball'],
      answer: 'Rocket',
      icon: '🚀',
    },
  ];

  if (selectedInterest === '동물') {
    quizQuestions[0] = { question: '이 그림은 무엇일까요?', options: ['Cat', 'Star', 'Ball'], answer: 'Cat', icon: '🐱' };
    quizQuestions[1] = { question: '이 그림은 무엇일까요?', options: ['Dog', 'Moon', 'Book'], answer: 'Dog', icon: '🐶' };
    quizQuestions[2] = { question: '이 그림은 무엇일까요?', options: ['Rabbit', 'Rocket', 'Cup'], answer: 'Rabbit', icon: '🐰' };
  }

  quizList.innerHTML = quizQuestions
    .map(
      (item, index) => `
        <div class="quiz-item" data-index="${index}">
          <h4>${item.icon} ${item.question}</h4>
          <div class="quiz-options">
            ${item.options
              .map(
                (option) => `
                  <button type="button" class="quiz-option" data-index="${index}" data-option="${option}" data-answer="${item.answer}">${option}</button>
                `
              )
              .join('')}
          </div>
        </div>
      `
    )
    .join('');

  quizState.starCount = 0;
  quizState.answeredQuestions = 0;
  quizFeedback.textContent = '';
  quizFeedback.classList.remove('success', 'error');
  quizList.querySelectorAll('.quiz-option').forEach((button) => {
    button.classList.remove('correct', 'wrong');
    button.disabled = false;
  });

  completionStep.classList.add('hidden');

  todayLearningSummary.textContent = `${selectedInterest}를 좋아하는 아이를 위한 오늘의 영어 학습 예시입니다.`;

  wordCardList.querySelectorAll('.word-play-btn').forEach((button) => {
    button.addEventListener('click', () => {
      speakText(button.dataset.text);
    });
  });

  phraseList.querySelectorAll('.phrase-play-btn').forEach((button) => {
    button.addEventListener('click', () => {
      speakText(button.dataset.text);
    });
  });

  quizList.querySelectorAll('.quiz-option').forEach((button) => {
    button.addEventListener('click', () => {
      const selectedOption = button.dataset.option;
      const answer = button.dataset.answer;
      const questionCard = button.closest('.quiz-item');
      const questionIndex = Number(questionCard.dataset.index);
      const options = questionCard.querySelectorAll('.quiz-option');

      if (questionCard.dataset.locked === 'true') {
        return;
      }

      options.forEach((option) => {
        if (option.dataset.option === answer) {
          option.classList.add('correct');
        } else {
          option.classList.add('wrong');
        }
      });

      questionCard.dataset.locked = 'true';

      if (selectedOption === answer) {
        quizState.starCount += 1;
        quizFeedback.textContent = '정답이에요! 별을 하나 받았어요. ⭐';
        quizFeedback.classList.add('success');
        quizFeedback.classList.remove('error');
      } else {
        quizFeedback.textContent = `아쉬워요! 정답은 ${answer}입니다. 다시 들려드릴게요.`;
        quizFeedback.classList.add('error');
        quizFeedback.classList.remove('success');
      }

      quizState.answeredQuestions += 1;
    });
  });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const validationMessage = validateForm();

  if (validationMessage) {
    showMessage(validationMessage);
    return;
  }

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

backToCurriculumBtn.addEventListener('click', () => {
  todayLearningScreen.classList.add('hidden-screen');
  curriculumScreen.classList.remove('hidden-screen');
});

retryLearningBtn.addEventListener('click', () => {
  renderTodayLearning();
  completionStep.classList.add('hidden');
  todayLearningScreen.classList.remove('hidden-screen');
  curriculumScreen.classList.add('hidden-screen');
  quizFeedback.textContent = '';
});

returnHomeBtn.addEventListener('click', () => {
  todayLearningScreen.classList.add('hidden-screen');
  profileScreen.classList.remove('hidden-screen');
  stepBadge.textContent = '1/2 단계';
  summaryCard.classList.add('hidden');
  diagnosisScreen.classList.add('hidden-screen');
  curriculumScreen.classList.add('hidden-screen');
  form.reset();
  Object.keys(selectionGroups).forEach((key) => {
    selectionGroups[key] = null;
  });
  Object.keys(diagnosisAnswers).forEach((key) => delete diagnosisAnswers[key]);
  document.querySelectorAll('.choice-btn').forEach((button) => {
    button.classList.remove('selected');
    button.setAttribute('aria-pressed', 'false');
  });
  document.querySelectorAll('.interest-item input').forEach((checkbox) => {
    checkbox.checked = false;
  });
  showMessage('');
});

checkQuizBtn.addEventListener('click', () => {
  const allAnswered = quizList.querySelectorAll('.quiz-item[data-locked="true"]').length === 3;

  if (!allAnswered) {
    quizFeedback.textContent = '모든 퀴즈를 풀고 확인해 주세요!';
    quizFeedback.classList.add('error');
    quizFeedback.classList.remove('success');
    return;
  }

  finalStarCount.textContent = String(quizState.starCount);
  completionSummary.textContent = `오늘의 학습을 통해 ${quizState.starCount}개의 별을 획득했어요!`;
  completionList.innerHTML = '';

  const learnedWords = getTodayLearningContent().words.map((item) => `${item.word} (${item.meaning})`);
  learnedWords.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    completionList.appendChild(li);
  });

  completionStep.classList.remove('hidden');
  quizFeedback.textContent = '오늘의 학습이 완료되었습니다!';
  quizFeedback.classList.add('success');
  quizFeedback.classList.remove('error');
});

bindChoiceButtons();
bindDiagnosisButtons();
updateDiagnosisProgress();
renderTodayLearning();
