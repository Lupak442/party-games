/**
 * 방 관리 + 재접속 처리의 핵심.
 *
 * [재접속 설계]
 *  - 플레이어는 접속이 끊겨도 절대 삭제되지 않고 "오프라인"으로만 표시된다.
 *    (점수/팀/카드/투표 등 모든 상태가 그대로 유지됨)
 *  - 기기는 localStorage에 {code, token}을 저장하고, 소켓이 (재)연결될 때마다 room:resume으로 자리를 되찾는다.
 *  - 저장소가 날아가거나 다른 브라우저로 들어와도, 같은 이름으로 입장하면 오프라인 자리를 되찾는다.
 *  - 방장이 오래 오프라인이면 자동으로 다른 사람에게 방장이 넘어가고, 돌아오면 일반 참가자로 복귀한다.
 *  - 방 상태는 디스크(.data/rooms.json)에 저장되어 서버가 재시작되어도 복구된다.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const games = require('./games');
const ai = require('./ai');

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DATA_DIR = path.join(__dirname, '..', '.data');
const DATA_FILE = path.join(DATA_DIR, 'rooms.json');
const HOST_AWAY_MS = 90 * 1000;          // 방장이 이 시간 이상 오프라인이면 위임
const ROOM_TTL_MS = 12 * 60 * 60 * 1000; // 모두 오프라인인 방은 12시간 후 삭제

const rooms = new Map();            // code -> room
const live = new Map();             // code -> Map(pid -> Set(socketId))
const sockInfo = new Map();         // socketId -> {code, pid}
let io = null;

const rid = (n) => crypto.randomBytes(n).toString('hex');
const cleanName = (n) => String(n || '').trim().replace(/\s+/g, ' ').slice(0, 12);

function fail(msg) { const e = new Error(msg); e.user = true; return e; }

/* ---------- 저장 ---------- */
let saveTimer = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = DATA_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify([...rooms.values()]));
      fs.renameSync(tmp, DATA_FILE);
    } catch (e) { /* 저장 실패는 게임 진행에 영향 없음 */ }
  }, 1000);
}
function load() {
  try {
    const arr = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    for (const r of arr) {
      if (Date.now() - (r.updatedAt || 0) > ROOM_TTL_MS) continue;
      rooms.set(r.code, r);
    }
  } catch (e) { /* 없으면 무시 */ }
}

/* ---------- 헬퍼 ---------- */
const isOnline = (room, pid) => (live.get(room.code)?.get(pid)?.size || 0) > 0;
const getPlayer = (room, pid) => room.players.find((p) => p.id === pid);

function emitAll(room, evt, data) {
  const m = live.get(room.code); if (!m) return;
  for (const set of m.values()) for (const sid of set) io.to(sid).emit(evt, data);
}

function viewFor(room, p) {
  return {
    serverTime: Date.now(),
    me: p.id,
    room: {
      code: room.code,
      maxPlayers: room.maxPlayers,
      hostId: room.hostId,
      gameId: room.game ? room.game.id : null,
      babo: room.babo || null,
      players: room.players.map((x) => ({ id: x.id, name: x.name, score: x.score, joinedAt: x.joinedAt, online: isOnline(room, x.id) })),
    },
    meta: {
      hasAi: ai.hasAiKey(),
      builtinTopics: ai.getBuiltinTopics(),
    },
    catalog: games.catalog(),
    game: room.game ? games.get(room.game.id).view(room, p) : null,
  };
}

function broadcast(room) {
  room.updatedAt = Date.now();
  const m = live.get(room.code);
  if (m) {
    for (const [pid, set] of m) {
      const p = getPlayer(room, pid); if (!p) continue;
      for (const sid of set) io.to(sid).emit('state', viewFor(room, p));
    }
  }
  save();
}

function addScore(room, pid, delta, reason) {
  const p = getPlayer(room, pid); if (!p || !delta) return;
  p.score += delta;
  emitAll(room, 'toast', { msg: `${p.name} ${delta > 0 ? '+' : ''}${delta}점${reason ? ' · ' + reason : ''}`, kind: delta > 0 ? 'up' : 'down' });
}

const ctxFor = () => ({ broadcast, addScore, ai });

