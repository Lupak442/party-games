/**
 * 카멜레온 (The Chameleon) 게임 모듈
 * 
 * 16개 단어가 적힌 주제 판 속에서 비밀 단어를 모르는 위장자(카멜레온)를 찾아내는
 * 고도의 눈치와 블러핑 파티게임! (3~12인)
 * 
 * - 시민: 주제와 16개 단어, 그리고 비밀 단어를 알고 시작함.
 * - 카멜레온: 비밀 단어를 모른 채 16개 단어 판만 보고 그럴듯하게 위장해야 함.
 * - 힌트 말하기: 각자 비밀 단어를 연상시키는 '한 단어'씩 말하기.
 * - 투표: 카멜레온으로 의심되는 자 지목.
 * - 검거 시 카멜레온의 역전 찬스: 카멜레온이 16개 단어 중 비밀 단어를 맞히면 극적 역전승!
 */
const { shuffle, pick, nameOf, fail } = require('./util');

// 내장 16개 단어 주제 팩 (4x4 그리드 = 16개)
const TOPIC_PACKS = [
  {
    id: 'food',
    name: '야식 & 배달음식',
    icon: '🍕',
    words: [
      '치킨', '피자', '떡볶이', '족발',
      '보쌈', '짜장면', '마라탕', '삼겹살',
      '곱창', '햄버거', '라면', '순대',
      '닭발', '초밥', '타코', '팟타이'
    ]
  },
  {
    id: 'animals',
    name: '동물 & 곤충',
    icon: '🦁',
    words: [
      '호랑이', '사자', '코끼리', '기린',
      '판다', '펭귄', '독수리', '돌고래',
      '캥거루', '카멜레온', '하마', '악어',
      '여우', '고양이', '강아지', '원숭이'
    ]
  },
  {
    id: 'jobs',
    name: '직업 & 전문직',
    icon: '💼',
    words: [
      '의사', '경찰관', '소방관', '요리사',
      '선생님', '프로그래머', '아이돌', '판사',
      '조종사', '마술사', '우주비행사', '작가',
      '유튜버', '미용사', '건축가', '탐정'
    ]
  },
  {
    id: 'movies',
    name: '한국 영화 & 명작',
    icon: '🎬',
    words: [
      '기생충', '오징어게임', '극한직업', '부산행',
      '범죄도시', '명량', '괴물', '태극기',
      '도깨비', '태양의후예', '미스터션샤인', '더글로리',
      '무빙', '올드보이', '베테랑', '신과함께'
    ]
  },
  {
    id: 'travel',
    name: '세계 여행지 & 국가',
    icon: '✈️',
    words: [
      '프랑스', '일본', '미국', '영국',
      '이탈리아', '스위스', '호주', '이집트',
      '브라질', '태국', '스페인', '베트남',
      '캐나다', '그리스', '몰디브', '하와이'
    ]
  },
  {
    id: 'items',
    name: '가전 & 일상 사물',
    icon: '📱',
    words: [
      '스마트폰', '냉장고', '세탁기', '에어컨',
      '전자레인지', '청소기', '드라이어', 'TV',
      '노트북', '다리미', '공기청정기', '커피머신',
      '전기밥솥', '스피커', '손목시계', '안경'
    ]
  },
  {
    id: 'dessert',
    name: '디저트 & 카페',
    icon: '☕',
    words: [
      '아메리카노', '카페라떼', '버블티', '딸기케이크',
      '크루아상', '마카롱', '빙수', '와플',
      '츄러스', '티라미수', '에그타르트', '핫초코',
      '스콘', '젤라또', '베이글', '푸딩'
    ]
  },
  {
    id: 'sports',
    name: '스포츠 & 운동',
    icon: '⚽',
    words: [
      '축구', '야구', '농구', '배구',
      '테니스', '수영', '골프', '볼링',
      '배드민턴', '태권도', '복싱', '탁구',
      '보드', '스키', '양궁', '마라톤'
    ]
  },
  {
    id: 'places',
    name: '도시 명소 & 핫플레이스',
    icon: '🏢',
    words: [
      '도서관', '병원', '놀이공원', '공항',
      '영화관', '찜질방', '미술관', '백화점',
      '노래방', 'PC방', '동물원', '수족관',
      '워터파크', '캠핑장', '카페', '편의점'
    ]
  },
  {
    id: 'school',
    name: '학교 & 학창시절',
    icon: '🏫',
    words: [
      '국어', '수학', '영어', '과학',
      '사회', '미술', '음악', '체육',
      '역사', '도덕', '급식실', '교무실',
      '운동장', '방학', '중간고사', '수능'
    ]
  },
  {
    id: 'fantasy',
    name: '판타지 & RPG',
    icon: '🧙',
    words: [
      '드래곤', '엘프', '마법사', '성기사',
      '골렘', '오크', '포션', '보물상자',
      '던전', '전설의검', '방패', '날개',
      '마왕', '공주', '좀비', '유령'
    ]
  },
  {
    id: 'korea',
    name: '국내 도시 & 여행지',
    icon: '🗺️',
    words: [
      '서울', '부산', '제주도', '강릉',
      '경주', '전주', '여수', '속초',
      '대구', '인천', '광주', '남산타워',
      '해운대', '성산일출봉', '불국사', '한강공원'
    ]
  },
  {
    id: 'heroes',
    name: '애니 & 히어로 캐릭터',
    icon: '🦸',
    words: [
      '스파이더맨', '아이언맨', '배트맨', '슈퍼맨',
      '헐크', '토르', '피카츄', '도라에몽',
      '짱구', '코난', '손오공', '루피',
      '엘사', '슈렉', '조커', '뽀로로'
    ]
  },
  {
    id: 'nature',
    name: '계절 & 자연 현상',
    icon: '🌈',
    words: [
      '봄날', '한여름', '가을단풍', '겨울눈',
      '무지개', '천둥번개', '태풍', '눈사람',
      '폭포', '사막', '푸른바다', '오로라',
      '화산', '붉은노을', '보름달', '은하수'
    ]
  }
];

