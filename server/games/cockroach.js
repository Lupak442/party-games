/**
 * 바퀴벌레 포커 (Cockroach Poker) 게임 모듈
 * 
 * 동물 8종류 x 8장 = 총 64장
 * 패배 조건:
 * 1. 같은 종류의 동물 4장 모음
 * 2. 모든 종류의 동물(8종류)을 1장씩 모음
 * 3. 자기 차례에 낼 카드가 손에 없음
 */
const { shuffle, nameOf, fail } = require('./util');

const BUGS = [
  { id: 'cockroach', name: '바퀴벌레', icon: '🪳' },
  { id: 'bat', name: '박쥐', icon: '🦇' },
  { id: 'fly', name: '파리', icon: '🪰' },
  { id: 'toad', name: '두꺼비', icon: '🐸' },
  { id: 'rat', name: '쥐', icon: '🐀' },
  { id: 'scorpion', name: '전갈', icon: '🦂' },
  { id: 'spider', name: '거미', icon: '🕷️' },
  { id: 'stinkbug', name: '노린재', icon: '🪲' },
];

const BUG_MAP = Object.fromEntries(BUGS.map((b) => [b.id, b]));

function makeDeck() {
  const deck = [];
  BUGS.forEach((b) => {
    for (let i = 0; i < 8; i++) {
      deck.push({ id: `${b.id}_${i}`, bugId: b.id });
    }
  });
  return shuffle(deck);
}

function checkLoser(table) {
  // 1. 같은 종류 4장 이상
  for (const b of BUGS) {
    if ((table[b.id] || 0) >= 4) {
      return { lost: true, reason: 'fourSame', bug: b.name };
    }
  }
  // 2. 모든 종류(8종) 각각 1장 이상
  const typesCollected = BUGS.filter((b) => (table[b.id] || 0) >= 1).length;
  if (typesCollected >= 8) {
    return { lost: true, reason: 'allTypes' };
  }
  return { lost: false };
}

