/**
 * 파티 게임즈 룰북 & 도움말 시스템 (GAME_RULES & RuleModal)
 * - 대기실 게임 카드 우측 상단 (?) 버튼
 * - 인게임 헤더 [📖 룰] 버튼
 * - 9가지 게임별 3줄 핵심 요약, 상세 규칙, 승리 조건, 꿀팁 제공
 */

const GAME_RULES = {
  liar: {
    id: 'liar',
    icon: '🤥',
    name: '라이어 게임',
    tagline: '시민들 사이에 숨은 단 한 명의 라이어를 찾아라!',
    minPlayers: '3인 ~ 30인',
    time: '약 3~5분',
    badge: '추리 심리전',
    summary: [
      '<b>제시어 확인</b>: 시민들에게는 진짜 단어가, 라이어에게는 카테고리만 주어집니다.',
      '<b>힌트 핑퐁</b>: 순서대로 돌아가며 한 줄 힌트를 말합니다. (라이어는 아는 척 연기 필수!)',
      '<b>라이어 투표</b>: 의심되는 사람을 지목 투표하여 라이어를 밝혀냅니다.'
    ],
    winCondition: [
      '<b>시민 승리</b>: 투표로 라이어를 지목하고, 라이어가 마지막에 진짜 제시어를 못 맞히면 시민 승리!',
      '<b>라이어 승리</b>: 지목을 피하거나, 지목당해도 마지막 제시어 맞히기 기회에서 정답을 맞히면 역전 승리!'
    ],
    proTip: '시민은 라이어가 눈치채지 못하게 너무 노골적인 힌트는 피하고, 라이어는 앞사람 힌트에 슬쩍 숟가락을 얹으세요!'
  },

  fool: {
    id: 'fool',
    icon: '🤪',
    name: '바보 라이어',
    tagline: '내가 바보인 줄도 모르고 당당하게 힌트를 말하는 폭소 심리전!',
    minPlayers: '3인 ~ 30인',
    time: '약 3~5분',
    badge: '웃음 보장',
    summary: [
      '<b>단어 확인</b>: 모두에게 단어가 보이지만, 딱 1명(바보)에게만 미묘하게 다른 단어가 주어집니다!',
      '<b>힌트 핑퐁</b>: 자신이 라이어인 줄 전혀 모른 채 아주 당당하게 힌트를 말합니다.',
      '<b>바보 색출</b>: 서로의 힌트가 왜 이렇게 이상한지 눈치채고, 누가 엉뚱한 단어를 가진 바보인지 투표합니다.'
    ],
    winCondition: [
      '<b>시민 승리</b>: 투표로 진짜 바보 라이어를 검거하면 시민 승리!',
      '<b>바보 승리</b>: 억울한 다른 시민이 바보로 지목당하면 바보 라이어의 승리!'
    ],
    proTip: '힌트를 말할 때 사람들의 표정을 잘 살피세요. 나 혼자 딴소리를 하고 있다면 내가 바보일 수도 있습니다!'
  },

  cockroach: {
    id: 'cockroach',
    icon: '🪳',
    name: '바퀴벌레 포커',
    tagline: '뻔뻔한 거짓말과 블러핑의 대향연! 바퀴벌레를 모으면 바보가 된다!',
    minPlayers: '2인 ~ 6인',
    time: '약 5~10분',
    badge: '블러핑 명작',
    summary: [
      '<b>카드 건네기</b>: 내 차례에 카드 1장을 엎어서 한 사람에게 밀어주며 동물을 외칩니다. ("이거 바퀴벌레야!")',
      '<b>참/거짓 간파</b>: 카드를 받은 사람은 "진짜야!" 혹은 "거짓말이야!"를 외치거나, 몰래 확인 후 다른 사람에게 넘깁니다.',
      '<b>결과 공개</b>: 맞히면 건넨 사람이, 틀리면 받은 사람이 카드를 벌칙 패로 먹습니다.'
    ],
    winCondition: [
      '<b>패배 조건</b>: 어떤 동물 카드든 <b>같은 동물 4장</b>을 모으거나 손패가 다 떨어지면 즉시 꼴찌(바보 훈장 🪳🤪)가 됩니다!',
      '나머지 모든 플레이어는 공동 승리!'
    ],
    proTip: '진짜 바퀴벌레일 때 오히려 더 뻔뻔하게 "이거 바퀴벌레 맞아"라고 말하는 역블러핑을 활용해 보세요!'
  },

  speedquiz: {
    id: 'speedquiz',
    icon: '⚡️',
    name: '스피드 퀴즈',
    tagline: '제한 시간 동안 단어를 몸짓과 설명으로 맞춰라!',
    minPlayers: '2인 ~ 30인 (팀전 가능)',
    time: '턴당 60초',
    badge: '팀 배틀 아케이드',
    summary: [
      '<b>출제자 선정</b>: 출제자 1명이 화면에 뜨는 단어를 보고 팀원들에게 설명합니다.',
      '<b>설명 방식</b>: 말이나 몸짓으로 설명하되, 단어 자체나 글자 수를 직접 말하면 안 됩니다.',
      '<b>정답 & 패스</b>: 팀원이 맞히면 [정답!], 너무 어려우면 [패스]를 눌러 다음 단어로 넘어갑니다.'
    ],
    winCondition: [
      '제한 시간(60초) 동안 가장 많은 정답을 맞힌 팀이 높은 포인트를 획득합니다.'
    ],
    proTip: '어려운 단어에 시간을 끌지 말고 과감하게 패스하는 것이 고득점의 핵심 비결입니다!'
  },

  blackjack: {
    id: 'blackjack',
    icon: '🃏',
    name: '블랙잭 (21점 승부)',
    tagline: '컴퓨터 딜러와 펼치는 긴장감 넘치는 21점 카드 승부!',
    minPlayers: '1인 ~ 10인',
    time: '판당 1~2분',
    badge: '두뇌 카드 승부',
    summary: [
      '<b>카드 배분</b>: 플레이어와 딜러가 각각 2장씩 카드를 받습니다. (딜러는 1장만 공개)',
      '<b>히트 or 스탠드</b>: 21점에 가까워지도록 카드를 더 받을지([히트 🃏]), 멈출지([스탠드 ✋]) 결정합니다.',
      '<b>점수 계산</b>: 합계가 21을 넘으면 즉시 \'버스트(패배)\'! A는 1점 또는 11점, J/Q/K는 10점입니다.'
    ],
    winCondition: [
      '딜러보다 21점에 더 가깝거나, 딜러가 21을 넘어 버스트되면 승리!',
      '딜러(컴퓨터) 룰: 16점 이하는 무조건 카드를 뽑고, 17점 이상은 무조건 멈춥니다.'
    ],
    proTip: '딜러의 오픈 카드가 4, 5, 6처럼 불리할 때는 내 점수가 12~16점이어도 무리하게 뽑지 말고 스탠드하는 것이 유리합니다!'
  },

  dalmuti: {
    id: 'dalmuti',
    icon: '👑',
    name: '달무티 (신분 카드 게임)',
    tagline: '숫자가 작을수록 강하다! 신분 역전을 노리는 최고의 카드 털기 게임',
    minPlayers: '3인 ~ 8인',
    time: '약 10분',
    badge: '계급 역전',
    summary: [
      '<b>계급 카드</b>: 1번(달무티/왕)은 1장, 12번(농노)은 12장 존재합니다. 숫자가 작을수록 강합니다.',
      '<b>카드 내기</b>: 앞사람이 낸 카드의 장수와 같고, 숫자만 더 작은(더 강한) 카드를 내야 합니다.',
      '<b>손패 털기</b>: 손에 든 모든 카드를 가장 먼저 털어버린 사람이 1등(다음 판의 대달무티)이 됩니다.'
    ],
    winCondition: [
      '손패를 다 턴 순서대로 1등 달무티, 2등 총리, ... 꼴찌 대농노 계급이 결정됩니다.'
    ],
    proTip: '조커 카드(어릿광대)는 단독으로 내면 13번(최약)이지만, 다른 카드와 조합하면 만능 와일드 카드가 됩니다!'
  },

  chameleon: {
    id: 'chameleon',
    icon: '🦎',
    name: '카멜레온',
    tagline: '비밀 단어를 모르는 카멜레온을 찾아라! 들키지 않는 완벽한 위장술',
    minPlayers: '3인 ~ 8인',
    time: '약 5분',
    badge: '단어 잠입 추리',
    summary: [
      '<b>좌표 확인</b>: 주사위 2개를 굴려 16칸 단어 격자판에서 이번 판의 비밀 단어를 확인합니다. (카멜레온은 주사위 해독표가 없음!)',
      '<b>한 단어 힌트</b>: 모든 사람이 돌아가며 비밀 단어와 관련된 \'딱 한 단어\'를 말합니다. 카멜레온은 눈치껏 그럴듯한 단어를 말해 위장합니다.',
      '<b>투표 & 탈출</b>: 토론 후 카멜레온을 지목 투표합니다.'
    ],
    winCondition: [
      '<b>시민 승리</b>: 카멜레온을 투표로 찾아내고, 카멜레온이 16칸 중에서 비밀 단어를 못 맞히면 시민 승리!',
      '<b>카멜레온 승리</b>: 투표를 피하거나, 지목당해도 16칸 중에서 진짜 비밀 단어를 맞히면 카멜레온 승리!'
    ],
    proTip: '힌트가 너무 쉬우면 카멜레온이 단어를 바로 알아채고, 너무 어려우면 내가 카멜레온으로 몰릴 수 있습니다!'
  },

  manito: {
    id: 'manito',
    icon: '🎁',
    name: '비밀 마니또',
    tagline: '친구 모임과 파티를 더욱 훈훈하게 만드는 비밀 수호천사',
    minPlayers: '3인 ~ 30인',
    time: '파티 내내 진행',
    badge: '훈훈한 파티',
    summary: [
      '<b>비밀 매칭</b>: 각자 몰래 챙겨줄 한 사람(내 마니또)을 무작위로 배정받습니다.',
      '<b>비밀 임무</b>: 파티 동안 상대방이 눈치채지 못하게 칭찬, 간식 챙기기, 도움 주기를 실천합니다.',
      '<b>결과 공개</b>: 정해진 시간에 모여 "내 마니또가 누구였을까?"를 추리하고 밝혀냅니다!'
    ],
    winCondition: [
      '훈훈한 파티 보너스 점수 및 서로의 따뜻한 우정 확인!'
    ],
    proTip: '너무 대놓고 잘해주면 금방 들통납니다. 자연스럽게 챙겨주는 센스가 포인트!'
  },

  yacht: {
    id: 'yacht',
    icon: '🎲',
    name: '1인용 요트 다이스',
    tagline: '5개의 주사위로 만드는 13가지 환상의 족보! 방 1등 휘장을 차지하라',
    minPlayers: '1인 솔로플레이 & 랭킹 경쟁',
    time: '13라운드 (약 3~4분)',
    badge: '대기 중 혼자 놀기',
    summary: [
      '<b>주사위 굴리기</b>: 5개의 주사위를 굴리고, 마음에 드는 주사위는 [터치 킵]하여 보관합니다. (턴당 최대 3번 굴림)',
      '<b>족보 채우기</b>: 13개의 점수 칸 중 가장 유리한 항목을 선택해 점수를 기록합니다. (이미 채운 칸은 재사용 불가)',
      '<b>상단 보너스</b>: 상단(1~6)의 합이 63점 이상이면 +35점 대박 보너스 획득!'
    ],
    winCondition: [
      '13라운드 완료 후 최종 점수가 방 내 1등일 경우, 닉네임 옆에 영예의 <b>[🎲👑 주사위 킹]</b> 휘장이 영구 각인됩니다!'
    ],
    proTip: '하단 족보 점수 기준: 트리플/포카드/풀하우스(눈의 총합), 스몰 스트레이트(20점), 라지 스트레이트(40점), 요트(50점)!'
  }
};

