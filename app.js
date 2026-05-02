let meuId;
let contacts = [];
let contatoSelecionado = null;
let peer;
let streamLocal;
let chamadaAtiva;
let onlinePeers = new Set();

// Configurado com a URL do Render em HTTPS
const backendUrl = 'https://radioptt.onrender.com';
const backendUrlObj = new URL(backendUrl);
const savedPeerId = localStorage.getItem('pttPeerId');

const meuIdDisplay = document.getElementById('meu-id');
const btnCopiarId = document.getElementById('btn-copiar-id');
const nomeContatoInput = document.getElementById('nome-contato');
const idContatoInput = document.getElementById('id-contato');
const btnAddContact = document.getElementById('btn-add-contact');
const listaContatos = document.getElementById('lista-contatos');
const statusConexao = document.getElementById('status-conexao');
const contatoSelecionadoText = document.getElementById('contato-selecionado');
const btnPtt = document.getElementById('btn-ptt');
const audioRecebido = document.getElementById('audio-recebido');
const searchInput = document.getElementById('search-contatos');
const onlineCount = document.getElementById('online-count');

// Elementos da sessão de Pop-up (Modal)
const sessaoFalar = document.getElementById('sessao-falar');
const btnVoltarLista = document.getElementById('btn-voltar-lista');

// Ativa o modo de segundo plano no Android assim que o dispositivo estiver pronto
document.addEventListener('deviceready', () => {
  if (window.cordova && window.cordova.plugins && window.cordova.plugins.backgroundMode) {
    window.cordova.plugins.backgroundMode.enable();
    window.cordova.plugins.backgroundMode.overrideBackButton();
    console.log('Modo de segundo plano ativado com sucesso.');
  }
}, false);

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

function atualizarOnlineCount() {
  onlineCount.innerText = onlinePeers.size;
}

function filtrarContatos() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    return contacts;
  }
  return contacts.filter((contact) => {
    return contact.name.toLowerCase().includes(query) || contact.id.toLowerCase().includes(query);
  });
}

function renderizarContatos() {
  const exibidos = filtrarContatos();

  if (exibidos.length === 0) {
    listaContatos.innerHTML = '<li class="empty-text">Nenhum contato encontrado.</li>';
    return;
  }

  listaContatos.innerHTML = exibidos.map((contact) => {
    const isOnline = onlinePeers.has(contact.id);
    const statusClass = isOnline ? 'status' : 'status-error';
    const statusText = isOnline ? 'Online' : 'Offline';

    return `
      <li>
        <div class="info">
          <strong>${contact.name}</strong><br>
          <small>${contact.id}</small>
          <span class="contact-status ${statusClass}">${statusText}</span>
        </div>
        <div>
          <button class="btn-chamar" data-id="${contact.id}">Chamar</button>
          <button class="btn-remover" data-id="${contact.id}">Remover</button>
        </div>
      </li>
    `;
  }).join('');
}

async function fetchContatos() {
  if (!meuId) return;
  try {
    const response = await fetch(`${backendUrl}/contacts?ownerId=${encodeURIComponent(meuId)}`);
    if (!response.ok) {
      throw new Error('Erro ao buscar contatos');
    }
    contacts = await response.json();
    renderizarContatos();
  } catch (err) {
    console.error(err);
    atualizaStatus('Falha ao carregar contatos do backend', '#dc3545');
  }
}

async function adicionarContato() {
  if (!meuId) {
    alert('Aguarde o PeerJS gerar seu ID antes de cadastrar contatos.');
    return;
  }

  const name = nomeContatoInput.value.trim();
  const id = idContatoInput.value.trim();

  if (!name || !id) {
    alert('Preencha nome e ID do contato.');
    return;
  }

  if (contacts.some((contact) => contact.id === id)) {
    alert('Esse ID já está cadastrado. Use outro contato.');
    return;
  }

  try {
    const response = await fetch(`${backendUrl}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: meuId, name, id }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Erro ao salvar contato');
    }

    contacts = await response.json();
    renderizarContatos();
    nomeContatoInput.value = '';
    idContatoInput.value = '';
    atualizaStatus('Contato cadastrado no backend', '#28a745');
  } catch (err) {
    console.error(err);
    alert('Não foi possível cadastrar contato. Verifique o backend e tente novamente.');
  }
}

async function removerContato(id) {
  if (!meuId) {
    alert('Aguarde o PeerJS gerar seu ID antes de remover contatos.');
    return;
  }

  try {
    const response = await fetch(`${backendUrl}/contacts/${encodeURIComponent(meuId)}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Erro ao remover contato');
    }
    contacts = await response.json();
    renderizarContatos();

    if (contatoSelecionado && contatoSelecionado.id === id) {
      contatoSelecionado = null;
      contatoSelecionadoText.innerText = '';
      fecharPopUp();
    }
  } catch (err) {
    console.error(err);
    alert('Não foi possível remover contato.');
  }
}

function selecionarContato(contact) {
  contatoSelecionado = contact;
  contatoSelecionadoText.innerText = `Contato selecionado: ${contact.name}`;
  abrirPopUp();
}

function copiarMeuId() {
  if (!meuId) return;
  navigator.clipboard.writeText(meuId)
    .then(() => {
      btnCopiarId.innerText = 'Copiado!';
      setTimeout(() => btnCopiarId.innerText = 'Copiar', 1200);
    })
    .catch(() => {
      alert('Não foi possível copiar o ID.');
    });
}

