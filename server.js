const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { ExpressPeerServer } = require('peer');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// ====================== CONFIGURAÇÕES ======================
const io = new Server(server, {
  cors: { origin: "*" }
});

const peerServer = ExpressPeerServer(server, { 
  debug: true 
});

app.use('/peerjs', peerServer);
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Rota raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ====================== USUÁRIOS (em memória) ======================
const users = new Map();
users.set('admin', { name: 'Administrador', password: '123456' });
users.set('user1', { name: 'adriano', password: '123' });
users.set('user2', { name: 'Maria', password: '123' });

// ====================== TOKENS ======================
const tokens = new Map();

// ====================== LOGIN ======================
app.post('/login', (req, res) => {
  const { userId, password } = req.body;

  if (!userId || !password) {
    return res.status(400).json({ error: 'userId e password são obrigatórios' });
  }

  const user = users.get(userId);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  }

  const token = 'tok_' + Math.random().toString(36).substring(2, 15);
  tokens.set(token, userId);

  res.json({
    success: true,
    token,
    user: { id: userId, name: user.name }
  });
});

// Middleware de autenticação
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !tokens.has(token)) {
    return res.status(401).json({ error: 'Token inválido ou não informado' });
  }
  req.userId = tokens.get(token);
  next();
};

// ====================== CONTATOS ======================
const contactsByOwner = {};

app.get('/contacts', authenticate, (req, res) => {
  res.json(contactsByOwner[req.userId] || []);
});

app.post('/contacts', authenticate, (req, res) => {
  const { name, id } = req.body;
  if (!name || !id) {
    return res.status(400).json({ error: 'name e id são obrigatórios' });
  }

  if (!users.has(id)) {
    return res.status(404).json({ error: 'Usuário não existe' });
  }

  const contacts = contactsByOwner[req.userId] || [];
  if (contacts.some(c => c.id === id)) {
    return res.status(409).json({ error: 'Contato já existe' });
  }

  contacts.push({ name, id });
  contactsByOwner[req.userId] = contacts;
  res.json(contacts);
});

// ====================== SOCKET.IO ======================
const onlinePeers = new Map();

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  socket.on('register', ({ peerId, token }) => {
    if (!token || !tokens.has(token)) {
      socket.emit('auth_error', 'Token inválido');
      return socket.disconnect();
    }

    const userId = tokens.get(token);
    socket.userId = userId;
    socket.peerId = peerId;

    onlinePeers.set(peerId, userId);
    io.emit('presence', Array.from(onlinePeers.keys()));
  });

  socket.on('disconnect', () => {
    if (socket.peerId) {
      onlinePeers.delete(socket.peerId);
      io.emit('presence', Array.from(onlinePeers.keys()));
    }
  });
});

// ====================== INICIAR SERVIDOR ======================
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 Acesse: https://ptt-1-zfyj.onrender.com`);
});
