/* 블랙잭 게임 UI (Pixi.js 아케이드 테이블 탑재) */

// ---- Pixi.js 기반 아케이드 카지노 테이블 렌더러 ----
const BlackjackPixiTable = {
  app: null,
  container: null,
  tableGfx: null,
  cardContainer: null,
  chipContainer: null,
  fxContainer: null,
  textContainer: null,

  dealerCards: [],   // { card, sprite, targetX, targetY, isNew }
  myCards: [],       // { card, sprite, targetX, targetY, isNew }
  chips: [],
  particles: [],

  shakeRemaining: 0,
  lastStateKey: '',
  isInit: false,

  init(mountEl) {
    if (!window.PIXI) return false;
    if (this.app && this.app.view && mountEl.contains(this.app.view)) {
      return true; // 이미 마운트됨
    }

    this.cleanup();

    const w = 560;
    const h = 420;

    try {
      this.app = new PIXI.Application({
        width: w,
        height: h,
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 2, 2.5),
        autoDensity: true,
      });

      this.app.view.className = 'bj-pixi-canvas';
      this.app.view.style.width = '100%';
      this.app.view.style.height = 'auto';
      this.app.view.style.aspectRatio = '560 / 420';
      this.app.view.style.borderRadius = '24px';
      this.app.view.style.boxShadow = '0 16px 40px rgba(0,0,0,0.5), inset 0 0 20px rgba(251,191,36,0.15)';
      this.app.view.style.border = '2px solid rgba(251,191,36,0.3)';

      mountEl.appendChild(this.app.view);

      // 레이어 구조
      this.tableGfx = new PIXI.Graphics();
      this.chipContainer = new PIXI.Container();
      this.cardContainer = new PIXI.Container();
      this.textContainer = new PIXI.Container();
      this.fxContainer = new PIXI.Container();

      this.app.stage.addChild(this.tableGfx);
      this.app.stage.addChild(this.chipContainer);
      this.app.stage.addChild(this.cardContainer);
      this.app.stage.addChild(this.textContainer);
      this.app.stage.addChild(this.fxContainer);

      this.drawTable();
      this.setupTicker();
      this.isInit = true;
      return true;
    } catch (e) {
      console.warn('Pixi.js 블랙잭 테이블 초기화 실패 (HTML로 대체):', e);
      return false;
    }
  },

  drawTable() {
    const g = this.tableGfx;
    g.clear();

    const w = 560;
    const h = 420;

    // 1. 카지노 에메랄드 펠트 베이스
    g.beginFill(0x064e3b); // 진한 에메랄드
    g.drawRoundedRect(0, 0, w, h, 24);
    g.endFill();

    // 펠트 내부 그라데이션 느낌의 오버레이
    g.beginFill(0x022c22, 0.45);
    g.drawRoundedRect(8, 8, w - 16, h - 16, 20);
    g.endFill();

    // 2. 황금빛 테두리 라인 2줄
    g.lineStyle(2, 0xfbbf24, 0.7);
    g.drawRoundedRect(14, 14, w - 28, h - 28, 18);
    g.lineStyle(1, 0xf59e0b, 0.4);
    g.drawRoundedRect(18, 18, w - 36, h - 36, 16);

    // 3. 중앙 카지노 아치 라인 (Semi-Circle Arc)
    g.lineStyle(2, 0xfbbf24, 0.35);
    g.arc(w / 2, 80, 200, 0.3, Math.PI - 0.3);

    // 4. 오른쪽 상단: 덱 슈 (Deck Shoe) 3D 그래픽
    const deckX = 460;
    const deckY = 36;
    for (let i = 4; i >= 0; i--) {
      g.beginFill(0x1e1b4b);
      g.lineStyle(1, 0xfbbf24, 0.6);
      g.drawRoundedRect(deckX + i * 2, deckY + i * 2, 54, 76, 6);
      g.endFill();

      // 빨간색 카드 뒷면 패턴
      g.beginFill(0xb91c1c);
      g.lineStyle(1, 0xfca5a5, 0.4);
      g.drawRoundedRect(deckX + i * 2 + 3, deckY + i * 2 + 3, 48, 70, 4);
      g.endFill();
    }

    // 텍스트 추가 (카지노 레터링 워터마크)
    if (!this.bannerText) {
      this.bannerText = new PIXI.Text('★ BLACKJACK PAYS 3 TO 2 ★\nDEALER MUST STAND ON 17', {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: 13,
        fontWeight: '800',
        fill: 0xfde68a,
        align: 'center',
        letterSpacing: 2,
      });
      this.bannerText.alpha = 0.35;
      this.bannerText.anchor.set(0.5);
      this.bannerText.position.set(w / 2, 210);
      this.tableGfx.addChild(this.bannerText);
    }
  },

  setupTicker() {
    this.app.ticker.add((delta) => {
      // 1. 화면 셰이크 감쇠
      if (this.shakeRemaining > 0) {
        this.shakeRemaining -= delta;
        const mag = Math.min(this.shakeRemaining * 1.5, 8);
        this.app.stage.position.x = (Math.random() - 0.5) * mag;
        this.app.stage.position.y = (Math.random() - 0.5) * mag;
      } else {
        this.app.stage.position.set(0, 0);
      }

      // 2. 카드 이동 & 애니메이션 보간
      [...this.dealerCards, ...this.myCards].forEach((item) => {
        if (!item.sprite) return;
        const sp = item.sprite;
        if (item.animProgress < 1) {
          item.animProgress = Math.min(1, item.animProgress + 0.055 * delta);
          const t = item.animProgress;
          // Ease-out cubic
          const ease = 1 - Math.pow(1 - t, 3);
          sp.x = item.startX + (item.targetX - item.startX) * ease;
          sp.y = item.startY + (item.targetY - item.startY) * ease;
          sp.rotation = item.startRot + (item.targetRot - item.startRot) * ease;
          sp.scale.set(item.startScale + (1 - item.startScale) * ease);
        } else {
          sp.x = item.targetX;
          sp.y = item.targetY;
          sp.rotation = item.targetRot;
          sp.scale.set(1);
        }

        // 플립 애니메이션 (뒤집기)
        if (item.flipping) {
          item.flipProgress = Math.min(1, item.flipProgress + 0.08 * delta);
          if (item.flipProgress < 0.5) {
            sp.scale.x = 1 - item.flipProgress * 2;
          } else {
            if (!item.flippedTextureSwapped) {
              item.flippedTextureSwapped = true;
              this.redrawCard(item, false); // 앞면으로 전환
            }
            sp.scale.x = (item.flipProgress - 0.5) * 2;
          }
          if (item.flipProgress >= 1) {
            item.flipping = false;
            sp.scale.x = 1;
          }
        }
      });

      // 3. 파티클 업데이트
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.vy += 0.25 * delta; // 중력
        p.rotation += p.vRot * delta;
        p.alpha -= 0.015 * delta;
        if (p.alpha <= 0 || p.y > 450) {
          p.destroy();
          this.particles.splice(i, 1);
        }
      }
    });
  },

  createCardSprite(card, isHidden) {
    const container = new PIXI.Container();
    const w = 68;
    const h = 98;

    const bg = new PIXI.Graphics();
    container.addChild(bg);
    container.bg = bg;
    container.cardWidth = w;
    container.cardHeight = h;

    this.drawCardGraphics(container, card, isHidden);

    container.pivot.set(w / 2, h / 2);
    return container;
  },

  drawCardGraphics(container, card, isHidden) {
    const bg = container.bg;
    bg.clear();
    const w = container.cardWidth;
    const h = container.cardHeight;

    if (isHidden) {
      // 뒷면 (미스터리 골드 앤 퍼플)
      bg.beginFill(0x1e1b4b);
      bg.lineStyle(2, 0xfbbf24, 0.9);
      bg.drawRoundedRect(0, 0, w, h, 10);
      bg.endFill();

      bg.beginFill(0x312e81);
      bg.lineStyle(1.5, 0xf59e0b, 0.6);
      bg.drawRoundedRect(4, 4, w - 8, h - 8, 8);
      bg.endFill();

      // 중앙 로고
      const dice = new PIXI.Text('🎲', { fontSize: 26 });
      dice.anchor.set(0.5);
      dice.position.set(w / 2, h / 2);
      bg.addChild(dice);
    } else {
      // 앞면 (깔끔한 프리미엄 카드)
      bg.beginFill(0xffffff);
      bg.lineStyle(1.5, 0x94a3b8, 0.5);
      bg.drawRoundedRect(0, 0, w, h, 10);
      bg.endFill();

      const isRed = card.color === 'red' || card.suit === '♥️' || card.suit === '♦️';
      const color = isRed ? 0xe11d48 : 0x0f172a;

      // 좌상단 슈트 & 숫자
      const topRank = new PIXI.Text(card.rank, {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: 14,
        fontWeight: '900',
        fill: color,
      });
      topRank.position.set(6, 4);
      bg.addChild(topRank);

      const topSuit = new PIXI.Text(card.suit, { fontSize: 11 });
      topSuit.position.set(6, 20);
      bg.addChild(topSuit);

      // 중앙 큰 숫자 & 슈트
      const centerRank = new PIXI.Text(card.rank, {
        fontFamily: 'Pretendard, sans-serif',
        fontSize: 34,
        fontWeight: '900',
        fill: color,
      });
      centerRank.anchor.set(0.5);
      centerRank.position.set(w / 2, h / 2 - 2);
      bg.addChild(centerRank);

      const centerSuit = new PIXI.Text(card.suit, { fontSize: 18 });
      centerSuit.anchor.set(0.5);
      centerSuit.position.set(w / 2, h / 2 + 22);
      bg.addChild(centerSuit);
    }
  },

  redrawCard(item, isHidden) {
    if (!item.sprite) return;
    this.drawCardGraphics(item.sprite, item.card, isHidden);
  },

  sync(G) {
    if (!this.isInit || !this.app) return;

    const deckX = 470;
    const deckY = 50;
    const dCards = G.dealer ? G.dealer.cards : [];
    const mCards = G.myHand ? G.myHand.cards : [];

    // 딜러 카드 동기화
    const dStartX = 280 - (dCards.length * 76) / 2 + 38;
    dCards.forEach((c, idx) => {
      const targetX = dStartX + idx * 76;
      const targetY = 90;
      let existing = this.dealerCards[idx];

      if (!existing) {
        // 새 카드 딜링 애니메이션
        const sp = this.createCardSprite(c, !!c.hidden);
        sp.x = deckX;
        sp.y = deckY;
        sp.rotation = -0.3;
        sp.scale.set(0.7);

        const item = {
          card: c,
          sprite: sp,
          startX: deckX,
          startY: deckY,
          targetX,
          targetY,
          startRot: -0.3,
          targetRot: (Math.random() - 0.5) * 0.08,
          startScale: 0.7,
          animProgress: 0,
        };
        this.cardContainer.addChild(sp);
        this.dealerCards.push(item);
      } else {
        existing.targetX = targetX;
        existing.targetY = targetY;
        // 뒷면에서 앞면으로 바뀐 경우 플립 트리거
        if (existing.card.hidden && !c.hidden && !existing.flipping) {
          existing.card = c;
          existing.flipping = true;
          existing.flipProgress = 0;
          existing.flippedTextureSwapped = false;
        }
      }
    });

    // 내 카드 동기화
    const mStartX = 280 - (mCards.length * 76) / 2 + 38;
    mCards.forEach((c, idx) => {
      const targetX = mStartX + idx * 76;
      const targetY = 320;
      let existing = this.myCards[idx];

      if (!existing) {
        // 덱에서 플레이어로 날아오는 딜링
        const sp = this.createCardSprite(c, false);
        sp.x = deckX;
        sp.y = deckY;
        sp.rotation = -0.4;
        sp.scale.set(0.7);

        const item = {
          card: c,
          sprite: sp,
          startX: deckX,
          startY: deckY,
          targetX,
          targetY,
          startRot: -0.4,
          targetRot: (Math.random() - 0.5) * 0.08,
          startScale: 0.7,
          animProgress: 0,
        };
        this.cardContainer.addChild(sp);
        this.myCards.push(item);
      } else {
        existing.targetX = targetX;
        existing.targetY = targetY;
      }
    });

    // 배팅 칩 표시
    this.updateChips(G);

    // 특수 연출 (블랙잭 / 버스트 / 승리)
    this.checkSpecialEffects(G);
  },

  updateChips(G) {
    this.chipContainer.removeChildren();
    const bet = G.myHand ? G.myHand.bet : G.myBet;
    if (!bet || bet <= 0) return;

    const cx = 280;
    const cy = 205;

    // 칩 스택 그리기
    for (let i = 0; i < bet; i++) {
      const chip = new PIXI.Graphics();
      const chipY = cy - i * 6;

      chip.beginFill(0xf59e0b);
      chip.lineStyle(2, 0xfde68a, 1);
      chip.drawCircle(cx, chipY, 22);
      chip.endFill();

      chip.beginFill(0xd97706);
      chip.lineStyle(1, 0xffffff, 0.6);
      chip.drawCircle(cx, chipY, 15);
      chip.endFill();

      const txt = new PIXI.Text('🪙', { fontSize: 14 });
      txt.anchor.set(0.5);
      txt.position.set(cx, chipY);
      chip.addChild(txt);

      this.chipContainer.addChild(chip);
    }
  },

  checkSpecialEffects(G) {
    const sc = G.myHand ? G.myHand.scoreInfo : null;
    const key = `${G.phase}_${sc ? sc.score : 0}_${sc ? sc.isBlackjack : false}_${sc ? sc.isBust : false}`;

    if (this.lastStateKey === key) return;
    this.lastStateKey = key;

    if (sc && sc.isBlackjack) {
      this.spawnCelebration(280, 320);
    } else if (sc && sc.isBust) {
      this.triggerShake(12);
    }

    if (G.phase === 'result') {
      const myRes = G.results ? G.results[S.state ? S.state.me : ''] : null;
      if (myRes && (myRes.outcome === 'win' || myRes.outcome === 'blackjack')) {
        this.spawnCelebration(280, 200);
      }
    }
  },

  triggerShake(intensity = 10) {
    this.shakeRemaining = intensity;
  },

  spawnCelebration(x, y) {
    const colors = [0xfbbf24, 0xf59e0b, 0xec4899, 0xa855f7, 0x38bdf8, 0xffffff];
    for (let i = 0; i < 45; i++) {
      const p = new PIXI.Graphics();
      const col = colors[Math.floor(Math.random() * colors.length)];
      const isCoin = Math.random() > 0.4;

      if (isCoin) {
        p.beginFill(col);
        p.lineStyle(1, 0xffffff, 0.8);
        p.drawCircle(0, 0, 4 + Math.random() * 4);
        p.endFill();
      } else {
        p.beginFill(col);
        p.drawRect(-4, -4, 8, 8);
        p.endFill();
      }

      p.x = x + (Math.random() - 0.5) * 40;
      p.y = y + (Math.random() - 0.5) * 30;

      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 8;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 4; // 위로 솟구침
      p.vRot = (Math.random() - 0.5) * 0.3;
      p.alpha = 1;

      this.fxContainer.addChild(p);
      this.particles.push(p);
    }
  },

  cleanup() {
    if (this.app) {
      try {
        this.app.destroy(true, { children: true, texture: true, baseTexture: true });
      } catch (e) {
        // ignore
      }
      this.app = null;
    }
    this.dealerCards = [];
    this.myCards = [];
    this.particles = [];
    this.isInit = false;
    this.lastStateKey = '';
  }
};

