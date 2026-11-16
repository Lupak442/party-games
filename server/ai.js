/**
 * 단어 생성 엔진 (100% 오프라인 & 내장 데이터)
 * - 외부 AI(Gemini 등) API 의존성을 완전히 제거하여 해킹 위험 제로, 토큰 과금 제로, 0초 즉시 시작 보장
 * - 20개 이상의 테마별 800+개 검증된 단어장(server/data/builtins.json) 기반
 * - 사용자 정의(직접 출제) 모드 지원
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
  return false;
}

function getBuiltinTopics() {
  const data = loadBuiltins();
  return Object.keys(data).map((topic) => ({
    name: topic,
    count: Array.isArray(data[topic]) ? data[topic].length : 0
  }));
}

function builtinFor(topic) {
  const data = loadBuiltins();
  const t = String(topic || '').trim();
  const key = Object.keys(data).find((k) => t === k || t.includes(k) || k.includes(t));
  return key ? data[key] : (data[Object.keys(data)[0]] || null);
}

const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** 
 * 라이어 게임용 제시어 생성 (100% 오프라인)
 */
async function generateLiarWords({ topic, fool, avoid = [] }) {
  const list = builtinFor(topic);
  if (!list || list.length < 2) {
    throw new Error(`테마 "${topic}"을 찾을 수 없거나 단어가 부족합니다.`);
  }

  const pool = shuffle(list.filter((w) => !avoid.includes(w)));
  const base = pool.length >= 2 ? pool : shuffle(list);
  return { word: base[0], similar: base[1] };
}

/** 
 * 스피드 퀴즈용 문제 목록 생성 (100% 오프라인)
 */
async function generateQuizWords({ topic, count, avoid = [] }) {
  const list = builtinFor(topic);
  if (!list) {
    throw new Error(`테마 "${topic}"이(가) 없습니다.`);
  }

  const pool = shuffle(list.filter((w) => !avoid.includes(w)));
  const base = pool.length >= count ? pool : shuffle(list);

  if (base.length < count) {
    // 풀이 부족하면 중복을 허용해서라도 채움
    const res = [...base];
    while (res.length < count) {
      res.push(...shuffle(list));
    }
    return res.slice(0, count);
  }

  return base.slice(0, count);
}

module.exports = {
  hasAiKey,
  getBuiltinTopics,
  generateLiarWords,
  generateQuizWords
};
