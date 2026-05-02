# HTTPS local para PTT Web

O navegador exige contexto seguro para usar microfone e WebRTC em muitos casos. Para desenvolvimento local, você pode usar `http://localhost:3000`, que é tratado como seguro pela maioria dos navegadores.

Se quiser forçar HTTPS local com certificados:

1. Instale `mkcert`:
   - Windows: https://github.com/FiloSottile/mkcert
2. Crie certificados para `localhost`:
   ```powershell
   mkcert -install
   mkcert localhost
   ```
3. Mova os arquivos gerados para `certs/` no projeto:
   - `certs/localhost-key.pem` -> `certs/localhost.key`
   - `certs/localhost.pem` -> `certs/localhost.crt`
4. Inicie o backend:
   ```powershell
   npm start
   ```
5. Abra no navegador:
   - `https://localhost:3000`

O servidor tentará usar HTTPS se encontrar os arquivos `certs/localhost.key` e `certs/localhost.crt`. Caso contrário, ele volta para HTTP automaticamente.

## Como iniciar o projeto

Para desenvolvimento, você precisa de dois servidores rodando:

1. **Servidor PeerJS** (porta 9000) - para sinalização WebRTC
2. **Backend Express** (porta 3000) - para contatos e presença

### Opção 1: Script automático (Windows)
```cmd
start.bat
```

### Opção 2: Terminal manual
Abra dois terminais:

Terminal 1:
```bash
npm run peer
```

Terminal 2:
```bash
npm start
```

### Opção 3: Desenvolvimento simultâneo
```bash
npm run dev
```

Depois acesse: `https://localhost:3000` ou `http://localhost:3000`
