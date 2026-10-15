/**
 * 블랙잭 게임 모듈
 * - 52장 표준 덱 (매 판 리셋)
 * - 딜러(서버): 16 이하는 무조건 히트, 17 이상은 무조건 스탠드
 * - 모드: 기본 점수제 (승리/블랙잭/버스트 점수 설정) vs 배팅 모드 (1~3점 배팅)
 */
const { shuffle, nameOf, fail } = require('./util');

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function newDeck() {
  const d = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      d.push({ suit: s, rank: r, color: (s === '♥' || s === '♦') ? 'red' : 'black' });
    }
  }
  return shuffle(d);
}

function handScore(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 'A') {
      aces += 1;
      total += 11;
    } else if (['K', 'Q', 'J'].includes(c.rank)) {
      total += 10;
    } else {
      total += Number(c.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  const isBlackjack = cards.length === 2 && total === 21;
  const isBust = total > 21;
  return { score: total, isBlackjack, isBust };
}

module.exports = {
  id: 'blackjack',
  name: '블랙잭',
  icon: '🃏',
  desc: '서버 딜러와 21점 승부! 배팅 모드 지원',
  minPlayers: 1,

  init() {
    return {
      phase: 'setup',
      settings: {
        mode: 'fixed', // 'fixed' | 'bet'
        winPts: 1,
        bjPts: 2,
        bustPts: 1, // 감점할 절대값 (1이면 -1점)
      },
      deck: [],
      dealer: { cards: [] },
      hands: {}, // pid -> { cards, bet, done, status }
      results: {}, // pid -> { outcome, delta, detail }
      error: null,
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
        g.settings.mode = pl.mode === 'bet' ? 'bet' : 'fixed';
        g.settings.winPts = Math.min(20, Math.max(1, Math.round(Number(pl.winPts)) || 1));
        g.settings.bjPts = Math.min(30, Math.max(1, Math.round(Number(pl.bjPts)) || 2));
        g.settings.bustPts = Math.min(20, Math.max(0, Math.round(Number(pl.bustPts)) || 1));
        return;
      }

      case 'start': {
        needHost();
        if (g.phase !== 'setup' && g.phase !== 'result') return;

        g.participants = room.players.map((x) => x.id);
        g.deck = newDeck();
        g.hands = {};
        g.results = {};
        g.dealer = { cards: [] };

        // 배팅 모드라면 배팅 단계로, 기본 점수제라면 바로 카드 배분
        if (g.settings.mode === 'bet') {
          g.participants.forEach((id) => {
            g.hands[id] = { cards: [], bet: 1, betDone: false, done: false };
          });
          g.phase = 'betting';
        } else {
          g.participants.forEach((id) => {
            g.hands[id] = { cards: [], bet: 0, betDone: true, done: false };
          });
          dealInitialCards(g);
        }
        return;
      }

      case 'bet': {
        if (g.phase !== 'betting') return;
        const h = g.hands[p.id];
        if (!h || h.betDone) return;
        const b = Math.min(3, Math.max(1, Math.round(Number(pl.amount)) || 1));
        h.bet = b;
        h.betDone = true;

        // 모두 배팅 완료했으면 게임 시작
        if (g.participants.every((id) => g.hands[id]?.betDone)) {
          dealInitialCards(g);
        }
        return;
      }

      case 'forceDeal': {
        needHost();
        if (g.phase !== 'betting') return;
        // 미배팅 유저는 기본 1점으로 처리
        g.participants.forEach((id) => {
          if (g.hands[id] && !g.hands[id].betDone) {
            g.hands[id].bet = 1;
            g.hands[id].betDone = true;
          }
        });
        dealInitialCards(g);
        return;
      }

      case 'hit': {
        if (g.phase !== 'playing') return;
        const h = g.hands[p.id];
        if (!h || h.done) throw fail('이미 차례가 끝났어요');

        const card = g.deck.pop();
        if (!card) throw fail('덱에 카드가 없어요');
        h.cards.push(card);

        const info = handScore(h.cards);
        if (info.isBust) {
          h.done = true;
          h.status = 'bust';
        } else if (info.score === 21) {
          h.done = true;
          h.status = 'stand';
        }

        checkAllPlayersDone(room, g, ctx);
        return;
      }

      case 'stand': {
        if (g.phase !== 'playing') return;
        const h = g.hands[p.id];
        if (!h || h.done) throw fail('이미 차례가 끝났어요');
        h.done = true;
        h.status = 'stand';

        checkAllPlayersDone(room, g, ctx);
        return;
      }

      case 'again': {
        needHost();
        if (g.phase !== 'result') return;
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

    const v = {
      phase: g.phase,
      settings: g.settings,
      error: g.error,
    };

    if (g.phase === 'setup') return v;

    // 배팅 단계
    if (g.phase === 'betting') {
      v.players = g.participants.map((id) => ({
        id,
        name: nm(id),
        score: room.players.find((x) => x.id === id)?.score || 0,
        bet: g.hands[id]?.bet || 1,
        betDone: !!g.hands[id]?.betDone,
      }));
      v.myBet = g.hands[p.id]?.bet || 1;
      v.myBetDone = !!g.hands[p.id]?.betDone;
      return v;
    }

    // 딜러 카드 뷰
    // playing 중에는 딜러의 1번째 카드만 보이고 2번째는 hidden
    if (g.phase === 'playing') {
      v.dealer = {
        cards: [g.dealer.cards[0], { hidden: true }],
        revealedCount: 1,
      };
    } else {
      // 딜러 턴 또는 결과 시 전면 공개
      v.dealer = {
        cards: g.dealer.cards,
        scoreInfo: handScore(g.dealer.cards),
      };
    }

    // 플레이어별 패 뷰
    v.players = g.participants.map((id) => {
      const h = g.hands[id] || { cards: [], done: false };
      return {
        id,
        name: nm(id),
        cards: h.cards,
        bet: h.bet,
        scoreInfo: handScore(h.cards),
        done: h.done,
        status: h.status,
      };
    });

    // 내 손패 상태
    const myH = g.hands[p.id];
    if (myH) {
      v.myHand = {
        cards: myH.cards,
        bet: myH.bet,
        scoreInfo: handScore(myH.cards),
        done: myH.done,
      };
    }

    if (g.phase === 'result') {
      v.results = g.results;
    }

    return v;
  },
};

function dealInitialCards(g) {
  // 각자 2장씩
  g.participants.forEach((id) => {
    g.hands[id].cards = [g.deck.pop(), g.deck.pop()];
    const sc = handScore(g.hands[id].cards);
    if (sc.isBlackjack) {
      g.hands[id].done = true;
      g.hands[id].status = 'blackjack';
    } else {
      g.hands[id].done = false;
      g.hands[id].status = 'playing';
    }
  });

  // 딜러 2장
  g.dealer.cards = [g.deck.pop(), g.deck.pop()];

  g.phase = 'playing';

  // 만약 모든 플레이어가 처음에 이미 블랙잭이면 바로 딜러 턴으로
  if (g.participants.every((id) => g.hands[id].done)) {
    // 딜러 차례 진행
  }
}

function checkAllPlayersDone(room, g, ctx) {
  const allDone = g.participants.every((id) => g.hands[id].done);
  if (!allDone) return;

  // 딜러 규칙: 16 이하는 무조건 히트, 17 이상이면 스탠드
  while (handScore(g.dealer.cards).score < 17) {
    const card = g.deck.pop();
    if (!card) break;
    g.dealer.cards.push(card);
  }

  const dInfo = handScore(g.dealer.cards);

  // 결과 판정 및 점수 지급
  g.results = {};
  const isBetMode = g.settings.mode === 'bet';

  g.participants.forEach((id) => {
    const h = g.hands[id];
    const pInfo = handScore(h.cards);
    let outcome = 'lose'; // 'win' | 'blackjack' | 'lose' | 'bust' | 'push'
    let delta = 0;
    let desc = '';

    if (pInfo.isBust) {
      outcome = 'bust';
      delta = isBetMode ? -h.bet : -g.settings.bustPts;
      desc = isBetMode ? `버스트! 배팅금 ${h.bet}점 상실` : `버스트! ${delta}점`;
    } else if (pInfo.isBlackjack) {
      if (dInfo.isBlackjack) {
        outcome = 'push';
        delta = 0;
        desc = '딜러도 블랙잭 (무승부 - 원금 회수)';
      } else {
        outcome = 'blackjack';
        delta = isBetMode ? h.bet * 2 : g.settings.bjPts;
        desc = isBetMode ? `블랙잭 대승! +${delta}점` : `블랙잭 승리! +${delta}점`;
      }
    } else if (dInfo.isBust) {
      // 딜러만 버스트
      outcome = 'win';
      delta = isBetMode ? h.bet : g.settings.winPts;
      desc = isBetMode ? `딜러 버스트! +${delta}점` : `승리! +${delta}점`;
    } else if (pInfo.score > dInfo.score) {
      outcome = 'win';
      delta = isBetMode ? h.bet : g.settings.winPts;
      desc = isBetMode ? `딜러보다 높음! +${delta}점` : `승리! +${delta}점`;
    } else if (pInfo.score === dInfo.score) {
      outcome = 'push';
      delta = 0;
      desc = '무승부 (원금 회수)';
    } else {
      outcome = 'lose';
      delta = isBetMode ? -h.bet : 0;
      desc = isBetMode ? `패배! 배팅금 ${h.bet}점 상실` : '패배';
    }

    g.results[id] = { outcome, delta, desc, score: pInfo.score };
    if (delta !== 0) {
      ctx.addScore(room, id, delta, `블랙잭 ${desc}`);
    }
  });

  g.phase = 'result';
}
