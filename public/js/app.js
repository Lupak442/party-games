/* ===== 공용 유틸 / 앱 코어 ===== */
window.GameUI = {};   // 게임별 렌더러가 여기에 등록됨 (public/js/games/*.js)

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pl = (o) => `data-payload="${esc(JSON.stringify(o))}"`;

const S = { state: null, tab: 'game', offset: 0, session: null, prevTop: null, resuming: false };
try { S.session = JSON.parse(localStorage.getItem('pg_session') || 'null'); } catch (e) { /* ignore */ }
const saveSession = (s) => { S.session = s; if (s) localStorage.setItem('pg_session', JSON.stringify(s)); else localStorage.removeItem('pg_session'); };

const socket = io({ reconnectionDelay: 500, reconnectionDelayMax: 3000 });

/* ---- 가벼운 DOM morph: 입력 포커스/CSS transition(카드 뒤집기, 랭킹 이동)을 유지하며 갱신 ---- */
function morph(parent, html) {
  const tpl = document.createElement('template'); tpl.innerHTML = html;
  patch(parent, tpl.content);
}
function patch(a, b) {
  const an = [...a.childNodes], bn = [...b.childNodes];
  for (let i = 0; i < Math.max(an.length, bn.length); i++) {
    const x = an[i], y = bn[i];
    if (!y) { a.removeChild(x); continue; }
    if (!x) { a.appendChild(y); continue; }
    if (x.nodeType !== y.nodeType || (x.nodeType === 1 && (x.tagName !== y.tagName || x.dataset.key !== y.dataset.key))) { a.replaceChild(y, x); continue; }
    if (x.nodeType === 3) { if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; continue; }
    if (x.nodeType === 1) { syncAttrs(x, y); patch(x, y); }
  }
}
function syncAttrs(x, y) {
  for (const at of [...x.attributes]) if (!y.hasAttribute(at.name)) x.removeAttribute(at.name);
  for (const at of [...y.attributes]) if (x.getAttribute(at.name) !== at.value) x.setAttribute(at.name, at.value);
  if (x.tagName === 'INPUT' && (x.type === 'radio' || x.type === 'checkbox')) x.checked = y.hasAttribute('checked');
}

/* ---- 통신 ---- */
function act(path, payload) {
  const [scope, type] = path.split('.');
  return new Promise((res) => socket.emit('act', { scope, type, payload: payload || {} }, (r) => {
    if (r && !r.ok) toast(r.error || '오류가 발생했어요', 'err');
    res(r);
  }));
}

function collect(sel) {
  const root = $(sel); const o = {}; if (!root) return o;
  $$('[name]', root).forEach((e) => {
    if (e.type === 'radio' && !e.checked) return;
    if (e.type === 'checkbox') { o[e.name] = e.checked; return; }
    const v = e.type === 'number' || e.type === 'range' ? Number(e.value) : e.value;
    if (e.name.endsWith('[]')) { const k = e.name.slice(0, -2); (o[k] = o[k] || []).push(v); } else o[e.name] = v;
  });
  return o;
}

function doSend(el, attr) {
  const msg = el.dataset.confirm; if (msg && !confirm(msg)) return;
  const payload = { ...JSON.parse(el.dataset.payload || '{}'), ...(el.dataset.collect ? collect(el.dataset.collect) : {}) };
  act(el.dataset[attr], payload);
}

/* ---- 토스트 / 이펙트 ---- */
function toast(msg, kind = 'info') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3100);
}
function confetti() {
  const colors = ['#fbbf24', '#f472b6', '#22d3ee', '#a78bfa', '#34d399'];
  for (let i = 0; i < 40; i++) {
    const c = document.createElement('i'); c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw'; c.style.background = colors[i % colors.length];
    c.style.animationDuration = 1.8 + Math.random() * 1.6 + 's'; c.style.animationDelay = Math.random() * 0.4 + 's';
    c.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
    document.body.appendChild(c); setTimeout(() => c.remove(), 4000);
  }
}

/* ---- 공용 렌더 헬퍼 ---- */
const hue = (id) => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
const avatar = (name, id) => `<div class="avatar" style="--h:${hue(id)}">${esc([...String(name)][0] || '?')}</div>`;
const serverNow = () => Date.now() + S.offset;
const fmtMs = (ms) => (ms / 1000).toFixed(1) + '초';
const countdown = (end) => `<span data-countdown="${end}">${Math.max(0, Math.ceil((end - serverNow()) / 1000))}</span>`;
setInterval(() => {
  $$('[data-countdown]').forEach((el) => {
    const v = String(Math.max(0, Math.ceil((Number(el.dataset.countdown) - serverNow()) / 1000)));
    if (el.textContent !== v) el.textContent = v;
  });
}, 200);