module.exports = {
  id: 'cockroach',
  name: '바퀴벌레 포커',
  icon: '🪳',
  desc: '블러핑 심리전! 꼴찌 1명을 가려내는 벌레 모으기 (2~6인, 초과 시 관전)',
  minPlayers: 2,
  maxPlayers: 6,

  init() {
    return {
      phase: 'setup',
      settings: {
        winPts: 1,
        losePts: 2,
      },
      hands: {},       // pid -> [card, ...]
      tables: {},      // pid -> { bugId: count, ... }
      turn: null,      // active card passing state
      activePlayer: null, // 카드를 보낼 차례인 사람
      participants: [],
      spectators: [],
      loserId: null,
      loserReason: null,
    };
  },

  async handle(room, p, type, pl, ctx) {
    const g = room.game.state;
    const isHost = p.id === room.hostId;
    const needHost = () => { if (!isHost) throw fail('방장만 할 수 있어요'); };

    switch (type) {
      case 'settings': {
        needHost();
        if (g.phase !== 'setup') return;
        g.settings.winPts = Math.min(20, Math.max(1, Math.round(Number(pl.winPts)) || 1));
        g.settings.losePts = Math.min(20, Math.max(1, Math.round(Number(pl.losePts)) || 2));
        return;
      }

      case 'start': {
        needHost();
        if (g.phase !== 'setup' && g.phase !== 'end') return;
        if (room.players.length < 2) throw fail('최소 2명 이상 필요해요');

        // 2~6인 제한: 6명 초과 시 앞의 6명 참가, 나머지는 관전자!
        const allPids = room.players.map((x) => x.id);
        if (allPids.length > 6) {
          g.participants = allPids.slice(0, 6);
          g.spectators = allPids.slice(6);
        } else {
          g.participants = [...allPids];
          g.spectators = [];
        }

        const deck = makeDeck();

        g.hands = {};
        g.tables = {};
        g.participants.forEach((id) => {
          g.hands[id] = [];
          g.tables[id] = {};
          BUGS.forEach((b) => { g.tables[id][b.id] = 0; });
        });

        // 카드 균등 분배 (참가자에게만)
        let idx = 0;
        while (deck.length > 0) {
          const card = deck.pop();
          g.hands[g.participants[idx % g.participants.length]].push(card);
          idx++;
        }

        g.activePlayer = g.participants[Math.floor(Math.random() * g.participants.length)];
        g.turn = null;
        g.loserId = null;
        g.loserReason = null;
        g.lastEvent = null;
        g.phase = 'play';
        return;
      }

      // 선 플레이어가 손패에서 카드를 골라 상대에게 보냄
      case 'offer': {
        if (g.phase !== 'play') return;
        if (g.turn) throw fail('현재 진행 중인 카드가 있어요');
        if (p.id !== g.activePlayer) throw fail('내 차례가 아니에요');

        const hand = g.hands[p.id];
        if (!hand || hand.length === 0) {
          // 낼 카드가 없으면 즉시 패배!
          return endGame(room, g, ctx, p.id, 'noCards');
        }

        const cardIdx = hand.findIndex((c) => c.id === pl.cardId);
        if (cardIdx === -1) throw fail('손패에 없는 카드예요');
        if (!g.participants.includes(pl.to) || pl.to === p.id) throw fail('전달할 상대를 선택해주세요');
        if (!BUG_MAP[pl.claim]) throw fail('선언할 동물을 선택해주세요');

        const [card] = hand.splice(cardIdx, 1);
        g.turn = {
          from: p.id,
          to: pl.to,
          card,
          claim: pl.claim,
          seenBy: [p.id],
          stage: 'respond', // 'respond' | 'pass'
        };
        return;
      }

      // 받은 사람이 참/거짓 선언
      case 'guess': {
        if (g.phase !== 'play' || !g.turn) return;
        if (g.turn.stage !== 'respond') return;
        if (p.id !== g.turn.to) throw fail('카드를 받은 사람만 맞힐 수 있어요');
        if (pl.guess !== 'true' && pl.guess !== 'false') throw fail('참 또는 거짓을 선택해주세요');

        const actualBugId = g.turn.card.bugId;
        const isActuallyTrue = actualBugId === g.turn.claim;
        const guessedTrue = pl.guess === 'true';

        // 정답을 맞혔는지 여부
        const guessCorrect = (guessedTrue === isActuallyTrue);

        // 맞혔으면 보낸 사람(from)이 먹고, 틀렸으면 받은 사람(to)이 먹음
        const eaterId = guessCorrect ? g.turn.from : g.turn.to;
        g.tables[eaterId][actualBugId] = (g.tables[eaterId][actualBugId] || 0) + 1;

        const eaterName = nameOf(room, eaterId);
        const actualBug = BUG_MAP[actualBugId];
        const claimBug = BUG_MAP[g.turn.claim];

        g.lastEvent = {
          from: nameOf(room, g.turn.from),
          to: nameOf(room, g.turn.to),
          claim: claimBug.name,
          actual: actualBug.name,
          actualIcon: actualBug.icon,
          guess: guessedTrue ? '참 (진짜)' : '거짓 (구라)',
          correct: guessCorrect,
          eater: eaterName,
        };

        // 패배 조건 검사
        const check = checkLoser(g.tables[eaterId]);
        if (check.lost) {
          return endGame(room, g, ctx, eaterId, check.reason, check.bug);
        }

        // 카드를 먹은 사람이 다음 선 플레이어
        g.activePlayer = eaterId;
        g.turn = null;

        // 먹은 사람이 카드가 0장이면 다음 카드를 낼 수 없으므로 패배!
        if (g.hands[eaterId].length === 0) {
          return endGame(room, g, ctx, eaterId, 'noCards');
        }
        return;
      }

      // 받은 사람이 카드를 확인하고 다른 사람에게 넘김(패스)
      case 'passPeek': {
        if (g.phase !== 'play' || !g.turn) return;
        if (g.turn.stage !== 'respond') return;
        if (p.id !== g.turn.to) throw fail('카드를 받은 사람만 넘길 수 있어요');

        // 아직 카드를 보지 않은 후보자들
        const candidates = g.participants.filter((id) => !g.turn.seenBy.includes(id));
        if (candidates.length === 0) throw fail('더 이상 넘길 수 있는 사람이 없어요. 맞혀야 해요!');

        g.turn.seenBy.push(p.id);
        g.turn.stage = 'pass';
        return;
      }

      // 패스 후 다른 사람에게 새로운 주장과 함께 전달
      case 'passDeliver': {
        if (g.phase !== 'play' || !g.turn) return;
        if (g.turn.stage !== 'pass') return;
        if (p.id !== g.turn.to) throw fail('본인 차례예요');

        if (!g.participants.includes(pl.to)) throw fail('전달할 상대를 선택해주세요');
        if (g.turn.seenBy.includes(pl.to)) throw fail('이미 이 카드를 본 사람에게는 넘길 수 없어요');
        if (!BUG_MAP[pl.claim]) throw fail('선언할 동물을 선택해주세요');

        g.turn.from = p.id;
        g.turn.to = pl.to;
        g.turn.claim = pl.claim;
        g.turn.stage = 'respond';
        return;
      }

      case 'again': {
        needHost();
        if (g.phase !== 'end') return;
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

    const v = {
      phase: g.phase,
      settings: g.settings,
      bugs: BUGS,
      babo: room.babo || null,
      isSpectator,
      spectators: (g.spectators || []).map((id) => ({ id, name: nm(id) })),
    };

    if (g.phase === 'setup') return v;

    v.activePlayer = g.activePlayer ? { id: g.activePlayer, name: nm(g.activePlayer) } : null;
    v.myHand = isSpectator ? [] : (g.hands[p.id] || []).map((c) => ({ id: c.id, bug: BUG_MAP[c.bugId] }));
    v.myHandCount = v.myHand.length;

    // 모든 참가자들의 테이블(앞에 모인 벌레 컬렉션) 현황
    v.players = g.participants.map((id) => {
      const counts = g.tables[id] || {};
      const totalCollected = Object.values(counts).reduce((a, b) => a + b, 0);
      const uniqueCount = BUGS.filter((b) => (counts[b.id] || 0) >= 1).length;
      return {
        id,
        name: nm(id),
        handCount: (g.hands[id] || []).length,
        tables: counts,
        totalCollected,
        uniqueCount, // 8종류 중 몇 개 모았는지
        isTurnTo: g.turn && g.turn.to === id,
      };
    });

    v.lastEvent = g.lastEvent;

    // 현재 진행 중인 턴 카드 뷰
    if (g.turn) {
      const isSender = g.turn.from === p.id;
      const isReceiver = g.turn.to === p.id;
      const hasSeen = g.turn.seenBy.includes(p.id);

      v.turn = {
        from: { id: g.turn.from, name: nm(g.turn.from) },
        to: { id: g.turn.to, name: nm(g.turn.to) },
        claim: BUG_MAP[g.turn.claim],
        stage: g.turn.stage,
        isReceiver,
        isSender,
        hasSeen,
        // 카드를 본 사람 또는 관전자는 카드가 무엇인지 확인 가능(관전의 묘미: 블러핑 구경)
        actualCard: (hasSeen || isSpectator) ? BUG_MAP[g.turn.card.bugId] : null,
        // 패스 가능한 후보자 목록
        passCandidates: g.participants.filter((id) => !g.turn.seenBy.includes(id)).map((id) => ({ id, name: nm(id) })),
      };
    }

    if (g.phase === 'end') {
      v.loser = {
        id: g.loserId,
        name: nm(g.loserId),
        reason: g.loserReason,
      };
    }

    return v;
  },
};

function endGame(room, g, ctx, loserId, reason, bugName) {
  g.phase = 'end';
  g.loserId = loserId;
  g.turn = null;

  let reasonDesc = '';
  if (reason === 'fourSame') {
    reasonDesc = `${bugName} 4장을 모아서 패배!`;
  } else if (reason === 'allTypes') {
    reasonDesc = '모든 종류(8종류)의 동물을 1장씩 모아서 패배!';
  } else if (reason === 'noCards') {
    reasonDesc = '손패에 낼 카드가 없어서 패배!';
  }
  g.loserReason = reasonDesc;

  // 꼴찌 바보 타이틀 방에 등록 (다음 바퀴벌레 포커에서 새 꼴찌가 나오기 전까지 유지)
  const loserName = nameOf(room, loserId);
  room.babo = {
    playerId: loserId,
    name: loserName,
    title: '바퀴벌레 바보',
    icon: '🪳🤪',
    reason: reasonDesc,
    at: Date.now(),
  };

  // 패배자 감점
  ctx.addScore(room, loserId, -g.settings.losePts, `바퀴벌레 포커 꼴찌 (${reasonDesc})`);

  // 승자들 가점 (참가자 중 패배자 제외)
  g.participants.filter((id) => id !== loserId).forEach((id) => {
    ctx.addScore(room, id, g.settings.winPts, '바퀴벌레 포커 생존 승리');
  });
}
