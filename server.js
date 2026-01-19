const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// 通話ルーム管理
const rooms = new Map();

io.on('connection', (socket) => {
    // 1. 通話作成
    socket.on('create-room', (roomId) => {
        if (rooms.has(roomId)) {
            socket.emit('room-error', 'そのIDは使用中です');
        } else {
            rooms.set(roomId, { hostId: socket.id, locked: false });
            socket.join(roomId);
            socket.emit('room-created', roomId);
        }
    });

    // 2. 参加リクエスト
    socket.on('request-join', (data) => {
        const room = rooms.get(data.roomId);
        if (!room) return socket.emit('join-error', '通話が見つかりません');
        if (room.locked) return socket.emit('join-error', 'ロックされています');
        // 主催者に承認要請（音を鳴らす指示）
        io.to(room.hostId).emit('admin-approval-request', { senderId: socket.id, nickname: data.nickname });
    });

    // 3. 承認処理
    socket.on('approve-user', (targetId) => {
        io.to(targetId).emit('join-approved');
    });

    // 4. チャット・メンション
    socket.on('send-chat', (data) => {
        io.to(data.roomId).emit('receive-chat', data);
    });

    // 5. 管理者機能
    socket.on('admin-action', (data) => {
        const room = rooms.get(data.roomId);
        if (room && room.hostId === socket.id) {
            if (data.type === 'lock') {
                room.locked = !room.locked;
                io.to(data.roomId).emit('sys-msg', `通話ロックが${room.locked ? "ON" : "OFF"}になりました`);
            }
            if (data.type === 'kick-all') {
                io.to(data.roomId).emit('force-exit');
                rooms.delete(data.roomId);
            }
        }
    });

    // 切断時の処理
    socket.on('disconnect', () => {
        // 主催者が落ちたら部屋を消すなどの処理が必要ならここに追加
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server Running'));
