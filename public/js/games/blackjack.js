/* 블랙잭 게임 UI */
GameUI.blackjack = {
  render(c) {
    const fn = this['p_' + c.G.phase];
    return `<div class="stack bj-container">${fn ? fn.call(this, c) : ''}</div>`;
  },

  renderCard(card) {
    if (!card) return '';
    if (card.hidden) {
      return `
        <div class="bj-card hidden" title="딜러의 숨겨진 카드">
          <div class="bj-card-back">
            <span class="back-logo">🎲</span>
            <small>HIDDEN</small>
          </div>
        </div>`;
    }
    const colorClass = card.color === 'red' ? 'red' : 'black';
    const faceIcon = {
      'A': '⭐',
      'K': '👑',
      'Q': '👸',
      'J': '⚔️'
    }[card.rank] || '';

    return `
      <div class="bj-card ${colorClass}">
        <div class="c-corner top">
          <span class="c-rank">${esc(card.rank)}</span>
          <span class="c-suit">${card.suit}</span>
        </div>
        <div class="c-center">
          <span class="c-main-rank">${esc(card.rank)}</span>
          <div class="c-sub-row">
            <span class="c-main-suit">${card.suit}</span>
            ${faceIcon ? `<span class="c-face-icon">${faceIcon}</span>` : ''}
          </div>
        </div>
        <div class="c-corner btm">
          <span class="c-rank">${esc(card.rank)}</span>
          <span class="c-suit">${card.suit}</span>
        </div>
      </div>`;
  },

  p_setup({ G, isHost }) {
    const s = G.settings;
    if (!isHost) {
      return `<div class="glass center">
        <div class="emoji-xl">🃏</div>
        <h3>블랙잭 (21점 승부)</h3>
        <p class="muted">모드: <b>${s.mode === 'bet' ? '💰 점수 배팅 모드' : '🏆 기본 점수제'}</b></p>
        <p class="pulse-text">방장이 게임을 준비하는 중입니다…</p>
      </div>`;
    }

    return `<div class="glass" id="bjSetupForm">
      <h3>🃏 블랙잭 설정</h3>
      <label class="field"><span>게임 모드</span>
        <select name="mode" data-change-send="game.settings" data-collect="#bjSetupForm">
          <option value="fixed" ${s.mode === 'fixed' ? 'selected' : ''}>🏆 기본 점수제 (승리 +1점 / 블랙잭 +2점 / 버스트 -1점)</option>
          <option value="bet" ${s.mode === 'bet' ? 'selected' : ''}>💰 배팅 모드 (1~3점 배팅, 승리 시 2배, 패배 시 상실)</option>
        </select>
      </label>

      ${s.mode === 'fixed' ? `
        <div class="trio">
          <label class="field"><span>승리 점수</span>
            <input type="number" name="winPts" min="1" max="20" value="${s.winPts}" data-change-send="game.settings" data-collect="#bjSetupForm" />
          </label>
          <label class="field"><span>블랙잭 점수</span>
            <input type="number" name="bjPts" min="1" max="30" value="${s.bjPts}" data-change-send="game.settings" data-collect="#bjSetupForm" />
          </label>
          <label class="field"><span>버스트 감점</span>
            <input type="number" name="bustPts" min="0" max="20" value="${s.bustPts}" data-change-send="game.settings" data-collect="#bjSetupForm" />
          </label>
        </div>
        <p class="hint">💡 버스트 감점 1이면 21 넘쳤을 때 -1점이 깎입니다 (0이면 무감점)</p>
      ` : `
        <div class="glass" style="margin:8px 0; background:rgba(251,191,36,.1); border-color:rgba(251,191,36,.3);">
          <b>💰 배팅 모드 룰</b>
          <p class="muted" style="margin:4px 0 0; font-size:.85rem;">
            각자 1~3점을 배팅하고 승리하면 <b>배팅금의 2배</b>를 얻습니다.<br>
            비기면 원금 회수, 지거나 버스트되면 배팅금을 모두 잃습니다.
          </p>
        </div>
      `}

      <button class="btn primary block" data-send="game.start">🎲 블랙잭 시작!</button>
      <p class="hint">딜러(컴퓨터) 룰: 16점 이하는 무조건 히트, 17점 이상은 무조건 스탠드</p>
    </div>`;
  },

  p_betting({ G, isHost }) {
    const myDone = G.myBetDone;
    const bets = [1, 2, 3];

    return `<div class="glass center">
      <div class="emoji-xl">💰</div>
      <h3>배팅할 점수를 선택하세요</h3>
      <p class="muted">이기면 2배! 지면 배팅금을 잃습니다</p>

      <div class="bet-chips">
        ${bets.map((b) => `
          <button class="bet-chip ${G.myBet === b ? 'selected' : ''}" data-send="game.bet" ${pl({ amount: b })} ${myDone ? 'disabled' : ''}>
            🪙 ${b}점
          </button>
        `).join('')}
      </div>

      <p class="verdict-line">${myDone ? `✅ <b>${G.myBet}점</b> 배팅 완료! 다른 유저 대기 중…` : '👆 배팅할 점수 버튼을 누르세요'}</p>
    </div>

    <div class="glass">
      <b>배팅 현황 (${G.players.filter((p) => p.betDone).length}/${G.players.length})</b>
      <div class="chips status" style="margin-top:8px;">
        ${G.players.map((p) => `
          <span class="chip ${p.betDone ? 'ok' : 'wait'}">
            ${p.betDone ? `✓ ${esc(p.name)} (${p.bet}점)` : `⏳ ${esc(p.name)}`}
          </span>
        `).join('')}
      </div>
      ${isHost ? `
        <button class="btn warn block" data-send="game.forceDeal" data-confirm="미배팅 유저는 1점으로 자동 배팅하고 시작할까요?">
          카드 바로 돌리기 (강제 시작)
        </button>
      ` : ''}
    </div>`;
  },

  p_playing({ G }) {
    const myH = G.myHand;
    const sc = myH ? myH.scoreInfo : { score: 0 };
    const myDone = myH ? myH.done : true;

    return `
      <!-- 딜러 카드 영역 -->
      <div class="glass bj-table dealer-box">
        <div class="bj-header">
          <span>🤖 딜러 (컴퓨터)</span>
          <small class="muted">16점 이하 히트 / 17점 이상 스탠드</small>
        </div>
        <div class="bj-cards">
          ${G.dealer.cards.map((c) => this.renderCard(c)).join('')}
        </div>
      </div>

      <!-- 내 카드 영역 -->
      ${myH ? `
        <div class="glass bj-table my-box ${sc.isBust ? 'bust-glow' : sc.isBlackjack ? 'bj-glow' : ''}">
          <div class="bj-header">
            <b>내 카드 ${myH.bet ? `(배팅 ${myH.bet}점)` : ''}</b>
            <div class="score-badge ${sc.isBust ? 'bust' : sc.isBlackjack ? 'bj' : ''}">
              ${sc.isBust ? '💥 BUST (21 초과)' : sc.isBlackjack ? '🌟 BLACKJACK (21)' : `${sc.score}점`}
            </div>
          </div>

          <div class="bj-cards">
            ${myH.cards.map((c) => this.renderCard(c)).join('')}
          </div>

          ${!myDone ? `
            <div class="two-btns big" style="margin-top:14px;">
              <button class="btn primary xl" data-send="game.hit">🃏 히트 (한 장 더)</button>
              <button class="btn ghost xl" data-send="game.stand">✋ 스탠드 (멈춤)</button>
            </div>
          ` : `
            <p class="pulse-text center" style="margin-top:10px;">
              ${sc.isBust ? '버스트되었습니다. 다른 유저들의 플레이를 기다리는 중…' : '스탠드 완료! 다른 유저들이 끝나면 딜러가 카드를 엽니다.'}
            </p>
          `}
        </div>
      ` : ''}

      <!-- 다른 참가자들 진행 현황 -->
      <div class="glass">
        <b>참가자 현황 (${G.players.filter((p) => p.done).length}/${G.players.length})</b>
        <div class="bj-others">
          ${G.players.map((p) => `
            <div class="bj-player-pill ${p.done ? (p.scoreInfo.isBust ? 'bust' : 'done') : 'waiting'}">
              <span>${esc(p.name)}</span>
              <b>${p.scoreInfo.isBust ? '💥 버스트' : p.done ? `${p.scoreInfo.score}점 (스탠드)` : '선택 중…'}</b>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  p_result({ G, isHost }) {
    const dSc = G.dealer.scoreInfo;
    const isBet = G.settings.mode === 'bet';

    return `
      <!-- 딜러 최종 결과 -->
      <div class="glass bj-table dealer-box ${dSc.isBust ? 'bust-glow' : ''}">
        <div class="bj-header">
          <span>🤖 딜러 최종 결과</span>
          <div class="score-badge ${dSc.isBust ? 'bust' : ''}">
            ${dSc.isBust ? `💥 딜러 버스트 (${dSc.score}점)` : `딜러 ${dSc.score}점`}
          </div>
        </div>
        <div class="bj-cards">
          ${G.dealer.cards.map((c) => this.renderCard(c)).join('')}
        </div>
      </div>

      <!-- 플레이어별 승패 결과 리스트 -->
      <div class="glass">
        <h3>🏆 판정 결과</h3>
        <div class="bj-results-list">
          ${G.players.map((p) => {
      const r = G.results[p.id] || { outcome: 'lose', delta: 0, desc: '' };
      const isWin = r.outcome === 'win' || r.outcome === 'blackjack';
      const isPush = r.outcome === 'push';
      const cls = isWin ? 'res-win' : isPush ? 'res-push' : 'res-lose';
      const outcomeName = {
        blackjack: '🌟 블랙잭 대승',
        win: '⭕ 승리',
        push: '🤝 무승부 (Push)',
        lose: '❌ 패배',
        bust: '💥 버스트',
      }[r.outcome] || '종료';

      return `
              <div class="bj-res-row ${cls}">
                <div class="res-who">
                  <b>${esc(p.name)}</b>
                  <small>${p.scoreInfo.isBust ? '21점 초과' : `${p.scoreInfo.score}점`}</small>
                </div>
                <div class="res-tag">${outcomeName}</div>
                <div class="res-delta ${r.delta > 0 ? 'plus' : r.delta < 0 ? 'minus' : ''}">
                  ${r.delta > 0 ? `+${r.delta}점` : r.delta < 0 ? `${r.delta}점` : '0점'}
                </div>
              </div>
            `;
    }).join('')}
        </div>

        ${isHost ? `
          <button class="btn primary block" data-send="game.again">🔁 한 판 더 하기</button>
        ` : '<p class="pulse-text center">방장이 다음 게임을 준비 중입니다…</p>'}
      </div>
    `;
  },
};
