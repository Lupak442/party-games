const { pick, norm, nameOf, fail } = require('./util');

const MAX_ROUNDS = 3; // 라이어 추적 최대 횟수

function make(cfg) {
  const trim = (s) => String(s || '').trim().slice(0, 30);

  function resetRound(g) {
    g.votes = {};
    g.done = {};
    g.result = null;
    g.accused = null;
    g.verdict = {};
    g.vres = null;
  }

  function finish(room, g, ctx, winner, reason) {
    g.phase = 'end';
    g.outcome = { winner, reason, accusedId: g.accused };
    if (winner === 'liar') {
      ctx.addScore(room, g.liarId, 3, '라이어 승리');
    } else {
      g.participants.filter((id) => id !== g.liarId).forEach((id) => ctx.addScore(room, id, 1, '라이어 검거'));
    }
  }

  function failRound(room, g, ctx) {
    if (g.round >= MAX_ROUNDS) return finish(room, g, ctx, 'liar', 'rounds');
    g.round += 1;
    g.phase = 'hunt';
    resetRound(g);
  }

  function tallyVotes(g) {
    const tally = {};
    g.participants.forEach((id) => (tally[id] = 0));
    Object.values(g.votes).forEach((t) => { if (t in tally) tally[t] += 1; });
    const max = Math.max(0, ...Object.values(tally));
    const top = max > 0 ? Object.keys(tally).filter((id) => tally[id] === max) : [];
    g.result = { tally, top };
    g.phase = 'voteResult';
  }

  function tallyVerdict(g) {
    const vals = Object.values(g.verdict);
    const agree = vals.filter((x) => x === 'agree').length;
    const disagree = vals.filter((x) => x === 'disagree').length;
    g.vres = { agree, disagree, passed: agree > disagree };
    g.phase = 'verdictResult';
  }

  return {
    id: cfg.id, name: cfg.name, icon: cfg.icon, desc: cfg.desc, minPlayers: 3,

    init() {
      return { phase: 'setup', topic: '', mode: 'builtin', error: null };
    },

    async handle(room, p, type, pl, ctx) {
      const g = room.game.state;
      const isHost = p.id === room.hostId;
      const needHost = () => { if (!isHost) throw fail('방장만 할 수 있어요'); };
      const part = () => { if (!g.participants || !g.participants.includes(p.id)) throw fail('이번 판 참가자가 아니에요'); };
      const stale = () => !room.game || room.game.state !== g;

      switch (type) {
        case 'start': {
          needHost();
          if (g.phase !== 'setup') return;
          const topic = trim(pl.topic);
          if (!topic) throw fail('주제를 입력하거나 선택해주세요');
          if (room.players.length < 3) throw fail('최소 3명이 필요해요');

          const mode = pl.mode === 'ai' ? 'ai' : pl.mode === 'custom' ? 'custom' : 'builtin';
          const cw = trim(pl.word), cf = trim(pl.fool);
          if (mode === 'custom') {
            if (!cw) throw fail('직접 입력할 제시어를 적어주세요');
            if (cfg.fool && !cf) throw fail('바보 라이어는 두 단어를 모두 입력해야 해요');
          }

          g.topic = topic;
          g.mode = mode;
          g.error = null;

          let words;
          if (mode === 'custom') {
            words = { word: cw, similar: cf };
          } else {
            g.phase = 'loading';
            ctx.broadcast(room);
            try {
              words = await ctx.ai.generateLiarWords({
                topic,
                fool: cfg.fool,
                mode,
                avoid: room.usedWords || []
              });
            } catch (e) {
              if (!stale()) {
                g.phase = 'setup';
                g.error = e.message;
              }
              return;
            }
            if (stale() || g.phase !== 'loading') return;
          }

          g.participants = room.players.map((x) => x.id);
          g.liarId = pick(g.participants);
          g.word = words.word;
          g.liarWord = cfg.fool ? words.similar : null;
          room.usedWords = room.usedWords || [];
          room.usedWords.push(words.word);
          room.usedWords = room.usedWords.slice(-60);

          g.flipped = {};
          g.round = 1;
          g.guess = null;
          g.judgeId = null;
          g.outcome = null;
          resetRound(g);
          g.phase = 'cards';
          return;
        }

        case 'flip':
          part();
          if (g.phase !== 'cards' && g.phase !== 'hunt') return;
          g.flipped[p.id] = true;
          return;

        case 'startHunt':
          needHost();
          if (g.phase === 'cards') g.phase = 'hunt';
          return;

        case 'startVote':
          needHost();
          if (g.phase === 'hunt') {
            resetRound(g);
            g.phase = 'vote';
          }
          return;

        case 'vote': {
          part();
          if (g.phase !== 'vote') return;
          if (g.done[p.id]) throw fail('이미 완료했어요');
          if (!g.participants.includes(pl.target) || pl.target === p.id) throw fail('잘못된 선택이에요');
          g.votes[p.id] = pl.target;
          return;
        }

        case 'done': {
          part();
          if (g.phase !== 'vote') return;
          if (!g.votes[p.id]) throw fail('먼저 지목할 사람을 선택해주세요');
          g.done[p.id] = true;
          if (g.participants.every((id) => g.done[id])) tallyVotes(g);
          return;
        }

        case 'forceVote':
          needHost();
          if (g.phase === 'vote') tallyVotes(g);
          return;

        case 'voteNext': {
          needHost();
          if (g.phase !== 'voteResult') return;
          if (g.result.top.length !== 1) return failRound(room, g, ctx);
          g.accused = g.result.top[0];
          g.verdict = {};
          g.phase = 'verdict';
          return;
        }

        case 'verdict': {
          part();
          if (g.phase !== 'verdict') return;
          if (g.verdict[p.id]) throw fail('이미 투표했어요');
          if (pl.choice !== 'agree' && pl.choice !== 'disagree') throw fail('잘못된 선택이에요');
          g.verdict[p.id] = pl.choice;
          if (g.participants.every((id) => g.verdict[id])) tallyVerdict(g);
          return;
        }

        case 'forceVerdict':
          needHost();
          if (g.phase === 'verdict') tallyVerdict(g);
          return;

        case 'verdictNext': {
          needHost();
          if (g.phase !== 'verdictResult') return;
          if (!g.vres.passed) return failRound(room, g, ctx);
          if (g.accused !== g.liarId) return finish(room, g, ctx, 'liar', 'wrongAccuse');
          g.phase = 'guess';
          g.guess = null;
          // 방장이 라이어면 방장 외의 다른 시민이 심판을 맡음
          g.judgeId = (room.hostId === g.liarId)
            ? (g.participants.find((id) => id !== g.liarId) || room.hostId)
            : room.hostId;
          return;
        }

        case 'guess': {
          if (g.phase !== 'guess' || p.id !== g.liarId) throw fail('지금은 정답을 맞힐 수 없어요');
          if (g.guess) return;
          const text = trim(pl.text);
          if (!text) throw fail('정답을 입력해주세요');
          g.guess = text;

          // 공백, 특수문자 제거 후 100% 완전 일치하면 바로 라이어 승리!
          if (norm(text) === norm(g.word)) {
            return finish(room, g, ctx, 'liar', 'guessed');
          }
          // 오타가 있거나 다른 단어인 경우: 심판(방장 또는 시민 대표)에게 정답 인정 여부를 판정하도록 넘김!
          return;
        }

        case 'judge': {
          if (g.phase !== 'guess') return;
          const judgeId = g.judgeId || room.hostId;
          if (p.id !== judgeId) throw fail('심판만 판정할 수 있어요');
          return finish(room, g, ctx, pl.ok ? 'liar' : 'citizens', pl.ok ? 'guessed' : 'caught');
        }

        case 'again':
          needHost();
          if (g.phase === 'end') {
            room.game.state = { phase: 'setup', topic: g.topic, mode: g.mode || 'builtin', error: null };
          }
          return;

        default:
          throw fail('알 수 없는 요청이에요');
      }
    },

    view(room, p) {
      const g = room.game.state;
      const nm = (id) => nameOf(room, id);
      const v = {
        phase: g.phase,
        fool: cfg.fool,
        topic: g.topic,
        mode: g.mode || 'builtin',
        error: g.error,
        round: g.round,
        maxRounds: MAX_ROUNDS,
      };

      if (g.phase === 'setup' || g.phase === 'loading') return v;

      const isHost = p.id === room.hostId;
      v.part = g.participants.includes(p.id);
      v.players = g.participants.map((id) => ({ id, name: nm(id) }));
      v.flipped = !!g.flipped[p.id];
      if (v.part && g.flipped[p.id]) {
        v.myCard = (p.id === g.liarId)
          ? (cfg.fool ? { word: g.liarWord } : { liar: true })
          : { word: g.word };
      }
      if (isHost && (g.phase === 'cards' || g.phase === 'hunt')) {
        v.flipStatus = g.participants.map((id) => ({ id, name: nm(id), flipped: !!g.flipped[id] }));
      }

      if (g.phase === 'vote') {
        v.myVote = g.votes[p.id] || null;
        v.myDone = !!g.done[p.id];
        v.doneList = g.participants.map((id) => ({ id, name: nm(id), done: !!g.done[id] }));
      }
      if (g.phase === 'voteResult') {
        v.votes = Object.entries(g.votes).map(([from, to]) => ({ from: nm(from), to: nm(to) }));
        v.tally = g.participants.map((id) => ({ id, name: nm(id), count: g.result.tally[id] })).sort((a, b) => b.count - a.count);
        v.tie = g.result.top.length !== 1;
        v.topName = g.result.top.length === 1 ? nm(g.result.top[0]) : null;
        v.notVoted = g.participants.filter((id) => !g.votes[id]).map(nm);
      }
      if (['verdict', 'verdictResult', 'guess', 'end'].includes(g.phase) && g.accused) {
        v.accused = { id: g.accused, name: nm(g.accused) };
      }
      if (g.phase === 'verdict' || g.phase === 'verdictResult') {
        v.verdicts = g.participants.map((id) => ({ id, name: nm(id), choice: g.verdict[id] || null }));
        v.myChoice = g.verdict[p.id] || null;
        if (g.vres) v.vres = g.vres;
      }
      if (g.phase === 'guess') {
        v.isLiar = p.id === g.liarId;
        v.guess = g.guess;
        const judgeId = g.judgeId || (room.hostId === g.liarId ? (g.participants.find((id) => id !== g.liarId) || room.hostId) : room.hostId);
        v.judgeId = judgeId;
        v.judgeName = nm(judgeId);
        v.canJudge = p.id === judgeId;
        if (v.canJudge) {
          v.word = g.word;
        }
      }
      if (g.phase === 'end') {
        v.outcome = g.outcome;
        v.guess = g.guess;
        v.reveal = { liarName: nm(g.liarId), word: g.word, liarWord: g.liarWord };
      }
      return v;
    },
  };
}

module.exports = {
  liar: make({ id: 'liar', name: '라이어 게임', icon: '🕵️', desc: '라이어를 찾아라', fool: false }),
  fool: make({ id: 'fool', name: '바보 라이어', icon: '🤪', desc: '라이어도 자기가 라이어인 줄 몰라요', fool: true }),
};