function bind(socket, room, p) {
  unbind(socket);
  if (!live.has(room.code)) live.set(room.code, new Map());
  const m = live.get(room.code);
  if (!m.has(p.id)) m.set(p.id, new Set());
  m.get(p.id).add(socket.id);
  sockInfo.set(socket.id, { code: room.code, pid: p.id });
  p.lastSeen = Date.now();
  if (room.hostId === p.id) room.hostAwaySince = null;
  broadcast(room);
}

function unbind(socket) {
  const info = sockInfo.get(socket.id); if (!info) return;
  sockInfo.delete(socket.id);
  const room = rooms.get(info.code); const m = live.get(info.code);
  const set = m && m.get(info.pid);
  if (set) { set.delete(socket.id); if (!set.size) m.delete(info.pid); }
  if (room) {
    const p = getPlayer(room, info.pid); if (p) p.lastSeen = Date.now();
    if (room.hostId === info.pid && !isOnline(room, info.pid)) room.hostAwaySince = Date.now();
    broadcast(room);
  }
}

function genCode() {
  for (;;) {
    let c = ''; for (let i = 0; i < 5; i++) c += ALPHA[crypto.randomInt(ALPHA.length)];
    if (!rooms.has(c)) return c;
  }
}
const newPlayer = (name) => ({ id: rid(4), token: rid(16), name, score: 0, joinedAt: Date.now(), lastSeen: Date.now() });
const findRoom = (code) => rooms.get(String(code || '').trim().toUpperCase());

/* ---------- 방 단위 액션 ---------- */
function roomAction(room, p, type, pl) {
  const isHost = p.id === room.hostId;
  const needHost = () => { if (!isHost) throw fail('방장만 할 수 있어요'); };
  switch (type) {
    case 'setMax': {
      needHost();
      const n = Math.round(Number(pl.max));
      if (!(n >= 2 && n <= 30)) throw fail('인원은 2~30명 사이로 설정해주세요');
      if (n < room.players.length) throw fail(`현재 ${room.players.length}명이 있어서 그보다 적게 설정할 수 없어요`);
      room.maxPlayers = n; return;
    }
    case 'transferHost': {
      needHost();
      const t = getPlayer(room, pl.id); if (!t) throw fail('대상을 찾을 수 없어요');
      room.hostId = t.id; room.hostAwaySince = null;
      emitAll(room, 'toast', { msg: `👑 ${t.name}님이 새 방장이에요`, kind: 'info' }); return;
    }
    case 'score': {
      needHost();
      const d = Math.round(Number(pl.delta)); if (!d || Math.abs(d) > 100) throw fail('잘못된 점수예요');
      if (!getPlayer(room, pl.id)) throw fail('대상을 찾을 수 없어요');
      addScore(room, pl.id, d); return;
    }
    case 'resetScores': needHost(); room.players.forEach((x) => (x.score = 0)); emitAll(room, 'toast', { msg: '점수를 초기화했어요', kind: 'info' }); return;
    case 'kick': {
      needHost();
      if (room.game) throw fail('진행 중인 게임을 끝낸 뒤 내보낼 수 있어요');
      if (pl.id === p.id) throw fail('자기 자신은 내보낼 수 없어요');
      const t = getPlayer(room, pl.id); if (!t) return;
      const set = live.get(room.code)?.get(t.id);
      if (set) for (const sid of set) { io.to(sid).emit('kicked'); sockInfo.delete(sid); }
      live.get(room.code)?.delete(t.id);
      room.players = room.players.filter((x) => x.id !== t.id); return;
    }
    case 'selectGame': {
      needHost();
      if (room.game) throw fail('먼저 현재 게임을 끝내주세요');
      const g = games.get(pl.id); if (!g) throw fail('없는 게임이에요');
      if (room.players.length < g.minPlayers) throw fail(`${g.name}은(는) 최소 ${g.minPlayers}명이 필요해요`);
      room.game = { id: g.id, state: g.init(room) }; return;
    }
    case 'endGame': needHost(); room.game = null; return;
    case 'rename': {
      const n = cleanName(pl.name); if (!n) throw fail('이름을 입력해주세요');
      if (room.players.some((x) => x.id !== p.id && x.name === n)) throw fail('이미 있는 이름이에요');
      p.name = n; return;
    }
    default: throw fail('알 수 없는 요청이에요');
  }
}

