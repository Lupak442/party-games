/* ===== 바퀴벌레 포커 (Cockroach Poker) 게임 클라이언트 UI ===== */
GameUI.cockroach = {
  render(c) {
    const fn = this['p_' + c.G.phase];
    return `<div class="stack cr-container">${fn ? fn.call(this, c) : ''}</div>`;
  },

  /* ---- 1. 대기/설정 화면 (setup) ---- */
  p_setup({ G, isHost }) {
    const s = G.settings;
    return `
      <div class="glass center cr-intro">
        <div class="cr-hero-icon">🪳</div>
        <h2>바퀴벌레 포커</h2>
        <p class="muted">블러핑 심리전! 단 한 명의 꼴찌가 될 때까지 살아남으세요.</p>
      </div>

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
            <b class="text-accent">🎯 승리 & 정산:</b> 꼴찌 1명만 감점되고, <b>나머지 모든 생존자는 승리 가점</b>을 획득합니다!
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
          <small class="muted">승리 시 +${s.winPts}점 / 패배 시 -${s.losePts}점</small>
        </div>
      `}
    `;
  },

  /* ---- 2. 게임 플레이 화면 (play) ---- */
  p_play({ G, me, state }) {
    const isMyTurn = G.activePlayer && G.activePlayer.id === me.id;
    const turn = G.turn;
    const bugs = G.bugs;

    // 턴 관련 상태 판단
    const isReceiver = turn && turn.to.id === me.id;
    const isSender = turn && turn.from.id === me.id;

    return `
      <!-- 1) 직전 턴 결과 안내 (있을 때만) -->
      ${G.lastEvent ? this.renderLastEvent(G.lastEvent) : ''}

      <!-- 2) 메인 액션 카드 (진행 중인 턴 / 내 차례 선택 / 대기) -->
      ${turn ? this.renderTurnBox(turn, me, bugs) : this.renderOfferBox(isMyTurn, G, me, bugs)}

      <!-- 3) 전체 플레이어의 모은 벌레 현황 보드 -->
      <div class="glass cr-tables-board">
        <div class="cr-board-header">
          <b>📊 테이블 수집 현황 (벌레 모음)</b>
          <small class="muted">동물 4장 또는 8종 올컬렉션 시 패배</small>
        </div>

        <div class="cr-players-grid">
          ${G.players.map((p) => this.renderPlayerTable(p, bugs, me.id)).join('')}
        </div>
      </div>

      <!-- 4) 내 손패 (My Hand) -->
      <div class="glass cr-my-hand-container">
        <div class="cr-hand-header">
          <b>내 손패 (${G.myHandCount}장 남음)</b>
          <small class="muted">다른 사람은 볼 수 없어요</small>
        </div>
        <div class="cr-hand-list">
          ${G.myHand.length === 0 ? `
            <div class="muted center" style="padding:12px; width:100%;">손패가 모두 소진되었습니다!</div>
          ` : G.myHand.map((card) => `
            <div class="cr-card-chip">
              <span class="cr-chip-icon">${card.bug.icon}</span>
              <span class="cr-chip-name">${esc(card.bug.name)}</span>
            </div>
          `).join('')}
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
  renderTurnBox(turn, me, bugs) {
    const isReceiver = turn.to.id === me.id;
    const isSender = turn.from.id === me.id;

    // 내가 카드를 받았고 응답할 차례 (참/거짓 맞히기 or 엿보고 넘기기)
    if (isReceiver && turn.stage === 'respond') {
      const canPass = turn.passCandidates && turn.passCandidates.length > 0;
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
                넘길 수 있는 후보: ${turn.passCandidates.map((c) => esc(c.name)).join(', ')}
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
      return `
        <div class="glass cr-action-box pass-glow" id="crPassForm">
          <div class="cr-turn-header">
            <span class="badge warn">👀 카드 엿보기 완료</span>
            <small>다른 사람에게 새로운 주장으로 넘기세요</small>
          </div>

          <div class="cr-secret-reveal">
            <div class="secret-label">비밀 확인 결과 (나만 보임)</div>
            <div class="secret-card">
              <span class="secret-icon">${turn.actualCard.icon}</span>
              <span class="secret-name">${esc(turn.actualCard.name)}</span>
            </div>
          </div>

          <div class="form-group" style="margin-top:12px;">
            <label class="field-title">1. 카드를 넘길 상대 선택</label>
            <div class="cr-radio-chips">
              ${turn.passCandidates.map((cand, idx) => `
                <label class="cr-chip-radio">
                  <input type="radio" name="to" value="${cand.id}" ${idx === 0 ? 'checked' : ''} />
                  <span>${esc(cand.name)}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <div class="form-group" style="margin-top:12px;">
            <label class="field-title">2. 상대에게 뭐라고 주장할까요? (진짜 or 거짓)</label>
            <div class="cr-radio-bugs">
              ${bugs.map((b, idx) => `
                <label class="cr-bug-radio">
                  <input type="radio" name="claim" value="${b.id}" ${b.id === turn.claim.id ? 'checked' : ''} />
                  <span class="b-box">
                    <span class="b-icon">${b.icon}</span>
                    <span class="b-name">${esc(b.name)}</span>
                  </span>
                </label>
              `).join('')}
            </div>
          </div>

          <button class="btn primary block lg" data-collect="#crPassForm" data-send="game.passDeliver" style="margin-top:14px;">
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

  /* 턴 시작 전 (카드 낼 차례인 사람이 카드를 선택해 보내는) 박스 */
  renderOfferBox(isMyTurn, G, me, bugs) {
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
    const opponents = G.players.filter((p) => p.id !== me.id);

    return `
      <div class="glass cr-action-box active-turn-glow" id="crOfferForm">
        <div class="cr-turn-header">
          <span class="badge ok">내 차례! 카드를 보내세요</span>
          <small>손패에서 카드를 골라 상대에게 블러핑하세요</small>
        </div>

        <!-- 1) 보낼 카드 선택 -->
        <div class="form-group" style="margin-top:10px;">
          <label class="field-title">1. 내 손패에서 보낼 카드 선택</label>
          <div class="cr-hand-select-row">
            ${myHand.map((card, idx) => `
              <label class="cr-hand-radio">
                <input type="radio" name="cardId" value="${card.id}" ${idx === 0 ? 'checked' : ''} />
                <span class="hand-card-tile">
                  <span class="tile-icon">${card.bug.icon}</span>
                  <span class="tile-name">${esc(card.bug.name)}</span>
                </span>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- 2) 전달할 상대 선택 -->
        <div class="form-group" style="margin-top:12px;">
          <label class="field-title">2. 카드를 보낼 상대 선택</label>
          <div class="cr-radio-chips">
            ${opponents.map((opp, idx) => `
              <label class="cr-chip-radio">
                <input type="radio" name="to" value="${opp.id}" ${idx === 0 ? 'checked' : ''} />
                <span>${esc(opp.name)} (${opp.handCount}장)</span>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- 3) 상대에게 주장할 동물 선택 -->
        <div class="form-group" style="margin-top:12px;">
          <label class="field-title">3. 상대에게 주장할 동물 선언 (진짜 or 거짓말)</label>
          <div class="cr-radio-bugs">
            ${bugs.map((b, idx) => `
              <label class="cr-bug-radio">
                <input type="radio" name="claim" value="${b.id}" ${idx === 0 ? 'checked' : ''} />
                <span class="b-box">
                  <span class="b-icon">${b.icon}</span>
                  <span class="b-name">${esc(b.name)}</span>
                </span>
              </label>
            `).join('')}
          </div>
        </div>

        <button class="btn primary block lg" data-collect="#crOfferForm" data-send="game.offer" style="margin-top:14px;">
          🃏 상대에게 카드 전달하기
        </button>
      </div>
    `;
  },

  /* 개별 플레이어의 테이블 벌레 컬렉션 카드 렌더러 */
  renderPlayerTable(p, bugs, myId) {
    const isMe = p.id === myId;
    const counts = p.tables || {};

    // 패배 위험도 감지
    // 1) 어떤 벌레가 3장이면 경고
    const danger3Bugs = bugs.filter((b) => (counts[b.id] || 0) === 3);
    // 2) 7종류를 모았으면 올컬렉션 패배 직전(1종류 남음) 경고
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
          <div class="loser-title">최종 꼴찌 (패배자)</div>
          <div class="loser-name">${esc(loser.name)}</div>
          <div class="loser-reason">사유: <b>${esc(loser.reason)}</b></div>
          <div class="loser-penalty">-${G.settings.losePts}점 감점!</div>
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