// ---- 게임 UI 본체 ----
GameUI.blackjack = {
  render(c) {
    const fn = this['p_' + c.G.phase];
    return `<div class="stack bj-container">${fn ? fn.call(this, c) : ''}</div>`;
  },

  // Pixi 캔버스 마운트 헬퍼
  mountPixi(G) {
    setTimeout(() => {
      const mount = document.getElementById('bjPixiTableWrap');
      if (mount) {
        const ok = BlackjackPixiTable.init(mount);
        if (ok) BlackjackPixiTable.sync(G);
      }
    }, 20);
  },

  p_setup({ G, isHost }) {
    const s = G.settings;
    BlackjackPixiTable.cleanup();

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
    BlackjackPixiTable.cleanup();

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

    // Pixi.js 캔버스 마운트 트리거
    this.mountPixi(G);

    return `
      <!-- Pixi.js 아케이드 카지노 테이블 -->
      <div class="bj-table-outer">
        <div id="bjPixiTableWrap" class="bj-pixi-wrapper"></div>
        <div class="bj-table-hud">
          <div class="hud-dealer">
            <span>🤖 딜러</span>
            <small>${G.dealer.cards.some(c => c.hidden) ? '카드 1장 숨김' : `${G.dealer.scoreInfo.score}점`}</small>
          </div>
          ${myH ? `
            <div class="hud-player">
              <span>내 점수</span>
              <b class="${sc.isBust ? 'bust-txt' : sc.isBlackjack ? 'bj-txt' : ''}">
                ${sc.isBust ? '💥 BUST' : sc.isBlackjack ? '🌟 21점' : `${sc.score}점`}
              </b>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- 플레이어 컨트롤 버튼 (아케이드 히트/스탠드) -->
      ${myH && !myDone ? `
        <div class="glass center" style="padding:16px;">
          <div class="two-btns big">
            <button class="btn primary xl btn-arcade-hit" data-send="game.hit">
              🃏 히트 (한 장 더)
            </button>
            <button class="btn ghost xl btn-arcade-stand" data-send="game.stand">
              ✋ 스탠드 (멈춤)
            </button>
          </div>
        </div>
      ` : myH ? `
        <div class="glass center" style="padding:12px;">
          <p class="pulse-text" style="margin:0;">
            ${sc.isBust ? '💥 21점을 초과했습니다! 다른 플레이어의 턴을 기다립니다.' : '✋ 스탠드 완료! 딜러의 턴을 기다리는 중입니다.'}
          </p>
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

    // Pixi.js 결과 연출 트리거
    this.mountPixi(G);

    return `
      <!-- Pixi.js 아케이드 카지노 테이블 -->
      <div class="bj-table-outer">
        <div id="bjPixiTableWrap" class="bj-pixi-wrapper"></div>
        <div class="bj-table-hud">
          <div class="hud-dealer">
            <span>🤖 딜러 최종</span>
            <b>${dSc.isBust ? '💥 딜러 버스트' : `${dSc.score}점`}</b>
          </div>
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
          <button class="btn primary block" data-send="game.again" style="margin-top:14px; font-size:1.15rem; padding:14px;">
            🔁 한 판 더 하기!
          </button>
        ` : '<p class="pulse-text center" style="margin-top:12px;">방장이 다음 게임을 준비 중입니다…</p>'}
      </div>
    `;
  },
};
