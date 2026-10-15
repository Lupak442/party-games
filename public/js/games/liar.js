/* 라이어 게임 / 바보 라이어 */
Local.peek = () => { S.peek = !S.peek; renderRoom(); };
Local.setLiarMode = (el) => {
  S.liarMode = el.dataset.mode;
  renderRoom();
};
Local.selectLiarBuiltin = (el) => {
  const input = $('#liarTopicInput');
  if (input) input.value = el.dataset.topic;
  $$('.topic-chip').forEach((c) => c.classList.toggle('sel', c.dataset.topic === el.dataset.topic));
};

GameUI.liar = GameUI.fool = {
  render(c) {
    const { G } = c;
    const topic = G.topic ? `<div class="topic-banner">주제 <b>${esc(G.topic)}</b>${G.round ? ` <span class="round">추적 ${G.round}/${G.maxRounds}</span>` : ''}</div>` : '';
    const fn = this['p_' + G.phase];
    return `<div class="stack">${G.phase === 'setup' || G.phase === 'loading' ? '' : topic}${fn ? fn.call(this, c) : ''}</div>`;
  },

  p_setup({ G, isHost, appMeta }) {
    if (!isHost) {
      return '<div class="glass center"><div class="emoji-xl">🕵️</div><p class="pulse-text">방장이 게임을 준비하는 중…</p></div>';
    }

    const curMode = S.liarMode || G.mode || 'builtin';
    const builtins = (appMeta && appMeta.builtinTopics && appMeta.builtinTopics.length)
      ? appMeta.builtinTopics
      : [
          { name: '과일', count: 22 }, { name: '동물', count: 22 }, { name: '음식', count: 22 },
          { name: '국내 드라마', count: 22 }, { name: '영화', count: 22 }, { name: '가수', count: 22 },
          { name: '예능', count: 22 }, { name: '직업', count: 22 }, { name: '스포츠', count: 22 }, { name: '나라', count: 22 }
        ];

    const currentTopic = G.topic || builtins[0]?.name || '과일';

    return `<div class="glass" id="liarForm">
      <h3>${G.fool ? '🤪 바보 라이어' : '🕵️ 라이어 게임'}</h3>
      ${G.error ? `<p class="err">${esc(G.error)}</p>` : ''}

      <div class="mode-tabs">
        <button type="button" class="mode-tab ${curMode === 'builtin' ? 'on' : ''}" data-local="setLiarMode" data-mode="builtin">📚 내장 주제</button>
        <button type="button" class="mode-tab ${curMode === 'ai' ? 'on' : ''}" data-local="setLiarMode" data-mode="ai">🤖 AI 자동생성</button>
        <button type="button" class="mode-tab ${curMode === 'custom' ? 'on' : ''}" data-local="setLiarMode" data-mode="custom">✍️ 직접 입력</button>
      </div>
      <input type="hidden" name="mode" value="${curMode}" />

      ${curMode === 'builtin' ? `
        <div class="builtin-wrap">
          <small class="muted">터치해서 바로 주제를 선택하세요:</small>
          <div class="topic-chips">
            ${builtins.map((b) => `
              <button type="button" class="chip topic-chip ${currentTopic === b.name ? 'sel' : ''}" data-local="selectLiarBuiltin" data-topic="${esc(b.name)}">
                ${esc(b.name)} <small>(${b.count})</small>
              </button>
            `).join('')}
          </div>
          <label class="field" style="margin-top:10px;">
            <span>선택된 주제</span>
            <input id="liarTopicInput" name="topic" value="${esc(currentTopic)}" readonly />
          </label>
          <p class="hint">💡 <b>server/data/builtins.json</b> 파일에 단어를 마음껏 추가/수정할 수 있어요!</p>
        </div>
      ` : ''}

      ${curMode === 'ai' ? `
        <div class="ai-wrap">
          <div class="ai-badge ${appMeta && appMeta.hasAi ? 'ok' : 'warn'}">
            ${appMeta && appMeta.hasAi ? '🟢 Gemini AI 연결됨' : '🟠 GEMINI_API_KEY 미설정 (내장 주제 추천)'}
          </div>
          <label class="field">
            <span>자유 주제 입력 (예: 롤 챔피언, 포켓몬, 90년대 만화 등)</span>
            <input id="liarTopicInput" name="topic" maxlength="30" value="${esc(G.topic)}" placeholder="원하는 아무 주제나 입력" autocomplete="off" />
          </label>
        </div>
      ` : ''}

      ${curMode === 'custom' ? `
        <div class="custom-wrap">
          <label class="field">
            <span>주제 이름</span>
            <input name="topic" maxlength="30" value="${esc(G.topic || '직접 지정')}" placeholder="예: 간식" autocomplete="off" />
          </label>
          <label class="field">
            <span>시민 단어 (라이어 제외 모두가 받는 단어)</span>
            <input name="word" maxlength="30" placeholder="예) 사과" autocomplete="off" />
          </label>
          ${G.fool ? `
            <label class="field">
              <span>바보 라이어 단어 (라이어만 받는 헷갈리는 단어)</span>
              <input name="fool" maxlength="30" placeholder="예) 배" autocomplete="off" />
            </label>
          ` : ''}
        </div>
      ` : ''}

      <button class="btn primary block" data-send="game.start" data-collect="#liarForm">🎲 게임 시작</button>
      <p class="hint">${G.fool ? '시민은 [사과], 바보 라이어는 [배]처럼 서로 다른 단어를 받아요' : '시민은 제시어를 받고 라이어는 "라이어" 카드를 받아요'}</p>
    </div>`;
  },

  p_loading() {
    return '<div class="glass center"><div class="spinner"></div><p class="pulse-text">단어를 불러오는 중입니다…</p></div>';
  },

  card(G, flippedNow) {
    const c = G.myCard;
    const back = !c ? '' : c.liar
      ? '<div class="liar-tag">🤥 LIAR</div><small>당신은 라이어예요!</small>'
      : `<small>제시어</small><div class="reveal-name">${esc(c.word)}</div>`;
    const canTap = !G.flipped;
    return `<div class="flip big ${flippedNow ? 'flipped' : ''}" ${canTap ? 'data-send="game.flip"' : G.myCard ? 'data-local="peek"' : ''}>
      <div class="flip-inner">
        <div class="face front liar-front"><span class="emoji-xl">${G.fool ? '🤪' : '🕵️'}</span><b>${G.fool ? '바보 라이어' : '라이어 게임'}</b><small>${canTap ? '👆 터치해서 뒤집기' : '👆 터치해서 확인'}</small></div>
        <div class="face back ${c && c.liar ? 'liar-back' : 'word-back'}">${back}</div>
      </div></div>`;
  },

  flipList(G, isHost) {
    if (!isHost || !G.flipStatus) return '';
    const n = G.flipStatus.filter((s) => s.flipped).length;
    return `<div class="glass"><b>카드 확인 현황 (${n}/${G.flipStatus.length})</b>
      <div class="chips status">${G.flipStatus.map((s) => `<span class="chip ${s.flipped ? 'ok' : 'wait'}">${s.flipped ? '✓' : '⏳'} ${esc(s.name)}</span>`).join('')}</div></div>`;
  },

  p_cards({ G, isHost }) {
    if (!G.part) return '<div class="glass center">이번 판은 관전 중이에요 👀</div>';
    const all = G.flipStatus && G.flipStatus.every((s) => s.flipped);
    return `${this.card(G, !!G.flipped)}
      ${this.flipList(G, isHost)}
      ${isHost ? `<button class="btn ${all ? 'primary' : 'warn'} block" data-send="game.startHunt">${all ? '✅ 모두 확인 완료 · 게임 시작' : '⚠️ 강제 시작'}</button>` : '<p class="pulse-text center">모두 카드를 확인하면 방장이 시작해요</p>'}`;
  },

  p_hunt({ G, isHost }) {
    return `<div class="glass center hunt">
        <div class="radar"><span>🔍</span></div>
        <h2 class="hunt-title">라이어 추적중<span class="dots"></span></h2>
        <p class="muted">대화를 나누며 수상한 사람을 찾아보세요</p>
      </div>
      ${G.part ? `<div class="peek-wrap">${this.card(G, G.myCard ? !!S.peek : false)}<small class="hint center">${G.myCard ? '카드를 눌러 내 제시어 다시 보기' : ''}</small></div>` : ''}
      ${this.flipList(G, isHost)}
      ${isHost ? '<button class="btn primary block" data-send="game.startVote">🗳️ 투표 시작</button>' : ''}`;
  },

  p_vote({ G, isHost }) {
    if (!G.part) return '<div class="glass center">투표 진행 중 (관전)</div>';
    const others = G.players.filter((p) => p.id !== c_me());
    const list = others.map((p) => `
      <label class="radio ${G.myVote === p.id ? 'sel' : ''}">
        <input type="radio" name="vote" ${G.myVote === p.id ? 'checked' : ''} ${G.myDone ? 'disabled' : ''} data-change-send="game.vote" ${pl({ target: p.id })} />
        ${avatar(p.name, p.id)}<span>${esc(p.name)}</span><i class="tick">✔</i>
      </label>`).join('');
    return `<div class="glass"><h3>🗳️ 누가 라이어일까요?</h3>
      <div class="radios">${list}</div>
      <button class="btn primary block" data-send="game.done" ${G.myVote && !G.myDone ? '' : 'disabled'}>${G.myDone ? '✅ 투표 완료 · 다른 사람 기다리는 중' : '투표 완료'}</button>
    </div>
    <div class="glass"><b>완료 현황 (${G.doneList.filter((d) => d.done).length}/${G.doneList.length})</b>
      <div class="chips status">${G.doneList.map((d) => `<span class="chip ${d.done ? 'ok' : 'wait'}">${d.done ? '✓' : '⏳'} ${esc(d.name)}</span>`).join('')}</div>
      ${isHost ? '<button class="btn warn block" data-send="game.forceVote" data-confirm="아직 안 한 사람을 제외하고 결과를 볼까요?">강제 집계</button>' : ''}
    </div>`;
  },

  p_voteResult({ G, isHost }) {
    const max = Math.max(1, ...G.tally.map((t) => t.count));
    return `<div class="glass"><h3>📣 투표 결과</h3>
      <ul class="votes">${G.votes.map((v) => `<li><b>${esc(v.from)}</b> <span>→</span> <b>${esc(v.to)}</b> 지목</li>`).join('')}</ul>
      ${G.notVoted.length ? `<p class="hint">미투표: ${G.notVoted.map(esc).join(', ')}</p>` : ''}
    </div>
    <div class="glass"><div class="tally">${G.tally.map((t) => `<div class="trow"><span>${esc(t.name)}</span><div class="bar"><i style="width:${(t.count / max) * 100}%"></i></div><b>${t.count}</b></div>`).join('')}</div>
      <p class="verdict-line">${G.tie ? '😵 최다 득표자가 같거나 없어요!' : `🎯 <b>${esc(G.topName)}</b>님이 지목됐어요`}</p>
      ${isHost ? `<button class="btn primary block" data-send="game.voteNext">${G.tie ? (G.round >= G.maxRounds ? '결과 보기' : `다시 추적하기 (${G.round + 1}/${G.maxRounds})`) : '찬반 투표로 →'}</button>` : '<p class="pulse-text center">방장이 다음으로 넘기는 중…</p>'}
    </div>`;
  },

  p_verdict({ G, isHost }) {
    return `<div class="glass center"><div class="emoji-xl">⚖️</div><h3><b>${esc(G.accused.name)}</b>님을<br>라이어로 확정할까요?</h3>
      ${G.part ? `<div class="two-btns">
        <button class="btn agree ${G.myChoice === 'agree' ? 'picked' : ''}" data-send="game.verdict" ${pl({ choice: 'agree' })} ${G.myChoice ? 'disabled' : ''}>👍 찬성</button>
        <button class="btn disagree ${G.myChoice === 'disagree' ? 'picked' : ''}" data-send="game.verdict" ${pl({ choice: 'disagree' })} ${G.myChoice ? 'disabled' : ''}>👎 반대</button>
      </div>` : ''}</div>
    ${this.verdictList(G)}
    ${isHost ? '<button class="btn warn block" data-send="game.forceVerdict" data-confirm="아직 안 한 사람을 제외하고 집계할까요?">강제 집계</button>' : ''}`;
  },

  verdictList(G) {
    return `<div class="glass"><b>투표 현황</b><ul class="votes">${G.verdicts.map((v) => `<li><b>${esc(v.name)}</b> <span class="${v.choice || ''}">${v.choice === 'agree' ? '👍 찬성' : v.choice === 'disagree' ? '👎 반대' : '⏳ 고민 중'}</span></li>`).join('')}</ul></div>`;
  },

  p_verdictResult({ G, isHost }) {
    const v = G.vres;
    return `<div class="glass center"><h3>👍 ${v.agree} : ${v.disagree} 👎</h3>
      <p class="verdict-line">${v.passed ? `<b>${esc(G.accused.name)}</b>님이 라이어로 확정됐어요!` : '반대가 더 많거나 동률이에요. 다시 추적해요!'}</p>
      ${isHost ? `<button class="btn primary block" data-send="game.verdictNext">${v.passed ? '정체 공개 →' : G.round >= G.maxRounds ? '결과 보기' : `다시 추적하기 (${G.round + 1}/${G.maxRounds})`}</button>` : '<p class="pulse-text">방장이 다음으로 넘기는 중…</p>'}</div>
    ${this.verdictList(G)}`;
  },

  p_guess({ G }) {
    // 1. 내가 라이어인 경우
    if (G.isLiar) {
      return G.guess
        ? `<div class="glass center">
            <div class="emoji-xl">🤞</div>
            <h3>제출한 정답</h3>
            <div class="reveal-name">${esc(G.guess)}</div>
            <p class="pulse-text">심판(<b>${esc(G.judgeName)}</b>님)이 정답/오타 여부를 확인 중입니다…</p>
          </div>`
        : `<div class="glass center" id="guessForm">
            <div class="emoji-xl">😱</div>
            <h3>들켰어요! 마지막 역전 기회!</h3>
            <p class="muted">제시어를 맞히면 라이어(3점)의 대역전 승리예요!</p>
            <input name="text" maxlength="30" placeholder="제시어를 입력하세요" autocomplete="off" />
            <button class="btn primary block" data-send="game.guess" data-collect="#guessForm">정답 제출</button>
            <p class="hint">💡 살짝 오타가 나더라도 심판이 확인 후 정답으로 인정해줄 수 있어요!</p>
          </div>`;
    }

    // 2. 내가 심판인 경우
    if (G.canJudge) {
      if (!G.guess) {
        return `<div class="glass center">
          <div class="emoji-xl">😈</div>
          <h3><b>${esc(G.accused.name)}</b>님은 진짜 라이어였어요!</h3>
          <p class="pulse-text">라이어가 마지막 정답을 고민하고 있습니다…</p>
          <p class="hint">제시어: <b>${esc(G.word)}</b></p>
        </div>`;
      }

      // 라이어가 정답을 제출했을 때 -> 심판이 오타 여부 등을 판단!
      return `<div class="glass center judge-box">
        <div class="emoji-xl">⚖️</div>
        <h3>라이어 정답 판정 (심판: 나)</h3>
        <div class="compare-box">
          <div class="c-item"><small>원래 제시어</small><b class="c-word">${esc(G.word)}</b></div>
          <div class="c-item"><small>라이어가 쓴 정답</small><b class="c-guess">${esc(G.guess)}</b></div>
        </div>
        <p class="judge-desc">
          💡 <b>오타 판정 안내:</b><br>
          띄어쓰기, 사소한 오타(예: <b>딸기 → 달기</b>), 또는 유사한 정답이라고 생각되시면 <b>[정답 인정]</b>을 눌러주세요!
        </p>
        <div class="two-btns">
          <button class="btn agree xl" data-send="game.judge" ${pl({ ok: true })}>⭕ 정답 인정 (오타 인정)</button>
          <button class="btn disagree xl" data-send="game.judge" ${pl({ ok: false })}>❌ 땡 (오답)</button>
        </div>
      </div>`;
    }

    // 3. 일반 시민/관전자 화면
    return `<div class="glass center">
      <div class="emoji-xl">😈</div>
      <h3><b>${esc(G.accused.name)}</b>님은 진짜 라이어였어요!</h3>
      ${G.guess ? `
        <div class="compare-box">
          <div class="c-item"><small>라이어가 제출한 정답</small><b class="c-guess">${esc(G.guess)}</b></div>
        </div>
        <p class="pulse-text">심판(<b>${esc(G.judgeName)}</b>님)이 오타 및 정답 여부를 판정 중입니다…</p>
      ` : `
        <p class="pulse-text">라이어가 마지막 정답을 입력하는 중…</p>
      `}
    </div>`;
  },

  p_end({ G, isHost }) {
    const o = G.outcome, liarWin = o.winner === 'liar';
    const reasons = {
      wrongAccuse: '엉뚱한 사람을 지목했어요!',
      rounds: '3번의 추적에도 라이어를 잡지 못했어요',
      guessed: '라이어가 제시어(오타 포함)를 맞혔어요!',
      caught: '라이어를 검거했어요!'
    };
    return `<div class="glass center end ${liarWin ? 'liar-win' : 'citizen-win'}">
      <div class="emoji-xl bounce">${liarWin ? '🤥' : '🎉'}</div>
      <h2>${liarWin ? '라이어 승리!' : '시민 승리!'}</h2>
      <p class="muted">${reasons[o.reason] || ''}</p>
      <div class="reveal-box">
        <div>라이어 <b>${esc(G.reveal.liarName)}</b></div>
        <div>제시어 <b>${esc(G.reveal.word)}</b>${G.reveal.liarWord ? ` <small>(라이어 단어: ${esc(G.reveal.liarWord)})</small>` : ''}</div>
        ${G.guess ? `<div>라이어의 제출 답 <b>${esc(G.guess)}</b></div>` : ''}
      </div>
      <p class="hint">${liarWin ? '라이어 +3점' : '라이어를 제외한 모두 +1점'}이 반영됐어요</p>
      ${isHost ? '<button class="btn primary block" data-send="game.again">🔁 한 판 더</button>' : ''}
    </div>`;
  },
};
const c_me = () => S.state.me;
