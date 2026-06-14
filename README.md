# 🃏 Poker Trainer

Plataforma de **treino e simulação de Poker (Texas Hold'em No-Limit)** com avaliador de mãos, engine de jogo, bots, torneios MTT em tempo real e um tutor com IA (Google Gemini).

> **Convenção de score:** em todo o sistema, **maior = mais forte**. As cartas privadas (_hole cards_) **nunca** são enviadas ao cliente.

---

## 🧰 Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router, `src/`, TypeScript) |
| Estilo | Tailwind CSS |
| Banco de dados | PostgreSQL (Supabase) via Prisma ORM 6 |
| Autenticação | NextAuth.js 4 (Credentials + Google), bcryptjs |
| Tempo real | Pusher |
| IA / Tutor | Google Gemini (`@google/generative-ai`) |
| Validação | Zod |

---

## 🚀 Começando

### 1. Pré-requisitos
- Node.js 20+
- Conta Supabase (PostgreSQL)

### 2. Instalar dependências
```bash
npm install
```

### 3. Variáveis de ambiente
Copie o exemplo e preencha com suas credenciais:
```bash
cp .env.example .env.local
```
Os arquivos `.env` e `.env.local` são ignorados pelo Git e **nunca** devem ser comitados.

### 4. Banco de dados
```bash
npx prisma db push      # sincroniza o schema com o Supabase
npx prisma generate     # gera o Prisma Client
```

### 5. Rodar em desenvolvimento
```bash
npm run dev
```
Abra [http://localhost:3000](http://localhost:3000).

---

## 📜 Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Servidor de produção |
| `npm run lint` | ESLint |

---

## 🗺️ Roadmap

| Fase | Entrega |
|---|---|
| **Pré-Fase** | Scaffold + banco + auth ✅ |
| **Fase 0** | Avaliador de mãos (lookup table) + ShowdownManager |
| **Fase 1** | Engine de jogo (estado da mesa, rodadas de aposta) |
| **Fase 2** | Regras de poker + bots |
| **Fase 3** | Torneios MTT + tempo real (Pusher) |
| **Fase 4** | Frontend completo + tutor com IA |

Detalhes completos em [`INSTRUCOES_PASSO_A_PASSO.md`](./INSTRUCOES_PASSO_A_PASSO.md) e [`PRD.md`](./PRD.md).

---

## 🔄 Versionamento e Releases

O projeto usa **[Conventional Commits](https://www.conventionalcommits.org/)** e **[release-please](https://github.com/googleapis/release-please)**:

- Commits seguem o padrão `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`, `ci:`.
- A cada push na `main`, o release-please abre/atualiza um **PR de release** com o `CHANGELOG.md` e o bump de versão (semver) calculado automaticamente.
- Ao mergear esse PR, é criada uma **tag** e uma **GitHub Release** automaticamente.

| Tipo de commit | Efeito na versão |
|---|---|
| `fix:` | patch (0.1.**0** → 0.1.**1**) |
| `feat:` | minor (0.**1**.0 → 0.**2**.0) |
| `feat!:` / `BREAKING CHANGE` | major (**0**.1.0 → **1**.0.0) |

---

## 📄 Licença

Privado / proprietário.
