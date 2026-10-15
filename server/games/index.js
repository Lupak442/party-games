/**
 * 게임 레지스트리. 새 게임 추가 방법:
 *  1) server/games/내게임.js 를 만들고 아래 인터페이스를 export
 *     { id, name, icon, desc, minPlayers,
 *       init(room) -> state,
 *       handle(room, player, type, payload, ctx),   // 사용자 오류는 throw fail('메시지')
 *       view(room, player) -> 해당 플레이어에게 보낼 JSON }
 *  2) 아래 list 에 추가
 *  3) public/js/games/내게임.js 에서 GameUI.내게임 = { render(c) } 등록 후 index.html 에 script 추가
 */
const manito = require('./manito');
const { liar, fool } = require('./liar');
const speedquiz = require('./speedquiz');
const blackjack = require('./blackjack');
const cockroach = require('./cockroach');

const list = [manito, liar, fool, speedquiz, blackjack, cockroach];
const byId = Object.fromEntries(list.map((g) => [g.id, g]));

module.exports = {
  get: (id) => byId[id],
  catalog: () => list.map((g) => ({ id: g.id, name: g.name, icon: g.icon, desc: g.desc, minPlayers: g.minPlayers })),
};
