/* 스피드 퀴즈 */
const TEAM = { red: { n: '빨강팀', e: '🔴' }, blue: { n: '파랑팀', e: '🔵' } };

GameUI.speedquiz = {
  render(c) {
    const fn = this['p_' + c.G.phase];
    return `<div class="stack">${fn ? fn.call(this, c) : ''}</div>`;
  },

  teamBox(G, team, isHost, repBtn) {
    return `<div class="team ${team}"><div class="team-h">${TEAM[team].e} ${TEAM[team].n} <small>${G.teams[team].length}명</small></div>
      ${G.teams[team].map((p) => `<div class="tm"><span>${G.reps[team] === p.id ? '⭐ ' : ''}${esc(p.name)}</span>
        ${isHost && repBtn ? `<button class="mini" data-send="game.${repBtn}" ${pl({ team, id: p.id })}>대표</button>` : ''}</div>`).join('') || '<small class="muted">비어 있음</small>'}
    </div>`;
  },

  p_setup({ G, isHost, appMeta }) {
    const s = G.settings;
    const teams = `<div class="teams">${this.teamBox(G, 'red', isHost, 'setRep')}${this.teamBox(G, 'blue', isHost, 'setRep')}</div>`;
    const builtins = (appMeta && appMeta.builtinTopics && appMeta.builtinTopics.length)
      ? appMeta.builtinTopics
      : [
          { name: '국내 드라마', count: 22 }, { name: '영화', count: 22 }, { name: '예능', count: 22 },
          { name: '가수', count: 22 }, { name: '음식', count: 22 }, { name: '동물', count: 22 },
          { name: '직업', count: 22 }, { name: '스포츠', count: 22 }
        ];

    const sourceName = s.source === 'builtin' ? '📚 내장 주제' : s.source === 'ai' ? '🤖 AI 출제' : '✍️ 대표 직접 입력';

    if (!isHost) {
      return `<div class="glass"><h3>⚡ 팀 구성</h3>${teams}
        ${G.teams.none.length ? `<p class="hint">미배정: ${G.teams.none.map((p) => esc(p.name)).join(', ')}</p>` : ''}</div>
        <div class="glass"><b>설정</b><p class="muted">출제: ${sourceName} ${s.source !== 'custom' ? `(${esc(s.topic || '기본')})` : ''} · ${s.count}문제 · ${s.time}초 · 패스 ${s.passes}번</p></div>
        <p class="pulse-text center">방장이 준비하는 중…</p>`;
    }
    const all = [];
    ['red', 'blue', 'none'].forEach((t) => G.teams[t].forEach((p) => all.push({ ...p, team: t })));
    return `<div class="glass"><div class="row-between"><h3>⚡ 팀 나누기</h3><button class="btn ghost sm" data-send="game.randomTeams">🎲 랜덤</button></div>
      <div class="assign">${all.map((p) => `<div class="arow"><span>${esc(p.name)}</span>
        <div class="seg3"><button class="${p.team === 'red' ? 'on red' : ''}" data-send="game.setTeam" ${pl({ id: p.id, team: 'red' })}>🔴</button>
        <button class="${p.team === 'none' ? 'on' : ''}" data-send="game.setTeam" ${pl({ id: p.id, team: null })}>—</button>
        <button class="${p.team === 'blue' ? 'on blue' : ''}" data-send="game.setTeam" ${pl({ id: p.id, team: 'blue' })}>🔵</button></div></div>`).join('')}</div>
      ${teams}<p class="hint">⭐ 대표는 직접 입력 모드에서 문제를 입력해요 (기본: 팀 첫 번째 사람)</p></div>
    <div class="glass" id="sqForm"><h3>설정</h3>${G.error ? `<p class="err">${esc(G.error)}</p>` : ''}
      <label class="field"><span>문제 출처</span>
        <select name="source" data-change-send="game.settings" data-collect="#sqForm">
          <option value="builtin" ${s.source === 'builtin' ? 'selected' : ''}>📚 내장 주제에서 출제 (추천)</option>
          <option value="ai" ${s.source === 'ai' ? 'selected' : ''}>🤖 AI가 주제에 맞게 자동 생성</option>
          <option value="custom" ${s.source === 'custom' ? 'selected' : ''}>✍️ 팀 대표가 직접 입력</option>
        </select>
      </label>

      ${s.source === 'builtin' ? `
        <label class="field"><span>내장 주제 선택</span>
          <select name="topic" data-change-send="game.settings" data-collect="#sqForm">
            ${builtins.map((b) => `<option value="${esc(b.name)}" ${s.topic === b.name ? 'selected' : ''}>${esc(b.name)} (${b.count}문제 보유)</option>`).join('')}
          </select>
        </label>
        <p class="hint">💡 <b>server/data/builtins.json</b> 파일에 단어를 추가하면 바로 반영돼요!</p>
      ` : ''}

      ${s.source === 'ai' ? `
        <div class="ai-badge ${appMeta && appMeta.hasAi ? 'ok' : 'warn'}">
          ${appMeta && appMeta.hasAi ? '🟢 Gemini AI 연결됨' : '🟠 GEMINI_API_KEY 미설정 (내장 주제 추천)'}
        </div>
        <label class="field"><span>주제 입력 (예: 국내 드라마, 90년대 가요)</span>
          <input name="topic" maxlength="30" value="${esc(s.topic)}" data-change-send="game.settings" data-collect="#sqForm" placeholder="주제 입력" autocomplete="off" />
        </label>
      ` : ''}

      ${s.source === 'custom' ? `
        <p class="hint">각 팀 대표가 <b>상대 팀이 맞힐 문제</b>를 직접 적어요 (난이도 조절 가능)</p>
      ` : ''}

      <div class="trio">
        <label class="field"><span>문제 수</span><input name="count" type="number" min="1" max="40" value="${s.count}" data-change-send="game.settings" data-collect="#sqForm" /></label>
        <label class="field"><span>제한시간(초)</span><input name="time" type="number" min="10" max="600" value="${s.time}" data-change-send="game.settings" data-collect="#sqForm" /></label>
        <label class="field"><span>패스 횟수</span><input name="passes" type="number" min="0" max="20" value="${s.passes}" data-change-send="game.settings" data-collect="#sqForm" /></label>
      </div>
      <button class="btn primary block" data-send="game.start" data-collect="#sqForm">
        ${s.source === 'custom' ? '✍️ 문제 입력 단계로' : '▶ 퀴즈 시작'}
      </button>
    </div>`;
  },

  p_loading() { return '<div class="glass center"><div class="spinner"></div><p class="pulse-text">AI가 유명한 문제만 골라오는 중…</p></div>'; },

  p_collect({ G, isHost }) {
    const r = G.rep;
    const status = `<div class="glass"><b>입력 현황</b><div class="chips status">
      ${['red', 'blue'].map((t) => `<span class="chip ${G.submitted[t] ? 'ok' : 'wait'}">${TEAM[t].e} ${TEAM[t].n} 대표 ${G.submitted[t] ? '✓ 완료' : '⏳ 입력 중'}</span>`).join('')}</div>
      ${isHost ? `<div class="teams">${this.teamBox(G, 'red', true, 'setRepLate')}${this.teamBox(G, 'blue', true, 'setRepLate')}</div><p class="hint">대표가 자리를 비웠다면 "대표" 버튼으로 교체할 수 있어요</p>` : ''}</div>`;
    if (!r) {
      return `<div class="glass center"><div class="emoji-xl">✍️</div><h3>팀 대표가 문제를 입력하는 중</h3><p class="muted">각 팀 대표는 <b>상대 팀</b>이 맞힐 문제 ${G.settings.count}개를 적어요</p></div>${status}`;
    }
    const inputs = Array.from({ length: r.count }, (_, i) => `<div class="wline"><span>${i + 1}</span><input name="words[]" maxlength="40" value="${esc(r.words[i] || '')}" placeholder="문제 ${i + 1}" autocomplete="off" /></div>`).join('');
    return `<div class="glass ${r.team}-glow" id="wordsForm"><h3>${TEAM[r.team].e} 대표 · ${TEAM[r.forTeam].e} ${TEAM[r.forTeam].n}이 맞힐 문제</h3>
      <p class="muted">${r.count}개를 모두 입력하고 저장하세요${r.saved ? ' · <b>저장됨 ✓ (수정 가능)</b>' : ''}</p>
      <div class="wlist">${inputs}</div>
      <button class="btn primary block" data-send="game.submitWords" data-collect="#wordsForm">💾 저장</button></div>${status}`;
  },

  scoreStrip(G) {
    return `<div class="scorestrip">${['red', 'blue'].map((t) => {
      const st = G.stats[t];
      return `<div class="sc ${t} ${G.current === t && G.phase !== 'result' ? 'active' : ''}"><b>${TEAM[t].e} ${TEAM[t].n}</b>
        <span>${st.done || G.phase === 'result' ? `정답 ${st.correct} · 패스 ${st.passed} · ${fmtMs(st.elapsedMs)}` : '대기'}</span></div>`;
    }).join('')}</div>`;
  },

  p_ready({ G, isHost }) {
    const cur = G.current, first = G.turnIndex === 0;
    const desc = isHost ? `<div class="glass"><b>출제자 선택 (제시어를 볼 사람)</b><p class="hint">방장과 출제자만 화면에 제시어가 보여요</p>
      <div class="chips">${G.candidates.map((p) => `<button class="chip ${G.describer && G.describer.id === p.id ? 'ok' : ''}" data-send="game.setDescriber" ${pl({ id: p.id })}>${esc(p.name)}</button>`).join('')}</div></div>` : '';
    return `${first ? '' : this.scoreStrip(G)}
      <div class="glass center ${cur}-glow"><div class="emoji-xl">${TEAM[cur].e}</div><h2>${first ? '첫 번째' : '두 번째'} 차례: ${TEAM[cur].n}</h2>
        <p class="muted">${G.settings.time}초 · 패스 ${G.settings.passes}번 · ${G.settings.count}문제</p>
        <p>출제자: <b>${G.describer ? esc(G.describer.name) : '미선택'}</b></p>
        ${isHost ? `<button class="btn primary block" data-send="game.startTurn">▶ 시작!</button>` : '<p class="pulse-text">방장이 시작하길 기다리는 중…</p>'}</div>${desc}`;
  },

  p_playing({ G, isHost }) {
    const cur = G.current, st = G.stats;
    const word = G.canSee ? `<div class="qword">${G.word ? esc(G.word) : '🎉 문제 끝!'}</div>` : `<div class="qword hidden">❓<small>${G.describer ? esc(G.describer.name) + '님이 설명 중' : '설명 중'}</small></div>`;
    const used = G.settings.passes - G.passesLeft;
    return `<div class="play ${cur}-glow">
      <div class="qtop"><small>${TEAM[cur].e} ${TEAM[cur].n} · ${esc(G.settings.topic || '직접 출제')}</small>${word}</div>
      <div class="hud">
        <div><small>남은 시간</small><b class="timer">${countdown(G.endsAt)}</b></div>
        <div><small>패스</small><b>${used}/${G.settings.passes}</b></div>
        <div><small>정답</small><b>${G.stats[cur].correct}</b></div>
        <div><small>진행</small><b>${G.idx}/${G.total}</b></div>
      </div></div>
      ${isHost ? `<div class="two-btns big">
        <button class="btn agree xl" data-send="game.correct">⭕ 정답</button>
        <button class="btn warn xl" data-send="game.pass" ${G.passesLeft <= 0 ? 'disabled' : ''}>⏭ 패스</button></div>
        <button class="btn ghost block" data-send="game.endTurn" data-confirm="이번 차례를 지금 끝낼까요?">차례 종료</button>` : ''}`;
  },

  p_result({ G, isHost }) {
    const w = G.winner;
    const list = (t) => `<div class="glass ${t}-glow"><b>${TEAM[t].e} ${TEAM[t].n} 패스한 문제</b>
      ${G.detail[t].passed.length ? `<div class="chips">${G.detail[t].passed.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>` : '<p class="muted">패스 없음 👏</p>'}
      <small class="muted">정답: ${G.detail[t].correct.map(esc).join(', ') || '없음'}</small></div>`;
    return `<div class="glass center end ${w === 'draw' ? '' : w + '-glow'}"><div class="emoji-xl bounce">${w === 'draw' ? '🤝' : '🏆'}</div>
      <h2>${w === 'draw' ? '무승부!' : `${TEAM[w].e} ${TEAM[w].n} 승리!`}</h2>
      <p class="hint">정답 수 → 걸린 시간 → 패스 적은 순으로 판정</p></div>
      ${this.scoreStrip(G)}${list('red')}${list('blue')}
      ${isHost ? `<div class="glass" id="awardBox"><div class="row-between"><b>승리팀 점수 지급</b>
        <span class="pts"><input type="number" name="points" min="1" max="20" value="1" /> 점</span></div>
        <button class="btn primary block" data-send="game.award" data-collect="#awardBox" ${G.awarded || w === 'draw' ? 'disabled' : ''}>${G.awarded ? '지급 완료 ✓' : '승리팀 전원에게 지급'}</button></div>
        <button class="btn ghost block" data-send="game.again">🔁 같은 팀으로 다시</button>` : ''}`;
  },
};
