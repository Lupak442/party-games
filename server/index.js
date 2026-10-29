require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const rooms = require('./rooms');

const app = express();
const server = http.createServer(app);

// 모바일 백그라운드 전환 등으로 끊겨도 빨리 감지하되, 너무 민감하지 않게
const io = new Server(server, { pingInterval: 10000, pingTimeout: 25000 });

app.get('/healthz', (req, res) => res.send('ok')); // 슬립 방지용 핑(UptimeRobot 등)
app.get('/r/:code', (req, res) => res.redirect('/?room=' + encodeURIComponent(req.params.code)));
app.use(express.static(path.join(__dirname, '..', 'public')));

rooms.init(io);
io.on('connection', (socket) => rooms.attach(socket));

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Party Games running on:`);
  console.log(`  - Local:   http://localhost:${PORT}`);
  console.log(`  - Network: http://192.168.0.200:${PORT}`);
});