/* ---- 랜딩 ---- */
const show = (id, on) => { const el = $(id); if (el) el.hidden = !on; };
function showLanding(errMsg) {
  show('#landing', true); show('#room', false);
  const s = S.session;
  show('#resumeBox', !!s);
  if (s) $('#resumeInfo').textContent = ` 방 ${s.code}`;
  const e = $('#landErr'); e.hidden = !errMsg; e.textContent = errMsg || '';
}
function landErr(msg) { const e = $('#landErr'); e.hidden = !msg; e.textContent = msg || ''; }

let previewTimer;
function previewRoom() {
  const code = $('#inCode').value.trim().toUpperCase();
  const box = $('#previewBox');
  if (code.length !== 5) { box.hidden = true; return; }
  socket.emit('room:preview', { code }, (r) => {
    if (!r || !r.ok) { box.hidden = false; box.innerHTML = `<span class="err">${esc(r ? r.error : '확인 실패')}</span>`; return; }
    const off = r.players.filter((p) => !p.online);
    box.hidden = false;
    box.innerHTML = `<div class="muted">참가자 ${r.count}/${r.max}명</div>` +
      (off.length ? `<div class="muted">혹시 이전에 나갔던 분이라면 이름을 눌러 자리로 돌아오세요</div><div class="chips">` +
        off.map((p) => `<button class="chip" data-local="claim" data-v="${esc(p.name)}">${esc(p.name)}</button>`).join('') + '</div>' : '');
  });
}

const Local = {
  seg(el) {
    const create = el.dataset.v === 'create';
    $('#segJoin').classList.toggle('on', !create); $('#segCreate').classList.toggle('on', create);
    show('#formJoin', !create); show('#formCreate', create); landErr('');
  },
  claim(el) { $('#inName').value = el.dataset.v; },
  create() {
    const name = $('#inName').value.trim(); if (!name) return landErr('이름을 입력해주세요');
    localStorage.setItem('pg_name', name);
    socket.emit('room:create', { name, maxPlayers: Number($('#inMax').value) }, (r) => {
      if (!r.ok) return landErr(r.error); saveSession({ code: r.code, token: r.token });
    });
  },
  join() {
    const name = $('#inName').value.trim(), code = $('#inCode').value.trim().toUpperCase();
    if (!name) return landErr('이름을 입력해주세요'); if (!code) return landErr('초대코드를 입력해주세요');
    localStorage.setItem('pg_name', name);
    socket.emit('room:join', { name, code }, (r) => {
      if (!r.ok) return landErr(r.error);
      saveSession({ code: r.code, token: r.token });
      if (r.resumed) toast('이전 자리로 돌아왔어요 ✅');
    });
  },
  resume() { tryResume(); },
  tab(el) { S.tab = el.dataset.v; renderRoom(); },
  async share() {
    const url = `${location.origin}/?room=${S.state.room.code}`;
    const text = `파티 게임 같이 해요! 초대코드: ${S.state.room.code}`;
    if (navigator.share) { try { await navigator.share({ title: '파티 게임즈', text, url }); return; } catch (e) { /* 취소 */ } }
    try { await navigator.clipboard.writeText(url); toast('초대 링크를 복사했어요 🔗'); } catch (e) { prompt('링크를 복사하세요', url); }
  },
  async copyCode() {
    try { await navigator.clipboard.writeText(S.state.room.code); toast('코드를 복사했어요'); } catch (e) { /* ignore */ }
  },
  leave() {
    if (!confirm('방에서 나갈까요?\n내 자리(점수 포함)는 남아 있어서, 같은 이름으로 다시 들어오면 돌아올 수 있어요.')) return;
    socket.emit('room:leave', {}, () => { saveSession(null); S.state = null; showLanding(); });
  },
};

/* ---- 방 렌더 ---- */
const ROW = 72;
function me() { return S.state.room.players.find((p) => p.id === S.state.me); }
function rankInfo() {
  const ps = S.state.room.players;
  const sorted = [...ps].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
  const rank = new Map(); sorted.forEach((p, i) => rank.set(p.id, i > 0 && p.score === sorted[i - 1].score ? rank.get(sorted[i - 1].id) : i + 1));
  return { sorted, rank, order: new Map(sorted.map((p, i) => [p.id, i])), allSame: sorted.every((p) => p.score === sorted[0].score) };
}

