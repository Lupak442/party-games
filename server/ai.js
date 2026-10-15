/**
 * 단어 생성 모듈 (완전히 독립된 3가지 모드):
 * 1. 📚 내장 모드 (builtin) - server/data/builtins.json 에서만 단어 추출 (AI 절대 호출 안 함)
 * 2. 🤖 AI 모드 (ai)       - Google Gemini AI를 무조건 호출하여 실시간 생성 (내장 주제와 같아도 AI가 생성)
 * 3. ✍️ 직접 모드 (custom)  - 사용자가 직접 입력한 단어 사용
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
  return !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0;
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

  // 사용자 요청 우선순위: Gemini 4 Argon -> Gemini 3.8 Flash -> Gemini 3.7 Flash
  const models = [
    process.env.GEMINI_MODEL,
    'gemini-4-argon',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ].filter(Boolean);

  let lastErr = null;

  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key.trim() },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 1 },
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        lastErr = new Error(`AI 응답 오류 [${model}] (${res.status}): ${errText.slice(0, 120)}`);
        // 404인 경우 다음 모델 시도
        if (res.status === 404) continue;
        throw lastErr;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
      // 404가 포함되어 있으면 다음 모델 계속 시도
      if (e.message && e.message.includes('404')) continue;
      throw e;
    }
  }

  throw lastErr || new Error('사용 가능한 Gemini AI 모델을 찾을 수 없습니다.');
}

/** 
 * 라이어 게임용 단어 쌍 생성 
 * mode: 'builtin' (내장 모드) | 'ai' (AI 모드)
 */
async function generateLiarWords({ topic, fool, mode = 'builtin', avoid = [] }) {
  // 1. 🤖 AI 모드: 주제가 무엇이든 무조건 Gemini AI를 호출하여 새로운 단어 생성
  if (mode === 'ai') {
    if (!hasAiKey()) {
      throw new Error('AI 키가 등록되어 있지 않습니다. Render 환경변수(Environment) 또는 로컬 .env 파일에 GEMINI_API_KEY를 등록해주세요.');
    }
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
      throw new Error('AI가 올바른 JSON 형식을 반환하지 않았습니다.');
    } catch (e) {
      console.error('AI 생성 오류:', e.message);
      throw new Error(`AI 단어 생성 실패: ${e.message}`);
    }
  }

  // 2. 📚 내장 모드: server/data/builtins.json 에서만 단어 추출 (절대 AI 호출하지 않음)
  const list = builtinFor(topic);
  if (!list || list.length < 2) {
    throw new Error(`내장 주제 "${topic}"을 찾을 수 없거나 단어가 부족합니다. (내장 주제: ${getBuiltinTopics().map(t=>t.name).join(', ')})`);
  }

  const pool = shuffle(list.filter((w) => !avoid.includes(w)));
  const base = pool.length >= 2 ? pool : shuffle(list);
  return { word: base[0], similar: base[1] };
}

/** 
 * 스피드 퀴즈용 문제 목록 생성
 * mode: 'builtin' (내장 모드) | 'ai' (AI 모드)
 */
async function generateQuizWords({ topic, count, mode = 'builtin', avoid = [] }) {
  // 1. 🤖 AI 모드: 주제가 무엇이든 무조건 Gemini AI를 호출하여 생성
  if (mode === 'ai') {
    if (!hasAiKey()) {
      throw new Error('AI 키가 등록되어 있지 않습니다. Render 환경변수(Environment) 또는 로컬 .env 파일에 GEMINI_API_KEY를 등록해주세요.');
    }
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
      throw new Error(`AI가 생성한 문제 수가 부족합니다 (${items.length}/${count}개).`);
    } catch (e) {
      console.error('AI 퀴즈 생성 오류:', e.message);
      throw new Error(`AI 퀴즈 생성 실패: ${e.message}`);
    }
  }

  // 2. 📚 내장 모드: server/data/builtins.json 에서만 추출
  const list = builtinFor(topic);
  if (!list) {
    throw new Error(`내장 주제 "${topic}"이(가) 없습니다. (내장 주제 목록: ${getBuiltinTopics().map(t=>t.name).join(', ')})`);
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