// Configuração ajustada para o Render (HTTPS)
const peerConfig = {
  host: backendUrlObj.hostname,
  port: 443,
  path: '/peerjs',
  secure: true,
  key: 'peerjs',
  debug: 3,
};

peer = new Peer(savedPeerId || undefined, peerConfig);

peer.on('open', (id) => {
  meuId = id;
  meuIdDisplay.innerText = meuId;
  if (!savedPeerId || savedPeerId !== id) {
    localStorage.setItem('pttPeerId', id);
  }
  atualizaStatus('Status: Aguardando contato', '#ffffff');
  console.log('Meu ID no PeerJS é: ' + id);
  socket.emit('register', id);
  fetchContatos();
});

peer.on('error', (err) => {
  console.error('PeerJS error:', err);
  const mensagem = err && err.type ? `${err.type}: ${err.message}` : (err && err.message ? err.message : 'Erro de conexão PeerJS');
  atualizaStatus(mensagem, '#dc3545');
});

peer.on('call', (call) => {
  chamadaAtiva = call;
  call.answer(streamLocal || null);

  const contatoExistente = contacts.find((c) => c.id === call.peer);
  const nomeContato = contatoExistente ? contatoExistente.name : `Contato ${call.peer}`;

  selecionarContato({ name: nomeContato, id: call.peer });
  atualizaStatus(`Chamada recebida de ${nomeContato}`, '#ffc107');

  call.on('stream', (remoteStream) => {
    audioRecebido.srcObject = remoteStream;
  });

  call.on('close', () => {
    finalizarChamada();
    fecharPopUp();
  });
  
  call.on('error', (err) => {
    console.error('Erro na chamada recebida:', err);
    atualizaStatus('Erro na chamada', '#dc3545');
  });
});

function iniciarChamada(contact) {
  if (!streamLocal) {
    alert('Microfone não está disponível. Verifique as permissões.');
    return;
  }

  if (chamadaAtiva && chamadaAtiva.peer === contact.id) {
    return;
  }

  if (chamadaAtiva) {
    chamadaAtiva.close();
  }

  streamLocal.getAudioTracks()[0].enabled = false;
  selecionarContato(contact);
  atualizaStatus(`Ligando para ${contact.name}...`, '#17a2b8');

  chamadaAtiva = peer.call(contact.id, streamLocal);
  chamadaAtiva.on('stream', (remoteStream) => {
    audioRecebido.srcObject = remoteStream;
  });
  chamadaAtiva.on('close', () => {
    finalizarChamada();
    fecharPopUp();
  });
  chamadaAtiva.on('error', (err) => {
    console.error('Erro na chamada:', err);
    atualizaStatus('Erro na chamada', '#dc3545');
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
  if (!contatoSelecionado) {
    alert('Selecione um contato antes de usar o PTT.');
    return;
  }

  if (!chamadaAtiva || chamadaAtiva.open === false) {
    iniciarChamada(contatoSelecionado);
  }

  if (streamLocal) {
    streamLocal.getAudioTracks()[0].enabled = true;
    btnPtt.classList.add('active');
    btnPtt.innerText = 'Falando...';
    atualizaStatus(`Transmitindo para ${contatoSelecionado.name}`, '#28a745');
  }
}

function pararTransmissao() {
  if (streamLocal) {
    streamLocal.getAudioTracks()[0].enabled = false;
    btnPtt.classList.remove('active');
    btnPtt.innerText = 'PTT';
    if (contatoSelecionado) {
      atualizaStatus(`Silenciado - ${contatoSelecionado.name}`, '#ffffff');
    }
  }
}

navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  .then((stream) => {
    streamLocal = stream;
    streamLocal.getAudioTracks()[0].enabled = false;
    console.log('Microfone pronto.');
  })
  .catch((err) => {
    alert('Erro ao acessar microfone. Ative as permissões.');
    console.error(err);
  });

btnAddContact.addEventListener('click', adicionarContato);
btnCopiarId.addEventListener('click', copiarMeuId);
searchInput.addEventListener('input', renderizarContatos);
listaContatos.addEventListener('click', (event) => {
  const target = event.target;
  const id = target.dataset.id;

  if (!id) return;

  if (target.classList.contains('btn-chamar')) {
    const contact = contacts.find((item) => item.id === id);
    if (contact) {
      iniciarChamada(contact);
    }
  }

  if (target.classList.contains('btn-remover')) {
    removerContato(id);
  }
});

btnPtt.addEventListener('mousedown', iniciarTransmissao);
btnPtt.addEventListener('mouseup', pararTransmissao);
btnPtt.addEventListener('touchstart', (e) => {
  e.preventDefault();
  iniciarTransmissao();
});
btnPtt.addEventListener('touchend', pararTransmissao);

btnVoltarLista.addEventListener('click', fecharPopUp);

socket.on('connect', () => {
  console.log('Conectado ao backend.');
  if (meuId) {
    socket.emit('register', meuId);
  }
});

socket.on('presence', (peers) => {
  onlinePeers = new Set(peers || []);
  atualizarOnlineCount();
  renderizarContatos();
});

socket.on('connect_error', () => {
  atualizaStatus('Não foi possível conectar ao backend', '#dc3545');
});

socket.on('disconnect', () => {
  atualizaStatus('Desconectado do backend', '#dc3545');
});