module.exports = {
  id: 'chameleon',
  name: '카멜레온',
  icon: '🦎',
  desc: '단어를 모르는 위장자를 찾아라! 16개 단어 속 고도의 눈치 심리전 (3~12인)',
  minPlayers: 3,
  maxPlayers: 12,

  init() {
    return {
      phase: 'setup',
      settings: {
        totalRounds: 3,
        chameleonCount: 1, // 1 or 2
        clueMode: 'turn',  // 'turn' (순서대로 1단어 입력) | 'free' (자유 음성 발언 후 바로 토론)
        category: 'random',
      },
      currentRound: 0,
      participants: [],
      spectators: [],
      topic: null,          // { id, name, icon, words: [...] }
      secretWord: null,     // string
      secretIndex: -1,      // 0~15
      chameleonIds: [],     // [pid, ...]
      turnOrder: [],        // [pid, ...] (힌트 발언 순서)
      activeTurnIndex: 0,
      activePlayerId: null,
      clues: {},            // pid -> string
      ready: {},            // pid -> boolean (카드 확인 완료)
      votes: {},            // voterPid -> targetPid
      voteRound: 1,         // 1: 1차 투표, 2: 재투표 (동점자 결선 투표)
      voteCandidates: [],   // 투표 지목 대상 후보군
      revoteNotice: null,   // 재투표 안내 정보
      voteResult: null,     // { tally: {}, top: [], isChameleonCaught: bool, caughtList: [] }
      guessResult: null,    // { guesserId, word, isCorrect }
      roundWinner: null,    // 'chameleon' | 'civilians'
      roundReason: null,    // 'escaped' | 'tie' | 'caught_wrong_guess' | 'caught_correct_guess'
      roundScores: {},      // pid -> score this round
    };
  },

  async handle(room, p, type, pl, ctx) {
    const g = room.game.state;
    const isHost = p.id === room.hostId;
    const needHost = () => { if (!isHost) throw fail('방장만 할 수 있어요'); };
    const needParticipant = () => {
      if (!g.participants.includes(p.id)) throw fail('이번 라운드 참가자가 아니에요');
    };

    switch (type) {
      case 'settings': {
        needHost();
        if (g.phase !== 'setup') return;
        g.settings.totalRounds = Math.min(10, Math.max(1, Math.round(Number(pl.totalRounds)) || 3));
        g.settings.chameleonCount = Math.min(2, Math.max(1, Math.round(Number(pl.chameleonCount)) || 1));
        g.settings.clueMode = pl.clueMode === 'free' ? 'free' : 'turn';
        g.settings.category = pl.category || 'random';
        return;
      }

      case 'start': {
        needHost();
        if (g.phase !== 'setup' && g.phase !== 'gameEnd') return;
        if (room.players.length < 3) throw fail('최소 3명 이상 필요해요 (추천 4~8명)');

        const allPids = room.players.map((x) => x.id);
        if (allPids.length > 12) {
          g.participants = allPids.slice(0, 12);
          g.spectators = allPids.slice(12);
        } else {
          g.participants = [...allPids];
          g.spectators = [];
        }

        g.currentRound = 0;
        startNewRound(room, g);
        return;
      }

      // 카드 확인 완료 (준비 버튼)
      case 'ready': {
        needParticipant();
        if (g.phase !== 'card') return;
        g.ready[p.id] = true;

        // 모든 참가자가 확인했으면 힌트 단계로 이동
        const allReady = g.participants.every((pid) => g.ready[pid]);
        if (allReady) {
          if (g.settings.clueMode === 'free') {
            // 자유 음성 발언 모드 -> 바로 토론/투표로 전환 가능
            g.phase = 'debate';
          } else {
            g.phase = 'clue';
            g.activeTurnIndex = 0;
            g.activePlayerId = g.turnOrder[0];
          }
        }
        return;
      }

      // 한 단어 힌트 제출 (순서대로 입력 모드)
      case 'submitClue': {
        needParticipant();
        if (g.phase !== 'clue') return;
        if (p.id !== g.activePlayerId) throw fail('내 차례가 아니에요');

        const clueText = String(pl.clue || '').trim().slice(0, 20);
        if (!clueText) throw fail('힌트 단어를 입력해주세요');

        g.clues[p.id] = clueText;

        // 다음 사람 턴 이동
        g.activeTurnIndex++;
        if (g.activeTurnIndex < g.turnOrder.length) {
          g.activePlayerId = g.turnOrder[g.activeTurnIndex];
        } else {
          // 모든 사람이 힌트를 냈으므로 토론 단계로 전환!
          g.phase = 'debate';
          g.activePlayerId = null;
        }
        return;
      }

      // 방장의 힌트 스킵 또는 즉시 토론 시작
      case 'startDebate': {
        needHost();
        if (g.phase === 'clue' || g.phase === 'card') {
          g.phase = 'debate';
          g.activePlayerId = null;
        }
        return;
      }

      // 투표 제출
      case 'vote': {
        needParticipant();
        if (g.phase !== 'debate') return;

        const targetId = String(pl.targetId || '');
        if (!g.voteCandidates.includes(targetId)) throw fail('이번 투표의 지목 대상 후보가 아니에요');

        g.votes[p.id] = targetId;

        // 모두 투표했는지 검사
        const allVoted = g.participants.every((pid) => g.votes[pid]);
        if (allVoted) {
          tallyVotes(room, g, ctx);
        }
        return;
      }

      // 방장의 즉시 투표 마감
      case 'forceTally': {
        needHost();
        if (g.phase !== 'debate') return;
        if (Object.keys(g.votes).length === 0) throw fail('아직 투표한 사람이 아무도 없어요');
        tallyVotes(room, g, ctx);
        return;
      }

      // 카멜레온의 최후 추리 (비밀 단어 맞히기)
      case 'guessWord': {
        needParticipant();
        if (g.phase !== 'guess') return;
        if (!g.chameleonIds.includes(p.id)) throw fail('검거된 카멜레온만 단어를 추리할 수 있어요');

        const word = String(pl.word || '').trim();
        if (!word) throw fail('맞힐 단어를 선택해주세요');

        const isCorrect = word === g.secretWord;
        g.guessResult = {
          guesserId: p.id,
          word,
          isCorrect,
        };

        if (isCorrect) {
          // 카멜레온 대역전승!
          finishRound(room, g, ctx, 'chameleon', 'caught_correct_guess');
        } else {
          // 시민 승리!
          finishRound(room, g, ctx, 'civilians', 'caught_wrong_guess');
        }
        return;
      }

      case 'nextRound': {
        needHost();
        if (g.phase !== 'roundEnd') return;
        startNewRound(room, g);
        return;
      }

      case 'again': {
        needHost();
        if (g.phase !== 'gameEnd') return;
        g.phase = 'setup';
        return;
      }

      default:
        throw fail('알 수 없는 요청이에요');
    }
  },

  view(room, p) {
    const g = room.game.state;
    const nm = (id) => nameOf(room, id);
    const isHost = p.id === room.hostId;
    const isSpectator = g.phase !== 'setup' && !g.participants.includes(p.id);
    const isChameleon = g.chameleonIds && g.chameleonIds.includes(p.id);

    const v = {
      phase: g.phase,
      settings: g.settings,
      currentRound: g.currentRound,
      isSpectator,
      isChameleon,
      topicPacks: TOPIC_PACKS.map((t) => ({ id: t.id, name: t.name, icon: t.icon })),
    };

    if (g.phase === 'setup') return v;

    // 참가자 목록 및 상태
    v.participants = g.participants.map((id) => ({
      id,
      name: nm(id),
      isReady: !!g.ready[id],
      hasClue: !!g.clues[id],
      clue: g.clues[id] || null,
      hasVoted: !!g.votes[id],
      votedFor: (g.phase === 'voteResult' || g.phase === 'roundEnd' || g.phase === 'gameEnd') ? g.votes[id] : null,
      score: (room.players.find((x) => x.id === id) || {}).score || 0,
      roundScore: g.roundScores[id] || 0,
      isChameleon: (g.phase === 'voteResult' || g.phase === 'guess' || g.phase === 'roundEnd' || g.phase === 'gameEnd' || isSpectator) ? g.chameleonIds.includes(id) : undefined,
    }));

    // 16개 단어 판
    v.topic = g.topic;

    // 비밀 단어 노출 제어:
    // 시민이거나 관전자이거나 라운드가 끝났을 때만 보임!
    const canSeeSecret = !isChameleon || isSpectator || g.phase === 'roundEnd' || g.phase === 'gameEnd';
    v.secretWord = canSeeSecret ? g.secretWord : null;
    v.secretIndex = canSeeSecret ? g.secretIndex : null;

    // 힌트 순서 및 현재 턴
    v.turnOrder = g.turnOrder.map((id) => ({ id, name: nm(id) }));
    v.activePlayerId = g.activePlayerId;
    v.isMyTurn = g.activePlayerId === p.id;

    // 투표 정보
    v.myVote = g.votes[p.id] || null;
    v.voteCount = Object.keys(g.votes).length;
    v.voteRound = g.voteRound || 1;
    v.voteCandidates = g.voteCandidates || [...g.participants];
    v.revoteNotice = g.revoteNotice;

    // 결과 정보
    v.voteResult = g.voteResult;
    v.guessResult = g.guessResult;
    v.roundWinner = g.roundWinner;
    v.roundReason = g.roundReason;
    v.chameleonNames = (g.phase === 'voteResult' || g.phase === 'guess' || g.phase === 'roundEnd' || g.phase === 'gameEnd' || isSpectator)
      ? g.chameleonIds.map(nm)
      : [];

    if (g.phase === 'roundEnd' || g.phase === 'gameEnd') {
      v.leaderboard = [...g.participants]
        .map((id) => ({
          id,
          name: nm(id),
          totalScore: (room.players.find((x) => x.id === id) || {}).score || 0,
          roundScore: g.roundScores[id] || 0,
          wasChameleon: g.chameleonIds.includes(id),
        }))
        .sort((a, b) => b.totalScore - a.totalScore);
    }

    return v;
  },
};

