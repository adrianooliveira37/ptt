const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const { ExpressPeerServer } = require('peer');
const cors = require('cors');

const app = express();
const certDir = path.join(__dirname, 'certs');
const certKeyPath = path.join(certDir, 'localhost.key');
const certCertPath = path.join(certDir, 'localhost.crt');
let server;
let serverProtocol = 'http';

// Para rede local, usar HTTP é mais simples
// Para produção remota, descomentar a lógica HTTPS abaixo
const forceHttp = true;

if (!forceHttp && fs.existsSync(certKeyPath) && fs.existsSync(certCertPath)) {
  const httpsOptions = {
    key: fs.readFileSync(certKeyPath),
    cert: fs.readFileSync(certCertPath),
  };
  server = https.createServer(httpsOptions, app);
  serverProtocol = 'https';
  console.log('Usando HTTPS local com certificados em certs/');
} else {
  server = http.createServer(app);
  console.log('Certificados HTTPS não encontrados ou desativados. Usando HTTP local.');
}
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const peerServer = ExpressPeerServer(server, {
  debug: true,
});
app.use('/peerjs', peerServer);

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const contactsByOwner = {};
const onlinePeers = new Set();

function broadcastPresence() {
  io.emit('presence', Array.from(onlinePeers));
}

app.get('/contacts', (req, res) => {
  const ownerId = req.query.ownerId;
  if (!ownerId) {
    return res.status(400).json({ error: 'ownerId é obrigatório' });
  }
  res.json(contactsByOwner[ownerId] || []);
});

app.post('/contacts', (req, res) => {
  const { ownerId, name, id } = req.body;
  if (!ownerId || !name || !id) {
    return res.status(400).json({ error: 'ownerId, name e id são obrigatórios' });
  }

  const contacts = contactsByOwner[ownerId] || [];
  if (contacts.some((contact) => contact.id === id)) {
    return res.status(409).json({ error: 'Contato já cadastrado' });
  }

  contacts.push({ name, id });
  contactsByOwner[ownerId] = contacts;
  res.json(contacts);
});

app.delete('/contacts/:ownerId/:contactId', (req, res) => {
  const { ownerId, contactId } = req.params;
  if (!ownerId || !contactId) {
    return res.status(400).json({ error: 'ownerId e contactId são obrigatórios' });
  }

  const contacts = contactsByOwner[ownerId] || [];
  const filtered = contacts.filter((contact) => contact.id !== contactId);
  contactsByOwner[ownerId] = filtered;
  res.json(filtered);
});

io.on('connection', (socket) => {
  socket.on('register', (peerId) => {
    if (!peerId) return;
    socket.peerId = peerId;
    onlinePeers.add(peerId);
    broadcastPresence();
  });

  socket.on('disconnect', () => {
    if (socket.peerId) {
      onlinePeers.delete(socket.peerId);
      broadcastPresence();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend rodando em ${serverProtocol}://0.0.0.0:${PORT}`);
  console.log(`Acesse via IP local em ${serverProtocol}://192.168.88.57:${PORT}`);
});