/* ---------- 소켓 ---------- */
function attach(socket) {
  const safe = (fn) => async (data, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    try { cb(await fn(data || {})); }
    catch (e) { if (!e.user) console.error(e); cb({ ok: false, error: e.user ? e.message : '서버 오류가 발생했어요' }); }
  };

  socket.on('room:create', safe((d) => {
    const name = cleanName(d.name); if (!name) throw fail('이름을 입력해주세요');
    const max = Math.min(30, Math.max(2, Math.round(Number(d.maxPlayers)) || 8));
    const p = newPlayer(name);
    const room = { code: genCode(), createdAt: Date.now(), updatedAt: Date.now(), maxPlayers: max, hostId: p.id, hostAwaySince: null, players: [p], game: null, usedWords: [] };
    rooms.set(room.code, room);
    bind(socket, room, p);
    return { ok: true, code: room.code, token: p.token };
  }));

  socket.on('room:preview', safe((d) => {
    const room = findRoom(d.code); if (!room) throw fail('방을 찾을 수 없어요');
    return { ok: true, max: room.maxPlayers, count: room.players.length, players: room.players.map((x) => ({ name: x.name, online: isOnline(room, x.id) })) };
  }));

  socket.on('room:join', safe((d) => {
    const room = findRoom(d.code); if (!room) throw fail('방을 찾을 수 없어요. 코드를 확인해주세요');
    const name = cleanName(d.name); if (!name) throw fail('이름을 입력해주세요');
    const same = room.players.find((x) => x.name === name);
    if (same) {
      // 같은 이름의 오프라인 자리 → 본인으로 간주하고 되찾기
      if (isOnline(room, same.id)) throw fail('이미 접속 중인 이름이에요. 본인이라면 연결이 정리되는 30초쯤 뒤에 다시 시도해주세요');
      same.token = rid(16);
      bind(socket, room, same);
      return { ok: true, code: room.code, token: same.token, resumed: true };
    }
    if (room.players.length >= room.maxPlayers) throw fail(`방이 가득 찼어요 (${room.maxPlayers}명)`);
    const p = newPlayer(name); room.players.push(p);
    bind(socket, room, p);
    emitAll(room, 'toast', { msg: `${p.name}님이 들어왔어요`, kind: 'info' });
    return { ok: true, code: room.code, token: p.token };
  }));

  socket.on('room:resume', safe((d) => {
    const room = findRoom(d.code);
    if (!room) return { ok: false, fatal: true, error: '방이 사라졌어요 (서버가 재시작됐거나 만료됐어요)' };
    const p = room.players.find((x) => x.token && x.token === d.token);
    if (!p) return { ok: false, fatal: true, error: '자리를 찾을 수 없어요. 같은 이름으로 다시 입장하면 돌아올 수 있어요' };
    bind(socket, room, p);
    return { ok: true, code: room.code };
  }));

  socket.on('room:leave', safe(() => { unbind(socket); return { ok: true }; }));

  socket.on('act', safe(async (d) => {
    const info = sockInfo.get(socket.id); if (!info) throw fail('방에 연결되어 있지 않아요');
    const room = rooms.get(info.code); const p = room && getPlayer(room, info.pid);
    if (!p) throw fail('방을 찾을 수 없어요');
    if (d.scope === 'room') {
      roomAction(room, p, d.type, d.payload || {});
    } else if (d.scope === 'game') {
      if (!room.game) throw fail('진행 중인 게임이 없어요');
      await games.get(room.game.id).handle(room, p, d.type, d.payload || {}, ctxFor());
    }
    broadcast(room);
    return { ok: true };
  }));

  socket.on('disconnect', () => unbind(socket));
}

/* ---------- 주기 작업 ---------- */
function housekeeping() {
  const now = Date.now();
  for (const room of [...rooms.values()]) {
    const anyOnline = room.players.some((x) => isOnline(room, x.id));
    if (!anyOnline && now - room.updatedAt > ROOM_TTL_MS) { rooms.delete(room.code); live.delete(room.code); continue; }
    // 방장 자동 위임
    if (room.hostAwaySince && now - room.hostAwaySince > HOST_AWAY_MS) {
      const next = room.players.filter((x) => isOnline(room, x.id)).sort((a, b) => a.joinedAt - b.joinedAt)[0];
      if (next) {
        room.hostId = next.id; room.hostAwaySince = null;
        emitAll(room, 'toast', { msg: `방장이 자리를 비워서 👑 ${next.name}님이 새 방장이 되었어요`, kind: 'info' });
        broadcast(room);
      }
    }
  }
}

function init(ioInstance) { io = ioInstance; load(); setInterval(housekeeping, 15000); }

module.exports = { init, attach };
