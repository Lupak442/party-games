/* ===== 바퀴벌레 포커 (Cockroach Poker) 게임 클라이언트 UI ===== */
GameUI.cockroach = {
  // 사용자가 고른 선택값 보존
  sel: {
    cardId: null,
    to: null,
    claim: null,
    passTo: null,
    passClaim: null,
  },

  setSel(key, val) {
    this.sel[key] = val;
    if (typeof renderRoom === 'function') renderRoom();
  },

  // 손패 카드 클릭 시 처리
  clickHandCard(cardId, bugId, isMyTurn, hasTurn, activeName) {
    if (hasTurn) {
      return toast('현재 진행 중인 카드가 있습니다! 먼저 참/거짓 판단이나 넘기기를 진행해주세요.', 'warn');
    }
    if (!isMyTurn) {
      return toast(`현재는 [${activeName || '다른 플레이어'}]님의 차례입니다 ⏳ (내 차례가 되면 카드를 보낼 수 있어요)`, 'info');
    }
    this.sel.cardId = cardId;
    // 주장할 동물이 비어있으면 현재 터치한 카드의 동물로 자동 제안
    if (!this.sel.claim) {
      this.sel.claim = bugId;
    }
    if (typeof renderRoom === 'function') renderRoom();
  },

  sendOffer() {
    const s = this.sel;
    if (!s.cardId) return toast('보낼 카드를 내 손패에서 선택해주세요 🪳', 'err');
    if (!s.to) return toast('전달할 상대를 선택해주세요 👥', 'err');
    if (!s.claim) return toast('주장할 동물을 선택해주세요 🗣️', 'err');
    act('game.offer', { cardId: s.cardId, to: s.to, claim: s.claim });
  },

  sendPass() {
    const s = this.sel;
    if (!s.passTo) return toast('넘길 상대를 선택해주세요 👥', 'err');
    if (!s.passClaim) return toast('주장할 동물을 선택해주세요 🗣️', 'err');
    act('game.passDeliver', { to: s.passTo, claim: s.passClaim });
  },

  render(c) {
    const fn = this['p_' + c.G.phase];
    return `<div class="stack cr-container">${fn ? fn.call(this, c) : ''}</div>`;
  },

  /* ---- 1. 대기/설정 화면 (setup) ---- */
  p_setup({ G, isHost, room }) {
    const s = G.settings;
    const babo = G.babo || room.babo;
    const playerCount = room.players ? room.players.length : 0;

    return `
      <div class="glass center cr-intro">
        <div class="cr-hero-icon">🪳</div>
        <h2>바퀴벌레 포커</h2>
        <p class="muted">블러핑 심리전! 단 한 명의 꼴찌(바보)가 될 때까지 살아남으세요.</p>
        <div class="cr-player-limit-badge">👥 2~6인 플레이 (현재 ${playerCount}명 대기 중 ${playerCount > 6 ? '· 6명 초과 시 관전' : ''})</div>
      </div>

      <!-- 이전 바보 안내 -->
      ${babo ? `
        <div class="glass cr-babo-hall center">
          <div class="babo-hall-title">🪳🤪 직전 바보: <b>${esc(babo.name)}</b></div>
          <small class="muted">${esc(babo.reason || '바퀴벌레 포커 꼴찌')}</small>
        </div>
      ` : ''}

      <div class="glass cr-rule-card">
        <h4 style="margin:0 0 8px 0;">📜 게임 규칙 & 3가지 패배 조건</h4>
        <ul class="cr-rule-list">
          <li>
            <b class="text-danger">💥 패배 조건 1:</b> 같은 종류의 동물을 <b>4장</b> 모았을 때
          </li>
          <li>
            <b class="text-danger">🌈 패배 조건 2:</b> 8종류의 동물을 <b>각각 1장씩(전체 종류)</b> 모았을 때
          </li>
          <li>
            <b class="text-danger">📭 패배 조건 3:</b> 자기 차례에 넘길 <b>손패 카드가 없을 때</b>
          </li>
          <li>
            <b class="text-accent">🤪 바보 패널티:</b> 꼴찌는 점수 감점과 함께 <b>다음에 이 게임을 하기 전까지 랭킹/방 전체에 바보 표시</b>가 붙습니다!
          </li>
          <li>
            <b class="text-muted">👥 인원 안내:</b> 정식 룰 2~6인 진행! 6명을 초과하면 나머지는 <b>관전자</b>가 되어 블러핑을 생생하게 구경할 수 있습니다.
          </li>
        </ul>
      </div>

      ${isHost ? `
        <div class="glass cr-settings-box" id="crSetupForm">
          <h4 style="margin:0 0 12px 0;">⚙️ 점수 설정</h4>
          <div class="form-row-2">
            <label class="field">
              <span>생존 승리 가점 (+)</span>
              <input type="number" name="winPts" value="${s.winPts}" min="1" max="20" />
            </label>
            <label class="field">
              <span>꼴찌 패배 감점 (-)</span>
              <input type="number" name="losePts" value="${s.losePts}" min="1" max="20" />
            </label>
          </div>
          <button class="btn block" data-collect="#crSetupForm" data-send="game.settings" style="margin-top:8px;">
            설정 저장
          </button>
        </div>

        <button class="btn primary xl block" data-send="game.start">
          🎮 바퀴벌레 포커 시작하기
        </button>
      ` : `
        <div class="glass center">
          <p class="pulse-text">방장이 게임을 준비 중입니다…</p>
          <small class="muted">승리 시 +${s.winPts}점 / 꼴찌 시 -${s.losePts}점 (바보 등극!)</small>
        </div>
      `}
    `;
  },

  /* ---- 2. 게임 플레이 화면 (play) ---- */
  p_play({ G, me }) {
    // me는 문자열 ID 또는 객체일 수 있으므로 확실하게 ID 추출!
    const myId = typeof me === 'object' && me ? me.id : me;
    const isMyTurn = G.activePlayer && G.activePlayer.id === myId;
    const turn = G.turn;
    const bugs = G.bugs;
    const isSpectator = G.isSpectator;

    return `
      <!-- 관전자 안내 배너 -->
      ${isSpectator ? `
        <div class="glass cr-spectator-banner">
          <div class="spec-icon">👀</div>
          <div class="spec-info">
            <b>현재 관전 중입니다 (최대 6인 플레이)</b>
            <small>플레이어들이 어떤 카드를 주고받는지 실시간으로 지켜보세요!</small>
          </div>
        </div>
      ` : ''}

      <!-- 1) 직전 턴 결과 안내 (있을 때만) -->
      ${G.lastEvent ? this.renderLastEvent(G.lastEvent) : ''}

      <!-- 2) 메인 액션 영역 (턴 진행 중 / 차례 액션 / 대기 / 관전) -->
      ${turn ? this.renderTurnBox(turn, myId, bugs, isSpectator) : this.renderOfferBox(isMyTurn, G, myId, bugs, isSpectator)}

      <!-- 3) 내 손패 (My Hand) - 내 차례 아닐 때 손패 확인용으로 표시 (내 차례일 땐 액션 폼 2단계에 포함) -->
      ${!isSpectator && (!isMyTurn || turn) ? this.renderMyHandSection(G, isMyTurn, !!turn) : ''}

      <!-- 4) 전체 플레이어의 모은 벌레 현황 보드 -->
      <div class="glass cr-tables-board">
        <div class="cr-board-header">
          <b>📊 테이블 수집 현황 (벌레 모음)</b>
          <small class="muted">동물 4장 또는 8종 올컬렉션 시 패배</small>
        </div>

        <div class="cr-players-grid">
          ${G.players.map((p) => this.renderPlayerTable(p, bugs, myId)).join('')}
        </div>
      </div>
    `;
  },

  /* 직전 턴 이벤트 안내 렌더러 */
  renderLastEvent(ev) {
    return `
      <div class="cr-last-event ${ev.correct ? 'event-correct' : 'event-wrong'}">
        <div class="event-title">
          <span>${ev.correct ? '🎯 정답 간파!' : '😈 거짓말 성공 (오답)!'}</span>
          <small>직전 턴 결과</small>
        </div>
        <div class="event-desc">
          <b>${esc(ev.from)}</b>님이 <b>${esc(ev.to)}</b>님에게 전달한 카드는 실제 <b>${ev.actualIcon} ${esc(ev.actual)}</b> 이었습니다!
          <br/>
          ${esc(ev.to)}님의 선택: [${esc(ev.guess)}] ➔ <b>${esc(ev.eater)}</b>님이 카드를 테이블에 가져갔습니다!
        </div>
      </div>
    `;
  },

  /* 턴 진행 중 (카드가 오가는 중) 박스 */
  renderTurnBox(turn, myId, bugs, isSpectator) {
    const isReceiver = turn.to.id === myId;
    const isSender = turn.from.id === myId;

    // 관전자의 시점
    if (isSpectator) {
      return `
        <div class="glass cr-action-box spectator-glow center">
          <span class="badge accent">👀 관전 중 (진행 상황)</span>
          <h3 style="margin:10px 0 6px 0;">
            <b>${esc(turn.from.name)}</b> ➔ <b>${esc(turn.to.name)}</b>
          </h3>
          <div class="claim-bubble" style="display:inline-block; margin-bottom:8px;">
            "${esc(turn.from.name)}: 이건 <b>${turn.claim.icon} ${esc(turn.claim.name)}</b> 이야!"
          </div>
          ${turn.actualCard ? `
            <div class="cr-secret-reveal" style="max-width:280px; margin:0 auto 10px auto;">
              <div class="secret-label">관전자 특권: 실제 숨겨진 카드</div>
              <div class="secret-card">${turn.actualCard.icon} ${esc(turn.actualCard.name)}</div>
            </div>
          ` : ''}
          <p class="pulse-text" style="font-size:13px; margin:0;">
            ${turn.stage === 'pass' ? `${esc(turn.to.name)} 님이 카드를 확인하고 다른 사람에게 넘기는 중…` : `${esc(turn.to.name)} 님이 참/거짓을 고민 중입니다…`}
          </p>
        </div>
      `;
    }

    // 내가 카드를 받았고 응답할 차례 (참/거짓 맞히기 or 엿보고 넘기기)
    if (isReceiver && turn.stage === 'respond') {
      const validCandidates = (turn.passCandidates || []).filter((c) => c.id !== myId && c.id !== turn.to.id);
      const canPass = validCandidates.length > 0;
      return `
        <div class="glass cr-action-box receiver-glow">
          <div class="cr-turn-header">
            <span class="badge accent">카드가 도착했습니다!</span>
            <small>${esc(turn.from.name)} ➔ 나</small>
          </div>

          <div class="cr-claim-display">
            <div class="claim-bubble">
              "${esc(turn.from.name)}: 이건 <b>${turn.claim.icon} ${esc(turn.claim.name)}</b> 이야!"
            </div>
            <div class="cr-mystery-card">
              <span class="mystery-mark">❓</span>
              <span class="mystery-hint">주장: ${turn.claim.icon} ${esc(turn.claim.name)}</span>
            </div>
          </div>

          <div class="cr-choices-grid">
            <button class="btn ok lg" data-send="game.guess" ${pl({ guess: 'true' })}>
              ⭕ 진짜야! (참)
            </button>
            <button class="btn danger lg" data-send="game.guess" ${pl({ guess: 'false' })}>
              ❌ 거짓말이야! (구라)
            </button>
          </div>

          ${canPass ? `
            <div style="margin-top:12px; border-top:1px dashed var(--border); padding-top:10px; text-align:center;">
              <button class="btn warn block" data-send="game.passPeek">
                👀 몰래 확인하고 다른 사람에게 넘기기 (패스)
              </button>
              <small class="muted" style="display:block; margin-top:4px;">
                넘길 수 있는 후보: ${validCandidates.map((c) => esc(c.name)).join(', ')}
              </small>
            </div>
          ` : `
            <div class="muted center" style="margin-top:8px; font-size:12px;">
              모든 사람이 이 카드를 확인하여 더 이상 넘길 수 없습니다. 맞혀야 합니다!
            </div>
          `}
        </div>
      `;
    }

    // 내가 카드를 확인하고 다른 사람에게 패스(토스)하는 단계
    if (isReceiver && turn.stage === 'pass') {
      const passCandidates = (turn.passCandidates || []).filter((cand) => cand.id !== myId && cand.id !== turn.to.id);
      if (!this.sel.passTo || this.sel.passTo === myId || !passCandidates.some((c) => c.id === this.sel.passTo)) {
        this.sel.passTo = passCandidates[0] ? passCandidates[0].id : null;
      }
      if (!this.sel.passClaim) this.sel.passClaim = turn.claim.id;

      return `
        <div class="glass cr-action-box pass-glow">
          <div class="cr-turn-header">
            <span class="badge warn">👀 카드 엿보기 완료</span>
            <small>다른 사람에게 새로운 주장으로 넘기세요 (나 제외)</small>
          </div>

          <div class="cr-secret-reveal">
            <div class="secret-label">비밀 확인 결과 (나만 보임)</div>
            <div class="secret-card">
              <span class="secret-icon">${turn.actualCard ? turn.actualCard.icon : '❓'}</span>
              <span class="secret-name">${turn.actualCard ? esc(turn.actualCard.name) : '카드'}</span>
            </div>
          </div>

          <!-- 1. 넘길 상대 선택 -->
          <div class="form-group" style="margin-top:12px;">
            <label class="field-title">1. 카드를 넘길 상대 선택 (나 제외)</label>
            <div class="cr-tiles-grid cr-opp-tiles">
              ${passCandidates.length === 0 ? `
                <div class="muted center" style="padding:10px;">넘길 수 있는 상대가 없습니다.</div>
              ` : passCandidates.map((cand) => {
                const isSel = this.sel.passTo === cand.id;
                return `
                  <button type="button" class="cr-interactive-tile ${isSel ? 'selected' : ''}" onclick="GameUI.cockroach.setSel('passTo', '${cand.id}')">
                    <span class="cr-tile-check">${isSel ? '✓' : ''}</span>
                    <span class="cr-tile-label">${esc(cand.name)}</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- 2. 상대에게 뭐라고 주장할지 선택 -->
          <div class="form-group" style="margin-top:12px;">
            <label class="field-title">2. 상대에게 뭐라고 주장할까요? (진짜 or 거짓)</label>
            <div class="cr-tiles-grid cr-bug-tiles">
              ${bugs.map((b) => {
                const isSel = this.sel.passClaim === b.id;
                return `
                  <button type="button" class="cr-interactive-tile ${isSel ? 'selected' : ''}" onclick="GameUI.cockroach.setSel('passClaim', '${b.id}')">
                    <span class="cr-tile-icon">${b.icon}</span>
                    <span class="cr-tile-label">${esc(b.name)}</span>
                    <span class="cr-tile-check">${isSel ? '✓' : ''}</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <button class="btn primary block lg" onclick="GameUI.cockroach.sendPass()" style="margin-top:14px;">
            🚀 선택한 상대에게 카드 전달하기
          </button>
        </div>
      `;
    }

    // 내가 보낸 사람이고 상대의 결정을 기다리는 중
    if (isSender) {
      return `
        <div class="glass cr-action-box center">
          <div class="badge primary">내가 카드 전달함</div>
          <h3 style="margin:10px 0 6px 0;">⏳ ${esc(turn.to.name)} 님의 결정을 대기 중…</h3>
          <p class="muted">
            선언: <b>${turn.claim.icon} ${esc(turn.claim.name)}</b>
            ${turn.actualCard ? `<br/><small>(실제 카드: ${turn.actualCard.icon} ${esc(turn.actualCard.name)})</small>` : ''}
          </p>
          <div class="cr-spinner-dots">● ● ●</div>
        </div>
      `;
    }

    // 다른 플레이어들 사이에서 진행 중
    return `
      <div class="glass cr-action-box center">
        <div class="badge muted">진행 중</div>
        <h3 style="margin:10px 0 6px 0;">
          <b>${esc(turn.from.name)}</b> ➔ <b>${esc(turn.to.name)}</b>
        </h3>
        <p class="muted">
          선언한 동물: <b>${turn.claim.icon} ${esc(turn.claim.name)}</b>
        </p>
        <p class="pulse-text" style="font-size:13px; margin:0;">
          ${turn.stage === 'pass' ? `${esc(turn.to.name)} 님이 카드를 확인하고 다른 사람에게 넘기는 중…` : `${esc(turn.to.name)} 님이 고민 중입니다…`}
        </p>
      </div>
    `;
  },

  /* 턴 시작 전 (카드 낼 차례인 사람이 상대와 주장을 골라 보내는) 박스 */
  renderOfferBox(isMyTurn, G, myId, bugs, isSpectator) {
    if (isSpectator) {
      return `
        <div class="glass cr-action-box center">
          <div class="badge">차례 대기</div>
          <h3 style="margin:10px 0 6px 0;">🎯 <b>${esc(G.activePlayer ? G.activePlayer.name : '플레이어')}</b> 님의 차례입니다</h3>
          <p class="pulse-text" style="margin:0;">카드를 골라 상대에게 보내기를 기다리고 있습니다…</p>
        </div>
      `;
    }

    if (!isMyTurn) {
      return `
        <div class="glass cr-action-box center">
          <div class="badge">차례 대기</div>
          <h3 style="margin:10px 0 6px 0;">🎯 <b>${esc(G.activePlayer ? G.activePlayer.name : '누군가')}</b> 님의 차례입니다</h3>
          <p class="pulse-text" style="margin:0;">카드를 골라 전달하기를 기다리고 있습니다…</p>
        </div>
      `;
    }

    const myHand = G.myHand || [];
    const opponents = G.players.filter((p) => p.id !== myId);

    // 기본 선택값 자동 세팅
    if (!this.sel.cardId || !myHand.some((c) => c.id === this.sel.cardId)) {
      if (myHand[0]) this.sel.cardId = myHand[0].id;
    }
    if (!this.sel.to || !opponents.some((o) => o.id === this.sel.to)) {
      if (opponents[0]) this.sel.to = opponents[0].id;
    }
    const currentCard = myHand.find((c) => c.id === this.sel.cardId);
    if (!this.sel.claim) {
      this.sel.claim = currentCard ? currentCard.bug.id : bugs[0].id;
    }

    const targetOpp = opponents.find((o) => o.id === this.sel.to);
    const claimedBug = bugs.find((b) => b.id === this.sel.claim);

    return `
      <div class="glass cr-action-box active-turn-glow">
        <div class="cr-turn-header">
          <span class="badge ok">🎯 내 차례! 카드를 보내세요</span>
          <small>상대 지목 ➔ 카드 선택 ➔ 블러핑 선언 순으로 진행하세요</small>
        </div>

        <!-- 1) 전달할 상대 선택 -->
        <div class="form-group" style="margin-top:10px;">
          <label class="field-title">1. 카드를 보낼 상대 지목</label>
          <div class="cr-tiles-grid cr-opp-tiles">
            ${opponents.map((opp) => {
              const isSel = this.sel.to === opp.id;
              return `
                <button type="button" class="cr-interactive-tile ${isSel ? 'selected' : ''}" onclick="GameUI.cockroach.setSel('to', '${opp.id}')">
                  <span class="cr-tile-label">${esc(opp.name)} (${opp.handCount}장)</span>
                  <span class="cr-tile-check">${isSel ? '✓' : ''}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 2) 내 손패에서 보낼 카드 선택 -->
        <div class="form-group" style="margin-top:14px;">
          <label class="field-title">
            2. 내 손패에서 보낼 카드 선택 
            ${currentCard ? `<span class="badge accent" style="margin-left:6px;">선택: ${currentCard.bug.icon} ${esc(currentCard.bug.name)}</span>` : ''}
          </label>
          <div class="cr-hand-select-scroll">
            ${myHand.map((card) => {
              const isSel = this.sel.cardId === card.id;
              return `
                <button type="button" 
                        class="cr-interactive-card ${isSel ? 'selected' : ''} can-pick" 
                        onclick="GameUI.cockroach.clickHandCard('${card.id}', '${card.bug.id}', true, false, '')">
                  <span class="card-icon">${card.bug.icon}</span>
                  <span class="card-name">${esc(card.bug.name)}</span>
                  ${isSel ? '<span class="card-selected-badge">보낼 카드</span>' : ''}
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 3) 상대에게 주장할 동물 선택 (블러핑) -->
        <div class="form-group" style="margin-top:14px;">
          <label class="field-title">
            3. 상대에게 주장할 동물 선언 
            <small class="muted">(${currentCard && this.sel.claim === currentCard.bug.id ? '진실' : '거짓말'})</small>
          </label>
          <div class="cr-tiles-grid cr-bug-tiles">
            ${bugs.map((b) => {
              const isSel = this.sel.claim === b.id;
              return `
                <button type="button" class="cr-interactive-tile ${isSel ? 'selected' : ''}" onclick="GameUI.cockroach.setSel('claim', '${b.id}')">
                  <span class="cr-tile-icon">${b.icon}</span>
                  <span class="cr-tile-label">${esc(b.name)}</span>
                  <span class="cr-tile-check">${isSel ? '✓' : ''}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <button class="btn primary block lg" onclick="GameUI.cockroach.sendOffer()" style="margin-top:16px;">
          🚀 ${targetOpp ? esc(targetOpp.name) : '상대'}에게 "${claimedBug ? claimedBug.name : ''}"라고 카드 전달하기
        </button>
      </div>
    `;
  },

  /* 내 손패 섹션 (터치하여 바로 카드 선택) */
  renderMyHandSection(G, isMyTurn, hasTurn) {
    const myHand = G.myHand || [];
    const activeName = G.activePlayer ? G.activePlayer.name : '';

    return `
      <div class="glass cr-my-hand-container ${isMyTurn ? 'my-hand-active-glow' : ''}">
        <div class="cr-hand-header">
          <div class="hand-title-row">
            <b>내 손패 (${G.myHandCount}장 남음)</b>
            ${isMyTurn ? `
              <span class="badge ok pulse">👆 보낼 카드를 터치하세요!</span>
            ` : '<small class="muted">다른 사람은 볼 수 없어요</small>'}
          </div>
        </div>

        <div class="cr-hand-select-scroll">
          ${myHand.length === 0 ? `
            <div class="muted center" style="padding:16px; width:100%;">손패가 모두 소진되었습니다!</div>
          ` : myHand.map((card) => {
            const isSel = isMyTurn && this.sel.cardId === card.id;
            return `
              <button type="button" 
                      class="cr-interactive-card ${isSel ? 'selected' : ''} ${isMyTurn ? 'can-pick' : ''}" 
                      onclick="GameUI.cockroach.clickHandCard('${card.id}', '${card.bug.id}', ${isMyTurn}, ${hasTurn}, '${esc(activeName)}')">
                <span class="card-icon">${card.bug.icon}</span>
                <span class="card-name">${esc(card.bug.name)}</span>
                ${isSel ? '<span class="card-selected-badge">보낼 카드</span>' : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  /* 개별 플레이어의 테이블 벌레 컬렉션 카드 렌더러 */
  renderPlayerTable(p, bugs, myId) {
    const isMe = p.id === myId;
    const counts = p.tables || {};

    // 패배 위험도 감지
    const danger3Bugs = bugs.filter((b) => (counts[b.id] || 0) === 3);
    const isAllTypesDanger = p.uniqueCount === 7;

    return `
      <div class="cr-player-card ${isMe ? 'is-me' : ''} ${danger3Bugs.length > 0 || isAllTypesDanger ? 'danger-alert' : ''}">
        <div class="p-card-top">
          <div class="p-card-name">
            <b>${isMe ? '🙋 ' : ''}${esc(p.name)}</b>
            <span class="p-hand-badge">손패 ${p.handCount}장</span>
          </div>
          <div class="p-unique-badge ${isAllTypesDanger ? 'badge-danger-blink' : ''}">
            종류: <b>${p.uniqueCount}</b> / 8종
          </div>
        </div>

        <!-- 위험 경고 문구 -->
        ${danger3Bugs.length > 0 ? `
          <div class="cr-danger-chip">
            🚨 ${danger3Bugs.map((b) => `${b.icon} ${b.name}`).join(', ')} 3장! (1장 더 모으면 패배)
          </div>
        ` : ''}
        ${isAllTypesDanger ? `
          <div class="cr-danger-chip rainbow">
            🚨 8종 올컬렉션까지 1종류 남음! (패배 위기)
          </div>
        ` : ''}

        <!-- 8종 벌레 수집 그리드 -->
        <div class="cr-bug-collection-grid">
          ${bugs.map((b) => {
            const cnt = counts[b.id] || 0;
            const isDanger = cnt >= 3;
            return `
              <div class="cr-coll-item ${cnt === 0 ? 'zero' : ''} ${isDanger ? 'item-danger' : ''}" title="${esc(b.name)}: ${cnt}장">
                <span class="coll-icon">${b.icon}</span>
                <span class="coll-count ${cnt > 0 ? 'active' : ''}">${cnt}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  /* ---- 3. 게임 종료 화면 (end) ---- */
  p_end({ G, isHost }) {
    const loser = G.loser;
    return `
      <div class="glass center cr-end-card">
        <div class="cr-loser-skull">💀</div>
        <h2 class="text-danger" style="margin:6px 0;">바퀴벌레 포커 종료!</h2>
        
        <div class="cr-loser-box">
          <div class="loser-title">👑 이번 판의 바보 (패배자) 🪳🤪</div>
          <div class="loser-name">${esc(loser.name)}</div>
          <div class="loser-reason">사유: <b>${esc(loser.reason)}</b></div>
          <div class="loser-penalty">-${G.settings.losePts}점 감점 & 바보 등극!</div>
        </div>

        <div class="cr-winners-box">
          <div class="winners-title">🏆 생존자 전원 승리! (+${G.settings.winPts}점)</div>
        </div>

        ${isHost ? `
          <div style="margin-top:16px;">
            <button class="btn primary lg block" data-send="game.again">
              🔄 한 판 더 하기 (설정으로)
            </button>
          </div>
        ` : `
          <p class="pulse-text" style="margin-top:16px;">방장이 다음 게임을 준비 중입니다…</p>
        `}
      </div>
    `;
  },
};