// 새 라운드 시작
function startNewRound(room, g) {
  g.currentRound++;
  g.ready = {};
  g.clues = {};
  g.votes = {};
  g.voteRound = 1;
  g.voteCandidates = [...g.participants];
  g.revoteNotice = null;
  g.voteResult = null;
  g.guessResult = null;
  g.roundWinner = null;
  g.roundReason = null;
  g.roundScores = {};

  // 주제 선택 (선택된 주제 또는 랜덤)
  let chosenPack = null;
  if (g.settings.category && g.settings.category !== 'random') {
    chosenPack = TOPIC_PACKS.find((p) => p.id === g.settings.category);
  }
  if (!chosenPack) {
    chosenPack = pick(TOPIC_PACKS);
  }
  g.topic = { ...chosenPack };

  // 16개 단어 중 1개를 비밀 단어로 무작위 지정
  g.secretIndex = Math.floor(Math.random() * g.topic.words.length);
  g.secretWord = g.topic.words[g.secretIndex];

  // 카멜레온 선출
  const shuffledPids = shuffle([...g.participants]);
  const chamCount = Math.min(g.settings.chameleonCount, Math.floor(g.participants.length / 2));
  g.chameleonIds = shuffledPids.slice(0, Math.max(1, chamCount));

  // 힌트 발언 순서 셔플
  g.turnOrder = shuffle([...g.participants]);
  g.activeTurnIndex = 0;
  g.activePlayerId = null;

  // 카드 확인 페이즈로 시작!
  g.phase = 'card';
}

