/* ===== 카멜레온 (The Chameleon) 게임 클라이언트 UI ===== */
GameUI.chameleon = {
  selectedVote: null,
  selectedGuessWord: null,

  selectVote(targetId) {
    this.selectedVote = targetId;
    if (typeof renderRoom === 'function') renderRoom();
  },

  sendVote() {
    if (!this.selectedVote) return toast('지목할 플레이어를 선택해주세요', 'err');
    act('game.vote', { targetId: this.selectedVote }).then((r) => {
      if (r && r.ok) {
        toast('투표를 완료했습니다!', 'ok');
      }
    });
  },

  submitClue() {
    const input = document.getElementById('cmClueInput');
    if (!input) return;
    const clue = input.value.trim();
    if (!clue) return toast('힌트 단어를 입력해주세요', 'err');
    act('game.submitClue', { clue }).then((r) => {
      if (r && r.ok) {
        input.value = '';
      }
    });
  },

  selectGuessWord(word) {
    this.selectedGuessWord = word;
    if (typeof renderRoom === 'function') renderRoom();
  },

  sendGuessWord() {
    if (!this.selectedGuessWord) return toast('추리할 비밀 단어를 선택해주세요', 'err');
    act('game.guessWord', { word: this.selectedGuessWord }).then((r) => {
      if (r && r.ok) {
        this.selectedGuessWord = null;
      }
    });
  },

  render(c) {
    const fn = this['p_' + c.G.phase];
    return `<div class="stack cm-container">${fn ? fn.call(this, c) : ''}</div>`;
  },

  /* 1. 대기 및 설정 화면 (setup) */
  p_setup({ G, isHost, room }) {
    const s = G.settings;
    const count = room.players ? room.players.length : 0;
    const packs = G.topicPacks || [];

    return `
      <div class="glass center cm-intro">
        <div class="cm-chameleon-icon">🦎</div>
        <h2>카멜레온 (The Chameleon)</h2>
        <p class="muted">"비밀 단어를 모르는 위장자는 누구인가?"<br/>16개 단어 속 고도의 눈치와 블러핑 파티게임</p>
        <div class="cm-limit-badge">👥 3~12인 플레이 (현재 ${count}명 대기 중 ${count > 12 ? '· 12명 초과 시 관전' : ''})</div>
      </div>

      <div class="glass cm-rules-box">
        <h4 style="margin:0 0 10px 0;">📜 게임 규칙 한눈에 보기</h4>
        <ul class="cm-rules-list">
          <li>
            <b class="text-accent">16개 단어 판:</b> 모든 사람에게 16개 단어가 적힌 주제 카드가 공개됩니다.
          </li>
          <li>
            <b class="text-ok">시민 vs 카멜레온:</b> 시민은 비밀 단어를 알고 시작하지만, 카멜레온은 비밀 단어를 모른 채 위장해야 합니다!
          </li>
          <li>
            <b class="text-gold">단 한 마디 힌트:</b> 순서대로 돌아가며 비밀 단어를 연상시키는 '한 단어'씩 말합니다.
          </li>
          <li>
            <b class="text-danger">투표 & 최후의 역전 찬스:</b> 카멜레온으로 지목되더라도, 16개 단어 중 <b>비밀 단어를 맞히면 극적 역전승!</b>
          </li>
        </ul>
      </div>

      ${isHost ? `
        <div class="glass cm-settings-box" id="cmSetupForm">
          <h4 style="margin:0 0 12px 0;">⚙️ 게임 설정</h4>
          <label class="field">
            <span>진행할 총 라운드 수</span>
            <input type="number" name="totalRounds" value="${s.totalRounds}" min="1" max="10" />
          </label>
          <label class="field">
            <span>카멜레온 인원</span>
            <select name="chameleonCount">
              <option value="1" ${s.chameleonCount === 1 ? 'selected' : ''}>1명 (기본)</option>
              <option value="2" ${s.chameleonCount === 2 ? 'selected' : ''}>2명 (6인 이상 추천)</option>
            </select>
          </label>
          <label class="field">
            <span>힌트 발언 방식</span>
            <select name="clueMode">
              <option value="turn" ${s.clueMode === 'turn' ? 'selected' : ''}>순서대로 1단어 텍스트 입력</option>
              <option value="free" ${s.clueMode === 'free' ? 'selected' : ''}>자유 음성 발언 후 바로 토론</option>
            </select>
          </label>
          <label class="field">
            <span>주제 카테고리</span>
            <select name="category">
              <option value="random" ${s.category === 'random' ? 'selected' : ''}>🎲 무작위 랜덤 주제</option>
              ${packs.map((pk) => `<option value="${pk.id}" ${s.category === pk.id ? 'selected' : ''}>${pk.icon} ${pk.name}</option>`).join('')}
            </select>
          </label>
          <button class="btn block" data-collect="#cmSetupForm" data-send="game.settings" style="margin-top:6px;">
            설정 저장
          </button>
        </div>

        <button class="btn primary xl block" data-send="game.start">
          🦎 카멜레온 게임 시작하기
        </button>
      ` : `
        <div class="glass center">
          <p class="pulse-text">방장이 게임을 준비 중입니다…</p>
          <small class="muted">총 ${s.totalRounds}라운드 진행 · 카멜레온 ${s.chameleonCount}명</small>
        </div>
      `}
    `;
  },

  /* 2. 카드 & 역할 확인 화면 (card) */
  p_card({ G, me }) {
    const myId = typeof me === 'object' && me ? me.id : me;
    const isChameleon = G.isChameleon;
    const myStatus = G.participants.find((p) => p.id === myId);
    const isReady = myStatus ? myStatus.isReady : false;

    return `
      <!-- 역할 공개 배너 -->
      <div class="glass cm-role-card ${isChameleon ? 'role-chameleon' : 'role-civilian'}">
        <div class="role-icon">${isChameleon ? '🦎' : '🕵️'}</div>
        <div class="role-desc">
          <div class="role-badge">${isChameleon ? '위장자' : '일반 시민'}</div>
          <h2>${isChameleon ? '당신은 카멜레온입니다!' : '당신은 시민입니다!'}</h2>
          ${isChameleon ? `
            <p class="role-hint">비밀 단어를 모릅니다! 16개 단어와 앞사람 힌트를 보고 정체를 들키지 않게 둘러대세요.</p>
          ` : `
            <p class="role-hint">이번 라운드 비밀 단어: <b class="secret-highlight">${esc(G.secretWord)}</b></p>
          `}
        </div>
      </div>

      <!-- 4x4 단어 그리드 판 -->
      ${this.renderWordGrid(G, false)}

      <!-- 준비 완료 버튼 영역 -->
      <div class="glass center cm-ready-box">
        ${isReady ? `
          <div class="ok-text" style="font-size:1.15rem; font-weight:800; margin-bottom:6px;">
            ✅ 확인 완료! 다른 플레이어를 기다리는 중…
          </div>
        ` : `
          <button class="btn primary xl block" data-send="game.ready">
            👌 역할 및 단어 확인 완료 (준비)
          </button>
        `}

        <div class="cm-ready-tags" style="margin-top:12px;">
          ${G.participants.map((p) => `
            <span class="tag ${p.isReady ? 'ok' : 'muted'}">
              ${p.isReady ? '✓ ' : ''}${esc(p.name)}
            </span>
          `).join(' ')}
        </div>
      </div>
    `;
  },

  /* 3. 한 단어 힌트 단계 (clue) */
  p_clue({ G, me, isHost }) {
    const isMyTurn = G.isMyTurn;
    const activePlayer = G.turnOrder.find((p) => p.id === G.activePlayerId);

    return `
      <!-- 상단 단어 그리드 -->
      ${this.renderWordGrid(G, false)}

      <!-- 차례 및 상태 알림 -->
      <div class="glass center cm-turn-banner ${isMyTurn ? 'my-turn-glow' : ''}">
        ${isMyTurn ? `
          <div class="badge ok pulse">🎯 당신의 차례입니다!</div>
          <h3 style="margin:8px 0 4px 0;">비밀 단어를 연상시키는 '단 하나의 단어'를 입력하세요</h3>
          <small class="muted">${G.isChameleon ? '카멜레온 팁: 그럴듯하게 둘러대어 의심을 피하세요!' : '시민 팁: 카멜레온이 눈치채지 못하도록 너무 뻔하지 않게!'}</small>
        ` : `
          <div class="badge muted">힌트 발표 중</div>
          <h3 style="margin:8px 0 4px 0;"><b>${esc(activePlayer ? activePlayer.name : '')}</b> 님이 힌트를 작성 중입니다…</h3>
        `}
      </div>

      <!-- 내 턴일 때 힌트 입력창 -->
      ${isMyTurn ? `
        <div class="glass cm-clue-input-box">
          <div class="cm-input-row">
            <input type="text" id="cmClueInput" maxlength="20" placeholder="힌트 단어 1개 입력 (예: 바삭함, 초록색)" onkeydown="if(event.key==='Enter') GameUI.chameleon.submitClue()" />
            <button class="btn primary lg" onclick="GameUI.chameleon.submitClue()">제출</button>
          </div>
        </div>
      ` : ''}

      <!-- 실시간 힌트 타임라인 리스트 -->
      <div class="glass cm-clues-timeline">
        <h4 style="margin:0 0 10px 0;">💬 플레이어 힌트 목록</h4>
        <div class="cm-clues-list">
          ${G.turnOrder.map((p) => {
            const clue = G.participants.find((x) => x.id === p.id)?.clue;
            const isCurrent = p.id === G.activePlayerId;
            return `
              <div class="cm-clue-item ${isCurrent ? 'current-speaker' : ''} ${clue ? 'has-clue' : ''}">
                <div class="clue-user">${esc(p.name)}</div>
                <div class="clue-bubble">
                  ${clue ? `<b>"${esc(clue)}"</b>` : isCurrent ? '<span class="pulse-text">작성 중…</span>' : '<span class="muted">대기</span>'}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      ${isHost ? `
        <button class="btn warn block" data-send="game.startDebate" style="margin-top:6px;">
          ⏩ 힌트 단계 건너뛰고 바로 토론/투표 시작하기
        </button>
      ` : ''}
    `;
  },

  /* 4. 토론 및 투표 단계 (debate) */
  p_debate({ G, me, isHost }) {
    const myId = typeof me === 'object' && me ? me.id : me;
    const isSpectator = G.isSpectator;
    const myVote = G.myVote;

    return `
      <!-- 단어 그리드 & 힌트 타임라인 요약 -->
      ${this.renderWordGrid(G, false)}

      <!-- 힌트 요약 바 -->
      <div class="glass cm-clues-summary">
        <div class="summary-title">💬 모두가 낸 힌트 단어:</div>
        <div class="summary-chips">
          ${G.participants.filter((p) => p.clue).map((p) => `
            <span class="clue-chip">
              <span class="chip-name">${esc(p.name)}</span>: <b>"${esc(p.clue)}"</b>
            </span>
          `).join('')}
        </div>
      </div>

      <!-- 투표 조작 패널 -->
      <div class="glass cm-vote-panel">
        <div class="center" style="margin-bottom:12px;">
          <div class="badge danger">🔥 카멜레온 색출 투표</div>
          <h2 style="margin:6px 0 2px 0;">누가 카멜레온인가요?</h2>
          <p class="muted">의심되는 사람 1명을 선택하고 투표하세요! (${G.voteCount}/${G.participants.length}명 투표 완료)</p>
        </div>

        ${!isSpectator ? `
          <div class="cm-vote-candidates">
            ${G.participants.map((p) => {
              const isSelf = p.id === myId;
              const isSelected = this.selectedVote === p.id;
              const hasVotedForThis = myVote === p.id;

              return `
                <button type="button" 
                        class="cm-candidate-card ${isSelected ? 'selected' : ''} ${hasVotedForThis ? 'voted' : ''}" 
                        onclick="GameUI.chameleon.selectVote('${p.id}')"
                        ${isSelf ? 'disabled' : ''}>
                  <div class="cand-name">${esc(p.name)} ${isSelf ? '<small>(나)</small>' : ''}</div>
                  <div class="cand-clue">${p.clue ? `"${esc(p.clue)}"` : '힌트 없음'}</div>
                  ${hasVotedForThis ? '<span class="badge ok cand-badge">내가 투표함</span>' : isSelected ? '<span class="badge accent cand-badge">선택됨</span>' : ''}
                </button>
              `;
            }).join('')}
          </div>

          <button class="btn danger xl block" onclick="GameUI.chameleon.sendVote()" style="margin-top:14px;" ${this.selectedVote ? '' : 'disabled'}>
            🗳️ 카멜레온으로 지목 투표하기
          </button>
        ` : `
          <div class="muted center">관전 중에는 투표할 수 없습니다.</div>
        `}

        ${isHost ? `
          <button class="btn warn block" data-send="game.forceTally" style="margin-top:10px;">
            ⚡ 즉시 투표 마감하고 결과 보기
          </button>
        ` : ''}
      </div>
    `;
  },

  /* 5. 카멜레온의 최후 추리 단계 (guess) */
  p_guess({ G, me }) {
    const isChameleon = G.isChameleon;
    const vRes = G.voteResult;

    return `
      <!-- 검거 성공 알림 배너 -->
      <div class="glass center cm-guess-banner">
        <div class="emoji-xl">🎯</div>
        <h2 class="text-danger">카멜레온 검거 성공!</h2>
        <p class="muted">
          최다 득표로 지목된 플레이어: <b>${esc(vRes.topNames.join(', '))}</b>
        </p>
      </div>

      <!-- 카멜레온 전용 역전 추리창 -->
      ${isChameleon ? `
        <div class="glass cm-chameleon-guess-box">
          <div class="badge gold" style="font-size:0.9rem;">🔥 최후의 대역전 찬스!</div>
          <h3 style="margin:10px 0 4px 0;">아래 16개 단어 중 이번 라운드의 '비밀 단어'를 맞히세요!</h3>
          <p class="muted">맞히면 카멜레온의 대역전승 (+2점)이 됩니다!</p>

          <div class="cm-guess-grid" style="margin:16px 0;">
            ${(G.topic.words || []).map((word) => {
              const isSel = this.selectedGuessWord === word;
              return `
                <button type="button" 
                        class="cm-guess-tile ${isSel ? 'selected' : ''}" 
                        onclick="GameUI.chameleon.selectGuessWord('${word}')">
                  <span class="guess-word">${esc(word)}</span>
                  ${isSel ? '<span class="guess-check">✓ 선택</span>' : ''}
                </button>
              `;
            }).join('')}
          </div>

          <button class="btn primary xl block" onclick="GameUI.chameleon.sendGuessWord()" ${this.selectedGuessWord ? '' : 'disabled'}>
            🎯 선택한 단어로 최후의 추리 제출하기
          </button>
        </div>
      ` : `
        <div class="glass center" style="padding:28px 16px;">
          <div class="pulse-text" style="font-size:1.2rem; font-weight:800;">
            🦎 카멜레온이 비밀 단어를 추리 중입니다…
          </div>
          <p class="muted" style="margin-top:6px;">과연 카멜레온이 16개 단어 중 진짜 비밀 단어를 맞힐 수 있을까요?</p>
        </div>
      `}

      <!-- 힌트 목록 복습 -->
      <div class="glass cm-clues-summary">
        <div class="summary-title">💬 이번 라운드 플레이어 힌트:</div>
        <div class="summary-chips">
          ${G.participants.filter((p) => p.clue).map((p) => `
            <span class="clue-chip"><span class="chip-name">${esc(p.name)}</span>: <b>"${esc(p.clue)}"</b></span>
          `).join('')}
        </div>
      </div>
    `;
  },

  /* 6. 라운드 종료 화면 (roundEnd) */
  p_roundEnd({ G, isHost }) {
    const isChamWin = G.roundWinner === 'chameleon';
    const reason = G.roundReason;
    const chamNames = G.chameleonNames.join(', ');

    return `
      <div class="glass center cm-end-banner ${isChamWin ? 'win-chameleon' : 'win-civilians'}">
        <div class="emoji-xl">${isChamWin ? '🦎' : '🎉'}</div>
        <h2>${isChamWin ? '카멜레온의 승리!' : '시민들의 완벽한 승리!'}</h2>
        <div class="cm-end-desc">
          ${reason === 'escaped' ? `
            <b class="text-gold">카멜레온 위장 성공!</b> 시민들이 엉뚱한 사람을 지목하여 카멜레온이 무사히 탈출했습니다. (+3점)
          ` : reason === 'caught_correct_guess' ? `
            <b class="text-gold">카멜레온 대역전승!</b> 정체가 들통났지만 비밀 단어를 정확히 맞혔습니다! (+2점)
          ` : `
            <b class="text-ok">시민 승리!</b> 카멜레온을 완벽히 검거하고 비밀 단어 방어에도 성공했습니다! (시민 각 +2점)
          `}
        </div>

        <div class="cm-truth-box">
          <div class="truth-item">
            <span class="truth-label">비밀 단어</span>
            <span class="truth-val secret">${esc(G.secretWord)}</span>
          </div>
          <div class="truth-item">
            <span class="truth-label">진짜 카멜레온</span>
            <span class="truth-val chameleon">🦎 ${esc(chamNames)}</span>
          </div>
        </div>
      </div>

      <!-- 이번 라운드 점수 & 누적 랭킹 -->
      <div class="glass cm-leaderboard-box">
        <h4 style="margin:0 0 12px 0;">📊 점수 및 순위</h4>
        <div class="cm-leaderboard-list">
          ${(G.leaderboard || []).map((r, idx) => `
            <div class="cm-lead-row ${r.wasChameleon ? 'was-chameleon' : ''}">
              <div class="lead-rank">${idx + 1}위</div>
              <div class="lead-name">
                <b>${esc(r.name)}</b>
                ${r.wasChameleon ? '<span class="badge danger" style="font-size:0.7rem; margin-left:4px;">카멜레온</span>' : ''}
              </div>
              <div class="lead-pts">
                <span class="round-plus">+${r.roundScore}점</span>
                <span class="total-pts">총 ${r.totalScore}점</span>
              </div>
            </div>
          `).join('')}
        </div>

        ${isHost ? `
          <button class="btn primary lg block" data-send="game.nextRound" style="margin-top:16px;">
            👑 제${G.currentRound + 1}라운드 시작하기
          </button>
        ` : `
          <p class="pulse-text" style="margin-top:16px;">방장이 다음 라운드를 준비 중입니다…</p>
        `}
      </div>
    `;
  },

  /* 7. 최종 게임 종료 화면 (gameEnd) */
  p_gameEnd({ G, isHost }) {
    const list = G.leaderboard || [];
    const winner = list[0];

    return `
      <div class="glass center cm-gameover-card">
        <div class="emoji-xl" style="font-size:3.8rem;">🏆</div>
        <h1 class="text-gold" style="margin:4px 0;">게임 종료!</h1>
        <p class="muted">모든 라운드가 끝났습니다.</p>

        <div class="cm-winner-podium">
          <div class="winner-title">👑 최종 우승자</div>
          <div class="winner-name">${winner ? esc(winner.name) : '우승자'}</div>
          <div class="winner-score">${winner ? winner.totalScore : 0}점</div>
        </div>

        <div class="cm-leaderboard-list" style="margin:16px 0;">
          ${list.map((r, idx) => `
            <div class="cm-lead-row">
              <div class="lead-rank">${idx + 1}위</div>
              <div class="lead-name"><b>${esc(r.name)}</b></div>
              <div class="lead-pts"><b>${r.totalScore}점</b></div>
            </div>
          `).join('')}
        </div>

        ${isHost ? `
          <button class="btn primary lg block" data-send="game.again">
            🔄 카멜레온 새 게임 시작하기
          </button>
        ` : `
          <p class="pulse-text">방장이 새 게임을 준비 중입니다…</p>
        `}
      </div>
    `;
  },

  /* 공통 헬퍼: 4x4 단어 그리드 렌더러 */
  renderWordGrid(G, isGuessMode) {
    if (!G.topic || !G.topic.words) return '';
    const words = G.topic.words;
    const secretIndex = G.secretIndex;

    const rowLabels = ['A', 'B', 'C', 'D'];

    return `
      <div class="glass cm-grid-container">
        <div class="cm-grid-head">
          <span class="cm-topic-name">${G.topic.icon} ${esc(G.topic.name)}</span>
          <small class="muted">제${G.currentRound}/${G.settings.totalRounds}R · 4x4 주제 카드</small>
        </div>

        <div class="cm-grid-board">
          ${words.map((w, idx) => {
            const isSecret = secretIndex === idx;
            const row = rowLabels[Math.floor(idx / 4)];
            const col = (idx % 4) + 1;
            const coord = `${row}${col}`;

            return `
              <div class="cm-word-tile ${isSecret ? 'secret-word' : ''}">
                <span class="word-coord">${coord}</span>
                <span class="word-text">${esc(w)}</span>
                ${isSecret ? '<span class="secret-pin">★ 비밀단어</span>' : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },
};
