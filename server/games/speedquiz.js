const { shuffle, nameOf, fail } = require('./util');

const timers = new Map(); // roomCode -> Timeout (서버 재시작 시엔 lazy tick 으로 복구)
const opp = (t) => (t === 'red' ? 'blue' : 'red');
const clampInt = (v, lo, hi, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def; };

function applySettings(s, pl) {
  s.time = clampInt(pl.time, 10, 600, s.time);
  s.passes = clampInt(pl.passes, 0, 20, s.passes);
  s.count = clampInt(pl.count, 1, 40, s.count);
  s.topic = String(pl.topic ?? s.topic).slice(0, 30);
  s.source = pl.source === 'custom' ? 'custom' : pl.source === 'ai' ? 'ai' : s.source;
}

function newTurn() { return { correct: [], passed: [], idx: 0, startedAt: 0, endsAt: 0, elapsedMs: 0, done: false }; }

function members(room, g, team) { return Object.keys(g.teams).filter((id) => g.teams[id] === team && room.players.some((p) => p.id === id)); }
function repOf(room, g, team) {
  const m = members(room, g, team);
  return g.reps[team] && m.includes(g.reps[team]) ? g.reps[team] : m[0] || null;
}

function winnerOf(g) {
  const a = g.turns.red, b = g.turns.blue;
  if (a.correct.length !== b.correct.length) return a.correct.length > b.correct.length ? 'red' : 'blue';
  if (a.elapsedMs !== b.elapsedMs) return a.elapsedMs < b.elapsedMs ? 'red' : 'blue';
  if (a.passed.length !== b.passed.length) return a.passed.length < b.passed.length ? 'red' : 'blue';
  return 'draw';
}

function endTurn(room, g, ctx) {
  if (g.phase !== 'playing') return;
  const team = g.order[g.turnIndex]; const t = g.turns[team];
  clearTimeout(timers.get(room.code)); timers.delete(room.code);
  t.elapsedMs = Math.max(0, Math.min(Date.now(), t.endsAt) - t.startedAt);
  t.done = true; g.describer = null;
  if (g.turnIndex === 0) { g.turnIndex = 1; g.phase = 'ready'; }
  else { g.phase = 'result'; g.winner = winnerOf(g); g.awarded = false; }
  if (ctx) ctx.broadcast(room);
}

function tick(room, g, ctx) {
  if (g.phase === 'playing' && Date.now() >= g.turns[g.order[g.turnIndex]].endsAt) endTurn(room, g, ctx);
}