// 투표 집계
function tallyVotes(room, g, ctx) {
  const nm = (id) => nameOf(room, id);
  const tally = {};
  (g.voteCandidates || g.participants).forEach((id) => { tally[id] = 0; });
  Object.values(g.votes).forEach((targetId) => {
    if (tally[targetId] !== undefined) {
      tally[targetId]++;
    }
  });

  const maxVotes = Math.max(0, ...Object.values(tally));
  const topIds = maxVotes > 0 ? (g.voteCandidates || g.participants).filter((id) => tally[id] === maxVotes) : [];

  // 최다 득표수가 같은 사람이 2명 이상인 경우 (동점표)
  if (topIds.length >= 2 || maxVotes === 0) {
    if (g.voteRound === 1) {
      // 1차 투표에서 동점 발생 -> 동점자들만 대상으로 2차 재투표 진행!
      const tieCandidates = topIds.length >= 2 ? topIds : [...g.participants];
      g.voteRound = 2;
      g.voteCandidates = [...tieCandidates];
      g.votes = {}; // 투표 리셋
      g.revoteNotice = {
        round: 2,
        topIds: tieCandidates,
        topNames: tieCandidates.map(nm),
        maxVotes,
      };
      g.phase = 'debate';
      return;
    } else {
      // 2차 재투표에서도 또다시 동점표 발생 -> 카멜레온 승리!
      g.voteResult = {
        tally,
        topIds,
        topNames: topIds.map(nm),
        maxVotes,
        isChameleonCaught: false,
        caughtList: [],
      };
      finishRound(room, g, ctx, 'chameleon', 'tie');
      return;
    }
  }

  // 단독 1등 선출 완료 (1차 또는 2차 재투표)
  const singleTopId = topIds[0];
  const isChameleonCaught = g.chameleonIds.includes(singleTopId);

  g.voteResult = {
    tally,
    topIds,
    topNames: topIds.map(nm),
    maxVotes,
    isChameleonCaught,
    caughtList: isChameleonCaught ? [singleTopId] : [],
  };

  if (isChameleonCaught) {
    // 카멜레온 검거 성공! -> 카멜레온에게 비밀 단어 추리 기회 제공!
    g.phase = 'guess';
  } else {
    // 시민 오인 지목 (카멜레온 도주 성공!) -> 카멜레온 승리!
    finishRound(room, g, ctx, 'chameleon', 'escaped');
  }
}

