const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_.,!?'"]/g, '');
const nameOf = (room, id) => (room.players.find((p) => p.id === id) || { name: '(나감)' }).name;
const fail = (msg) => { const e = new Error(msg); e.user = true; return e; };

module.exports = { shuffle, pick, norm, nameOf, fail };