function renderRoom() {
  const st = S.state; if (!st) return;
  show('#landing', false); show('#room', true);
  $('#roomCode').textContent = st.room.code;
  const m = me(), ri = rankInfo(), isHost = st.me === st.room.hostId;
  $('#meChip').innerHTML = `${isHost ? '👑 ' : ''}${esc(m.name)} <b>${m.score}점</b> · ${ri.rank.get(m.id)}위`;
  ['game', 'rank', 'people'].forEach((t) => $('#tab-' + t).classList.toggle('on', S.tab === t));
  const html = S.tab === 'game' ? gameTab() : S.tab === 'rank' ? rankTab() : peopleTab();
  morph($('#roomBody'), html);

  // 1등이 바뀌면 축하 효과
  const top = !ri.allSame && ri.sorted[0].score > 0 ? ri.sorted[0].id : null;
  if (top && S.prevTop && top !== S.prevTop) confetti();
  S.prevTop = top;
}

function gameTab() {
  const st = S.state, isHost = st.me === st.room.hostId;
  if (!st.room.gameId) {
    const n = st.room.players.length;
    return `<div class="stack">
      <h2 class="sec">${isHost ? '어떤 게임을 할까요?' : '방장이 게임을 고르는 중…'}</h2>
      ${isHost ? '' : '<div class="glass pulse-box">⏳ 잠시만 기다려주세요</div>'}
      <div class="game-grid">${st.catalog.map((g) => `
        <button class="game-card ${isHost ? '' : 'dim'}" ${isHost ? `data-send="room.selectGame" ${pl({ id: g.id })}` : 'disabled'}>
          <span class="gi">${g.icon}</span><b>${esc(g.name)}</b><small>${esc(g.desc)}</small>
          <em>${g.minPlayers}명~ ${n < g.minPlayers ? '· 인원 부족' : ''}</em>
        </button>`).join('')}
      </div>
      <p class="hint">새로운 게임은 앞으로 계속 추가돼요 ✨</p>
    </div>`;
  }
  const meta = st.catalog.find((g) => g.id === st.room.gameId);
  const ui = GameUI[st.room.gameId];
  const ctx = {
    G: st.game,
    me: st.me,
    room: st.room,
    isHost,
    appMeta: st.meta || { hasAi: false, builtinTopics: [] },
    nm: (id) => (st.room.players.find((p) => p.id === id) || { name: '?' }).name
  };
  return `<div class="stack">
    <div class="game-head"><span>${meta.icon} ${esc(meta.name)}</span>
      ${isHost ? `<button class="btn ghost sm" data-send="room.endGame" data-confirm="게임을 끝내고 목록으로 돌아갈까요?">게임 끝내기</button>` : ''}</div>
    ${ui ? ui.render(ctx) : '<div class="glass">지원하지 않는 게임이에요</div>'}
  </div>`;
}

function rankTab() {
  const st = S.state, isHost = st.me === st.room.hostId, ri = rankInfo(), n = ri.sorted.length;
  const rows = [...st.room.players].sort((a, b) => a.joinedAt - b.joinedAt).map((p) => {
    const idx = ri.order.get(p.id), rk = ri.rank.get(p.id);
    let cls = '';
    if (!ri.allSame) {
      if (rk <= 3) cls = 'r' + rk;
      else if (idx >= n - 2) cls = 'low';
    }
    const medal = { 1: '🥇', 2: '🥈', 3: '🥉' }[rk];
    return `<div class="rrow ${cls} ${p.id === st.me ? 'me' : ''}" data-key="${p.id}" style="transform:translateY(${idx * ROW}px)">
      <div class="rpos">${cls.startsWith('r') && !ri.allSame ? medal : rk}</div>
      ${avatar(p.name, p.id)}
      <div class="rname">${esc(p.name)}${p.id === st.room.hostId ? ' <span title="방장">👑</span>' : ''}${p.online ? '' : ' <small class="off">오프라인</small>'}</div>
      <div class="rscore">${p.score}</div>
      ${isHost ? `<div class="radj"><button data-send="room.score" ${pl({ id: p.id, delta: -1 })}>−</button><button data-send="room.score" ${pl({ id: p.id, delta: 1 })}>+</button></div>` : ''}
      <span class="fx fx1"></span><span class="fx fx2"></span><span class="fx fx3"></span>
      ${cls === 'low' ? '<span class="rain">🌧️</span>' : ''}
    </div>`;
  }).join('');
  return `<div class="stack"><h2 class="sec">🏆 실시간 랭킹</h2>
    <div class="board" style="height:${n * ROW}px">${rows}</div>
    ${isHost ? '<p class="hint">방장은 − / + 버튼으로 점수를 바로 조절할 수 있어요</p>' : ''}
  </div>`;
}

