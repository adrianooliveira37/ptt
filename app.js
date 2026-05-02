let meuId;
let meuNome = localStorage.getItem('pttMeuNome') || '';
let contatoSelecionado = null;
let peer;
let streamLocal;
let chamadaAtiva;
let onlineUsers = []; // Lista completa de objetos { id, name } vindos do servidor

const backendUrl = 'https://radioptt.onrender.com';
const backendUrlObj = new URL(backendUrl);

const meuNomeInput = document.getElementById('meu-nome-input');
const meuNomeDisplay = document.getElementById('meu-nome-display');
const btnSalvarNome = document.getElementById('btn-salvar-nome');
const listaContatos = document.getElementById('lista-contatos');
const statusConexao = document.getElementById('status-conexao');
const contatoSelecionadoText = document.getElementById('contato-selecionado');
const btnPtt = document.getElementById('btn-ptt');
const audioRecebido = document.getElementById('audio-recebido');
const onlineCount = document.getElementById('online-count');

// Elementos do Modal
const sessaoFalar = document.getElementById('sessao-falar');
const btnVoltarLista = document.getElementById('btn-voltar-lista');

if (meuNome) {
  meuNomeDisplay.innerText = meuNome;
  meuNomeInput.value = meuNome;
}

const socket = io(backendUrl);

function abrirPopUp() {
  sessaoFalar.classList.add('ativa');
}

function fecharPopUp() {
  sessaoFalar.classList.remove('ativa');
  finalizarChamada();
}

function atualizaStatus(texto, cor = '#28a745') {
  statusConexao.innerText = texto;
  statusConexao.style.color = cor;
}

function renderizarDispositivos() {
  // Filtra para não mostrar você mesmo na lista de quem você pode chamar
  const outrosUsuarios = onlineUsers.filter(u => u.id !== meuId);
  onlineCount.innerText = outrosUsuarios.length;

  if (outrosUsuarios.length === 0) {
    listaContatos.innerHTML = '<li class="empty-text">Nenhum outro dispositivo online no momento.</li>';
    return;
  }

  listaContatos.innerHTML = outrosUsuarios.map((u) => `
    <li>
      <div class="info">
        <strong>${u.name || 'Dispositivo sem nome'}</strong><br>
        <small style="color: #666;">ID: ${u.id}</small>
      </div>
      <button class="btn-chamar" data-id="${u.id}" data-name="${u.name || 'Dispositivo'}">Conversar</button>
    </li>
  `).join('');
}

btnSalvarNome.addEventListener('click', () => {
  const nome = meuNomeInput.value.trim();
  if (!nome) return alert('Por favor, digite um nome válido.');
  meuNome = nome;
  localStorage.setItem('pttMeuNome', nome);
  meuNomeDisplay.innerText = nome;
  
  if (meuId) {
    socket.emit('register', { peerId: meuId, name: meuNome });
  }
  alert('Nome salvo com sucesso!');
});

// Configuração para o Render
const peerConfig = {
  host: backendUrlObj.hostname,
  port: 443,
  path: '/peerjs',
  secure: true,
  key: 'peerjs',
  debug: 3,
};

peer = new Peer(undefined, peerConfig);

peer.on('open', (id) => {
  meuId = id;
  console.log('Meu ID no PeerJS:', id);
  socket.emit('register', { peerId: meuId, name: meuNome });
});

peer.on('call', (call) => {
  chamadaAtiva = call;
  call.answer(streamLocal || null);

  const outroUser = onlineUsers.find(u => u.id === call.peer);
  const nomeExibicao = outroUser && outroUser.name ? outroUser.name : 'Outro Dispositivo';

  contatoSelecionado = { id: call.peer, name: nomeExibicao };
  contatoSelecionadoText.innerText = `Em chamada com: ${nomeExibicao}`;
  
  abrirPopUp();
  atualizaStatus('Chamada recebida!', '#ffc107');

  call.on('stream', (remoteStream) => {
    audioRecebido.srcObject = remoteStream;
  });
  call.on('close', () => {
    fecharPopUp();
  });
});

function iniciarChamada(id, name) {
  if (!streamLocal) {
    alert('Microfone não está pronto. Verifique as permissões.');
    return;
  }
  contatoSelecionado = { id, name };
  contatoSelecionadoText.innerText = `Em chamada com: ${name}`;
  abrirPopUp();
  atualizaStatus(`Chamando ${name}...`, '#17a2b8');

  chamadaAtiva = peer.call(id, streamLocal);
  chamadaAtiva.on('stream', (remoteStream) => {
    audioRecebido.srcObject = remoteStream;
  });
  chamadaAtiva.on('close', () => {
    fecharPopUp();
  });
}

function finalizarChamada() {
  if (chamadaAtiva) {
    chamadaAtiva.close();
    chamadaAtiva = null;
  }
  if (streamLocal) {
    streamLocal.getAudioTracks()[0].enabled = false;
  }
  btnPtt.classList.remove('active');
  btnPtt.innerText = 'PTT';
  atualizaStatus('Chamada encerrada', '#999');
}

function iniciarTransmissao() {
  if (!contatoSelecionado) return;
  if (streamLocal) {
    streamLocal.getAudioTracks()[0].enabled = true;
    btnPtt.classList.add('active');
    btnPtt.innerText = 'Falando...';
    atualizaStatus(`Transmitindo áudio...`, '#28a745');
  }
}

function pararTransmissao() {
  if (streamLocal) {
    streamLocal.getAudioTracks()[0].enabled = false;
    btnPtt.classList.remove('active');
    btnPtt.innerText = 'PTT';
    atualizaStatus('Silenciado', '#ffffff');
  }
}

navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  .then((stream) => {
    streamLocal = stream;
    streamLocal.getAudioTracks()[0].enabled = false;
    console.log('Microfone pronto para uso.');
  })
  .catch((err) => {
    alert('Erro ao acessar microfone.');
    console.error(err);
  });

listaContatos.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-chamar')) {
    const id = e.target.dataset.id;
    const name = e.target.dataset.name;
    iniciarChamada(id, name);
  }
});

btnPtt.addEventListener('mousedown', iniciarTransmissao);
btnPtt.addEventListener('mouseup', pararTransmissao);
btnPtt.addEventListener('touchstart', (e) => { e.preventDefault(); iniciarTransmissao(); });
btnPtt.addEventListener('touchend', pararTransmissao);

btnVoltarLista.addEventListener('click', fecharPopUp);

socket.on('connect', () => {
  if (meuId) socket.emit('register', { peerId: meuId, name: meuNome });
});

socket.on('presence', (users) => {
  onlineUsers = users || [];
  renderizarDispositivos();
});
