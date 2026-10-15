/**
 * 달무티 (The Great Dalmuti) 게임 모듈
 * 
 * 인생은 불공평합니다!
 * 1~12번 카드 (번호만큼의 장수) + 조커 2장 = 총 80장
 * 클라이밍 카드 게임 (같은 장수, 더 낮은 숫자)
 * 라운드 종료 시 등수에 따라 계급 부여 (달무티, 총리, 평민, 소농노, 대농노)
 * 세금 교환: 대농노 -> 달무티 (최고 카드 2장 자동 상납 / 달무티는 자유 2장 하사)
 *             소농노 -> 총리 (최고 카드 1장 자동 상납 / 총리는 자유 1장 하사)
 */
const { shuffle, nameOf, fail } = require('./util');

// 계급 카드 정의 (숫자, 이름, 아이콘, 장수)
const CARDS_DEF = [
  { rank: 1, name: '달무티왕', icon: '👑', count: 1 },
  { rank: 2, name: '대주교', icon: '🪽', count: 2 },
  { rank: 3, name: '총리대신', icon: '📜', count: 3 },
  { rank: 4, name: '남작부인', icon: '💎', count: 4 },
  { rank: 5, name: '수도원장', icon: '⛪', count: 5 },
  { rank: 6, name: '기사', icon: '⚔️', count: 6 },
  { rank: 7, name: '재봉사', icon: '🧵', count: 7 },
  { rank: 8, name: '석공', icon: '🧱', count: 8 },
  { rank: 9, name: '요리사', icon: '🍳', count: 9 },
  { rank: 10, name: '양치기', icon: '🐑', count: 10 },
  { rank: 11, name: '광부', icon: '⛏️', count: 11 },
  { rank: 12, name: '농노', icon: '🌾', count: 12 },
];

const CARD_MAP = Object.fromEntries(CARDS_DEF.map((c) => [c.rank, c]));
CARD_MAP[13] = { rank: 13, name: '어릿광대(조커)', icon: '🃏', count: 2 };

// 신분 계급 타이틀 정의
function getTitle(seatIdx, total) {
  if (seatIdx === 0) return { id: 'dalmuti', name: '달무티왕', icon: '👑', class: 't-dalmuti' };
  if (seatIdx === 1 && total >= 4) return { id: 'minister', name: '총리', icon: '📜', class: 't-minister' };
  if (seatIdx === total - 1) return { id: 'greater_peon', name: '대농노', icon: '🌾', class: 't-gpeon' };
  if (seatIdx === total - 2 && total >= 4) return { id: 'lesser_peon', name: '소농노', icon: '🧹', class: 't-lpeon' };
  return { id: 'merchant', name: `평민 ${seatIdx}`, icon: '🍺', class: 't-merchant' };
}

function makeDeck() {
  const deck = [];
  CARDS_DEF.forEach((c) => {
    for (let i = 0; i < c.count; i++) {
      deck.push({ id: `c_${c.rank}_${i}`, rank: c.rank });
    }
  });
  // 조커 2장 (rank: 13)
  deck.push({ id: 'c_joker_1', rank: 13, isJoker: true });
  deck.push({ id: 'c_joker_2', rank: 13, isJoker: true });
  return shuffle(deck);
}

// 손패에서 가장 좋은 카드(가장 낮은 숫자 순, 조커는 단독 13번이므로 가장 나쁨) n장 추출
function pickBestCards(hand, count) {
  // 정렬: rank 기준 오름차순 (1이 가장 좋고, 12, 13 조커 순)
  const sorted = [...hand].sort((a, b) => a.rank - b.rank);
  return sorted.slice(0, count);
}

