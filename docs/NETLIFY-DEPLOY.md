# Deploy no Netlify

Guia para publicar o projeto Rove+ (frontend + API) no Netlify.

---

## Opção A – Só frontend no Netlify (API noutro sítio)

Se a **API já está na Vercel** (ou noutro servidor), podes publicar só o frontend no Netlify.

### 1. Conta e repositório

1. Entra em [netlify.com](https://netlify.com) e faz login (GitHub/GitLab/Bitbucket).
2. O projeto tem de estar num repositório Git.

### 2. Novo site

1. **Add new site** → **Import an existing project**.
2. Liga o repositório (autoriza o Netlify se for preciso).
3. Escolhe o repositório do Rove+.

### 3. Definições de build

| Campo | Valor |
|-------|--------|
| **Build command** | `npm run build` |
| **Publish directory** | `dist` |
| **Base directory** | (vazio) |

### 4. Variáveis de ambiente

Em **Site configuration** → **Environment variables** → **Add a variable** (ou **Add env vars**):

| Nome | Valor | Notas |
|------|--------|--------|
| `VITE_API_URL` | `https://teu-projeto.vercel.app` | URL da API (ex.: a que está na Vercel). Se deixares vazio, o frontend usa o mesmo domínio (não serve para API noutro sítio). |

Guarda e faz **Deploy site**.

### 5. Redirects (SPA)

Para o React Router funcionar (evitar 404 ao abrir `/login`, `/clientes`, etc.), no Netlify: **Site configuration** → **Build & deploy** → **Post processing** → **Redirects** (ou **Redirects** no menu). Adiciona:

| From | To | Status |
|------|-----|--------|
| `/*` | `/index.html` | 200 |

Alternativa: cria na raiz **`public/_redirects`** com a linha `/*    /index.html   200`. O Vite copia o conteúdo de `public` para `dist`, por isso o deploy vai incluir este ficheiro.

---

## Opção B – Frontend + API no Netlify (full stack)

Aqui o Netlify serve o frontend (Vite) e a API (Express como Netlify Function).

### 1. Ficheiros já criados no projeto

- **`netlify.toml`** – build, publish, redirects e configuração das functions.
- **`netlify/functions/api.mjs`** – function que expõe a app Express.
- **`scripts/copy-server-for-netlify.js`** – copia o output da API para a function (corre no build).

### 2. Dependência

Instala no projeto (se ainda não tiveres):

```bash
npm install serverless-http
```

### 3. Novo site no Netlify

1. **Add new site** → **Import an existing project** → escolhe o repo.
2. O Netlify usa o **`netlify.toml`** da raiz; não precisas de preencher build command nem publish directory na UI (a não ser que queiras sobrepor).

### 4. Variáveis de ambiente

Em **Site configuration** → **Environment variables**:

| Nome | Valor | Obrigatório |
|------|--------|-------------|
| `DATABASE_URL` | `postgresql://...` (Neon, Supabase, etc.) | Sim |
| `JWT_SECRET` | Chave longa e aleatória | Sim |
| `NODE_VERSION` | `20` | Recomendado (pode estar no netlify.toml) |

Opcionais: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `VITE_API_URL` (vazio se front e API no mesmo domínio), WhatsApp, Cron, etc.

### 5. Deploy

1. **Deploy site** (ou push para a branch ligada).
2. O build vai:
   - `npm run db:generate`
   - `npm run build:api` (gera `server/dist`)
   - `npm run build` (frontend em `dist`)
   - `node scripts/copy-server-for-netlify.js` (copia `server/dist` para a function)
3. O Netlify publica `dist/` e a function que trata de `/api/*`.

### 6. Primeira vez – base de dados

À primeira, cria tabelas e admin na BD (no teu PC, com a mesma `DATABASE_URL` no `.env`):

```bash
npx prisma db push
npx tsx prisma/seed.ts
```

---

## Resumo

| Opção | Quando usar | API |
|-------|-------------|-----|
| **A** | Já tens a API na Vercel (ou noutro URL) | Noutro sítio; defines `VITE_API_URL` |
| **B** | Queres tudo no Netlify | Netlify Function (Express com serverless-http) |

Para **variáveis obrigatórias** (DATABASE_URL, JWT_SECRET) e pormenores, vê também **`docs/VERCEL-DEPLOY-PONTO-4.md`** (a lista é a mesma para produção).