/**
 * 룰북 바텀시트 모달 컨트롤러
 */
const RuleModal = {
  el: null,

  init() {
    if (this.el) return;
    const wrap = document.createElement('div');
    wrap.id = 'ruleModal';
    wrap.className = 'rule-modal';
    wrap.innerHTML = `
      <div class="rule-modal-backdrop" onclick="RuleModal.close()"></div>
      <div class="rule-modal-sheet" role="dialog" aria-modal="true">
        <div class="rule-sheet-handle-bar"></div>
        <div class="rule-modal-header">
          <div class="rule-title-row">
            <span class="rule-icon" id="rmIcon">🎲</span>
            <div>
              <h3 id="rmName">게임 이름</h3>
              <p class="rule-tagline" id="rmTagline">한 줄 설명</p>
            </div>
          </div>
          <button class="rule-close-btn" onclick="RuleModal.close()" aria-label="닫기">✕</button>
        </div>

        <div class="rule-meta-chips" id="rmMetaChips">
          <span class="rule-chip" id="rmPlayers">👥 3인~</span>
          <span class="rule-chip" id="rmTime">⏱️ 약 5분</span>
          <span class="rule-chip badge-gold" id="rmBadge">🎮 파티 게임</span>
        </div>

        <div class="rule-modal-body" id="rmBody">
          <!-- 3줄 핵심 요약 -->
          <div class="rule-section">
            <div class="rule-sec-title">⚡️ 3줄 핵심 요약</div>
            <div class="rule-quick-box" id="rmQuickBox"></div>
          </div>

          <!-- 승리 조건 -->
          <div class="rule-section">
            <div class="rule-sec-title">🏆 승리 조건</div>
            <div class="rule-win-box" id="rmWinBox"></div>
          </div>

          <!-- 꿀팁 -->
          <div class="rule-section" id="rmTipSec">
            <div class="rule-sec-title">💡 플레이 꿀팁</div>
            <div class="rule-tip-box" id="rmTipBox"></div>
          </div>
        </div>

        <div class="rule-modal-footer">
          <button class="btn primary block" onclick="RuleModal.close()">알겠어요! 닫기</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    this.el = wrap;

    // ESC 키로 닫기
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.el && this.el.classList.contains('active')) {
        this.close();
      }
    });
  },

  open(gameId) {
    this.init();
    const rule = GAME_RULES[gameId];
    if (!rule) {
      console.warn('Rule not found for:', gameId);
      return;
    }

    const $ = (id) => this.el.querySelector(id);
    $('#rmIcon').textContent = rule.icon || '🎲';
    $('#rmName').textContent = rule.name;
    $('#rmTagline').textContent = rule.tagline || '';
    $('#rmPlayers').textContent = `👥 ${rule.minPlayers || '자유'}`;
    $('#rmTime').textContent = `⏱️ ${rule.time || '약 5분'}`;
    $('#rmBadge').textContent = rule.badge || '파티 게임';

    // 3줄 요약 렌더
    const qb = $('#rmQuickBox');
    qb.innerHTML = (rule.summary || []).map((s, idx) => `
      <div class="rule-step-item">
        <span class="step-num">${idx + 1}</span>
        <span class="step-text">${s}</span>
      </div>
    `).join('');

    // 승리 조건
    const wb = $('#rmWinBox');
    wb.innerHTML = (rule.winCondition || []).map((w) => `
      <div class="rule-win-item">✨ ${w}</div>
    `).join('');

    // 팁
    const tb = $('#rmTipBox');
    if (rule.proTip) {
      $('#rmTipSec').style.display = 'block';
      tb.innerHTML = `💡 ${rule.proTip}`;
    } else {
      $('#rmTipSec').style.display = 'none';
    }

    // 모달 표시
    this.el.classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  close() {
    if (!this.el) return;
    this.el.classList.remove('active');
    document.body.style.overflow = '';
  }
};

// 전역 등록
window.GAME_RULES = GAME_RULES;
window.RuleModal = RuleModal;
