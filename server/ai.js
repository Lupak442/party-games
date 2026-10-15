/**
 * AI 단어 생성 (Google Gemini). GEMINI_API_KEY 가 없으면 내장 주제 목록으로 대체한다.
 */
const BUILTIN = {
  과일: ['사과', '배', '포도', '딸기', '수박', '참외', '복숭아', '귤', '바나나', '망고', '키위', '체리', '감', '파인애플', '자두', '멜론', '레몬', '오렌지', '블루베리', '석류'],
  동물: ['강아지', '고양이', '사자', '호랑이', '코끼리', '기린', '토끼', '곰', '여우', '늑대', '펭귄', '원숭이', '판다', '하마', '악어', '다람쥐', '돌고래', '고래', '독수리', '낙타'],
  음식: ['김치찌개', '된장찌개', '비빔밥', '불고기', '떡볶이', '치킨', '피자', '햄버거', '라면', '삼겹살', '냉면', '짜장면', '짬뽕', '초밥', '파스타', '김밥', '순대', '갈비탕', '탕수육', '족발'],
  나라: ['한국', '일본', '중국', '미국', '영국', '프랑스', '독일', '이탈리아', '스페인', '브라질', '캐나다', '호주', '인도', '태국', '베트남', '이집트', '러시아', '멕시코', '터키', '스위스'],
  직업: ['의사', '소방관', '경찰관', '선생님', '요리사', '가수', '배우', '변호사', '프로그래머', '농부', '화가', '기자', '간호사', '조종사', '판사', '미용사', '택시기사', '건축가', '사진작가', '과학자'],
  스포츠: ['축구', '야구', '농구', '배구', '테니스', '탁구', '골프', '수영', '배드민턴', '볼링', '스키', '복싱', '양궁', '펜싱', '유도', '태권도', '마라톤', '스케이트', '럭비', '당구'],
  '국내 드라마': ['별에서 온 그대', '태양의 후예', '도깨비', '사랑의 불시착', '오징어 게임', '이태원 클라쓰', '겨울연가', '대장금', '응답하라 1988', '미스터 션샤인', '더 글로리', '푸른 바다의 전설', '시크릿 가든', '파리의 연인', '꽃보다 남자', '상속자들', '킹덤', '지금 우리 학교는', '재벌집 막내아들', '부부의 세계'],
  영화: ['기생충', '올드보이', '부산행', '택시운전사', '명량', '극한직업', '범죄도시', '타이타닉', '아바타', '인터스텔라', '어벤져스', '해리포터', '겨울왕국', '라이온 킹', '토이 스토리', '쥬라기 공원', '다크 나이트', '인셉션', '엑스맨', '스파이더맨'],
  '가수': ['아이유', '싸이', 'BTS', '블랙핑크', '지드래곤', '태연', '박효신', '이승기', '비', '보아', '임영웅', '에스파', '뉴진스', '트와이스', '성시경', '김범수', '윤종신', 'god', '소녀시대', '빅뱅'],
  '예능': ['런닝맨', '무한도전', '1박 2일', '나 혼자 산다', '놀라운 토요일', '유 퀴즈 온 더 블럭', '신서유기', '삼시세끼', '아는 형님', '전지적 참견 시점', '미운 우리 새끼', '골 때리는 그녀들', '효리네 민박', '짠한형', '피지컬 100', '쇼미더머니', '복면가왕', '슈퍼맨이 돌아왔다', '라디오 스타', '대탈출'],
};

function builtinFor(topic) {
  const t = String(topic).trim();
  const key = Object.keys(BUILTIN).find((k) => t === k || t.includes(k) || k.includes(t));
  return key ? BUILTIN[key] : null;
}
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

async function gemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) { const e = new Error('NO_KEY'); throw e; }
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

const NO_AI_MSG = 'AI 키가 없고 내장 주제에도 없어요. 단어를 직접 입력하거나 내장 주제(과일, 동물, 음식, 나라, 직업, 스포츠, 국내 드라마, 영화, 가수, 예능)를 써주세요';

/** 라이어 게임용 단어 쌍: word(시민 단어), similar(바보 라이어 단어) */
async function generateLiarWords({ topic, fool, avoid = [] }) {
  try {
    const r = await gemini(
      `한국어 단어 게임용 단어를 만들어줘. 주제: "${topic}".\n` +
      `- word: 주제에 속하는, 누구나 아는 흔한 단어 1개\n` +
      `- similar: 같은 주제에 속하지만 word와 다른, 헷갈릴 만큼 비슷한 단어 1개 (예: 사과 / 배)\n` +
      `이미 쓴 단어는 피해줘: ${JSON.stringify(avoid.slice(-30))}\n` +
      `JSON으로만 답해: {"word":"...","similar":"..."}`
    );
    if (r && r.word && (!fool || r.similar)) return { word: String(r.word).trim(), similar: String(r.similar || '').trim() };
  } catch (e) {
    if (e.message !== 'NO_KEY') console.error('AI error:', e.message);
  }
  const list = builtinFor(topic);
  if (!list) throw new Error(NO_AI_MSG);
  const pool = shuffle(list.filter((w) => !avoid.includes(w)));
  const base = pool.length >= 2 ? pool : shuffle(list);
  return { word: base[0], similar: base[1] };
}

/** 스피드 퀴즈용 문제 목록 (가장 유명한 것 위주) */
async function generateQuizWords({ topic, count, avoid = [] }) {
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
    if (e.message !== 'NO_KEY') console.error('AI error:', e.message);
  }
  const list = builtinFor(topic);
  if (!list) throw new Error(NO_AI_MSG);
  if (list.length < count) throw new Error(`내장 목록에는 "${topic}" 문제가 ${list.length}개뿐이에요. 문제 수를 줄이거나 AI 키를 설정해주세요`);
  return shuffle(list).slice(0, count);
}

module.exports = { generateLiarWords, generateQuizWords };
