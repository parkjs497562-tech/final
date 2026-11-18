(function attachBloomyLearningData(window, document) {
  const STORAGE_KEY = 'bloomy.learningRecords';
  const SCHEMA_VERSION = 1;
  const IDLE_LIMIT_MS = 90000;
  let storageState = 'ready';
  let storageMessage = '';
  let canPersist = true;
  let data = { schemaVersion: SCHEMA_VERSION, activeProfileId: null, profiles: {} };
  let activeSince = null;
  let lastInteractionAt = null;
  let timerPaused = false;

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.schemaVersion === SCHEMA_VERSION && saved.profiles && typeof saved.profiles === 'object') {
        data = saved;
        return;
      }
      storageState = 'unsupported';
      storageMessage = '저장된 학습 데이터 버전을 확인할 수 없어 원본을 보존하고 읽기 전용으로 열었어요.';
      canPersist = false;
    } catch (error) {
      storageState = 'error';
      storageMessage = '이 브라우저의 학습 데이터를 읽지 못했어요. 기존 데이터는 변경하지 않았어요.';
      canPersist = false;
    }
  }

  function persist() {
    if (!canPersist) return false;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      storageState = 'ready';
      storageMessage = '';
      return true;
    } catch (error) {
      storageState = 'error';
      storageMessage = '학습 기록을 이 기기에 저장하지 못했어요. 브라우저 저장 공간 설정을 확인해 주세요.';
      return false;
    }
  }

  function getProfileRecord(create = false) {
    let profileId = data.activeProfileId;
    if (!profileId && create) {
      profileId = createId();
      data.activeProfileId = profileId;
      data.profiles[profileId] = { profile: {}, diagnosis: {}, sessions: [], activeSessionId: null };
    }
    if (!profileId) return null;
    if (!data.profiles[profileId] && create) {
      data.profiles[profileId] = { profile: {}, diagnosis: {}, sessions: [], activeSessionId: null };
    }
    return data.profiles[profileId] || null;
  }

  function activeSessionRecord() {
    const profile = getProfileRecord();
    if (!profile?.activeSessionId) return null;
    const session = profile.sessions.find((item) => item.id === profile.activeSessionId);
    return session?.status === 'in_progress' ? session : null;
  }

  function flushTimer(now = Date.now(), allowHidden = false) {
    const session = activeSessionRecord();
    if (!session || activeSince == null) return;
    if (timerPaused || (document.hidden && !allowHidden)) {
      activeSince = null;
      return;
    }
    const cutoff = (lastInteractionAt || activeSince) + IDLE_LIMIT_MS;
    const end = Math.min(now, cutoff);
    const elapsed = Math.max(0, end - activeSince);
    if (elapsed > 0) session.activeMilliseconds += elapsed;
    activeSince = now < cutoff ? now : null;
    session.activeSeconds = Math.floor(session.activeMilliseconds / 1000);
    if (elapsed > 0) persist();
  }

  function noteActivity() {
    const session = activeSessionRecord();
    if (!session || document.hidden || timerPaused) return;
    const now = Date.now();
    flushTimer(now);
    lastInteractionAt = now;
    if (activeSince == null) activeSince = now;
  }

  function setStorageWarning(message) {
    storageMessage = message;
  }

  function saveProfile(profile, diagnosis = {}) {
    const record = getProfileRecord(true);
    record.profile = clone(profile || {});
    record.diagnosis = clone(diagnosis || {});
    persist();
    return data.activeProfileId;
  }

  function getActiveProfile() {
    const record = getProfileRecord();
    if (!record) return null;
    return { id: data.activeProfileId, profile: clone(record.profile), diagnosis: clone(record.diagnosis) };
  }

  function startOrResumeSession(profileSnapshot, contentSnapshot) {
    const record = getProfileRecord(true);
    record.profile = clone(profileSnapshot || record.profile || {});
    const existing = activeSessionRecord();
    if (existing) {
      noteActivity();
      return clone(existing);
    }

    const now = Date.now();
    const session = {
      id: createId(),
      date: localDateKey(new Date(now)),
      startedAt: new Date(now).toISOString(),
      endedAt: null,
      activeMilliseconds: 0,
      activeSeconds: 0,
      completed: false,
      status: 'in_progress',
      currentPage: 1,
      resumePage: 1,
      quizIndex: 0,
      learnedWords: [],
      learnedPhrases: [],
      quizTotal: 3,
      quizAttempts: [],
      contentSnapshot: clone(contentSnapshot || {}),
      recommendationSnapshot: clone(contentSnapshot?.recommendation || null),
    };
    record.sessions.push(session);
    record.activeSessionId = session.id;
    activeSince = document.hidden ? null : now;
    lastInteractionAt = document.hidden ? null : now;
    persist();
    return clone(session);
  }

  function getActiveSession() {
    flushTimer();
    return clone(activeSessionRecord());
  }

  function setCurrentPage(page, quizIndex) {
    const session = activeSessionRecord();
    if (!session) return;
    session.currentPage = page;
    if (page > 0 && page < 4) session.resumePage = page;
    if (typeof quizIndex === 'number') session.quizIndex = quizIndex;
    noteActivity();
    persist();
  }

  function addUnique(items, key, value) {
    if (!items.some((item) => item[key] === value[key])) items.push(clone(value));
  }

  function recordWord(word) {
    const session = activeSessionRecord();
    if (!session || !word?.word) return;
    addUnique(session.learnedWords, 'word', word);
    noteActivity();
    persist();
  }

  function recordPhrase(phrase) {
    const session = activeSessionRecord();
    if (!session || !phrase?.english) return;
    addUnique(session.learnedPhrases, 'english', phrase);
    noteActivity();
    persist();
  }

  function recordQuizAttempt(attempt) {
    const session = activeSessionRecord();
    if (!session || !attempt || typeof attempt.questionIndex !== 'number') return;
    const existingIndex = session.quizAttempts.findIndex((item) => item.questionIndex === attempt.questionIndex);
    const item = { ...clone(attempt), answeredAt: new Date().toISOString() };
    if (existingIndex >= 0) session.quizAttempts[existingIndex] = item;
    else session.quizAttempts.push(item);
    addUnique(session.learnedWords, 'word', attempt.wordDetails || { word: attempt.word });
    noteActivity();
    persist();
  }

  function completeSession() {
    const session = activeSessionRecord();
    const profile = getProfileRecord();
    if (!session || !profile) return null;
    flushTimer();
    session.completed = true;
    session.status = 'completed';
    session.endedAt = new Date().toISOString();
    session.currentPage = 4;
    session.activeSeconds = Math.floor(session.activeMilliseconds / 1000);
    profile.activeSessionId = null;
    activeSince = null;
    lastInteractionAt = null;
    persist();
    return clone(session);
  }

  function resumeTimer() {
    const session = activeSessionRecord();
    timerPaused = false;
    if (!session || document.hidden) return;
    const now = Date.now();
    activeSince = now;
    lastInteractionAt = now;
  }

  function pauseTimer() {
    flushTimer();
    timerPaused = true;
    activeSince = null;
  }

  function ordinal(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  }

  function mondayOf(date) {
    const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = (copy.getDay() + 6) % 7;
    copy.setDate(copy.getDate() - day);
    return copy;
  }

  function getDashboardStats() {
    flushTimer();
    const profile = getProfileRecord();
    const sessions = profile?.sessions || [];
    const today = localDateKey();
    const active = activeSessionRecord();
    const todaySessions = sessions.filter((session) => session.date === today);
    const studyDates = [...new Set(sessions
      .filter((session) => session.activeSeconds > 0 || session.completed || session.id === active?.id)
      .map((session) => session.date))].sort();
    const attempts = sessions.flatMap((session) => session.quizAttempts || [])
      .sort((a, b) => new Date(a.answeredAt) - new Date(b.answeredAt));
    const recentAttempts = attempts.slice(-20);
    const correct = attempts.filter((attempt) => attempt.correct).length;
    const wrong = attempts.length - correct;
    const wordStats = {};
    attempts.forEach((attempt) => {
      if (!attempt.word) return;
      if (!wordStats[attempt.word]) wordStats[attempt.word] = { word: attempt.word, meaning: attempt.meaning || '', correct: 0, wrong: 0 };
      wordStats[attempt.word][attempt.correct ? 'correct' : 'wrong'] += 1;
      if (!wordStats[attempt.word].meaning && attempt.meaning) wordStats[attempt.word].meaning = attempt.meaning;
    });
    const words = Object.values(wordStats).map((item) => ({
      ...item,
      total: item.correct + item.wrong,
      accuracy: item.correct + item.wrong ? item.correct / (item.correct + item.wrong) : null,
    })).sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1));
    const weakWords = words.filter((item) => item.wrong >= 2 && (item.accuracy ?? 1) < 0.75);
    const masteredWords = words.filter((item) => item.correct >= 2 && (item.accuracy ?? 0) >= 0.8);
    const uniqueWords = new Set(sessions.flatMap((session) => (session.learnedWords || []).map((item) => item.word)));
    const uniquePhrases = new Set(sessions.flatMap((session) => (session.learnedPhrases || []).map((item) => item.english)));
    const totalMilliseconds = sessions.reduce((sum, session) => sum + (session.activeMilliseconds || 0), 0);
    const weeklyStart = mondayOf(new Date());
    const weeklyDates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weeklyStart);
      date.setDate(date.getDate() + index);
      return localDateKey(date);
    });
    const weekly = weeklyDates.map((date) => {
      const daySessions = sessions.filter((session) => session.date === date);
      const seconds = daySessions.reduce((sum, session) => sum + (session.activeSeconds || 0), 0);
      return { date, seconds, completed: daySessions.some((session) => session.completed), studied: daySessions.some((session) => session.activeSeconds > 0 || session.completed || session.id === active?.id) };
    });
    let streak = 0;
    const todayOrdinal = ordinal(today);
    const latestOrdinal = studyDates.length ? ordinal(studyDates[studyDates.length - 1]) : null;
    if (latestOrdinal != null && latestOrdinal >= todayOrdinal - 1) {
      let expected = latestOrdinal;
      for (let index = studyDates.length - 1; index >= 0; index -= 1) {
        const current = ordinal(studyDates[index]);
        if (current !== expected) break;
        streak += 1;
        expected -= 1;
      }
    }
    const recentCorrect = recentAttempts.filter((attempt) => attempt.correct).length;
    const lastCompleted = sessions.filter((session) => session.completed && session.quizAttempts.length).slice(-2);
    const sessionAccuracy = (session) => session.quizAttempts.length
      ? session.quizAttempts.filter((attempt) => attempt.correct).length / session.quizAttempts.length
      : null;
    const previousTrend = lastCompleted.length === 2
      ? Math.round((sessionAccuracy(lastCompleted[1]) - sessionAccuracy(lastCompleted[0])) * 100)
      : null;
    const todayProgress = active
      ? Math.max(0, Math.min(100, ((active.currentPage || active.resumePage || 0) * 25)))
      : todaySessions.some((session) => session.completed) ? 100 : 0;
    return {
      today,
      todayCompleted: todaySessions.some((session) => session.completed),
      todayProgress,
      todaySeconds: todaySessions.reduce((sum, session) => sum + (session.activeSeconds || 0), 0),
      todaySessions: todaySessions.length,
      totalDays: studyDates.length,
      totalSeconds: Math.floor(totalMilliseconds / 1000),
      totalWords: uniqueWords.size,
      totalPhrases: uniquePhrases.size,
      totalQuiz: attempts.length,
      correct,
      wrong,
      averageAccuracy: attempts.length ? correct / attempts.length : null,
      recentAccuracy: recentAttempts.length ? recentCorrect / recentAttempts.length : null,
      recentAttemptCount: recentAttempts.length,
      streak,
      weekly,
      weeklyDays: weekly.filter((item) => item.studied).length,
      weeklySeconds: weekly.reduce((sum, item) => sum + item.seconds, 0),
      weakWords,
      masteredWords,
      words,
      previousTrend,
      sessions: clone(sessions),
      activeSession: clone(active),
      recentAttempts: clone(recentAttempts),
    };
  }

  function getStorageStatus() {
    return { state: storageState, message: storageMessage, key: STORAGE_KEY, schemaVersion: SCHEMA_VERSION };
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      flushTimer(Date.now(), true);
      activeSince = null;
    } else {
      activeSince = null;
    }
  }

  load();
  ['pointerdown', 'keydown', 'scroll'].forEach((eventName) => {
    document.addEventListener(eventName, noteActivity, { passive: true, capture: true });
  });
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', () => flushTimer());
  window.setInterval(flushTimer, 10000);

  window.BloomyLearningData = {
    getActiveProfile,
    saveProfile,
    startOrResumeSession,
    getActiveSession,
    setCurrentPage,
    recordWord,
    recordPhrase,
    recordQuizAttempt,
    completeSession,
    resumeTimer,
    pauseTimer,
    getDashboardStats,
    getStorageStatus,
    setStorageWarning,
  };
})(window, document);
