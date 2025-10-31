// server/index.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.get('/', (req, res) => res.send('Socket.IO chat server running'));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // for dev; tighten in prod to your client origin
    methods: ['GET', 'POST'],
  },
});

/**
 * Simple in-memory user tracking:
 * rooms -> { socketId: username }
 */
const users = new Map(); // socketId -> { username, room }

io.on('connection', (socket) => {
  console.log('Client connected', socket.id);

  // join room
  socket.on('join', ({ username, room }, cb) => {
    if (!username || !room) return cb && cb({ status: 'error', message: 'username and room required' });

    users.set(socket.id, { username, room });
    socket.join(room);

    // notify others in room
    socket.to(room).emit('user-joined', { id: socket.id, username });
    // send current users in room to the joined socket
    const roomUsers = [];
    for (const [id, u] of users.entries()) {
      if (u.room === room) roomUsers.push({ id, username: u.username });
    }

    socket.emit('joined', { id: socket.id, username, room, users: roomUsers });
    io.in(room).emit('room-users', roomUsers);

    cb && cb({ status: 'ok' });
  });

  // handle chat message
  socket.on('message', (payload, cb) => {
    const u = users.get(socket.id);
    if (!u) return cb && cb({ status: 'error', message: 'not joined' });

    const msg = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      text: payload.text || '',
      username: u.username,
      socketId: socket.id,
      at: new Date().toISOString(),
    };

    io.in(u.room).emit('message', msg);
    cb && cb({ status: 'ok' });
  });

  // typing indicator
  socket.on('typing', (isTyping) => {
    const u = users.get(socket.id);
    if (!u) return;
    socket.to(u.room).emit('typing', { id: socket.id, username: u.username, isTyping });
  });

  // disconnect
  socket.on('disconnect', () => {
    const u = users.get(socket.id);
    if (u) {
      users.delete(socket.id);
      socket.to(u.room).emit('user-left', { id: socket.id, username: u.username });
      // update room user list
      const roomUsers = [];
      for (const [id, uu] of users.entries()) {
        if (uu.room === u.room) roomUsers.push({ id, username: uu.username });
      }
      io.in(u.room).emit('room-users', roomUsers);
    }
    console.log('Client disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`Socket server listening on ${PORT}`));
