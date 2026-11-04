/**
 * 🎲 요트 다이스 (Yacht Dice) - 1인 솔로 플레이 엔진 & 뷰
 * 
 * - 총 13라운드 (상단 6개 + 하단 7개)
 * - 상단: 1~6의 눈 (63점 이상 시 +35점 보너스)
 * - 하단: 초이스, 트리플(3 of a Kind), 포카드(4 of a Kind), 풀하우스,
 *         스몰 스트레이트(20점), 라지 스트레이트(40점), 요트(50점)
 * - 턴당 최대 3회 굴림, 주사위 킵(Keep) & 리롤
 * - 13턴 완주 시 방 내 최고 점수 비교 및 [🎲👑 휘장] 획득!
 */

window.YachtGame = (function() {
  let state = null;

  function defaultState() {
    return {
      round: 1,
      rollsLeft: 3,
      isRolling: false,
      dice: [1, 2, 3, 4, 5],
      kept: [false, false, false, false, false],
      categories: {
        ones: null,
        twos: null,
        threes: null,
        fours: null,
        fives: null,
        sixes: null,
        choice: null,
        triple: null,
        fourKind: null,
        fullHouse: null,
        smallStraight: null,
        largeStraight: null,
        yacht: null,
      },
      finished: false,
      finalScore: 0,
      highScore: parseInt(localStorage.getItem('party_yacht_best') || '0', 10),
    };
  }

  const CAT_INFO = {
    ones: { name: '에이스 (1)', desc: '1의 눈 모두 합산', sec: 'upper' },
    twos: { name: '듀스 (2)', desc: '2의 눈 모두 합산', sec: 'upper' },
    threes: { name: '트레이 (3)', desc: '3의 눈 모두 합산', sec: 'upper' },
    fours: { name: '포 (4)', desc: '4의 눈 모두 합산', sec: 'upper' },
    fives: { name: '파이브 (5)', desc: '5의 눈 모두 합산', sec: 'upper' },
    sixes: { name: '식스 (6)', desc: '6의 눈 모두 합산', sec: 'upper' },
    choice: { name: '초이스', desc: '주사위 5개의 눈 전체 합', sec: 'lower' },
    triple: { name: '트리플', desc: '동일한 눈 3개 이상 (전체 합)', sec: 'lower' },
    fourKind: { name: '포 오브 어 카인드', desc: '동일한 눈 4개 이상 (전체 합)', sec: 'lower' },
    fullHouse: { name: '풀 하우스', desc: '동일한 눈 3개 + 2개 (전체 합)', sec: 'lower' },
    smallStraight: { name: '스몰 스트레이트', desc: '연속된 4개 숫자 (고정 20점)', sec: 'lower' },
    largeStraight: { name: '라지 스트레이트', desc: '연속된 5개 숫자 (고정 40점)', sec: 'lower' },
    yacht: { name: '요트 (Yacht)', desc: '동일한 눈 5개 전부 일치 (고정 50점)', sec: 'lower' },
  };

  function init() {
    state = defaultState();
  }

  function getCounts(dice) {
    const c = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    dice.forEach(d => { if (c[d] !== undefined) c[d]++; });
    return c;
  }

  function calcScore(key, dice) {
    const sum = dice.reduce((a, b) => a + b, 0);
    const counts = getCounts(dice);
    const vals = Object.values(counts);

    switch (key) {
      case 'ones': return (counts[1] || 0) * 1;
      case 'twos': return (counts[2] || 0) * 2;
      case 'threes': return (counts[3] || 0) * 3;
      case 'fours': return (counts[4] || 0) * 4;
      case 'fives': return (counts[5] || 0) * 5;
      case 'sixes': return (counts[6] || 0) * 6;

      case 'choice': return sum;
      case 'triple': return vals.some(v => v >= 3) ? sum : 0;
      case 'fourKind': return vals.some(v => v >= 4) ? sum : 0;
      case 'fullHouse': {
        const has3 = vals.includes(3);
        const has2 = vals.includes(2);
        const has5 = vals.includes(5);
        return (has3 && has2) || has5 ? sum : 0;
      }
      case 'smallStraight': {
        const set = new Set(dice);
        const has = (arr) => arr.every(x => set.has(x));
        return (has([1, 2, 3, 4]) || has([2, 3, 4, 5]) || has([3, 4, 5, 6])) ? 20 : 0;
      }
      case 'largeStraight': {
        const set = new Set(dice);
        const has = (arr) => arr.every(x => set.has(x));
        return (has([1, 2, 3, 4, 5]) || has([2, 3, 4, 5, 6])) ? 40 : 0;
      }
      case 'yacht': return vals.some(v => v === 5) ? 50 : 0;
      default: return 0;
    }
  }

  function getTotals() {
    if (!state) return { upperSum: 0, bonus: 0, lowerSum: 0, total: 0 };
    const cats = state.categories;
    const uKeys = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
    let upperSum = 0;
    uKeys.forEach(k => { if (cats[k] !== null) upperSum += cats[k]; });
    const bonus = upperSum >= 63 ? 35 : 0;

    const lKeys = ['choice', 'triple', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yacht'];
    let lowerSum = 0;
    lKeys.forEach(k => { if (cats[k] !== null) lowerSum += cats[k]; });

    return {
      upperSum,
      bonus,
      lowerSum,
      total: upperSum + bonus + lowerSum
    };
  }

  function roll() {
    if (!state || state.isRolling || state.rollsLeft <= 0 || state.finished) return;
    state.isRolling = true;
    if (window.renderRoom) window.renderRoom();

    let count = 0;
    const interval = setInterval(() => {
      count++;
      for (let i = 0; i < 5; i++) {
        if (!state.kept[i]) {
          state.dice[i] = Math.floor(Math.random() * 6) + 1;
        }
      }
      if (window.renderRoom) window.renderRoom();

      if (count >= 5) {
        clearInterval(interval);
        state.isRolling = false;
        state.rollsLeft--;
        if (window.renderRoom) window.renderRoom();
      }
    }, 60);
  }

  function toggleKeep(idx) {
    if (!state || state.isRolling || state.rollsLeft === 3 || state.finished) return;
    state.kept[idx] = !state.kept[idx];
    if (window.renderRoom) window.renderRoom();
  }

  function selectCategory(key) {
    if (!state || state.isRolling || state.rollsLeft === 3 || state.finished) return;
    if (state.categories[key] !== null) return;

    state.categories[key] = calcScore(key, state.dice);

    // 13개 카테고리 완주 검사
    const allFilled = Object.values(state.categories).every(v => v !== null);
    if (allFilled) {
      state.finished = true;
      const totals = getTotals();
      state.finalScore = totals.total;

      // 최고 기록 저장
      if (state.finalScore > state.highScore) {
        state.highScore = state.finalScore;
        localStorage.setItem('party_yacht_best', String(state.finalScore));
        if (window.confetti) window.confetti();
        if (window.toast) window.toast(`🎉 최고 기록 경신! ${state.finalScore}점 달성!`, 'ok');
      }

      // 서버 룸에 점수 제출 (방 내 1위 경쟁)
      if (window.act) {
        window.act('room.submitYachtScore', { score: state.finalScore });
      }
    } else {
      // 다음 라운드 준비
      state.round++;
      state.rollsLeft = 3;
      state.kept = [false, false, false, false, false];
    }

    if (window.renderRoom) window.renderRoom();
  }

  function restart() {
    init();
    if (window.renderRoom) window.renderRoom();
  }

  function renderDieFace(num) {
    // 3x3 점(pip) 레이아웃 생성
    const pips = [];
    const active = {
      1: [4],
      2: [2, 6],
      3: [2, 4, 6],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    }[num] || [4];

    for (let i = 0; i < 9; i++) {
      pips.push(`<span class="pip ${active.includes(i) ? 'on' : ''}"></span>`);
    }
    return `<div class="die-face die-${num}">${pips.join('')}</div>`;
  }

  function render(ctx) {
    if (!state) init();

    const totals = getTotals();
    const canRoll = state.rollsLeft > 0 && !state.isRolling && !state.finished;
    const canPick = state.rollsLeft < 3 && !state.isRolling && !state.finished;
    const roomLeader = ctx?.room?.yachtLeader;
    const isMeLeader = roomLeader && roomLeader.pid === ctx.me && roomLeader.score > 0;

    // 분리된 주사위 (KEEP 트레이 vs ROLL 트레이)
    const keptDice = [];
    const rollDice = [];
    state.dice.forEach((d, i) => {
      const dieHtml = `
        <div class="yacht-die ${state.kept[i] ? 'is-kept' : ''} ${state.isRolling && !state.kept[i] ? 'rolling' : ''}"
             onclick="YachtGame.toggleKeep(${i})"
             title="${state.rollsLeft === 3 ? '먼저 주사위를 굴려주세요' : state.kept[i] ? '클릭하면 킵 해제' : '클릭하면 킵(보관)'}">
          ${renderDieFace(d)}
          <span class="die-tag">${state.kept[i] ? '🔒 KEEP' : '터치 킵'}</span>
        </div>`;
      if (state.kept[i]) keptDice.push(dieHtml);
      else rollDice.push(dieHtml);
    });

    return `
      <div class="yacht-container">
        <!-- 1. 헤더 HUD: 라운드, 롤링 잔여, 최고 기록, 나가기 -->
        <div class="yacht-hud glass">
          <div class="hud-col">
            <span class="hud-lbl">라운드</span>
            <b class="hud-val">${state.round} / 13</b>
          </div>
          <div class="hud-col">
            <span class="hud-lbl">남은 굴림</span>
            <div class="hud-dots">
              <span class="roll-dot ${state.rollsLeft >= 1 ? 'active' : ''}"></span>
              <span class="roll-dot ${state.rollsLeft >= 2 ? 'active' : ''}"></span>
              <span class="roll-dot ${state.rollsLeft >= 3 ? 'active' : ''}"></span>
            </div>
          </div>
          <div class="hud-col leader-col">
            <span class="hud-lbl">방 최고 👑</span>
            <b class="hud-leader">${roomLeader ? `${esc(roomLeader.name)} (${roomLeader.score}점)` : '기록 없음'}</b>
          </div>
          <div class="hud-col exit-col">
            <button class="btn ghost sm" onclick="Local.exitYacht()">✕ 나가기</button>
          </div>
        </div>

        <!-- 2. 주사위 플레이보드 -->
        <div class="yacht-board glass">
          <!-- KEEP 트레이 -->
          <div class="keep-tray-box">
            <div class="tray-label">
              <span>🔒 킵한 주사위 (재굴림 안 됨)</span>
              <small class="muted">${keptDice.length}/5개</small>
            </div>
            <div class="dice-row keep-row">
              ${keptDice.length ? keptDice.join('') : '<span class="empty-tray-hint">주사위를 터치해 여기에 보관하세요</span>'}
            </div>
          </div>

          <!-- ROLL 트레이 -->
          <div class="roll-tray-box">
            <div class="tray-label">
              <span>🎲 굴릴 주사위</span>
              <small class="muted">${rollDice.length}/5개</small>
            </div>
            <div class="dice-row roll-row">
              ${rollDice.length ? rollDice.join('') : '<span class="empty-tray-hint">모든 주사위가 킵되었습니다</span>'}
            </div>
          </div>

          <!-- 롤 버튼 -->
          <div class="roll-action-bar">
            ${state.finished ? `
              <div class="finished-banner">
                <h3>🎉 13라운드 완주! 최종 점수: ${state.finalScore}점</h3>
                <p class="muted">${state.finalScore >= (roomLeader?.score || 0) ? '👑 축하합니다! 방 내 최고 기록을 달성하여 주사위 휘장을 획득했습니다!' : '방 1위 기록에 도전해보세요!'}</p>
                <div class="finished-btns">
                  <button class="btn primary" onclick="YachtGame.restart()">🔄 다시 한 판 하기</button>
                  <button class="btn ghost" onclick="Local.exitYacht()">대기실로 돌아가기</button>
                </div>
              </div>
            ` : `
              <button class="btn primary block roll-main-btn ${state.isRolling ? 'loading' : ''}"
                      ${canRoll ? 'onclick="YachtGame.roll()"' : 'disabled'}>
                ${state.rollsLeft === 3 ? '🎲 주사위 굴리기 (1차)' :
                  state.rollsLeft > 0 ? `🎲 남은 주사위 재굴림 (${state.rollsLeft}회 남음)` :
                  '점수표에서 항목을 선택해주세요!'}
              </button>
            `}
          </div>
        </div>

        <!-- 3. 인터랙티브 스코어보드 (상단 6종 + 하단 7종) -->
        <div class="yacht-score-section glass">
          <div class="score-sec-head">
            <h3>📊 스코어보드</h3>
            <span class="my-best-pill">🏆 내 최고: <b>${state.highScore}점</b></span>
          </div>

          <!-- 상단 섹션 -->
          <div class="score-sub-box">
            <div class="sub-head">
              <span>상단 섹션 (1~6의 눈 합계)</span>
              <span class="bonus-prog ${totals.upperSum >= 63 ? 'bonus-done' : ''}">
                ${totals.upperSum} / 63점 ${totals.upperSum >= 63 ? '👑 +35점 보너스 획득!' : `(보너스까지 ${Math.max(0, 63 - totals.upperSum)}점)`}
              </span>
            </div>
            <div class="score-grid">
              ${['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'].map(k => renderScoreRow(k, canPick)).join('')}
            </div>
          </div>

          <!-- 하단 섹션 -->
          <div class="score-sub-box">
            <div class="sub-head">
              <span>하단 섹션 (특수 족보)</span>
            </div>
            <div class="score-grid">
              ${['choice', 'triple', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yacht'].map(k => renderScoreRow(k, canPick)).join('')}
            </div>
          </div>

          <!-- 최종 합계 -->
          <div class="yacht-total-strip">
            <div class="total-detail">
              <span>상단 ${totals.upperSum}점</span>
              <span>보너스 +${totals.bonus}점</span>
              <span>하단 ${totals.lowerSum}점</span>
            </div>
            <div class="total-big">
              <small>총점</small>
              <b>${totals.total}점</b>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderScoreRow(key, canPick) {
    const info = CAT_INFO[key];
    const val = state.categories[key];
    const isFilled = val !== null;
    const ghost = !isFilled && canPick ? calcScore(key, state.dice) : null;

    return `
      <div class="score-row ${isFilled ? 'is-filled' : 'is-empty'} ${ghost !== null ? 'can-select' : ''}"
           ${!isFilled && canPick ? `onclick="YachtGame.selectCategory('${key}')"` : ''}>
        <div class="score-cat-info">
          <b>${info.name}</b>
          <small>${info.desc}</small>
        </div>
        <div class="score-cat-val">
          ${isFilled ? `<span class="val-num ${val > 0 ? 'good' : 'zero'}">${val}점</span>` :
            ghost !== null ? `<span class="val-ghost ${ghost > 0 ? 'good' : 'zero'}">+${ghost}점</span>` :
            '<span class="val-dash">-</span>'}
        </div>
      </div>
    `;
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return {
    init,
    roll,
    toggleKeep,
    selectCategory,
    restart,
    render,
  };
})();