module.exports = {
  id: 'dalmuti',
  name: '달무티',
  icon: '👑',
  desc: '인생은 불공평합니다! 계급 서열과 세금 징수의 명작 카드게임',
  minPlayers: 3,
  maxPlayers: 8,

  init() {
    return {
      phase: 'setup',
      settings: {
        totalRounds: 3,
        enableTax: true,
        enableRevolution: true,
      },
      currentRound: 0,
      participants: [],
      spectators: [],
      seats: [],         // [ { id, name, title } ] (계급 서열 순서)
      hands: {},         // pid -> [card, ...]
      trick: null,       // { lastPlayerId, cards: [], rankValue, count, passes: [] }
      activePlayer: null,// 현재 턴 플레이어 id
      finishedOrder: [], // 손패를 턴 순서대로 pid 저장
      tax: null,         // 세금 교환 진행 상태
      roundScores: {},   // pid -> score
      revolution: null,  // { playerId, type: 'tax_free' | 'overthrow' }
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
        g.settings.totalRounds = Math.min(10, Math.max(1, Math.round(Number(pl.totalRounds)) || 3));
        g.settings.enableTax = pl.enableTax !== false;
        g.settings.enableRevolution = pl.enableRevolution !== false;
        return;
      }

      case 'start': {
        needHost();
        if (g.phase !== 'setup' && g.phase !== 'gameEnd') return;
        if (room.players.length < 3) throw fail('최소 3명 이상 필요해요 (추천 4~8명)');

        const allPids = room.players.map((x) => x.id);
        if (allPids.length > 8) {
          g.participants = allPids.slice(0, 8);
          g.spectators = allPids.slice(8);
        } else {
          g.participants = [...allPids];
          g.spectators = [];
        }

        // 1라운드는 임의 순서로 좌석 배정
        g.seats = shuffle([...g.participants]);
        g.currentRound = 0;
        startNewRound(room, g);
        return;
      }

      // 조커 2장을 쥔 사람의 대혁명 선언
      case 'revolution': {
        if (g.phase !== 'tax' || !g.settings.enableRevolution) return;
        if (!g.tax) return;
        const myHand = g.hands[p.id] || [];
        const jokerCount = myHand.filter((c) => c.rank === 13).length;
        if (jokerCount < 2) throw fail('조커 2장을 모두 가지고 있어야 대혁명을 일으킬 수 있어요!');

        // 세금으로 달무티/총리에게 넘어갔던 카드가 있다면 대농노/소농노에게 롤백 반환
        const dalmutiId = g.seats[0];
        const gPeonId = g.seats[g.seats.length - 1];
        if (g.tax.rawGPeonCards && g.tax.rawGPeonCards.length > 0) {
          for (const c of g.tax.rawGPeonCards) {
            const idx = g.hands[dalmutiId].findIndex((x) => x.id === c.id);
            if (idx !== -1) {
              g.hands[gPeonId].push(g.hands[dalmutiId].splice(idx, 1)[0]);
            }
          }
        }
        if (g.seats.length >= 4 && g.tax.rawMinisterCards && g.tax.rawMinisterCards.length > 0) {
          const ministerId = g.seats[1];
          const lPeonId = g.seats[g.seats.length - 2];
          for (const c of g.tax.rawMinisterCards) {
            const idx = g.hands[ministerId].findIndex((x) => x.id === c.id);
            if (idx !== -1) {
              g.hands[lPeonId].push(g.hands[ministerId].splice(idx, 1)[0]);
            }
          }
        }

        // 대농노가 대혁명을 일으킨 경우 -> 대반란(상하 계급 180도 역전!)
        const total = g.seats.length;
        const isGreaterPeon = g.seats[total - 1] === p.id;

        if (isGreaterPeon) {
          // 좌석 계급 180도 반전!
          g.seats.reverse();
          g.revolution = { playerId: p.id, type: 'overthrow' };
          g.phase = 'play';
          g.activePlayer = g.seats[0]; // 새 달무티가 선
          g.tax = null;
          return;
        } else {
          // 일반 대혁명: 세금 면제!
          g.revolution = { playerId: p.id, type: 'tax_free' };
          g.phase = 'play';
          g.activePlayer = g.seats[0];
          g.tax = null;
          return;
        }
      }

      // 달무티 또는 총리가 농노에게 하사할 카드 전달
      case 'taxGive': {
        if (g.phase !== 'tax' || !g.tax) return;
        const myHand = g.hands[p.id];
        if (!myHand) throw fail('손패가 없어요');

        const cardIds = Array.isArray(pl.cardIds) ? pl.cardIds : [];
        const isDalmuti = g.seats[0] === p.id;
        const isMinister = g.seats.length >= 4 && g.seats[1] === p.id;

        if (isDalmuti) {
          if (g.tax.dalmutiDone) throw fail('이미 세금 교환을 완료했어요');
          if (cardIds.length !== 2) throw fail('하사할 카드 2장을 선택해주세요');
          const cardsToGive = [];
          for (const cid of cardIds) {
            const idx = myHand.findIndex((c) => c.id === cid);
            if (idx === -1) throw fail('손패에 없는 카드예요');
            cardsToGive.push(myHand.splice(idx, 1)[0]);
          }

          // 대농노에게 전달
          const gPeonId = g.seats[g.seats.length - 1];
          g.hands[gPeonId].push(...cardsToGive);
          g.tax.dalmutiGiven = cardsToGive;
          g.tax.dalmutiDone = true;
        } else if (isMinister) {
          if (g.tax.ministerDone) throw fail('이미 세금 교환을 완료했어요');
          if (cardIds.length !== 1) throw fail('하사할 카드 1장을 선택해주세요');
          const idx = myHand.findIndex((c) => c.id === cardIds[0]);
          if (idx === -1) throw fail('손패에 없는 카드예요');
          const [cardToGive] = myHand.splice(idx, 1);

          // 소농노에게 전달
          const lPeonId = g.seats[g.seats.length - 2];
          g.hands[lPeonId].push(cardToGive);
          g.tax.ministerGiven = [cardToGive];
          g.tax.ministerDone = true;
        } else {
          throw fail('달무티나 총리만 하사할 카드를 고를 수 있어요');
        }

        // 세금 교환 완료 확인
        const needMinister = g.seats.length >= 4;
        if (g.tax.dalmutiDone && (!needMinister || g.tax.ministerDone)) {
          // 세금 교환 완료 -> 플레이 시작!
          g.phase = 'play';
          g.activePlayer = g.seats[0]; // 달무티부터 선
          g.trick = null;
        }
        return;
      }

      // 카드 제출 (클라이밍)
      case 'play': {
        if (g.phase !== 'play') return;
        if (p.id !== g.activePlayer) throw fail('내 차례가 아니에요');

        const cardIds = Array.isArray(pl.cardIds) ? pl.cardIds : [];
        if (cardIds.length === 0) throw fail('낼 카드를 선택해주세요');

        const myHand = g.hands[p.id];
        const selectedCards = [];
        for (const cid of cardIds) {
          const c = myHand.find((x) => x.id === cid);
          if (!c) throw fail('손패에 없는 카드가 포함되어 있어요');
          selectedCards.push(c);
        }

        // 카드 유효성 검사 (조커 포함하여 모두 같은 rank로 인정되는지)
        const nonJokers = selectedCards.filter((c) => c.rank !== 13);
        let targetRank = null;
        if (nonJokers.length === 0) {
          // 조커만 단독으로 낼 때 -> 13번으로 취급
          targetRank = 13;
        } else {
          targetRank = nonJokers[0].rank;
          if (nonJokers.some((c) => c.rank !== targetRank)) {
            throw fail('서로 다른 계급의 카드는 한 번에 낼 수 없어요 (같은 숫자 또는 조커 조합만 가능)');
          }
        }

        const count = selectedCards.length;

        // 현재 바닥 트릭 검사
        if (g.trick) {
          if (count !== g.trick.count) {
            throw fail(`바닥에 나온 카드와 같은 장수(${g.trick.count}장)를 내야 해요`);
          }
          if (targetRank >= g.trick.rankValue) {
            throw fail(`바닥의 카드(${g.trick.rankValue}번)보다 더 낮은 숫자(더 높은 계급)를 내야 해요`);
          }
        }

        // 유효함! 손패에서 카드 제거
        for (const c of selectedCards) {
          const idx = myHand.findIndex((x) => x.id === c.id);
          myHand.splice(idx, 1);
        }

        // 트릭 갱신
        g.trick = {
          lastPlayerId: p.id,
          lastPlayerName: nameOf(room, p.id),
          cards: selectedCards.map((c) => ({
            id: c.id,
            rank: targetRank,
            origRank: c.rank,
            name: CARD_MAP[targetRank].name,
            icon: CARD_MAP[targetRank].icon,
            isJoker: c.rank === 13,
          })),
          rankValue: targetRank,
          count,
          passes: [],
        };

        // 손패를 다 털었는지 확인
        if (myHand.length === 0) {
          g.finishedOrder.push(p.id);
        }

        // 라운드 종료 검사 (손패 남은 사람이 1명 이하이면 라운드 끝!)
        const remaining = g.seats.filter((id) => (g.hands[id] || []).length > 0);
        if (remaining.length <= 1) {
          if (remaining.length === 1) {
            g.finishedOrder.push(remaining[0]);
          }
          endRound(room, g, ctx);
          return;
        }

        // 다음 차례 이동
        advanceTurn(g);
        return;
      }

      // 패스
      case 'pass': {
        if (g.phase !== 'play') return;
        if (p.id !== g.activePlayer) throw fail('내 차례가 아니에요');
        if (!g.trick) throw fail('바닥에 카드가 없을 때는 선이므로 카드를 내야 해요');

        if (!g.trick.passes.includes(p.id)) {
          g.trick.passes.push(p.id);
        }

        // 아직 손패가 남은 참가자들
        const activePlayers = g.seats.filter((id) => (g.hands[id] || []).length > 0);

        // 마지막 낸 사람을 제외한 모든 생존자가 패스했는지 검사
        const others = activePlayers.filter((id) => id !== g.trick.lastPlayerId);
        const allOthersPassed = others.every((id) => g.trick.passes.includes(id));

        if (allOthersPassed) {
          // 트릭 획득! 바닥이 치워짐
          const winnerId = g.trick.lastPlayerId;
          g.trick = null;

          // 만약 트릭 승자가 방금 손패를 다 털어낸 사람이라면?
          // 다음 선은 계급 순서대로 아직 손패가 남은 사람 중 가장 계급 높은 사람!
          if ((g.hands[winnerId] || []).length === 0) {
            g.activePlayer = activePlayers[0];
          } else {
            g.activePlayer = winnerId;
          }
          return;
        }

        // 다음 차례 이동
        advanceTurn(g);
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

    const v = {
      phase: g.phase,
      settings: g.settings,
      currentRound: g.currentRound,
      isSpectator,
    };

    if (g.phase === 'setup') return v;

    const total = g.seats.length;
    // 계급 서열 좌석 정보
    v.seats = g.seats.map((id, idx) => {
      const title = getTitle(idx, total);
      const handCount = (g.hands[id] || []).length;
      const isFinished = g.finishedOrder.includes(id);
      const finishRank = isFinished ? g.finishedOrder.indexOf(id) + 1 : null;
      return {
        id,
        name: nm(id),
        title,
        seatIdx: idx,
        handCount,
        isFinished,
        finishRank,
        isActive: g.activePlayer === id,
        isTurnPassed: g.trick ? g.trick.passes.includes(id) : false,
      };
    });

    // 내 손패 (정렬됨: 1 -> 13)
    const myHandRaw = isSpectator ? [] : (g.hands[p.id] || []);
    v.myHand = myHandRaw
      .map((c) => ({
        id: c.id,
        rank: c.rank,
        isJoker: c.rank === 13,
        name: CARD_MAP[c.rank].name,
        icon: CARD_MAP[c.rank].icon,
      }))
      .sort((a, b) => a.rank - b.rank);

    v.myHandCount = v.myHand.length;
    v.isMyTurn = g.activePlayer === p.id;
    v.trick = g.trick;
    v.activePlayer = g.activePlayer ? { id: g.activePlayer, name: nm(g.activePlayer) } : null;
    v.revolution = g.revolution;

    // 세금 페이즈 뷰
    if (g.phase === 'tax' && g.tax) {
      const mySeatIdx = g.seats.indexOf(p.id);
      const isDalmuti = mySeatIdx === 0;
      const isMinister = total >= 4 && mySeatIdx === 1;
      const isGPeon = mySeatIdx === total - 1;
      const isLPeon = total >= 4 && mySeatIdx === total - 2;

      v.tax = {
        isDalmuti,
        isMinister,
        isGPeon,
        isLPeon,
        dalmutiDone: g.tax.dalmutiDone,
        ministerDone: g.tax.ministerDone,
        dalmutiReceived: g.tax.dalmutiReceived,
        ministerReceived: g.tax.ministerReceived,
        dalmutiGiven: g.tax.dalmutiGiven,
        ministerGiven: g.tax.ministerGiven,
        canRevolution: g.settings.enableRevolution && v.myHand.filter((c) => c.isJoker).length >= 2,
      };
    }

    if (g.phase === 'roundEnd' || g.phase === 'gameEnd') {
      v.roundResults = g.finishedOrder.map((id, idx) => {
        const prevIdx = g.prevSeats ? g.prevSeats.indexOf(id) : null;
        const prevRank = prevIdx !== null && prevIdx !== -1 ? prevIdx + 1 : null;
        return {
          id,
          name: nm(id),
          rank: idx + 1,
          prevRank,
          title: getTitle(idx, total),
          prevTitle: prevRank ? getTitle(prevIdx, total) : null,
          roundScore: g.roundScores[id] || 0,
          totalScore: (room.players.find((x) => x.id === id) || {}).score || 0,
        };
      });
    }

    return v;
  },
};

// 다음 턴 플레이어 탐색 (손패가 남아있는 참가자만)
function advanceTurn(g) {
  const activePlayers = g.seats.filter((id) => (g.hands[id] || []).length > 0);
  if (activePlayers.length === 0) return;

  const curIdx = g.seats.indexOf(g.activePlayer);
  const total = g.seats.length;

  for (let i = 1; i <= total; i++) {
    const nextIdx = (curIdx + i) % total;
    const nextPid = g.seats[nextIdx];
    if ((g.hands[nextPid] || []).length > 0) {
      g.activePlayer = nextPid;
      return;
    }
  }
}

// 새 라운드 시작
function startNewRound(room, g) {
  g.currentRound++;
  g.finishedOrder = [];
  g.trick = null;
  g.revolution = null;

  // 카드 덱 생성 & 균등 분배
  const deck = makeDeck();
  g.hands = {};
  g.participants.forEach((id) => { g.hands[id] = []; });

  let idx = 0;
  while (deck.length > 0) {
    const card = deck.pop();
    g.hands[g.participants[idx % g.participants.length]].push(card);
    idx++;
  }

  // 1라운드는 세금 교환 없이 바로 플레이
  if (g.currentRound === 1 || !g.settings.enableTax) {
    g.phase = 'play';
    g.activePlayer = g.seats[0]; // 1번 좌석부터 시작
    g.tax = null;
    return;
  }

  // 2라운드부터는 세금 교환 페이즈 시작!
  g.phase = 'tax';
  const total = g.seats.length;
  const dalmutiId = g.seats[0];
  const gPeonId = g.seats[total - 1];

  // 1. 대농노의 최고 카드 2장 자동 차출 -> 달무티에게 전달
  const gPeonBest = pickBestCards(g.hands[gPeonId], 2);
  for (const c of gPeonBest) {
    const cIdx = g.hands[gPeonId].findIndex((x) => x.id === c.id);
    g.hands[gPeonId].splice(cIdx, 1);
  }
  g.hands[dalmutiId].push(...gPeonBest);

  let ministerBest = [];
  if (total >= 4) {
    const ministerId = g.seats[1];
    const lPeonId = g.seats[total - 2];
    // 2. 소농노의 최고 카드 1장 자동 차출 -> 총리에게 전달
    ministerBest = pickBestCards(g.hands[lPeonId], 1);
    for (const c of ministerBest) {
      const cIdx = g.hands[lPeonId].findIndex((x) => x.id === c.id);
      g.hands[lPeonId].splice(cIdx, 1);
    }
    g.hands[ministerId].push(...ministerBest);
  }

  g.tax = {
    rawGPeonCards: gPeonBest,
    rawMinisterCards: ministerBest,
    dalmutiReceived: gPeonBest.map((c) => ({ ...c, name: CARD_MAP[c.rank].name, icon: CARD_MAP[c.rank].icon })),
    ministerReceived: ministerBest.map((c) => ({ ...c, name: CARD_MAP[c.rank].name, icon: CARD_MAP[c.rank].icon })),
    dalmutiDone: false,
    ministerDone: false,
    dalmutiGiven: null,
    ministerGiven: null,
  };
}

// 라운드 종료 처리
function endRound(room, g, ctx) {
  const total = g.seats.length;
  g.prevSeats = [...g.seats];
  // 이번 라운드에서 손패를 털어낸 순서대로 다음 라운드의 계급(좌석)이 결정됨!
  g.seats = [...g.finishedOrder];

  // 라운드 점수 부여 (1등: total-1점, 2등: total-2점, ... 꼴찌: 0점)
  g.roundScores = {};
  g.finishedOrder.forEach((pid, idx) => {
    const pts = Math.max(0, total - 1 - idx);
    g.roundScores[pid] = pts;
    ctx.addScore(room, pid, pts, `달무티 ${g.currentRound}R ${idx + 1}위 (${getTitle(idx, total).name})`);
  });

  if (g.currentRound >= g.settings.totalRounds) {
    g.phase = 'gameEnd';
  } else {
    g.phase = 'roundEnd';
  }
}