function peopleTab() {
  const st = S.state, isHost = st.me === st.room.hostId, r = st.room;
  const list = [...r.players].sort((a, b) => a.joinedAt - b.joinedAt).map((p) => `
    <div class="prow">
      ${avatar(p.name, p.id)}
      <div class="pinfo"><b>${esc(p.name)}${p.id === r.hostId ? ' 👑' : ''}${p.id === st.me ? ' <small>(나)</small>' : ''}</b>
        <small class="${p.online ? 'on' : 'off'}">● ${p.online ? '접속 중' : '오프라인 (자리 유지 중)'} · ${p.score}점</small></div>
      ${isHost && p.id !== st.me ? `<div class="pact">
        <button class="mini" data-send="room.score" ${pl({ id: p.id, delta: -5 })}>-5</button>
        <button class="mini" data-send="room.score" ${pl({ id: p.id, delta: 5 })}>+5</button>
        <button class="mini" data-send="room.transferHost" ${pl({ id: p.id })} data-confirm="${esc(p.name)}님에게 방장을 넘길까요?">👑</button>
        <button class="mini danger" data-send="room.kick" ${pl({ id: p.id })} data-confirm="${esc(p.name)}님을 내보낼까요?">✕</button>
      </div>` : ''}
    </div>`).join('');
  return `<div class="stack">
    <div class="glass invite">
      <div><small>초대코드</small><div class="big-code">${r.code}</div></div>
      <div class="invite-btns"><button class="btn primary sm" data-local="share">링크 공유</button><button class="btn ghost sm" data-local="copyCode">코드 복사</button></div>
    </div>
    <div class="glass">
      <div class="row-between"><b>참가자 ${r.players.length} / ${r.maxPlayers}명</b></div>
      ${isHost ? `<div id="maxBox" class="max-box"><input type="range" name="max" min="2" max="30" value="${r.maxPlayers}" data-change-send="room.setMax" data-collect="#maxBox" /><small>최대 인원 설정 (놓으면 적용)</small></div>` : ''}
      <div class="plist">${list}</div>
    </div>
    ${isHost ? `<button class="btn ghost block" data-send="room.resetScores" data-confirm="모든 점수를 0으로 초기화할까요?">점수 초기화</button>` : ''}
    <button class="btn ghost block" data-local="leave">방 나가기</button>
  </div>`;
}

/* ---- 소켓 이벤트 ---- */
socket.on('state', (st) => {
  S.offset = st.serverTime - Date.now();
  S.state = st; S.resuming = false;
  if (!S.session) { /* 방금 만든 방: 세션 저장이 ack보다 늦게 올 수 있음 */ }
  renderRoom();
});
socket.on('toast', (t) => toast(t.msg, t.kind));
socket.on('kicked', () => { saveSession(null); S.state = null; showLanding('방장이 방에서 내보냈어요'); });

let connTimer;
socket.on('disconnect', () => { clearTimeout(connTimer); connTimer = setTimeout(() => show('#conn', true), 1200); });
socket.on('connect', () => { clearTimeout(connTimer); show('#conn', false); tryResume(); });

function tryResume() {
  if (!S.session) return;
  S.resuming = true;
  socket.emit('room:resume', S.session, (r) => {
    if (r && r.ok) return;
    if (r && r.fatal) {
      const name = localStorage.getItem('pg_name') || '';
      const code = S.session.code; saveSession(null); S.state = null;
      showLanding(r.error); $('#inName').value = name; $('#inCode').value = code; previewRoom();
    } else showLanding('다시 연결하지 못했어요. 잠시 후 다시 눌러주세요');
  });
}

// 폰을 잠갔다 켜거나 앱을 전환했다가 돌아오면 즉시 재연결
document.addEventListener('visibilitychange', () => { if (!document.hidden && !socket.connected) socket.connect(); });
window.addEventListener('online', () => { if (!socket.connected) socket.connect(); });

/* ---- 이벤트 위임 ---- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-send],[data-local]'); if (!el || el.disabled) return;
  if (el.dataset.send) doSend(el, 'send'); else if (Local[el.dataset.local]) Local[el.dataset.local](el, e);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change-send]'); if (el) doSend(el, 'changeSend');
});

function boot() {
  const params = new URLSearchParams(location.search);
  $('#inName').value = localStorage.getItem('pg_name') || '';
  $('#inMax').addEventListener('input', (e) => { $('#maxVal').textContent = e.target.value; });
  $('#inCode').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); clearTimeout(previewTimer); previewTimer = setTimeout(previewRoom, 250); });
  const link = (params.get('room') || '').toUpperCase();
  if (link) {
    history.replaceState(null, '', '/');
    if (S.session && S.session.code === link) { tryResumeOrLanding(); return; }
    saveSession(null); showLanding(); $('#inCode').value = link; previewRoom(); return;
  }
  tryResumeOrLanding();
}
function tryResumeOrLanding() {
  if (!S.session) { showLanding(); return; }
  // 재접속 시도 중에는 랜딩을 숨겨 깜빡임 방지, 오래 걸리면 수동 버튼 노출
  setTimeout(() => { if (!S.state) showLanding(); }, 4000);
}
window.__boot = boot;