module.exports = {
  id: 'speedquiz',
  name: '스피드 퀴즈',
  icon: '⚡',
  desc: '팀 대결! 몸으로 말해요',
  minPlayers: 2,

  init() {
    return { phase: 'setup', teams: {}, reps: {}, settings: { time: 60, passes: 3, count: 10, topic: '', source: 'ai' }, error: null };
  },

  async handle(room, p, type, pl, ctx) {
    const g = room.game.state;
    tick(room, g, ctx);
    const isHost = p.id === room.hostId;
    const needHost = () => { if (!isHost) throw fail('방장만 할 수 있어요'); };
    const stale = () => !room.game || room.game.state !== g;

    switch (type) {
      case 'setTeam': {
        needHost(); if (g.phase !== 'setup') return;
        if (!room.players.some((x) => x.id === pl.id)) throw fail('대상을 찾을 수 없어요');
        if (pl.team === 'red' || pl.team === 'blue') g.teams[pl.id] = pl.team; else delete g.teams[pl.id];
        return;
      }
      case 'randomTeams': {
        needHost(); if (g.phase !== 'setup') return;
        g.teams = {}; g.reps = {};
        shuffle(room.players.map((x) => x.id)).forEach((id, i) => { g.teams[id] = i % 2 ? 'blue' : 'red'; });
        return;
      }
      case 'setRep': {
        needHost(); if (g.phase !== 'setup') return;
        if ((pl.team === 'red' || pl.team === 'blue') && g.teams[pl.id] === pl.team) g.reps[pl.team] = pl.id;
        return;
      }
      case 'settings': {
        needHost(); if (g.phase !== 'setup') return;
        applySettings(g.settings, pl);
        return;
      }
      case 'start': {
        needHost(); if (g.phase !== 'setup') return;
        applySettings(g.settings, pl);
        if (!members(room, g, 'red').length || !members(room, g, 'blue').length) throw fail('빨강팀과 파랑팀에 각각 1명 이상 배정해주세요');
        const s = g.settings;
        g.reps = { red: repOf(room, g, 'red'), blue: repOf(room, g, 'blue') };
        g.words = { red: [], blue: [] }; g.submitted = { red: false, blue: false };
        g.turns = { red: newTurn(), blue: newTurn() };
        g.order = shuffle(['red', 'blue']); g.turnIndex = 0; g.describer = null; g.winner = null; g.error = null;
        if (s.source === 'custom') { g.phase = 'collect'; return; }
        if (!s.topic.trim()) throw fail('주제를 입력해주세요');
        g.phase = 'loading'; ctx.broadcast(room);
        try {
          const list = await ctx.ai.generateQuizWords({ topic: s.topic, count: s.count * 2 });
          if (stale() || g.phase !== 'loading') return;
          g.words.red = list.slice(0, s.count); g.words.blue = list.slice(s.count, s.count * 2);
          g.phase = 'ready';
        } catch (e) { if (!stale()) { g.phase = 'setup'; g.error = e.message; } }
        return;
      }
      case 'submitWords': {
        if (g.phase !== 'collect') throw fail('지금은 입력할 수 없어요');
        const team = g.teams[p.id];
        if (!team || g.reps[team] !== p.id) throw fail('팀 대표만 입력할 수 있어요');
        const words = (Array.isArray(pl.words) ? pl.words : []).map((w) => String(w || '').trim().slice(0, 40));
        if (words.length !== g.settings.count || words.some((w) => !w)) throw fail(`${g.settings.count}개를 모두 입력해주세요`);
        g.words[opp(team)] = words; g.submitted[team] = true;
        if (g.submitted.red && g.submitted.blue) g.phase = 'ready';
        return;
      }
      case 'setRepLate': { // 대표가 자리를 비웠을 때 방장이 대표 교체 (입력 단계)
        needHost(); if (g.phase !== 'collect') return;
        if (g.teams[pl.id] === pl.team) g.reps[pl.team] = pl.id;
        return;
      }
      case 'setDescriber': {
        needHost(); if (g.phase !== 'ready') return;
        const team = g.order[g.turnIndex];
        g.describer = members(room, g, team).includes(pl.id) ? pl.id : null; return;
      }
      case 'startTurn': {
        needHost(); if (g.phase !== 'ready') return;
        const team = g.order[g.turnIndex]; const t = g.turns[team];
        t.startedAt = Date.now(); t.endsAt = t.startedAt + g.settings.time * 1000; t.idx = 0; t.correct = []; t.passed = [];
        g.phase = 'playing';
        clearTimeout(timers.get(room.code));
        timers.set(room.code, setTimeout(() => { if (!stale()) endTurn(room, g, ctx); }, g.settings.time * 1000 + 50));
        return;
      }
      case 'correct':
      case 'pass': {
        needHost(); if (g.phase !== 'playing') return;
        const team = g.order[g.turnIndex]; const t = g.turns[team]; const words = g.words[team];
        if (type === 'pass' && t.passed.length >= g.settings.passes) throw fail('패스 횟수를 모두 사용했어요');
        const w = words[t.idx]; if (w === undefined) return;
        (type === 'correct' ? t.correct : t.passed).push(w); t.idx += 1;
        if (t.idx >= words.length) endTurn(room, g, ctx);
        return;
      }
      case 'endTurn': needHost(); endTurn(room, g, ctx); return;
      case 'award': {
        needHost(); if (g.phase !== 'result' || g.awarded || g.winner === 'draw') return;
        const pts = clampInt(pl.points, 1, 20, 1);
        members(room, g, g.winner).forEach((id) => ctx.addScore(room, id, pts, '스피드 퀴즈 승리'));
        g.awarded = true; return;
      }
      case 'again': {
        needHost(); if (g.phase !== 'result') return;
        room.game.state = { phase: 'setup', teams: g.teams, reps: g.reps, settings: g.settings, error: null }; return;
      }
      default: throw fail('알 수 없는 요청이에요');
    }
  },

  view(room, p) {
    const g = room.game.state;
    tick(room, g, null);
    const nm = (id) => nameOf(room, id);
    const isHost = p.id === room.hostId;
    const v = { phase: g.phase, settings: g.settings, error: g.error };
    const roster = (team) => (team === 'none'
      ? room.players.filter((x) => !g.teams[x.id])
      : room.players.filter((x) => g.teams[x.id] === team)).map((x) => ({ id: x.id, name: x.name }));
    v.teams = { red: roster('red'), blue: roster('blue'), none: roster('none') };
    v.reps = { red: repOf(room, g, 'red'), blue: repOf(room, g, 'blue') };
    v.myTeam = g.teams[p.id] || null;
    if (g.phase === 'setup' || g.phase === 'loading') return v;

    v.order = g.order; v.turnIndex = g.turnIndex;
    v.current = g.order[Math.min(g.turnIndex, 1)];
    v.reps = g.reps;
    const stat = (team) => { const t = g.turns[team]; return { correct: t.correct.length, passed: t.passed.length, elapsedMs: t.elapsedMs, done: t.done }; };
    v.stats = { red: stat('red'), blue: stat('blue') };

    if (g.phase === 'collect') {
      v.submitted = g.submitted;
      const team = g.teams[p.id];
      if (team && g.reps[team] === p.id) v.rep = { team, forTeam: opp(team), count: g.settings.count, words: g.words[opp(team)], saved: g.submitted[team] };
    }
    if (g.phase === 'ready') {
      v.describer = g.describer ? { id: g.describer, name: nm(g.describer) } : null;
      v.candidates = members(room, g, v.current).map((id) => ({ id, name: nm(id) }));
    }
    if (g.phase === 'playing') {
      const team = g.order[g.turnIndex]; const t = g.turns[team];
      v.describer = g.describer ? { id: g.describer, name: nm(g.describer) } : null;
      v.endsAt = t.endsAt; v.total = g.words[team].length; v.idx = t.idx;
      v.passesLeft = g.settings.passes - t.passed.length;
      v.canSee = isHost || p.id === g.describer;
      if (v.canSee) v.word = g.words[team][t.idx] ?? null;
    }
    if (g.phase === 'result') {
      v.winner = g.winner; v.awarded = g.awarded;
      v.detail = { red: { correct: g.turns.red.correct, passed: g.turns.red.passed }, blue: { correct: g.turns.blue.correct, passed: g.turns.blue.passed } };
    }
    return v;
  },
};
