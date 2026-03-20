# API de WhatsApp – Rove+ Painel

Microserviço Node.js que recebe requisições HTTP e envia mensagens via **WhatsApp Web** (whatsapp-web.js). Pensado para integrar com o backend do Rove+ Painel.

## Requisitos

- Node.js 18+
- Número de WhatsApp (será ligado via QR Code)

## Instalação

```bash
cd whatsapp-api
npm install
```

## Como iniciar o servidor

```bash
node server.js
```

Ou, com o script do package.json:

```bash
npm start
```

O servidor sobe na **porta 3002** por defeito (ou na variável `PORT`), para não conflitar com o backend do Rove+ (3001). Na primeira execução aparece um **QR Code no terminal**.

No Rove+, define `WHATSAPP_API_URL=http://localhost:3002`.

## Testar a API

1. **Arranca a API** (num terminal): `npm start` e escaneia o QR Code se for a primeira vez.
2. **Estado da ligação:** no browser abre [http://localhost:3002/status](http://localhost:3002/status) — deve mostrar `{ "connected": true }` quando estiver ligado.
3. **Enviar mensagem de teste:** na pasta `whatsapp-api` corre  
   `node test-api.js`  
   (envia para 244922858762 por defeito). Para outro número:  
   `node test-api.js 244912345678`  
   Se usares `WHATSAPP_TOKEN`, define a variável antes:  
   `set WHATSAPP_TOKEN=teu_token` (Windows) ou `WHATSAPP_TOKEN=teu_token node test-api.js` (Linux/Mac).

## Como conectar o WhatsApp

1. No **telemóvel**, abre o WhatsApp.
2. Vai a **Definições** (ou Menu) → **Dispositivos ligados** → **Ligar um dispositivo**.
3. **Escaneia o QR Code** que aparece no terminal onde correu `node server.js`.
4. Quando ligar, no terminal aparece: **"WhatsApp conectado!"**
5. A sessão fica guardada em `.wwebjs_auth/` (LocalAuth). Nas próximas vezes pode não ser preciso escanear de novo, desde que não apagues essa pasta.

## Variáveis de ambiente

| Variável           | Obrigatório | Descrição |
|-------------------|-------------|-----------|
| `PORT`            | Não         | Porta do servidor (default: 3001). |
| `WHATSAPP_TOKEN`  | Recomendado | Token para o header `Authorization: Bearer ...`. Se não definires, a API aceita qualquer requisição (apenas para desenvolvimento). |

Exemplo `.env`:

```env
PORT=3001
WHATSAPP_TOKEN=seu_token_secreto
```

## Endpoints

### GET /status

Indica se o WhatsApp está ligado.

**Resposta (200):**

```json
{ "connected": true }
```

ou

```json
{ "connected": false }
```

---

### POST /send

Envia uma mensagem de texto para um número.

**Headers:**

- `Content-Type: application/json`
- `Authorization: Bearer WHATSAPP_TOKEN` (se `WHATSAPP_TOKEN` estiver definido)

**Body (JSON):**

```json
{
  "phone": "244XXXXXXXXX",
  "message": "texto da mensagem"
}
```

- `phone`: número com indicativo (ex: 244912345678 ou "244 912 345 678").
- `message`: texto a enviar.

**Sucesso (200):**

```json
{
  "success": true,
  "message": "Mensagem enviada"
}
```

**Erro (4xx/5xx):**

```json
{
  "success": false,
  "error": "descrição do erro"
}
```

Se o token estiver errado ou em falta (quando obrigatório): **401 Unauthorized**.

---

### GET /health

Estado do serviço e do WhatsApp (útil para monitorização). Não exige token.

```json
{ "ok": true, "whatsapp": true }
```

## Como o backend do Rove+ deve chamar a API

Configura no Rove+ as variáveis:

- `WHATSAPP_API_URL` = URL base da API (ex: `http://localhost:3001` ou `http://ip-da-vps:3001`)
- `WHATSAPP_TOKEN` = mesmo valor usado em `WHATSAPP_TOKEN` nesta API

Exemplo de envio a partir do backend (Node/Express):

```javascript
const ok = await fetch(process.env.WHATSAPP_API_URL + '/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + process.env.WHATSAPP_TOKEN,
  },
  body: JSON.stringify({
    phone: cliente.whatsapp,   // ex: "244 912 345 678"
    message: 'O seu acesso vence em 3 dias.',
  }),
})
const data = await ok.json()
if (!data.success) {
  console.error('Falha ao enviar WhatsApp:', data.error)
}
```

O serviço `server/services/whatsapp.ts` do Rove+ já usa `WHATSAPP_API_URL` e `WHATSAPP_TOKEN`; basta apontar a URL para esta API (ex: `http://localhost:3001`) e manter o mesmo formato de body (ou adaptar o whatsapp.ts para enviar `phone` e `message` neste formato, se ainda usar outro).

## Rodar em VPS ou Docker

- **VPS:** instalar Node.js, clonar/copiar a pasta, `npm install`, configurar `PORT` e `WHATSAPP_TOKEN`. Usar `pm2` ou `systemd` para manter o processo a correr (e garantir que o QR foi escaneado uma vez para a sessão ficar em `.wwebjs_auth`).
- **Docker:** criar uma imagem que execute `node server.js`, montar um volume em `.wwebjs_auth` para persistir a sessão. Na primeira vez será preciso aceder ao container (ou ao log) para ver o QR e escanear.

## Resumo do fluxo

```
Rove+ Backend  →  HTTP POST /send (phone, message)  →  WhatsApp API  →  whatsapp-web.js  →  WhatsApp Web  →  Cliente recebe a mensagem
```

Todo o código da API está no ficheiro **server.js**.
