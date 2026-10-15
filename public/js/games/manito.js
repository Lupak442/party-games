/* 마니또 */
GameUI.manito = {
  render({ G, isHost }) {
    if (G.phase === 'setup') {
      return `<div class="glass center">
        <div class="emoji-xl">🎁</div>
        <h3>마니또 뽑기</h3>
        <p class="muted">모두가 서로의 마니또가 되도록 배정돼요.<br>(나 자신은 나오지 않고, 같은 사람이 겹치지 않아요)</p>
        <p><b>${G.count}명</b> 참여</p>
        ${isHost ? `<button class="btn primary block" data-send="game.start">마니또 시작!</button>` : '<p class="pulse-text">방장이 시작하길 기다리는 중…</p>'}
      </div>`;
    }
    const card = G.part ? `
      <div class="flip big ${G.revealed ? 'flipped' : ''}" ${G.revealed ? '' : 'data-send="game.flip"'}>
        <div class="flip-inner">
          <div class="face front manito-front"><span class="emoji-xl">🎁</span><b>MANITO</b><small>👆 터치해서 뒤집기</small></div>
          <div class="face back manito-back"><small>내가 몰래 도와줄 사람</small><div class="reveal-name">${esc(G.target || '')}</div><small>🤫 비밀이에요!</small></div>
        </div>
      </div>` : '<div class="glass center">이번 판에는 참여하지 않았어요 👀</div>';
    const host = isHost && G.status ? `
      <div class="glass"><b>카드 확인 현황 (${G.status.filter((s) => s.revealed).length}/${G.status.length})</b>
        <div class="chips status">${G.status.map((s) => `<span class="chip ${s.revealed ? 'ok' : 'wait'}">${s.revealed ? '✓' : '⏳'} ${esc(s.name)}</span>`).join('')}</div>
        <button class="btn ghost block" data-send="game.start" data-confirm="마니또를 다시 뽑을까요? 기존 배정은 사라져요.">🔄 다시 뽑기</button>
      </div>` : '';
    return `<div class="stack">${card}${host}</div>`;
  },
};
