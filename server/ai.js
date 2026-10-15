/**
 * 단어 생성 모듈 (내장 데이터 및 Google Gemini AI)
 * 내장 단어 목록은 server/data/builtins.json 에서 쉽게 관리/추가/수정할 수 있습니다.
 */
const fs = require('fs');
const path = require('path');

const BUILTIN_FILE = path.join(__dirname, 'data', 'builtins.json');

function loadBuiltins() {
  try {
    if (fs.existsSync(BUILTIN_FILE)) {
      return JSON.parse(fs.readFileSync(BUILTIN_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('내장 데이터 파일 로드 오류:', e.message);
  }
  return {
    과일: ['사과', '배', '포도', '딸기', '수박', '참외', '복숭아', '귤', '바나나', '망고'],
    동물: ['강아지', '고양이', '사자', '호랑이', '코끼리', '기린', '토끼', '곰'],
    음식: ['김치찌개', '비빔밥', '불고기', '떡볶이', '치킨', '피자', '라면', '삼겹살']
  };
}

function hasAiKey() {
  return !!process.env.GEMINI_API_KEY;
}

function getBuiltinTopics() {
  const data = loadBuiltins();
  return Object.keys(data).map(topic => ({
    name: topic,
    count: Array.isArray(data[topic]) ? data[topic].length : 0
  }));
}

function builtinFor(topic) {
  const data = loadBuiltins();
  const t = String(topic || '').trim();
  const key = Object.keys(data).find((k) => t === k || t.includes(k) || k.includes(t));
  return key ? data[key] : null;
}

const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

async function gemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('NO_KEY');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 1 },
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error('AI 응답 오류 ' + res.status);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  return JSON.parse(text);
}

const NO_AI_MSG = 'AI 키가 설정되지 않았습니다. 내장 주제 모드를 선택하시거나 .env / Render 환경변수에 GEMINI_API_KEY를 등록해주세요.';

/** 라이어 게임용 단어 쌍 */
async function generateLiarWords({ topic, fool, mode = 'builtin', avoid = [] }) {
  // AI 모드 요청인 경우
  if (mode === 'ai') {
    if (!hasAiKey()) throw new Error(NO_AI_MSG);
    try {
      const r = await gemini(
        `한국어 단어 게임용 단어를 만들어줘. 주제: "${topic}".\n` +
        `- word: 주제에 속하는, 누구나 아는 흔한 단어 1개\n` +
        `- similar: 같은 주제에 속하지만 word와 다른, 헷갈릴 만큼 비슷한 단어 1개 (예: 사과 / 배)\n` +
        `이미 쓴 단어는 피해줘: ${JSON.stringify(avoid.slice(-30))}\n` +
        `JSON으로만 답해: {"word":"...","similar":"..."}`
      );
      if (r && r.word && (!fool || r.similar)) {
        return { word: String(r.word).trim(), similar: String(r.similar || '').trim() };
      }
    } catch (e) {
      console.error('AI 생성 오류:', e.message);
      throw new Error(`AI 단어 생성 실패: ${e.message}`);
    }
  }

  // 내장 주제 모드 (또는 기본)
  const list = builtinFor(topic);
  if (!list || list.length < 2) {
    if (mode === 'builtin') {
      throw new Error(`내장 주제 "${topic}"을 찾을 수 없거나 단어가 부족합니다. (내장 주제: ${getBuiltinTopics().map(t=>t.name).join(', ')})`);
    }
    // AI 키가 있으면 시도
    if (hasAiKey()) {
      return generateLiarWords({ topic, fool, mode: 'ai', avoid });
    }
    throw new Error(NO_AI_MSG);
  }

  const pool = shuffle(list.filter((w) => !avoid.includes(w)));
  const base = pool.length >= 2 ? pool : shuffle(list);
  return { word: base[0], similar: base[1] };
}

/** 스피드 퀴즈용 문제 목록 */
async function generateQuizWords({ topic, count, mode = 'builtin', avoid = [] }) {
  if (mode === 'ai') {
    if (!hasAiKey()) throw new Error(NO_AI_MSG);
    try {
      const r = await gemini(
        `스피드 퀴즈 문제를 만들어줘. 주제: "${topic}".\n` +
        `- 해당 주제에서 한국인이 가장 잘 아는 유명한 것들만 정확히 ${count}개\n` +
        `- 짧은 정식 명칭, 서로 중복 없이, 섞어서\n` +
        `- 제외: ${JSON.stringify(avoid.slice(-40))}\n` +
        `JSON으로만 답해: {"items":["...", "..."]}`
      );
      const items = [...new Set((r?.items || []).map((x) => String(x).trim()).filter(Boolean))];
      if (items.length >= count) return items.slice(0, count);
    } catch (e) {
      console.error('AI 퀴즈 생성 오류:', e.message);
      throw new Error(`AI 퀴즈 생성 실패: ${e.message}`);
    }
  }

  const list = builtinFor(topic);
  if (!list) {
    if (hasAiKey()) {
      return generateQuizWords({ topic, count, mode: 'ai', avoid });
    }
    throw new Error(NO_AI_MSG);
  }

  if (list.length < count) {
    throw new Error(`내장 목록 "${topic}"에는 문제가 ${list.length}개뿐입니다. 문제 수를 줄이거나 server/data/builtins.json에 단어를 추가해주세요.`);
  }
  return shuffle(list).slice(0, count);
}

module.exports = {
  hasAiKey,
  getBuiltinTopics,
  generateLiarWords,
  generateQuizWords
};