// 라운드 종료 및 점수 정산
function finishRound(room, g, ctx, winner, reason) {
  g.roundWinner = winner;
  g.roundReason = reason;
  g.roundScores = {};

  // 검거 실패(escaped) 또는 재투표 동점(tie) 시 카멜레온 3점, 역전 추리 성공 시 2점, 시민 승리 시 시민 각 2점
  const chamPts = (reason === 'escaped' || reason === 'tie') ? 3 : 2;
  const civPts = 2;

  if (winner === 'chameleon') {
    const reasonText = reason === 'tie' ? '재투표 동점 도주' : reason === 'escaped' ? '위장 성공' : '비밀 단어 역전 추리';
    g.chameleonIds.forEach((id) => {
      g.roundScores[id] = chamPts;
      ctx.addScore(room, id, chamPts, `카멜레온 승리 (${reasonText})`);
    });
    g.participants.filter((id) => !g.chameleonIds.includes(id)).forEach((id) => {
      g.roundScores[id] = 0;
    });
  } else {
    g.participants.filter((id) => !g.chameleonIds.includes(id)).forEach((id) => {
      g.roundScores[id] = civPts;
      ctx.addScore(room, id, civPts, '카멜레온 검거 성공');
    });
    g.chameleonIds.forEach((id) => {
      g.roundScores[id] = 0;
    });
  }

  if (g.currentRound >= g.settings.totalRounds) {
    g.phase = 'gameEnd';
  } else {
    g.phase = 'roundEnd';
  }
}
