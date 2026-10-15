const { shuffle, nameOf, fail } = require('./util');

/** 마니또: 모두가 정확히 한 명의 마니또가 되도록 하나의 순환 고리로 배정 (자기 자신 배정 불가) */
function assign(ids) {
  const order = shuffle(ids);
  const map = {};
  order.forEach((id, i) => { map[id] = order[(i + 1) % order.length]; });
  return map;
}

module.exports = {
  id: 'manito',
  name: '마니또',
  icon: '🎁',
  desc: '몰래 도와줄 상대를 뽑아요',
  minPlayers: 2,

  init() { return { phase: 'setup' }; },

  handle(room, p, type) {
    const g = room.game.state;
    const isHost = p.id === room.hostId;
    switch (type) {
      case 'start': {
        if (!isHost) throw fail('방장만 시작할 수 있어요');
        const ids = room.players.map((x) => x.id);
        if (ids.length < 2) throw fail('최소 2명이 필요해요');
        g.participants = ids; g.assign = assign(ids); g.revealed = {}; g.phase = 'running';
        return;
      }
      case 'flip':
        if (g.phase === 'running' && g.assign[p.id]) g.revealed[p.id] = true;
        return;
      default: throw fail('알 수 없는 요청이에요');
    }
  },

  view(room, p) {
    const g = room.game.state;
    if (g.phase === 'setup') return { phase: 'setup', count: room.players.length };
    const part = g.participants.includes(p.id);
    const v = { phase: 'running', part, revealed: !!g.revealed[p.id], target: null };
    // 뒤집기 전에는 서버가 상대 이름을 아예 내려주지 않는다 (치팅 방지)
    if (part && g.revealed[p.id]) v.target = nameOf(room, g.assign[p.id]);
    if (p.id === room.hostId) v.status = g.participants.map((id) => ({ id, name: nameOf(room, id), revealed: !!g.revealed[id] }));
    return v;
  },
};
