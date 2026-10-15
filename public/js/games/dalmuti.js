/* ===== 달무티 (The Great Dalmuti) 게임 클라이언트 UI ===== */
GameUI.dalmuti = {
  // 선택 상태
  selectedCards: new Set(),     // 플레이 중 선택한 카드 ID Set
  taxSelectedCards: new Set(),  // 세금 하사용 선택한 카드 ID Set

  toggleCard(cid) {
    if (this.selectedCards.has(cid)) {
      this.selectedCards.delete(cid);
    } else {
      this.selectedCards.add(cid);
    }
    if (typeof renderRoom === 'function') renderRoom();
  },

  toggleTaxCard(cid, max) {
    if (this.taxSelectedCards.has(cid)) {
      this.taxSelectedCards.delete(cid);
    } else {
      if (this.taxSelectedCards.size >= max) {
        toast(`최대 ${max}장까지만 선택할 수 있어요`, 'warn');
        return;
      }
      this.taxSelectedCards.add(cid);
    }
    if (typeof renderRoom === 'function') renderRoom();
  },

  sendPlayCards() {
    const arr = [...this.selectedCards];
    if (arr.length === 0) return toast('낼 카드를 손패에서 선택해주세요', 'err');
    act('game.play', { cardIds: arr }).then((r) => {
      if (r && r.ok) {
        this.selectedCards.clear();
      }
    });
  },

  sendPass() {
    act('game.pass', {}).then((r) => {
      if (r && r.ok) {
        this.selectedCards.clear();
      }
    });
  },

  sendTaxGive(max) {
    const arr = [...this.taxSelectedCards];
    if (arr.length !== max) return toast(`하사할 카드 ${max}장을 선택해주세요`, 'err');
    act('game.taxGive', { cardIds: arr }).then((r) => {
      if (r && r.ok) {
        this.taxSelectedCards.clear();
      }
    });
  },

  sendRevolution() {
    if (!confirm('조커 2장으로 대혁명을 선언할까요?\n세금 교환이 무효화되고, 대농노라면 계급이 180도 전복됩니다!')) return;
    act('game.revolution', {});
  },

  render(c) {
    const fn = this['p_' + c.G.phase];
    return `<div class="stack dm-container">${fn ? fn.call(this, c) : ''}</div>`;
  },

  /* ---- 1. 대기/설정 화면 (setup) ---- */
  p_setup({ G, isHost, room }) {
    const s = G.settings;
    const count = room.players ? room.players.length : 0;

    return `
      <div class="glass center dm-intro">
        <div class="dm-crown-icon">👑</div>
        <h2>달무티 (The Great Dalmuti)</h2>
        <p class="muted">"인생은 불공평합니다!"<br/>계급 서열과 세금 징수의 명작 카드게임</p>
        <div class="dm-limit-badge">👥 3~8인 플레이 (현재 ${count}명 대기 중 ${count > 8 ? '· 8명 초과 시 관전' : ''})</div>
      </div>

      <div class="glass dm-rules-box">
        <h4 style="margin:0 0 10px 0;">📜 게임 규칙 & 신분제 서열</h4>
        <ul class="dm-rules-list">
          <li>
            <b class="text-gold">👑 계급 서열:</b> 
            달무티왕(1등) ➔ 총리대신(2등) ➔ 평민 ➔ 소농노 ➔ 대농노(꼴찌)
          </li>
          <li>
            <b class="text-accent">🔄 자리 배치 & 순번:</b> 
            매 라운드가 끝나면 등수에 따라 <b>달무티의 왼쪽부터 시계 방향으로 신분순으로 다시 앉고, 달무티부터 선</b>이 됩니다!
          </li>
          <li>
            <b class="text-danger">💰 세금 징수 룰 (2라운드부터):</b>
            대농노는 가장 좋은 카드 2장 자동 상납(달무티는 2장 하사), 
            소농노는 가장 좋은 카드 1장 자동 상납(총리는 1장 하사)!
          </li>
          <li>
            <b class="text-gold">🃏 조커 대혁명:</b> 
            조커 2장을 모두 손에 쥐면 <b>대혁명</b>을 일으켜 세금을 무효화할 수 있으며, 대농노가 쥐면 <b>신분이 180도 역전</b>됩니다!
          </li>
        </ul>
      </div>

      ${isHost ? `
        <div class="glass dm-settings-box" id="dmSetupForm">
          <h4 style="margin:0 0 12px 0;">⚙️ 라운드 설정</h4>
          <label class="field">
            <span>진행할 총 라운드 수</span>
            <input type="number" name="totalRounds" value="${s.totalRounds}" min="1" max="10" />
          </label>
          <button class="btn block" data-collect="#dmSetupForm" data-send="game.settings" style="margin-top:6px;">
            설정 저장
          </button>
        </div>

        <button class="btn primary xl block" data-send="game.start">
          👑 달무티 게임 시작하기
        </button>
      ` : `
        <div class="glass center">
          <p class="pulse-text">방장이 게임을 준비 중입니다…</p>
          <small class="muted">총 ${s.totalRounds}라운드 진행</small>
        </div>
      `}
    `;
  },

  /* ---- 2. 세금 교환 화면 (tax) ---- */
  p_tax({ G, me }) {
    const myId = typeof me === 'object' && me ? me.id : me;
    const tax = G.tax;
    if (!tax) return '';

    const isDalmuti = tax.isDalmuti;
    const isMinister = tax.isMinister;
    const isGPeon = tax.isGPeon;
    const isLPeon = tax.isLPeon;
    const myHand = G.myHand || [];

    return `
      <div class="glass center dm-tax-banner">
        <div class="emoji-xl">💰</div>
        <h2>제${G.currentRound}라운드 세금 징수 & 교환</h2>
        <p class="muted">신분에 따른 불공평한 카드 교환 시간입니다!</p>
      </div>

      <!-- 세금 상납 현황 브리핑 -->
      <div class="glass dm-tax-status">
        <h4 style="margin:0 0 10px 0;">📜 자동 세금 상납 현황</h4>
        <div class="tax-row">
          <span class="tax-from">대농노 🌾</span>
          <span class="tax-arrow">➔ (최고 카드 2장 상납) ➔</span>
          <span class="tax-to">달무티왕 👑</span>
        </div>
        ${tax.dalmutiReceived && tax.dalmutiReceived.length > 0 ? `
          <div class="tax-cards-pill">
            상납된 카드: ${tax.dalmutiReceived.map((c) => `<span class="dm-mini-card r-${c.rank}">${c.icon} ${c.rank}번</span>`).join(' ')}
          </div>
        ` : ''}

        ${tax.ministerReceived && tax.ministerReceived.length > 0 ? `
          <div class="tax-row" style="margin-top:10px;">
            <span class="tax-from">소농노 🧹</span>
            <span class="tax-arrow">➔ (최고 카드 1장 상납) ➔</span>
            <span class="tax-to">총리 📜</span>
          </div>
          <div class="tax-cards-pill">
            상납된 카드: ${tax.ministerReceived.map((c) => `<span class="dm-mini-card r-${c.rank}">${c.icon} ${c.rank}번</span>`).join(' ')}
          </div>
        ` : ''}
      </div>

      <!-- 내 신분별 세금 조작창 -->
      ${isDalmuti ? `
        <div class="glass dm-tax-action-box">
          <div class="badge gold">달무티왕 👑</div>
          ${tax.dalmutiDone ? `
            <div class="center" style="padding:16px 0;">
              <div class="ok-text" style="font-size:1.1rem; font-weight:bold;">✅ 대농노에게 하사할 카드 2장을 전달했습니다!</div>
              <p class="muted">다른 참가자의 세금 교환이 끝나길 기다리는 중입니다…</p>
            </div>
          ` : `
            <h3 style="margin:8px 0 4px 0;">대농노에게 하사할 카드 2장을 선택하세요</h3>
            <p class="muted">선택됨: ${this.taxSelectedCards.size}/2장</p>

            <div class="dm-hand-grid" style="margin:12px 0;">
              ${myHand.map((c) => {
                const isSel = this.taxSelectedCards.has(c.id);
                return `
                  <button type="button" class="dm-card-tile r-${c.rank} ${isSel ? 'selected' : ''}" onclick="GameUI.dalmuti.toggleTaxCard('${c.id}', 2)">
                    <span class="c-rank-badge">${c.rank === 13 ? '🃏' : c.rank}</span>
                    <span class="c-icon">${c.icon}</span>
                    <span class="c-name">${esc(c.name)}</span>
                    ${isSel ? '<span class="c-check">하사</span>' : ''}
                  </button>
                `;
              }).join('')}
            </div>

            <button class="btn primary lg block" onclick="GameUI.dalmuti.sendTaxGive(2)" ${this.taxSelectedCards.size === 2 ? '' : 'disabled'}>
              대농노에게 카드 2장 하사하기
            </button>
          `}
        </div>
      ` : isMinister ? `
        <div class="glass dm-tax-action-box">
          <div class="badge accent">총리 📜</div>
          ${tax.ministerDone ? `
            <div class="center" style="padding:16px 0;">
              <div class="ok-text" style="font-size:1.1rem; font-weight:bold;">✅ 소농노에게 하사할 카드 1장을 전달했습니다!</div>
              <p class="muted">다른 참가자의 세금 교환이 끝나길 기다리는 중입니다…</p>
            </div>
          ` : `
            <h3 style="margin:8px 0 4px 0;">소농노에게 하사할 카드 1장을 선택하세요</h3>
            <p class="muted">선택됨: ${this.taxSelectedCards.size}/1장</p>

            <div class="dm-hand-grid" style="margin:12px 0;">
              ${myHand.map((c) => {
                const isSel = this.taxSelectedCards.has(c.id);
                return `
                  <button type="button" class="dm-card-tile r-${c.rank} ${isSel ? 'selected' : ''}" onclick="GameUI.dalmuti.toggleTaxCard('${c.id}', 1)">
                    <span class="c-rank-badge">${c.rank === 13 ? '🃏' : c.rank}</span>
                    <span class="c-icon">${c.icon}</span>
                    <span class="c-name">${esc(c.name)}</span>
                    ${isSel ? '<span class="c-check">하사</span>' : ''}
                  </button>
                `;
              }).join('')}
            </div>

            <button class="btn primary lg block" onclick="GameUI.dalmuti.sendTaxGive(1)" ${this.taxSelectedCards.size === 1 ? '' : 'disabled'}>
              소농노에게 카드 1장 하사하기
            </button>
          `}
        </div>
      ` : isGPeon ? `
        <div class="glass center dm-tax-notice-box">
          <div class="badge brown">대농노 🌾</div>
          <h3 style="margin:10px 0 4px 0;">최고 카드 2장이 달무티에게 자동 상납되었습니다!</h3>
          <p class="muted">달무티가 자비롭게 하사해줄 카드 2장을 기다리는 중입니다…</p>
        </div>
      ` : isLPeon ? `
        <div class="glass center dm-tax-notice-box">
          <div class="badge orange">소농노 🧹</div>
          <h3 style="margin:10px 0 4px 0;">최고 카드 1장이 총리에게 자동 상납되었습니다!</h3>
          <p class="muted">총리가 자비롭게 하사해줄 카드 1장을 기다리는 중입니다…</p>
        </div>
      ` : `
        <div class="glass center">
          <div class="badge muted">평민 🍺</div>
          <p class="pulse-text" style="margin-top:10px;">달무티와 총리의 세금 징수가 진행 중입니다…</p>
          <small class="muted">평민 계급은 세금 징수/상납 대상이 아닙니다.</small>
        </div>
      `}

      <!-- 조커 2장 보유자 대혁명 선언 버튼 -->
      ${tax.canRevolution ? `
        <div class="glass center dm-revolution-box">
          <h3 class="text-danger" style="margin:0 0 6px 0;">🔥 조커 2장 보유! 대혁명 가능</h3>
          <p class="muted">대혁명을 선언하여 세금 교환을 엎을 수 있습니다!</p>
          <button class="btn danger lg block" onclick="GameUI.dalmuti.sendRevolution()">
            🔥 대혁명 선언하기!
          </button>
        </div>
      ` : ''}
    `;
  },

  /* ---- 3. 게임 플레이 화면 (play) ---- */
  p_play({ G, me }) {
    const myId = typeof me === 'object' && me ? me.id : me;
    const isMyTurn = G.isMyTurn;
    const trick = G.trick;
    const myHand = G.myHand || [];
    const isSpectator = G.isSpectator;

    return `
      <!-- 관전자 안내 -->
      ${isSpectator ? `
        <div class="glass cr-spectator-banner">
          <div class="spec-icon">👀</div>
          <div class="spec-info">
            <b>달무티 관전 중</b>
            <small>플레이어들의 계급 투쟁을 관전하고 있습니다.</small>
          </div>
        </div>
      ` : ''}

      <!-- 혁명 발생 배너 -->
      ${G.revolution ? `
        <div class="glass dm-revolution-alert ${G.revolution.type}">
          <div class="rev-icon">${G.revolution.type === 'overthrow' ? '⚡' : '🔥'}</div>
          <div class="rev-info">
            <b>${G.revolution.type === 'overthrow' ? '대반란 발생! 신분 180도 전복!' : '대혁명 발생! 이번 라운드 세금 면제!'}</b>
            <small>${G.revolution.type === 'overthrow' ? '대농노가 조커 2장으로 혁명을 일으켜 모든 계급 서열이 완전히 뒤집혔습니다!' : '조커 2장을 가진 자의 대혁명 선언으로 이번 라운드 세금이 전격 면제되었습니다!'}</small>
          </div>
        </div>
      ` : ''}

      <!-- 상단: 👑 계급 서열 및 원탁 좌석도 -->
      <div class="glass dm-roundtable-box">
        <div class="dm-roundtable-head">
          <b>👑 제${G.currentRound}/${G.settings.totalRounds}R 계급 서열 & 좌석도</b>
          <small class="muted">달무티부터 시계 방향 순번</small>
        </div>
        <div class="dm-seats-row">
          ${G.seats.map((seat) => {
            const isMe = seat.id === myId;
            return `
              <div class="dm-seat-card ${seat.title.class} ${seat.isActive ? 'turn-active' : ''} ${seat.isTurnPassed ? 'passed' : ''} ${isMe ? 'is-me' : ''}">
                <div class="seat-title-badge">${seat.title.icon} ${seat.title.name}</div>
                <div class="seat-name">${isMe ? '🙋 ' : ''}${esc(seat.name)}</div>
                <div class="seat-status">
                  ${seat.isFinished ? `
                    <span class="badge ok">탈출! ${seat.finishRank}위</span>
                  ` : `
                    <span class="seat-hand-count">🃏 ${seat.handCount}장</span>
                  `}
                </div>
                ${seat.isActive ? '<span class="seat-turn-arrow">▼ 턴</span>' : ''}
                ${seat.isTurnPassed && !seat.isFinished ? '<span class="seat-pass-tag">패스</span>' : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 중앙: 바닥에 나온 트릭 카드 -->
      <div class="glass dm-trick-box">
        ${trick ? `
          <div class="trick-info">
            <span class="badge accent">${esc(trick.lastPlayerName)}</span> 님이 낸 카드
          </div>
          <div class="trick-cards-display">
            <div class="trick-main-desc">
              ${trick.cards[0].icon} <b>${trick.rankValue}번 (${trick.cards[0].name})</b> x <b>${trick.count}장</b>
            </div>
            <div class="trick-cards-visual">
              ${trick.cards.map((c) => `
                <div class="dm-field-card r-${c.origRank}">
                  <span class="fc-rank">${c.origRank === 13 ? '🃏' : c.origRank}</span>
                  <span class="fc-icon">${c.icon}</span>
                  <small>${c.isJoker ? '조커' : c.name}</small>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="trick-rule-hint">
            👉 다음 사람은 같은 <b>${trick.count}장</b>이면서 <b>${trick.rankValue}보다 낮은 숫자(더 높은 계급)</b>를 내야 합니다!
          </div>
        ` : `
          <div class="trick-empty center">
            <div class="empty-sparkle">✨</div>
            <h3>바닥이 비었습니다 (새로운 선)</h3>
            <p class="muted">
              ${G.activePlayer ? `<b>${esc(G.activePlayer.name)}</b> 님이 원하는 카드 세트를 낼 차례입니다.` : ''}
            </p>
          </div>
        `}
      </div>

      <!-- 내 차례 조작 버튼 영역 -->
      ${!isSpectator ? `
        <div class="glass dm-action-panel ${isMyTurn ? 'my-turn-glow' : ''}">
          <div class="action-status-line">
            ${isMyTurn ? `
              <span class="badge ok pulse">🎯 내 차례입니다!</span>
              <small>아래 손패에서 카드를 선택하세요</small>
            ` : `
              <span class="badge muted">대기 중</span>
              <small><b>${esc(G.activePlayer ? G.activePlayer.name : '다른 플레이어')}</b> 님의 차례입니다</small>
            `}
          </div>

          ${isMyTurn ? `
            <div class="dm-action-btns">
              <button class="btn primary lg flex-1" onclick="GameUI.dalmuti.sendPlayCards()" ${this.selectedCards.size > 0 ? '' : 'disabled'}>
                🃏 선택한 카드 ${this.selectedCards.size}장 내기
              </button>
              ${trick ? `
                <button class="btn warn lg" onclick="GameUI.dalmuti.sendPass()">
                  패스 (Pass)
                </button>
              ` : ''}
            </div>
          ` : ''}
        </div>

        <!-- 내 손패 영역 -->
        <div class="glass dm-my-hand-container">
          <div class="dm-hand-head">
            <b>내 손패 (${G.myHandCount}장)</b>
            <small class="muted">터치하여 카드를 선택/해제하세요 (조커 조합 가능)</small>
          </div>

          <div class="dm-hand-grid">
            ${myHand.length === 0 ? `
              <div class="muted center" style="padding:16px; width:100%;">🎉 손패를 모두 털어냈습니다!</div>
            ` : myHand.map((c) => {
              const isSel = this.selectedCards.has(c.id);
              return `
                <button type="button" 
                        class="dm-card-tile r-${c.rank} ${isSel ? 'selected' : ''}" 
                        onclick="GameUI.dalmuti.toggleCard('${c.id}')">
                  <span class="c-rank-badge">${c.rank === 13 ? '🃏' : c.rank}</span>
                  <span class="c-icon">${c.icon}</span>
                  <span class="c-name">${esc(c.name)}</span>
                  ${isSel ? '<span class="c-check">선택됨</span>' : ''}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    `;
  },

  /* ---- 4. 라운드 종료 화면 (roundEnd) ---- */
  p_roundEnd({ G, isHost }) {
    const results = G.roundResults || [];

    return `
      <div class="glass center dm-end-banner">
        <div class="emoji-xl">🏆</div>
        <h2>제${G.currentRound}라운드 종료!</h2>
        <p class="muted">탈출 순서에 따라 다음 라운드의 새로운 계급이 확정되었습니다.</p>
      </div>

      <div class="glass dm-results-table">
        <h4 style="margin:0 0 12px 0;">📊 신분 변동 & 라운드 점수 결과</h4>
        <div class="dm-results-list">
          ${results.map((r) => {
            const diff = r.prevRank ? r.prevRank - r.rank : null;
            let moveTag = '';
            if (diff !== null) {
              if (diff > 0) moveTag = `<span class="badge ok">▲ +${diff} 승급</span>`;
              else if (diff < 0) moveTag = `<span class="badge danger">▼ ${diff} 강등</span>`;
              else moveTag = `<span class="badge muted">= 유지</span>`;
            }
            return `
              <div class="dm-res-row ${r.title.class}">
                <div class="res-rank-col">
                  <span class="res-rank-num">${r.rank}위</span>
                  <span class="res-title-badge">${r.title.icon} ${r.title.name}</span>
                </div>
                <div class="res-name-col">
                  <b>${esc(r.name)}</b>
                  <div class="res-move-wrap">
                    ${moveTag}
                    ${r.prevTitle ? `<small class="muted">이전: ${r.prevTitle.name}</small>` : ''}
                  </div>
                </div>
                <div class="res-score-col">
                  <span class="res-round-pts">+${r.roundScore}점</span>
                  <small class="muted">총 ${r.totalScore}점</small>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        ${isHost ? `
          <button class="btn primary lg block" data-send="game.nextRound" style="margin-top:16px;">
            👑 제${G.currentRound + 1}라운드 시작하기 (신분순 자리 재배치)
          </button>
        ` : `
          <p class="pulse-text" style="margin-top:16px;">방장이 다음 라운드를 준비 중입니다…</p>
        `}
      </div>
    `;
  },

  /* ---- 5. 최종 게임 종료 화면 (gameEnd) ---- */
  p_gameEnd({ G, isHost }) {
    const results = G.roundResults || [];
    const winner = results[0];

    return `
      <div class="glass center dm-gameover-card">
        <div class="dm-crown-icon" style="font-size:4rem;">👑</div>
        <h1 class="text-gold" style="margin:4px 0;">최종 달무티 대관식</h1>
        <p class="muted">모든 라운드가 종료되었습니다!</p>

        <div class="dm-winner-box">
          <div class="winner-title">👑 최고 권력자 (최종 우승자)</div>
          <div class="winner-name">${winner ? esc(winner.name) : '우승자'}</div>
          <div class="winner-score">${winner ? winner.totalScore : 0}점</div>
        </div>

        <div class="dm-results-list" style="margin:16px 0;">
          ${results.map((r) => `
            <div class="dm-res-row ${r.title.class}">
              <div class="res-rank-col">${r.rank}위 ${r.title.icon}</div>
              <div class="res-name-col"><b>${esc(r.name)}</b></div>
              <div class="res-score-col"><b>${r.totalScore}점</b></div>
            </div>
          `).join('')}
        </div>

        ${isHost ? `
          <button class="btn primary lg block" data-send="game.again">
            🔄 달무티 새 게임 시작하기
          </button>
        ` : `
          <p class="pulse-text">방장이 새 게임을 준비 중입니다…</p>
        `}
      </div>
    `;
  },
};
