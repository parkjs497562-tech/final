(function attachBloomyRecommender(window) {
  const LEVELS = ['기초', '차근차근', '도전'];

  function diagnosedLevel(profile, diagnosis) {
    const experienceScore = {
      '처음 시작해요': 0,
      '가끔 해봤어요': 1,
      '기초를 알고 있어요': 2,
      '영어를 자주 접해요': 3,
    }[profile.experience] ?? 1;
    const answerScores = {
      q1: [
        ['거의 몰라요', 0], ['일부 알파벳', 1], ['대문자와 소문자', 2], ['읽고 말할 수', 3],
      ],
      q2: [
        ['아직 접해본 적 없어요', 0], ['노래나 영상', 1], ['소리를 조금 알아요', 2], ['단어의 소리를 읽어본', 3],
      ],
      q3: [
        ['거의 없어요', 0], ['그림 위주', 1], ['단어가 있는 책', 2], ['영어 문장을 읽어본', 3],
      ],
      q4: [
        ['거의 반응하지', 0], ['표정이나 행동', 1], ['한국어로 대답', 2], ['영어 단어나 짧은 문장', 3],
      ],
      q5: [
        ['표현이 거의 없어요', 0], ['인사나 간단한 단어', 1], ['짧은 표현을 이해', 2], ['영어 지시나 문장', 3],
      ],
    };
    const scores = Object.entries(diagnosis || {}).flatMap(([question, answer]) => {
      const match = answerScores[question]?.find(([text]) => String(answer).includes(text));
      return match ? [match[1]] : [];
    });
    const diagnosisScore = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : experienceScore;
    const combinedScore = diagnosisScore * 0.7 + experienceScore * 0.3;
    if (combinedScore <= 0.75) return 0;
    if (combinedScore >= 2.25) return 2;
    return 1;
  }

  function accuracyLabel(value) {
    return value == null ? '아직 퀴즈 기록이 없어요.' : `최근 정답률 ${Math.round(value * 100)}%`;
  }

  function getRecommendation(input) {
    const profile = input.profile || {};
    const stats = input.stats || {};
    const availableWords = input.words || [];
    const phrases = input.phrases || [];
    const diagnosis = input.diagnosis || {};
    let level = diagnosedLevel(profile, diagnosis);
    const attempts = stats.recentAttemptCount || 0;
    const accuracy = stats.recentAccuracy;
    if (attempts >= 5 && accuracy != null) {
      if (accuracy < 0.5) level = Math.max(0, level - 1);
      if (accuracy >= 0.85) level = Math.min(2, level + 1);
    }

    const weakNames = (stats.weakWords || []).map((item) => item.word);
    const masteredNames = new Set((stats.masteredWords || []).map((item) => item.word));
    const weakWords = weakNames
      .map((name) => availableWords.find((item) => item.word === name))
      .filter(Boolean);
    const notMastered = availableWords.filter((item) => !masteredNames.has(item.word));
    const selectedWords = [];
    weakWords.forEach((item) => { if (!selectedWords.some((word) => word.word === item.word)) selectedWords.push(item); });
    notMastered.forEach((item) => {
      if (selectedWords.length < 3 && !selectedWords.some((word) => word.word === item.word)) selectedWords.push(item);
    });
    availableWords.forEach((item) => {
      if (selectedWords.length < 3 && !selectedWords.some((word) => word.word === item.word)) selectedWords.push(item);
    });

    const reasons = [];
    if (attempts === 0) {
      reasons.push(`아이의 ${profile.age || '입력한 나이'}와 ${profile.experience || '초기 진단'} 정보를 바탕으로 시작 단계를 골랐어요.`);
    } else {
      reasons.push(`${accuracyLabel(accuracy)} 기록을 반영했어요.`);
    }
    if (weakWords.length) reasons.push(`${weakWords.map((item) => item.word).join(', ')}를 다시 만나도록 앞에 배치했어요.`);
    else if (masteredNames.size && notMastered.length) reasons.push('익숙해진 단어는 우선순위를 낮추고 덜 익숙한 관심사 단어를 먼저 골랐어요.');
    else if (masteredNames.size) reasons.push('익숙한 관심사 단어를 가볍게 복습할 수 있도록 골랐어요.');
    else reasons.push(`${profile.interests?.[0] || '관심사'} 주제의 단어와 표현을 골랐어요.`);
    if (attempts > 0 && attempts < 5) reasons.push('추천 정확도를 높이려면 학습 기록이 조금 더 필요해요.');

    const studyMinutes = Number.parseInt(String(profile.studyTime || '10'), 10) || 10;
    const estimatedMinutes = Math.min(studyMinutes, 9);
    const trend = stats.previousTrend;
    let improvement = '이전 학습과 비교할 기록이 아직 부족해요.';
    if (trend != null) {
      improvement = trend > 0
        ? `직전 학습보다 정답률이 ${trend}%p 올랐어요.`
        : trend < 0
          ? `직전 학습보다 정답률이 ${Math.abs(trend)}%p 낮아 복습을 더해요.`
          : '직전 학습과 정답률이 같아요. 새 단어와 함께 복습해요.';
    }

    return {
      provider: 'rules',
      label: '브라우저 학습 기록 기반 규칙 추천',
      level: LEVELS[level],
      words: selectedWords,
      phrases,
      weakWords: weakWords.map((item) => item.word),
      masteredWords: [...masteredNames],
      reasons,
      improvement,
      estimatedMinutes,
      historyCount: attempts,
      enoughHistory: attempts >= 5,
      interest: profile.interests?.[0] || '우주',
    };
  }

  window.BloomyRecommender = {
    getRecommendation,
    diagnosedLevel,
  };
})(window);
