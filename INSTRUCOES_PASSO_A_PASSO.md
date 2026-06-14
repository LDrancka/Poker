# Guia de Implementação Passo a Passo
## Sistema de Treinamento e Simulação de Poker Texas Hold'em

Este guia detalha a implementação completa do aplicativo web de poker utilizando **Next.js (App Router)**, **TypeScript**, **Supabase (PostgreSQL + Prisma ORM)**, **Pusher** e a **API do Google Gemini** com regras estáticas do Material de Apoio.

> **Estratégia de desenvolvimento**: Trabalharemos **localmente** (`localhost:3000`) até ter uma versão funcional. O deploy para Vercel (produção) só acontece no Passo 14.

---

## Roadmap de Implementação Priorizado (Fases 0–4)

Os passos deste guia são a **referência técnica** de cada módulo. A **ordem de execução**, porém, segue as 5 fases abaixo — organizadas por dependência e risco. Cada fase aponta o(s) passo(s) onde o código vive e os critérios de "pronto" (DoD). **Regra de ouro:** não avançar de fase sem os testes da fase anterior verdes.

### Fase 0 — Fundação confiável (bloqueia todo o resto) · *Passos 5, 6, 13*
Sem avaliação e showdown corretos e testados, todo o resto é construído sobre areia. Foi aqui que estavam os bugs críticos de corretude.

| # | Item | Passo | Esforço | DoD |
|---|------|-------|---------|-----|
| 0.1 | Port do avaliador por **lookup table** (tabelas do `phevaluator` → JS/WASM) | 5 | M | Avalia 5–7 cartas em <2ms; convenção `maior=mais forte` |
| 0.2 | Testes unitários do avaliador contra os vetores do `phevaluator` + bordas (wheel, royal, kicker, split) | 13 | M | 100% dos vetores batem; ranking total verificado |
| 0.3 | Testes do `ShowdownManager` (side pots multi all-in, split, odd chip à esquerda do dealer, uncontested) | 13 | S | Cenários do Passo 6 passam |
| 0.4 | Refino de empate no Monte Carlo (0.5 por tie em vez de descartar) | 5 | XS | Coin-flip conhecido (AKs vs QQ) dentro de ±1% |

### Fase 1 — Engine joga uma mão sozinha · *Passo 4*
O RF02 só existe de verdade depois disto. Pré-requisito do modo treino e do MTT.

| # | Item | Passo | Esforço | DoD |
|---|------|-------|---------|-----|
| 1.1 | `applyAction(state, idx, action, amount)` — fichas, `currentBet`/`pot`, `totalBetThisHand` | 4 | M | Sequência FOLD/CALL/RAISE/ALL-IN produz estado correto |
| 1.2 | Validação de **min-raise** (No-Limit) e ações ilegais rejeitadas | 4 | S | Raise < incremento anterior é recusado |
| 1.3 | Detecção de **fim de rodada** + avanço de turno (pula folds/all-ins) | 4 | M | Street só avança quando todos igualam ou all-in |
| 1.4 | **Run-out de all-in** até o showdown | 4 | S | 2 all-ins pré-flop abrem flop/turn/river automaticamente |
| 1.5 | Teste de mão completa (heads-up e 3-way) | 13 | S | Pote conservado (soma de fichas constante) |

### Fase 2 — Inteligência: regras + bots · *Passos 8, 9*
Depende do `HandContext`, que só existe com a engine pronta (Fase 1).

| # | Item | Passo | Esforço | DoD |
|---|------|-------|---------|-----|
| 2.1 | Helpers `handClass.ts` (`isPremium`, `isSpeculative`, `isMarginalDefense`) | 9 | S | Classificação bate com os livros |
| 2.2 | `predicate` para **todas** as regras + `evaluateViolations(ctx)` ligado à engine | 9 | M | Cada regra com teste: viola → true; respeita → false |
| 2.3 | Popular `HandContext` a cada ação do humano (equity, potOdds, posição, bubbleFactor, SPR) | 4/9 | S | `errorsFlagged`/`rulesViolated[]` corretos |
| 2.4 | Bots: sizing por textura, consciência posicional pós-flop, cache de equity | 8 | M | Sem all-in fixo 0.5 pote; 4 perfis plausíveis |

### Fase 3 — Infra de torneio e tempo real · *Passos 10, 12*
Depende da engine (mesa do humano) e define a arquitetura serverless.

| # | Item | Passo | Esforço | DoD |
|---|------|-------|---------|-----|
| 3.1 | `simulateEliminations(stacks, dt)` — modelo estatístico ICM/stack | 10 | M | Distribuição de eliminações coerente com stack |
| 3.2 | `advanceTournament(dt)` dirigido por tick (blinds, rebalance, payouts) | 10 | M | 27→1 sem loop contínuo; bolha detectada |
| 3.3 | Locking otimista (coluna `version`) no estado da mesa | 2/10 | S | Writes concorrentes sem lost update |
| 3.4 | Filtragem de hole cards por jogador antes de serializar/publicar | 12 | S | Payload do cliente nunca contém cartas de oponentes |
| 3.5 | Pusher: `bot-action`/`street-advance`/`hand-end`/`tournament-update` | 12 | M | Mesa atualiza <500ms sem reload (RNF02) |

### Fase 4 — Auth, dashboard e polimento · *Passos 3, 11, 12*
Importante para o produto, mas não bloqueia o núcleo de jogo (pode correr em paralelo desde o início nos itens independentes da engine: 4.1, 4.5).

| # | Item | Passo | Esforço | DoD |
|---|------|-------|---------|-----|
| 4.1 | Rota `/api/register` + bcrypt (salt 12) + validação Zod | 3 | S | Cadastro cria usuário; senha nunca em texto |
| 4.2 | Cálculo de **VPIP/PFR** (atualiza `User` ao fim de cada mão/torneio) | 4/12 | M | Stats batem com a definição padrão |
| 4.3 | Tutor **local determinístico** (outs/equity/pot odds/SPR/EV) + Gemini sob demanda | 11 | M | Painel sem chamada de rede; "Pedir Dica" usa Gemini |
| 4.4 | RNG **seedável** (substituir `Math.random`) | 4 | XS | Mesma seed → mesma sequência |
| 4.5 | Verificar SDK/modelo do Gemini (`@google/genai` vs `@google/generative-ai`) | 11 | XS | Chamada real funciona com modelo confirmado |
| 4.6 | Dashboard (stats, lista, gráfico) + relatório pós-torneio | 12 | M | RF09/RF10 navegáveis |

### Caminho crítico
```
Fase 0 ──► Fase 1 ──► Fase 2 ──► Fase 3 ──► (produto jogável MTT)
                          └─────► Fase 4.3 (tutor) ── modo treino
Itens 4.1 / 4.2 / 4.5 correm em paralelo (independentes da engine).
```
**Go/No-Go:** fechar Fase 0 + Fase 1 com testes verdes **antes** de tocar em frontend ou Pusher. É onde estavam os bugs e o maior ROI de confiabilidade.

**Riscos a vigiar:** (1) tempo de execução serverless no `advanceTournament` (mitigado pelo tick); (2) custo do Gemini se "Pedir Dica" for muito usado (cachear por situação); (3) realismo percebido do modelo de eliminação abstrata.

---

## Playbook de Execução com ECC (Comandos, Skills e Agents)

Esta seção define **como** implementar (o processo) e **quais ferramentas ECC** usar em cada fase. O guia técnico (Passos 0–14) descreve o *o quê*; o playbook abaixo descreve o *como executar com qualidade*.

### Princípios de execução (inegociáveis)

1. **TDD primeiro** nas Fases 0 e 1 (núcleo matemático): escrever o teste (RED) → implementar mínimo (GREEN) → refatorar. Cobertura alvo **≥ 80%**.
2. **Gate por fase:** não avançar de fase sem os testes da fase anterior **verdes** (regra de ouro do roadmap).
3. **Code review após cada módulo** com o reviewer da linguagem certa, antes de commit.
4. **Security review obrigatório** em tudo que toca auth, estado de jogo, hole cards e chaves de API.
5. **Commits pequenos e convencionais** (`feat:`, `fix:`, `test:`…) ao fechar cada item do roadmap com DoD cumprido.

### Loop de implementação por item do roadmap

Para **cada** item (ex: 0.1, 1.2, 2.4…) repita este ciclo:

```
/plan (se o item for complexo)  ──►  tdd-workflow (RED→GREEN)  ──►  /code-review
        ──►  /security-scan (se sensível)  ──►  /checkpoint  ──►  commit
```

### Mapa de Fase → Ferramentas ECC

| Fase | Foco | Skills (referência) | Commands (`/...`) | Agents (Task) |
|------|------|---------------------|-------------------|---------------|
| **Pré-Fase — Scaffold** (Passos 0–3) | Next.js, Prisma, env | `nextjs-turbopack`, `prisma-patterns`, `postgres-patterns`, `database-migrations`, `coding-standards` | `/build-fix` | `code-architect`, `database-reviewer` |
| **Fase 0 — Avaliador + Showdown** (5,6,13) | Corretude + performance <2ms | `tdd-workflow`, `python-patterns` (ler tabelas-fonte), `error-handling` | `/react-test` (Vitest), `/test-coverage`, `/code-review` | `tdd-guide`, `typescript-reviewer`, `python-reviewer` (port das tabelas), `performance-optimizer` |
| **Fase 1 — Engine** (4) | Máquina de estados, min-raise, side pots | `tdd-workflow`, `backend-patterns`, `error-handling` | `/react-test`, `/code-review`, `/checkpoint` | `tdd-guide`, `typescript-reviewer`, `silent-failure-hunter` |
| **Fase 2 — Regras + Bots** (8,9) | `predicate`, EV, perfis | `tdd-workflow`, `backend-patterns` | `/code-review`, `/test-coverage` | `tdd-guide`, `typescript-reviewer` |
| **Fase 3 — MTT + Tempo real** (10,12) | Tick, locking, Pusher, hole cards | `api-design`, `backend-patterns`, `redis-patterns` (cache equity), `deployment-patterns` | `/security-scan`, `/code-review` | `architect`, `database-reviewer` (locking otimista), `security-reviewer` (hole cards), `typescript-reviewer` |
| **Fase 4 — Auth + Frontend + Tutor** (3,11,12) | NextAuth, mesa 2D premium, Gemini | `react-patterns`, `react-performance`, `react-testing`, `frontend-design-direction`, `liquid-glass-design`, `motion-foundations`, `motion-ui`, `frontend-a11y` | `/react-build`, `/react-test`, `/react-review`, `/security-scan` | `react-reviewer`, `a11y-architect`, `security-reviewer` (bcrypt/sessão/API keys), `e2e-runner` |
| **Deploy** (14) | Vercel + CI | `deployment-patterns`, `github-ops`, `git-workflow` | `/pr`, `/security-scan` | `doc-updater` |

### Comandos e skills de uso transversal (todas as fases)

| Quando | Ferramenta | Uso |
|--------|-----------|-----|
| Dúvida de API/SDK (Next.js 14, NextAuth, Prisma, `@google/generative-ai`, Pusher) | skill `documentation-lookup` / agent `docs-lookup` (Context7) | Confirmar assinatura/versão **antes** de codar — evita retrabalho |
| Antes de qualquer módulo novo | `/plan` | Reformular requisito + riscos + passos |
| Após escrever/alterar código | `/code-review` + agent `code-reviewer` | Qualidade, antes de commit |
| Código sensível (auth, estado, chaves) | `/security-scan` + agent `security-reviewer` | OWASP, segredos, vazamento de hole cards |
| Build/tipo quebrado | `/build-fix` (geral) ou `/react-build` (frontend) | Correção mínima e cirúrgica |
| Custo do Gemini | skill `cost-tracking` | Monitorar gasto das chamadas LLM |
| Fechar incremento estável | `/checkpoint` → commit (`git-workflow`) | Ponto de retorno verificado |
| Pausar/retomar trabalho longo | `/save-session` / `/resume-session` | Continuidade entre sessões |
| Abrir PR ao fim de uma fase | `/pr` | PR com sumário + plano de teste |

### Checklist de "pronto para commit" (por item)

- [ ] Testes do item verdes (e os da fase anterior continuam verdes)
- [ ] `/code-review` sem issues CRITICAL/HIGH
- [ ] `/security-scan` limpo (quando o item for sensível)
- [ ] DoD do item do roadmap cumprido
- [ ] Convenção de score única respeitada (maior = mais forte)
- [ ] Commit convencional criado

> **Nota sobre o avaliador (Fase 0):** as tabelas de hash perfeito vivem em `Aplicativo para avaliar mãos/python/phevaluator/tables/` e `.../cpp/src/`. Use o agent `python-reviewer` para ler/validar a fonte e o `typescript-reviewer` para revisar o port em JS/TS, garantindo que os vetores batem (item 0.2).

---

## Passo 0: Pré-Requisitos e Contas Necessárias

Antes de iniciar qualquer código, garanta que você tem tudo configurado.

### 1. Ferramentas Locais

Verifique se as ferramentas abaixo estão instaladas:
```bash
node --version    # v18+ (LTS recomendado)
npm --version     # v9+
git --version     # qualquer versão recente
```

Instale o Node.js via [https://nodejs.org](https://nodejs.org) se necessário.

### 2. Contas e Serviços (todos gratuitos para começar)

| Serviço | Papel | Link |
|---|---|---|
| **Supabase** | PostgreSQL gerenciado (banco de dados) | https://supabase.com |
| **Pusher** | WebSocket em tempo real (plano Sandbox) | https://pusher.com |
| **Google AI Studio** | Chave de API do Gemini | https://aistudio.google.com |
| **GitHub** | Repositório + CI/CD com Vercel depois | https://github.com |
| **Vercel** | Deploy de produção (Passo 9) | https://vercel.com |

### 3. Configurar o Projeto no Supabase

1. Crie um novo projeto em [supabase.com](https://supabase.com)
2. Anote a **Connection String** (PostgreSQL): em *Settings → Database → Connection string → URI*
3. O formato será: `postgresql://postgres:[senha]@db.[projeto-id].supabase.co:5432/postgres`

### 4. Configurar o Pusher

1. Crie uma conta e um novo App em [pusher.com](https://pusher.com)
2. Escolha o cluster mais próximo (ex: `sa1` para São Paulo)
3. Anote: `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`

### 5. Obter a Chave do Gemini

1. Acesse [aistudio.google.com](https://aistudio.google.com)
2. Clique em **Get API Key** e copie a chave

### 6. Análise de Portas e Conflitos Locais (Localhost)

Antes de rodar a aplicação localmente (`localhost:3000`), foi realizada uma análise de portas no ambiente para evitar conflitos de portas em uso:

* **Next.js Web App** (Porta `3000`): **Disponível (Livre)**. Pode iniciar o servidor de desenvolvimento normalmente.
* **Banco de Dados local** (Porta `5432`): **Disponível (Livre)**.
  * *Nota:* Existe um serviço local do **PostgreSQL** rodando e ouvindo na porta **`5435`** (PID 6560). Se você optar por rodar um banco local ao invés de usar o Supabase na nuvem, configure sua URL de conexão para apontar para `localhost:5435`.
* **Outras portas ocupadas por serviços do sistema**:
  * Portas `9000` / `9001`: Ocupadas por um processo Java (`javaw.exe`, PID 19108).
  * Porta `19300`: Ocupada pela IDE (`Antigravity IDE.exe`, PID 8284).
  * Porta `5939`: Ocupada pelo TeamViewer (`TeamViewer_Service.exe`, PID 4936).
  * Porta `26822`: Ocupada pelo MSI Terminal Server (`MSI.TerminalServer.exe`, PID 13052).

Garanta que suas configurações locais (no arquivo `.env.local`) reflitam esses mapeamentos para evitar falhas de conexão.

---

## Passo 1: Inicialização e Dependências do Projeto

### 1. Criar o Projeto Next.js

Execute o comando abaixo no terminal dentro da pasta do projeto (não-interativo):
```bash
npx -y create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

### 2. Instalar as Dependências

Precisaremos de bibliotecas para criptografia, autenticação, modelagem de banco de dados, avaliação de mãos de poker, animações, o cliente da API do Gemini e o Pusher:

```bash
npm install @prisma/client next-auth @auth/prisma-adapter bcryptjs framer-motion @google/generative-ai lucide-react zod pusher pusher-js @supabase/supabase-js
npm install -D prisma @types/bcryptjs @types/node
```

> **Nota sobre avaliação de mãos**: Não usaremos o **pacote npm nativo** `phevaluator` (addon C++), pois o binário nativo não roda em ambientes serverless como a Vercel. Em vez disso, faremos um **port por lookup table**: as tabelas de hash perfeito do `phevaluator` (já disponíveis em `Aplicativo para avaliar mãos/`) são exportadas como **dados puros em JS/TS (ou WASM)** e consultadas com aritmética simples — avaliação em tempo constante, **compatível com qualquer ambiente** e cumprindo o alvo de `<2ms` por mão de 7 cartas (RNF02). O avaliador combinatório mostrado no Passo 5 serve como **referência didática e fallback** para validar as tabelas com testes; o caminho de produção usa a lookup table.

### 3. Configurar Variáveis de Ambiente (`.env.local`)

Crie um arquivo `.env.local` na raiz do projeto (nunca comite este arquivo no git):

```env
# Banco de dados Supabase (PostgreSQL)
DATABASE_URL="postgresql://postgres:[SUA_SENHA]@db.[PROJETO_ID].supabase.co:5432/postgres"

# Chave secreta para sessões do NextAuth
NEXTAUTH_SECRET="gere_uma_string_aleatoria_longa_aqui"
NEXTAUTH_URL="http://localhost:3000"

# Chave de API do Google Gemini
GEMINI_API_KEY="sua_chave_de_api_do_google_gemini"

# Pusher (servidor)
PUSHER_APP_ID="seu_app_id"
PUSHER_KEY="sua_pusher_key"
PUSHER_SECRET="seu_pusher_secret"
PUSHER_CLUSTER="sa1"

# Pusher (cliente — prefixo NEXT_PUBLIC_ para expor ao browser)
NEXT_PUBLIC_PUSHER_KEY="sua_pusher_key"
NEXT_PUBLIC_PUSHER_CLUSTER="sa1"
```

Adicione `.env.local` ao `.gitignore` se ainda não estiver lá.

---

## Passo 2: Modelagem do Banco de Dados (Supabase + Prisma)

Substitua o conteúdo de `prisma/schema.prisma` pelo seguinte esquema:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id           String        @id @default(uuid())
  name         String
  email        String        @unique
  emailVerified DateTime?
  image        String?
  passwordHash String?       // Nulo para usuários OAuth (Google)
  statsVpip    Float         @default(0.0) // Voluntary Put In Pot
  statsPfr     Float         @default(0.0) // Pre-flop Raise
  statsHands   Int           @default(0)   // Total de mãos jogadas
  tourneysWon  Int           @default(0)   // Torneios ganhos (1º lugar)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  tournaments  Tournament[]
  accounts     Account[]
  sessions     Session[]
}

// Modelos necessários para o NextAuth Prisma Adapter
model Account {
  id                 String  @id @default(uuid())
  userId             String
  type               String
  provider           String
  providerAccountId  String
  refresh_token      String? @db.Text
  access_token       String? @db.Text
  expires_at         Int?
  token_type         String?
  scope              String?
  id_token           String? @db.Text
  session_state      String?
  user               User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(uuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model Tournament {
  id            String        @id @default(uuid())
  userId        String
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  initialChips  Int           @default(10000)
  buyIn         Float         @default(10.0)
  blindSpeed    String        @default("REGULAR") // TURBO, REGULAR, DEEP
  totalPlayers  Int           @default(27)         // Padrão: 27 (3 mesas de 9)
  finalPosition Int?          // Posição final do usuário no torneio
  earnings      Float         @default(0.0)
  createdAt     DateTime      @default(now())
  hands         HandHistory[]
}

model HandHistory {
  id             String     @id @default(uuid())
  tournamentId   String
  tournament     Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  handNumber     Int
  boardCards     String[]   // Ex: ["As", "Kd", "Qc", "Jh", "Ts"]
  playerCards    String[]   // Ex: ["Kh", "Qh"]
  actionsJson    String     // Histórico sequencial de apostas (Stringified JSON)
  rulesViolated  String[]   // IDs das regras do POKER_RULES.ts que foram violadas
  errorsFlagged  Boolean    @default(false)
  potSize        Int        @default(0)
  isTrainingMode Boolean    @default(false)
  createdAt      DateTime   @default(now())
  aiAnalysis     AiAnalysis?
}

model AiAnalysis {
  id             String      @id @default(uuid())
  handHistoryId  String      @unique
  handHistory    HandHistory @relation(fields: [handHistoryId], references: [id], onDelete: Cascade)
  feedbackText   String      @db.Text // Texto em Markdown gerado pelo Gemini
  referencedBook String      // Livro e capítulo citados como conselho principal
  createdAt      DateTime    @default(now())
}
```

Para criar as tabelas no Supabase, execute:
```bash
npx prisma db push
```

Para gerar o Prisma Client após qualquer mudança no schema:
```bash
npx prisma generate
```

---

## Passo 3: Autenticação com NextAuth.js + Prisma Adapter

### 1. Criar o arquivo de configuração do NextAuth (`src/lib/auth.ts`)

```typescript
import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
};
```

### 2. Criar o singleton do Prisma Client (`src/lib/prisma.ts`)

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["query"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### 3. Criar a Route Handler do NextAuth (`src/app/api/auth/[...nextauth]/route.ts`)

```typescript
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

### 4. Rota de Cadastro (`src/app/api/register/route.ts`) — *Roadmap item 4.1*

O RF01 prevê registro com e-mail/senha, mas o `CredentialsProvider` apenas **valida** credenciais; a **criação** do usuário precisa de uma rota própria com hashing bcrypt (salt rounds = 12) e validação com Zod.

```typescript
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "A senha precisa de ao menos 8 caracteres"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno ao cadastrar" }, { status: 500 });
  }
}
```

> A senha **nunca** trafega ou é persistida em texto puro: só o `passwordHash` é gravado. A tela `/auth/register` (Passo 12) consome esta rota e, em seguida, chama `signIn("credentials", ...)`.

---

## Passo 4: Máquina de Estados do Texas Hold'em (Backend/TypeScript)

A engine do poker precisa controlar a ordem de ação, apostas e distribuição de cartas. Crie o arquivo `src/lib/poker/PokerEngine.ts`:

```typescript
export type Card = string; // Ex: "Ah", "Kd", "9s", "2c"
export type ActionType = "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE" | "ALL_IN";

export interface PlayerState {
  id: string;
  name: string;
  isBot: boolean;
  botProfile?: "TAG" | "LAG" | "NIT" | "CALLING_STATION";
  chips: number;
  currentBet: number;
  cards: Card[];
  hasFolded: boolean;
  isAllIn: boolean;
  position: string; // "UTG", "BTN", "SB", "BB", etc.
}

export interface GameState {
  players: PlayerState[];
  board: Card[];
  deck: Card[];
  pot: number;
  currentBetToCall: number;
  dealerIndex: number;
  activePlayerIndex: number;
  street: "PRE_FLOP" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN";
  smallBlind: number;
  bigBlind: number;
  actionsHistory: string[];
}

export class PokerEngine {
  public static createDeck(): Card[] {
    const suits = ["h", "d", "c", "s"]; // Hearts, Diamonds, Clubs, Spades
    const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
    const deck: Card[] = [];
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push(rank + suit);
      }
    }
    return this.shuffle(deck);
  }

  private static shuffle(deck: Card[]): Card[] {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  // Prepara uma nova mão, reiniciando apostas e postando Small e Big Blinds
  public static startNewHand(players: PlayerState[], sb: number, bb: number, dealerIdx: number): GameState {
    const deck = this.createDeck();
    
    // Distribui 2 cartas para cada jogador
    const updatedPlayers = players.map(p => ({
      ...p,
      cards: [deck.pop()!, deck.pop()!],
      currentBet: 0,
      hasFolded: false,
      isAllIn: p.chips <= 0,
    }));

    // Postar Blinds
    const numPlayers = updatedPlayers.length;
    const sbIdx = (dealerIdx + 1) % numPlayers;
    const bbIdx = (dealerIdx + 2) % numPlayers;

    updatedPlayers[sbIdx].chips -= sb;
    updatedPlayers[sbIdx].currentBet = sb;

    updatedPlayers[bbIdx].chips -= bb;
    updatedPlayers[bbIdx].currentBet = bb;

    // UTG age primeiro pré-flop
    const firstToActIdx = (bbIdx + 1) % numPlayers;

    return {
      players: updatedPlayers,
      board: [],
      deck,
      pot: sb + bb,
      currentBetToCall: bb,
      dealerIndex: dealerIdx,
      activePlayerIndex: firstToActIdx,
      street: "PRE_FLOP",
      smallBlind: sb,
      bigBlind: bb,
      actionsHistory: [`Small Blind postado por ${updatedPlayers[sbIdx].name}`, `Big Blind postado por ${updatedPlayers[bbIdx].name}`],
    };
  }

  // Avança de Street (Flop, Turn, River)
  public static advanceStreet(state: GameState): GameState {
    // Coleta as apostas da rodada para o pote principal
    const currentBetsSum = state.players.reduce((sum, p) => sum + p.currentBet, 0);
    state.pot += currentBetsSum;
    state.players.forEach(p => p.currentBet = 0);
    state.currentBetToCall = 0;

    if (state.street === "PRE_FLOP") {
      state.street = "FLOP";
      // Queima uma carta e abre 3 (Flop)
      state.deck.pop();
      state.board.push(state.deck.pop()!, state.deck.pop()!, state.deck.pop()!);
    } else if (state.street === "FLOP") {
      state.street = "TURN";
      state.deck.pop();
      state.board.push(state.deck.pop()!);
    } else if (state.street === "TURN") {
      state.street = "RIVER";
      state.deck.pop();
      state.board.push(state.deck.pop()!);
    } else if (state.street === "RIVER") {
      state.street = "SHOWDOWN";
    }

    // Primeiro jogador ativo à esquerda do Button começa apostando no pós-flop
    state.activePlayerIndex = this.findFirstActivePlayerLeftOf(state.dealerIndex, state.players);
    return state;
  }

  private static findFirstActivePlayerLeftOf(idx: number, players: PlayerState[]): number {
    const num = players.length;
    for (let i = 1; i <= num; i++) {
      const target = (idx + i) % num;
      if (!players[target].hasFolded && !players[target].isAllIn && players[target].chips > 0) {
        return target;
      }
    }
    return idx;
  }
}
```

> **⚠️ A engine acima ainda está incompleta para jogar uma mão inteira.** Os métodos `createDeck`, `startNewHand` e `advanceStreet` montam o estado e abrem as ruas, mas o RF02 também exige a **aplicação e validação de ações**, que precisam ser adicionadas antes do frontend:
>
> - `applyAction(state, playerIdx, action, amount)`: aplica FOLD/CHECK/CALL/BET/RAISE/ALL_IN, debita fichas, atualiza `currentBet`/`pot` e acumula `totalBetThisHand` (necessário para os side pots do Passo 6).
> - **Validação de min-raise**: um raise deve ser ≥ ao último incremento de aposta (regra No-Limit); valores inválidos são rejeitados.
> - **Detecção de fim da rodada de aposta**: a street só avança quando todos os ativos igualaram a maior aposta ou estão all-in. Só então chamamos `advanceStreet`.
> - **Run-out de all-in**: quando não resta ação possível (todos all-in), abrir as ruas restantes direto até o showdown.
> - **Avanço do turno**: após cada ação, mover `activePlayerIndex` para o próximo ativo (pulando folds/all-ins).
>
> Sem esses pontos a mesa não joga sozinha. Trate-os como parte obrigatória do Passo 4 (Roadmap **Fase 1**, itens 1.1–1.4).
>
> **Também neste passo (Roadmap Fase 4):**
> - **4.4 — RNG seedável:** substituir `Math.random()` em `shuffle`/`shuffleArr` por um PRNG com seed injetável (ex.: mulberry32), permitindo testes determinísticos e replays reproduzíveis. Mantenha a assinatura, apenas troque a fonte de aleatoriedade.
> - **4.2 — VPIP/PFR:** ao encerrar cada mão, atualizar `statsHands` e recalcular `statsVpip` (entrou voluntariamente no pote) e `statsPfr` (deu raise pré-flop) do usuário — média acumulada gravada no `User`. Esses contadores alimentam o Dashboard (Passo 12) e o relatório (Passo 11).

---

## Passo 5: Avaliador de Mãos em TypeScript Puro (Sem Binários Nativos)

> **Estratégia em duas camadas.** Em produção usaremos um **port por lookup table** das tabelas de hash perfeito do `phevaluator` (exportadas como dados JS/WASM puros, sem addon nativo) — avaliação em tempo ~constante e dentro do alvo de `<2ms` (RNF02). O avaliador combinatório 100% TypeScript abaixo é a **implementação de referência/fallback**: legível, correto e usado nos **testes unitários** para validar a lookup table contra os vetores de teste que acompanham o `phevaluator`.
>
> **Convenção de score (válida em todo o sistema): `MAIOR score = mão mais forte`.** Tanto `evaluateBestHand` (pega o máximo), quanto `calculateEquity` (vence quem tem score estritamente maior) e o `ShowdownManager` (usa `Math.max`) seguem a mesma direção — não inverta essa convenção em nenhum módulo.

### 1. Avaliador de Mãos (`src/lib/poker/HandEvaluator.ts`)

```typescript
export type HandRank =
  | "HIGH_CARD"
  | "ONE_PAIR"
  | "TWO_PAIR"
  | "THREE_OF_A_KIND"
  | "STRAIGHT"
  | "FLUSH"
  | "FULL_HOUSE"
  | "FOUR_OF_A_KIND"
  | "STRAIGHT_FLUSH"
  | "ROYAL_FLUSH";

export interface HandResult {
  rank: HandRank;
  score: number; // CONVENÇÃO ÚNICA DO SISTEMA: MAIOR score = mão mais forte (para comparação)
  description: string;
}

const RANK_ORDER: Record<string, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "T": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
};

// CONVENÇÃO ÚNICA: maior número = categoria mais forte.
// Combinada com os kickers SOMADOS abaixo, garante que "maior score = mão mais forte"
// em TODO o sistema (evaluateBestHand, calculateEquity e ShowdownManager).
const HAND_SCORES: Record<HandRank, number> = {
  HIGH_CARD: 1,
  ONE_PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10,
};

export class HandEvaluator {
  // Avalia a melhor mão de 5 entre N cartas (ex: 7 cartas = hole + board)
  public static evaluateBestHand(cards: string[]): HandResult {
    const combinations = this.getCombinations(cards, 5);
    let best: HandResult | null = null;

    for (const combo of combinations) {
      const result = this.evaluateFiveCard(combo);
      // Maior score = mão mais forte → escolhemos o máximo entre as combinações
      if (!best || result.score > best.score) {
        best = result;
      }
    }
    return best!;
  }

  private static getCombinations(arr: string[], k: number): string[][] {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    const [first, ...rest] = arr;
    const withFirst = this.getCombinations(rest, k - 1).map(c => [first, ...c]);
    const withoutFirst = this.getCombinations(rest, k);
    return [...withFirst, ...withoutFirst];
  }

  private static evaluateFiveCard(cards: string[]): HandResult {
    const ranks = cards.map(c => RANK_ORDER[c[0]]).sort((a, b) => b - a);
    const suits = cards.map(c => c[1]);
    const isFlush = suits.every(s => s === suits[0]);
    const isStraight = this.checkStraight(ranks);

    const rankCounts = this.countRanks(ranks);
    const counts = Object.values(rankCounts).sort((a, b) => b - a);

    // Sistema de score granular com kickers: maior score = mão mais forte
    // Formato: categoria * 10^10 + rank1 * 10^8 + rank2 * 10^6 + kicker1 * 10^4 + kicker2 * 10^2 + kicker3
    // Permite desempate correto por kicker conforme regras oficiais
    const kickers = (exclude: number[]) =>
      ranks.filter(r => !exclude.includes(r));

    if (isFlush && isStraight && ranks[0] === 14) {
      return { rank: "ROYAL_FLUSH", score: HAND_SCORES.ROYAL_FLUSH * 1e10, description: "Royal Flush" };
    }
    if (isFlush && isStraight) {
      const high = (ranks[0] === 14 && ranks[1] === 5) ? 5 : ranks[0]; // Wheel: A-2-3-4-5, high é o 5
      return { rank: "STRAIGHT_FLUSH", score: HAND_SCORES.STRAIGHT_FLUSH * 1e10 + high, description: "Straight Flush" };
    }
    if (counts[0] === 4) {
      const quadRank = this.getHighCard(rankCounts, 4);
      const kicker = kickers([quadRank])[0] || 0;
      return { rank: "FOUR_OF_A_KIND", score: HAND_SCORES.FOUR_OF_A_KIND * 1e10 + quadRank * 1e4 + kicker, description: "Quadra" };
    }
    if (counts[0] === 3 && counts[1] === 2) {
      const tripRank = this.getHighCard(rankCounts, 3);
      const pairRank = this.getHighCard(rankCounts, 2);
      return { rank: "FULL_HOUSE", score: HAND_SCORES.FULL_HOUSE * 1e10 + tripRank * 1e4 + pairRank, description: "Full House" };
    }
    if (isFlush) {
      // Flush: desempate pelos 5 ranks em ordem decrescente
      return { rank: "FLUSH", score: HAND_SCORES.FLUSH * 1e10 + ranks[0] * 1e8 + ranks[1] * 1e6 + ranks[2] * 1e4 + ranks[3] * 1e2 + ranks[4], description: "Flush" };
    }
    if (isStraight) {
      const high = (ranks[0] === 14 && ranks[1] === 5) ? 5 : ranks[0]; // Wheel
      return { rank: "STRAIGHT", score: HAND_SCORES.STRAIGHT * 1e10 + high, description: "Sequência" };
    }
    if (counts[0] === 3) {
      const tripRank = this.getHighCard(rankCounts, 3);
      const ks = kickers([tripRank, tripRank, tripRank]).sort((a, b) => b - a);
      return { rank: "THREE_OF_A_KIND", score: HAND_SCORES.THREE_OF_A_KIND * 1e10 + tripRank * 1e6 + (ks[0] || 0) * 1e4 + (ks[1] || 0), description: "Trinca" };
    }
    if (counts[0] === 2 && counts[1] === 2) {
      const pairs = Object.entries(rankCounts).filter(([, v]) => v === 2).map(([k]) => Number(k)).sort((a, b) => b - a);
      const kk = kickers([pairs[0], pairs[0], pairs[1], pairs[1]]).sort((a, b) => b - a);
      return { rank: "TWO_PAIR", score: HAND_SCORES.TWO_PAIR * 1e10 + pairs[0] * 1e6 + pairs[1] * 1e4 + (kk[0] || 0), description: "Dois Pares" };
    }
    if (counts[0] === 2) {
      const pairRank = this.getHighCard(rankCounts, 2);
      const ks = kickers([pairRank, pairRank]).sort((a, b) => b - a);
      return { rank: "ONE_PAIR", score: HAND_SCORES.ONE_PAIR * 1e10 + pairRank * 1e8 + (ks[0] || 0) * 1e6 + (ks[1] || 0) * 1e4 + (ks[2] || 0), description: "Um Par" };
    }
    // Carta Alta: todos os 5 ranks como kicker em cascata
    return { rank: "HIGH_CARD", score: HAND_SCORES.HIGH_CARD * 1e10 + ranks[0] * 1e8 + ranks[1] * 1e6 + ranks[2] * 1e4 + ranks[3] * 1e2 + ranks[4], description: "Carta Alta" };
  }

  private static checkStraight(sortedRanks: number[]): boolean {
    // Straight normal
    if (sortedRanks[0] - sortedRanks[4] === 4 && new Set(sortedRanks).size === 5) return true;
    // Wheel (A-2-3-4-5)
    const wheel = [14, 5, 4, 3, 2];
    return JSON.stringify(sortedRanks) === JSON.stringify(wheel);
  }

  private static countRanks(ranks: number[]): Record<number, number> {
    return ranks.reduce((acc, r) => ({ ...acc, [r]: (acc[r] || 0) + 1 }), {} as Record<number, number>);
  }

  private static getHighCard(counts: Record<number, number>, targetCount: number): number {
    return Math.max(...Object.entries(counts).filter(([, v]) => v === targetCount).map(([k]) => Number(k)));
  }

  // Calcula equidade via simulação Monte Carlo (TypeScript puro)
  public static calculateEquity(playerCards: string[], boardCards: string[], numOpponents = 1, iterations = 500): number {
    const allKnown = new Set([...playerCards, ...boardCards]);
    const deck = this.buildRemainingDeck(allKnown);
    let wins = 0;

    for (let i = 0; i < iterations; i++) {
      const shuffled = this.shuffleArr([...deck]);
      let idx = 0;

      // Completar o board
      const fullBoard = [...boardCards];
      while (fullBoard.length < 5) fullBoard.push(shuffled[idx++]);

      // Avaliar mão do jogador
      const myScore = this.evaluateBestHand([...playerCards, ...fullBoard]).score;

      // Avaliar oponentes (maior score = mão mais forte)
      // Só vencemos se NOSSO score for estritamente maior que o de TODOS os oponentes.
      // Empates são contabilizados como não-vitória (equity conservadora). Para precisão
      // total, divida 0.5 por empate em vez de descartar — ver "Aprimoramentos".
      let beatAll = true;
      for (let op = 0; op < numOpponents; op++) {
        const opCards = [shuffled[idx++], shuffled[idx++]];
        const opScore = this.evaluateBestHand([...opCards, ...fullBoard]).score;
        if (opScore >= myScore) { beatAll = false; break; }
      }

      if (beatAll) wins++;
    }

    return wins / iterations;
  }

  private static buildRemainingDeck(exclude: Set<string>): string[] {
    const suits = ["h", "d", "c", "s"];
    const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
    const deck: string[] = [];
    for (const s of suits) for (const r of ranks) {
      const card = r + s;
      if (!exclude.has(card)) deck.push(card);
    }
    return deck;
  }

  private static shuffleArr<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
```

---

## Passo 6: Showdown — Determinação do Vencedor com Regras Oficiais

Este módulo implementa as regras oficiais de showdown do Texas Hold'em: avaliação comparativa de mãos, desempate por kicker, divisão de pote (split pot) e cálculo de **potes laterais (side pots)** para situações com múltiplos all-ins.

Crie o arquivo `src/lib/poker/ShowdownManager.ts`:

```typescript
import { HandEvaluator, HandResult } from "./HandEvaluator";

// === INTERFACES ===

export interface ShowdownPlayer {
  id: string;
  name: string;
  cards: string[];       // Cartas fechadas (hole cards)
  totalBet: number;      // Total apostado nesta mão (para cálculo de side pots)
  hasFolded: boolean;
}

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[]; // Apenas os jogadores que podem ganhar este pote
}

export interface PotResult {
  potIndex: number;         // 0 = pote principal, 1+ = potes laterais
  amount: number;
  winners: string[];        // IDs dos vencedores
  isSplit: boolean;
  amountPerWinner: number;  // Valor recebido por cada vencedor
  remainder: number;        // Ficha ímpar (vai para o jogador mais à esquerda do dealer)
}

export interface ShowdownResult {
  pots: PotResult[];
  rankings: Array<{
    playerId: string;
    playerName: string;
    bestHand: HandResult;
    isWinner: boolean;
    showCards: boolean; // Se é obrigado a mostrar cartas (ganhou ou foi ao showdown)
  }>;
}

// === CLASSE PRINCIPAL ===

export class ShowdownManager {

  /**
   * Ponto de entrada principal — determina vencedor(es) do showdown.
   * Aplica regras oficiais:
   *   1. Melhor mão de 5 cartas entre as 7 disponíveis.
   *   2. Desempate por kicker (encodado no score do HandEvaluator).
   *   3. Split pot quando scores são idênticos.
   *   4. Side pots corretos para all-ins de valores diferentes.
   */
  public static resolve(
    players: ShowdownPlayer[],
    board: string[],
    dealerIndex: number   // Para regra da ficha ímpar
  ): ShowdownResult {
    // 1. Avaliar melhor mão de cada jogador não-foldado
    const evaluations = players
      .filter(p => !p.hasFolded)
      .map(p => ({
        ...p,
        bestHand: HandEvaluator.evaluateBestHand([...p.cards, ...board]),
      }));

    // 2. Calcular todos os potes (principal + laterais)
    const sidePots = this.calculateSidePots(players);

    // 3. Resolver cada pote separadamente
    const potResults: PotResult[] = sidePots.map((pot, idx) => {
      const eligible = evaluations.filter(e => pot.eligiblePlayerIds.includes(e.id));

      if (eligible.length === 0) {
        // Pote sem candidatos elegíveis (todos foldaram antes de chegar aqui)
        return { potIndex: idx, amount: pot.amount, winners: [], isSplit: false, amountPerWinner: 0, remainder: 0 };
      }

      // Maior score vence (nosso sistema: maior score = mão mais forte)
      const maxScore = Math.max(...eligible.map(e => e.bestHand.score));
      const winners = eligible.filter(e => e.bestHand.score === maxScore).map(e => e.id);

      const amountPerWinner = Math.floor(pot.amount / winners.length);
      const remainder = pot.amount % winners.length; // Ficha(s) ímpar(es)

      return {
        potIndex: idx,
        amount: pot.amount,
        winners,
        isSplit: winners.length > 1,
        amountPerWinner,
        remainder, // Regra oficial: vai para o jogador mais próximo à esquerda do dealer
      };
    });

    // 4. Rankings de melhor mão para exibição no showdown
    const rankings = evaluations
      .sort((a, b) => b.bestHand.score - a.bestHand.score)
      .map(e => ({
        playerId: e.id,
        playerName: e.name,
        bestHand: e.bestHand,
        isWinner: potResults.some(pot => pot.winners.includes(e.id)),
        showCards: true, // Todos os que chegaram ao showdown mostram cartas
      }));

    return { pots: potResults, rankings };
  }

  /**
   * Cálculo de Side Pots — Regras Oficiais.
   *
   * Algoritmo:
   *  - Ordena todos os jogadores (incluindo foldados) pelo valor total apostado.
   *  - Para cada nível de aposta, cria um pote com a diferença × número de contribuintes.
   *  - Apenas jogadores não-foldados são elegíveis para ganhar.
   *
   * Exemplo com 3 jogadores:
   *   A all-in: 500  → Pote principal: 500×3 = 1500 (todos elegíveis)
   *   B all-in: 1500 → Side pot 1:    1000×2 = 2000 (B e C elegíveis)
   *   C apostou: 2000 → Side pot 2:   500×1  =  500 (só C, recebe de volta)
   */
  public static calculateSidePots(players: ShowdownPlayer[]): SidePot[] {
    const pots: SidePot[] = [];
    let prevLevel = 0;

    // Níveis únicos de aposta (inclui foldados pois eles contribuíram ao pote)
    const levels = [...new Set(players.map(p => p.totalBet))]
      .filter(v => v > 0)
      .sort((a, b) => a - b);

    for (const level of levels) {
      const contribution = level - prevLevel;
      if (contribution <= 0) continue;

      // Quantos jogadores contribuíram pelo menos este valor
      const contributors = players.filter(p => p.totalBet >= level);
      const potAmount = contribution * contributors.length;

      // Apenas os não-foldados podem ganhar este pote
      const eligible = contributors
        .filter(p => !p.hasFolded)
        .map(p => p.id);

      if (potAmount > 0) {
        pots.push({ amount: potAmount, eligiblePlayerIds: eligible });
      }

      prevLevel = level;
    }

    return pots;
  }

  /**
   * Verifica se há empate (split pot) e retorna a descrição para exibição.
   */
  public static describePotResult(result: PotResult, playerNames: Record<string, string>): string {
    if (result.winners.length === 0) return "Pote sem vencedor (todos foldaram)";
    if (result.isSplit) {
      const names = result.winners.map(id => playerNames[id] || id).join(" e ");
      return `Split Pot — ${names} dividem ${result.amount} fichas (${result.amountPerWinner} cada${
        result.remainder > 0 ? ` + ${result.remainder} ficha ímpar para o primeiro à esquerda do dealer` : ''
      })`;
    }
    const winner = playerNames[result.winners[0]] || result.winners[0];
    return `${winner} vence ${result.amount} fichas`;
  }

  /**
   * Regra de "Melhor Mão na Mesa" (Best Hand on Board):
   * Quando apenas um jogador resta (todos foldaram), ele vence sem mostrar cartas.
   */
  public static resolveUncontested(
    winnerId: string,
    players: ShowdownPlayer[]
  ): ShowdownResult {
    const totalPot = players.reduce((sum, p) => sum + p.totalBet, 0);
    return {
      pots: [{ potIndex: 0, amount: totalPot, winners: [winnerId], isSplit: false, amountPerWinner: totalPot, remainder: 0 }],
      rankings: [],
    };
  }
}
```

### Integração do ShowdownManager com o PokerEngine

Adicione este trecho à lógica de `advanceStreet` quando a street for `SHOWDOWN`, ou crie uma função separada na API Route:

```typescript
// Exemplo de uso no handler da API: src/app/api/game/action/route.ts
import { ShowdownManager, ShowdownPlayer } from "@/lib/poker/ShowdownManager";

// Ao atingir SHOWDOWN:
const showdownPlayers: ShowdownPlayer[] = state.players.map(p => ({
  id: p.id,
  name: p.name,
  cards: p.cards,
  totalBet: p.totalBetThisHand, // Acumulado ao longo de todas as streets
  hasFolded: p.hasFolded,
}));

const result = ShowdownManager.resolve(showdownPlayers, state.board, state.dealerIndex);

// Distribuir fichas
for (const pot of result.pots) {
  for (const winnerId of pot.winners) {
    const player = state.players.find(p => p.id === winnerId);
    if (player) player.chips += pot.amountPerWinner;
  }
  // Ficha ímpar (odd chip): regra oficial = primeiro vencedor à ESQUERDA do dealer,
  // não simplesmente winners[0]. Percorremos os assentos a partir do dealer+1.
  if (pot.remainder > 0 && pot.winners.length > 0) {
    const n = state.players.length;
    for (let i = 1; i <= n; i++) {
      const seat = state.players[(state.dealerIndex + i) % n];
      if (pot.winners.includes(seat.id)) {
        seat.chips += pot.remainder;
        break;
      }
    }
  }
}
```

---

## Passo 7: Composição de Fichas (ChipComposer)

O sistema de fichas decompõe qualquer valor numérico nas denominações corretas de torneio, permitindo renderização visual autêntica com chips coloridos sobre a mesa.

Crie o arquivo `src/lib/poker/ChipComposer.ts`:

```typescript
// === DENOMINAÇÕES DE FICHAS DE TORNEIO ===
// Baseadas no esquema padrão de torneios de poker (EPT, WSOP, circuito nacional)

export interface ChipDenomination {
  value: number;
  label: string;       // Texto exibido na ficha
  color: string;       // Nome da cor (para CSS/Tailwind)
  cssColor: string;    // Hex ou HSL para renderização direta
  textColor: string;   // Cor do texto sobre a ficha
  borderColor: string; // Borda/listras da ficha
}

export const CHIP_DENOMINATIONS: ChipDenomination[] = [
  // Ordem decrescente — algoritmo greedy usa a maior primeiro
  { value: 100_000, label: "100K",  color: "yellow",  cssColor: "#F59E0B", textColor: "#1F1F1F", borderColor: "#92400E" },
  { value:  25_000, label: "25K",   color: "pink",    cssColor: "#EC4899", textColor: "#FFFFFF", borderColor: "#9D174D" },
  { value:   5_000, label: "5K",    color: "black",   cssColor: "#1F2937", textColor: "#F9FAFB", borderColor: "#4B5563" },
  { value:   1_000, label: "1K",    color: "green",   cssColor: "#059669", textColor: "#FFFFFF", borderColor: "#064E3B" },
  { value:     500, label: "500",   color: "purple",  cssColor: "#7C3AED", textColor: "#FFFFFF", borderColor: "#4C1D95" },
  { value:     100, label: "100",   color: "gray",    cssColor: "#9CA3AF", textColor: "#1F1F1F", borderColor: "#4B5563" },
  { value:      25, label: "25",    color: "red",     cssColor: "#DC2626", textColor: "#FFFFFF", borderColor: "#7F1D1D" },
];

export interface ChipCount {
  denomination: ChipDenomination;
  count: number;
}

export interface ChipStack {
  chips: ChipCount[];
  total: number;
  remainderWarning?: string; // Se valor não for divisível exatamente
}

export class ChipComposer {

  /**
   * Decompõe um valor em denominações de fichas usando algoritmo greedy.
   * Garante sempre a composição com o MENOR número de fichas possível.
   *
   * @param amount - Valor em fichas a decompor
   * @param denominations - Lista de denominações (default: padrão de torneio)
   */
  public static compose(
    amount: number,
    denominations: ChipDenomination[] = CHIP_DENOMINATIONS
  ): ChipStack {
    let remaining = Math.floor(amount); // Apenas inteiros (fichas não têm frações)
    const chips: ChipCount[] = [];

    for (const denom of denominations) {
      if (remaining >= denom.value) {
        const count = Math.floor(remaining / denom.value);
        chips.push({ denomination: denom, count });
        remaining -= count * denom.value;
      }
    }

    const stack: ChipStack = { chips, total: amount };
    if (remaining > 0) {
      stack.remainderWarning = `${remaining} fichas não representáveis com as denominações disponíveis`;
    }

    return stack;
  }

  /**
   * Retorna apenas os chips com count > 0 para exibição visual.
   */
  public static getDisplayChips(amount: number): ChipCount[] {
    return this.compose(amount).chips.filter(c => c.count > 0);
  }

  /**
   * Converte uma stack de volta ao valor total (útil para validação).
   */
  public static toValue(stack: ChipStack): number {
    return stack.chips.reduce((sum, c) => sum + c.denomination.value * c.count, 0);
  }

  /**
   * Gera uma representação em texto para logs e debug.
   * Ex: "2x 1K + 3x 100 + 1x 25 = 2325"
   */
  public static toString(amount: number): string {
    const chips = this.getDisplayChips(amount);
    const parts = chips.map(c => `${c.count}x ${c.denomination.label}`);
    return `${parts.join(" + ")} = ${amount}`;
  }

  /**
   * Verifica se um valor é apostável com as denominações disponíveis.
   * Importante para validar raises (deve ser múltiplo da menor ficha).
   */
  public static isValidBetAmount(amount: number): boolean {
    const smallestChip = CHIP_DENOMINATIONS[CHIP_DENOMINATIONS.length - 1].value;
    return amount % smallestChip === 0 && amount > 0;
  }

  /**
   * Arredonda um valor para o múltiplo válido mais próximo (para slider de bet).
   */
  public static roundToValid(amount: number): number {
    const smallestChip = CHIP_DENOMINATIONS[CHIP_DENOMINATIONS.length - 1].value;
    return Math.round(amount / smallestChip) * smallestChip;
  }
}
```

### Componente Visual de Chips (`src/components/ChipStackDisplay.tsx`)

Criar o componente React que renderiza as fichas visualmente sobre a mesa:

```tsx
"use client";

import { ChipComposer } from "@/lib/poker/ChipComposer";

interface ChipStackDisplayProps {
  amount: number;
  label?: string;   // Ex: "Pote", "Aposta"
  size?: "sm" | "md" | "lg";
}

export function ChipStackDisplay({ amount, label, size = "md" }: ChipStackDisplayProps) {
  const chips = ChipComposer.getDisplayChips(amount);
  const chipSize = size === "sm" ? "w-5 h-5 text-[8px]" : size === "lg" ? "w-9 h-9 text-xs" : "w-7 h-7 text-[10px]";

  return (
    <div className="flex flex-col items-center gap-1">
      {label && (
        <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">{label}</span>
      )}
      {/* Pilha de fichas — renderiza da maior para a menor */}
      <div className="flex items-end gap-1">
        {chips.map(({ denomination, count }) => (
          <div key={denomination.value} className="flex flex-col items-center gap-0.5">
            {/* Empilha chips visualmente (até 4 visíveis + contador) */}
            <div className="relative flex flex-col-reverse items-center">
              {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
                <div
                  key={i}
                  className={`${chipSize} rounded-full border-2 flex items-center justify-center font-bold shadow-md`}
                  style={{
                    backgroundColor: denomination.cssColor,
                    borderColor: denomination.borderColor,
                    color: denomination.textColor,
                    marginBottom: i > 0 ? "-6px" : 0,
                    zIndex: i,
                  }}
                >
                  {i === 0 ? denomination.label : ""}
                </div>
              ))}
            </div>
            {/* Contador se > 4 fichas */}
            {count > 1 && (
              <span className="text-[9px] text-gray-300 font-bold">×{count}</span>
            )}
          </div>
        ))}
      </div>
      {/* Valor total */}
      <span className="text-xs font-bold text-yellow-300">{amount.toLocaleString()}</span>
    </div>
  );
}
```

### Exemplo de uso na mesa de jogo

```tsx
// No componente PokerTable.tsx — substituir o texto do pote pelo componente visual:
import { ChipStackDisplay } from "@/components/ChipStackDisplay";

// Antes:
// <div>POTE: 1.500 fichas</div>

// Depois:
<ChipStackDisplay amount={1500} label="Pote" size="sm" />

// Para exibir a aposta do jogador:
<ChipStackDisplay amount={250} label="Bet" size="sm" />
```

---

## Passo 8: Algoritmo de Tomada de Decisão do Bot (`src/lib/poker/BotDecision.ts`)

```typescript
import { GameState, PlayerState, ActionType } from "./PokerEngine";
import { HandEvaluator } from "./HandEvaluator";

export class BotDecision {
  public static getAction(state: GameState, botIdx: number): { action: ActionType; amount: number } {
    const bot = state.players[botIdx];
    const numPlayers = state.players.filter(p => !p.hasFolded).length;
    const toCall = state.currentBetToCall - bot.currentBet;
    const potOdds = toCall / (state.pot + toCall);

    // 1. Decisão Pré-Flop Baseada em Ranges Posicionais e Perfil do Bot
    if (state.street === "PRE_FLOP") {
      return this.makePreFlopDecision(bot, state.players.length, toCall, state.bigBlind);
    }

    // 2. Decisão Pós-Flop Baseada em Equidade (Monte Carlo com TS puro)
    const equity = HandEvaluator.calculateEquity(bot.cards, state.board, numPlayers - 1, 300);

    // Valor Esperado (EV) simplificado
    const expectedValue = (equity * state.pot) - ((1 - equity) * toCall);

    // Ajuste de Blefe baseado no perfil do bot
    const bluffFactor = this.getBluffFactor(bot.botProfile || "TAG");

    if (equity > 0.7) {
      const raiseAmount = Math.max(state.bigBlind, Math.floor(state.pot * 0.5));
      return { action: bot.chips <= raiseAmount ? "ALL_IN" : "RAISE", amount: raiseAmount };
    } else if (equity > 0.4 || expectedValue > 0 || Math.random() < bluffFactor) {
      if (toCall === 0) return { action: "CHECK", amount: 0 };
      return { action: bot.chips <= toCall ? "ALL_IN" : "CALL", amount: toCall };
    } else {
      return toCall === 0 ? { action: "CHECK", amount: 0 } : { action: "FOLD", amount: 0 };
    }
  }

  private static getBluffFactor(profile: string): number {
    switch (profile) {
      case "LAG": return 0.20;
      case "TAG": return 0.08;
      case "NIT": return 0.02;
      case "CALLING_STATION": return 0.05;
      default: return 0.05;
    }
  }

  private static makePreFlopDecision(bot: PlayerState, totalPlayers: number, toCall: number, bb: number): { action: ActionType; amount: number } {
    const c1 = bot.cards[0];
    const c2 = bot.cards[1];
    const highRank = c1[0];
    const lowRank = c2[0];
    const suited = c1[1] === c2[1];
    const pair = highRank === lowRank;

    const premium = pair && ["A", "K", "Q", "J", "T"].includes(highRank);
    const goodSuited = suited && ["A", "K", "Q"].includes(highRank) && ["K", "Q", "J", "T", "9"].includes(lowRank);
    const goodUnsuited = !suited && highRank === "A" && ["K", "Q", "J"].includes(lowRank);

    if (premium) {
      const bet = bb * 3;
      return { action: "RAISE", amount: Math.min(bot.chips, bet) };
    }
    if (goodSuited || goodUnsuited) {
      if (toCall <= bb * 2) return { action: "CALL", amount: toCall };
    }
    if (toCall > 0) return { action: "FOLD", amount: 0 };
    return { action: "CHECK", amount: 0 };
  }
}
```

---

## Passo 9: Regras Estáticas do Poker — POKER_RULES.ts

Este arquivo é o coração do sistema de análise. Ele codifica as regras mais importantes dos livros do Material de Apoio em formato TypeScript estruturado. A engine local verifica as `triggerConditions` a cada ação do jogador e o Gemini recebe **apenas as regras violadas** para gerar feedback eficiente.

Crie o arquivo `src/lib/poker/POKER_RULES.ts`:

> **Importante (RF06):** o campo `triggerConditions` (texto) é apenas **documentação legível**. Para que a engine local **detecte violações automaticamente**, cada regra também tem um **predicado executável** `predicate(ctx)` que recebe um `HandContext` estruturado e retorna `true` quando a regra foi violada. É o `predicate` — não o texto — que marca `errorsFlagged` e popula `rulesViolated[]`.

```typescript
// Snapshot estruturado da decisão do jogador, montado pela engine a cada ação.
// O avaliador (lookup table) preenche equity/outs; a engine preenche posição, sizing, street etc.
export interface HandContext {
  street: "PRE_FLOP" | "FLOP" | "TURN" | "RIVER";
  position: "UTG" | "UTG1" | "MP" | "HJ" | "CO" | "BTN" | "SB" | "BB";
  heroCards: string[];          // ex.: ["Ah", "Kd"]
  board: string[];
  action: "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE" | "ALL_IN";
  betSize: number;              // valor apostado/pago nesta ação
  pot: number;                  // pote ANTES da ação
  toCall: number;               // valor para pagar antes da ação
  potOddsNeeded: number;        // toCall / (pot + toCall)
  equity: number;               // 0..1, calculado pela lookup table / Monte Carlo
  activePlayers: number;        // jogadores ainda na mão
  facing3Bet: boolean;
  effectiveStackBB: number;     // stack efetivo em big blinds
  bubbleFactor: number;         // 0..1; >0 indica proximidade da bolha (ICM)
}

export interface PokerRule {
  id: string;           // Identificador único (ex: "PRE_FLOP_001")
  category: "PRE_FLOP" | "POST_FLOP" | "POSITION" | "POT_ODDS" | "BLUFF" | "ICM" | "VALUE_BET";
  title: string;
  description: string;
  bookSource: string;   // Citação do livro de origem
  severity: "LOW" | "MEDIUM" | "HIGH"; // Impacto do erro no EV
  triggerConditions: string;            // Documentação legível das condições (NÃO é avaliada)
  predicate: (ctx: HandContext) => boolean; // Executável: true = regra VIOLADA nesta ação
}

// Helpers de classificação de mãos usados pelos predicados (implementar em utils)
import { isPremium, isSpeculative, isMarginalDefense } from "@/lib/poker/handClass";

export const POKER_RULES: PokerRule[] = [
  // === PRÉ-FLOP ===
  {
    id: "PRE_FLOP_001",
    category: "PRE_FLOP",
    title: "Jogar mãos fracas fora de posição sem pressão do blind",
    description: "Entrar no pote com mãos especulativas (conectores sem naipe, pares pequenos) em UTG/UTG+1 resulta em perda de EV a longo prazo. Mãos que requerem pós-flop favorável devem ser abertas com frequência apenas em posição.",
    bookSource: "Poker em 50 Lições — Leo Bello, Lição 8: A Importância da Posição",
    severity: "HIGH",
    triggerConditions: "Jogador ativa com call/open em UTG/UTG+1 com mão classificada como especulativa (conectores off-suit, pares < 77)",
    predicate: (ctx) =>
      ctx.street === "PRE_FLOP" &&
      ["UTG", "UTG1"].includes(ctx.position) &&
      ["CALL", "BET", "RAISE"].includes(ctx.action) &&
      isSpeculative(ctx.heroCards),
  },
  {
    id: "PRE_FLOP_002",
    category: "PRE_FLOP",
    title: "Limp (call de BB) com mão premium pré-flop",
    description: "Limpar com AA, KK, QQ, AKs pré-flop desperdiça valor. Mãos premium exigem raise para isolar oponentes e construir pote com vantagem de equidade.",
    bookSource: "Easy Game Vol. I — Andrew Seidman, Capítulo 3: Value Betting e Freqüência",
    severity: "HIGH",
    triggerConditions: "Jogador faz call do BB com mão premium (AA, KK, QQ, AKs) sem raise anterior",
    predicate: (ctx) =>
      ctx.street === "PRE_FLOP" &&
      ctx.action === "CALL" &&
      ctx.toCall <= ctx.pot && // ainda em pote não-elevado (limp/complete)
      isPremium(ctx.heroCards),
  },
  {
    id: "PRE_FLOP_003",
    category: "PRE_FLOP",
    title: "Pagar 3-bet sem equidade ou posição",
    description: "Pagar 3-bet sem posição com mãos fora do range de défesa ideal (ex: KJo, QTo) resulta em EV negativo. O correto é fold ou 4-bet como blefe.",
    bookSource: "A Matemática do Poker — Rafael Polesi, Capítulo 7: Pot Odds em 3-Bet Pots",
    severity: "HIGH",
    triggerConditions: "Jogador paga 3-bet > 12BB fora de posição com mão classificada como marginal",
  },

  // === PÓS-FLOP ===
  {
    id: "POST_FLOP_001",
    category: "POST_FLOP",
    title: "Continuation Bet em board ruim para o range de abertura",
    description: "Fazer c-bet automático em boards que conectam melhor com a gama do oponente (ex: J-9-8 quando o vilão defendeu BB com amplo range) é um erro de equidade.",
    bookSource: "Easy Game Vol. I — Andrew Seidman, Capítulo 5: Seleção de Boards para C-Bet",
    severity: "MEDIUM",
    triggerConditions: "Jogador faz c-bet > 50% do pote em flop com textura molhada (2+ cartas sequenciadas e do mesmo naipe) com equidade < 40%",
  },
  {
    id: "POST_FLOP_002",
    category: "POST_FLOP",
    title: "Fold com pot odds corretas para completar draw",
    description: "Quando o custo do call representa menos do que a equidade × pote (pot odds melhores que a equity do draw), o fold é matematicamente incorreto.",
    bookSource: "A Matemática do Poker — Rafael Polesi, Capítulo 4: Outs e Pot Odds",
    severity: "HIGH",
    triggerConditions: "Jogador faz fold com flush draw ou open-ended straight draw quando pot odds > equity necessária para breakeven",
  },
  {
    id: "POST_FLOP_003",
    category: "POST_FLOP",
    title: "Overbet em posição sem equity advantage",
    description: "Apostas > 100% do pote requerem forte vantagem de range. Sem polarização adequada, o overbet torna-se facilmente explorável.",
    bookSource: "Easy Game Vol. I — Andrew Seidman, Capítulo 9: Polarização e Bet Sizing",
    severity: "MEDIUM",
    triggerConditions: "Jogador aposta > 100% do pote com equidade calculada entre 40-60%",
  },

  // === POSIÇÃO ===
  {
    id: "POSITION_001",
    category: "POSITION",
    title: "Ignorar vantagem posicional no Button",
    description: "Ter a posição de Button e não usar steals de blinds ou isolamentos agressivos desperdiça a maior vantagem estrutural do poker.",
    bookSource: "Hold'em Wisdom — Daniel Negreanu, Capítulo 2: A Arte do Jogo Posicional",
    severity: "MEDIUM",
    triggerConditions: "Jogador em BTN faz fold/check com > 2 limpers na mesa sem pressão de raise",
  },

  // === ICM (Pressão de Torneio) ===
  {
    id: "ICM_001",
    category: "ICM",
    title: "All-in irresponsável próximo da bolha",
    description: "Próximo à zona de pagamento, o ICM penaliza eliminações. Apostas de stack completo com equidade < 55% ignoram a pressão financeira da situação.",
    bookSource: "A Matemática do Poker — Rafael Polesi, Capítulo 12: ICM e Pressão de Bolha",
    severity: "HIGH",
    triggerConditions: "Jogador vai all-in próximo da bolha do torneio (< 20% da mesa restante) com equidade < 55% e stack acima de 15BB",
  },
  {
    id: "ICM_002",
    category: "ICM",
    title: "Fold incorreto com stack curto e boa equity",
    description: "Com stack < 10BB, o push/fold é matematicamente superior ao call/fold. Esperar por uma mão 'premium' quando há pressão de blinds resulta em morte lenta por cegueira.",
    bookSource: "Poker em 50 Lições — Leo Bello, Lição 42: Sobrevivência em Short Stack",
    severity: "HIGH",
    triggerConditions: "Jogador faz fold em BB/SB com stack < 10BB e mão com equidade > 45% contra range de push",
  },

  // === BLEFE ===
  {
    id: "BLUFF_001",
    category: "BLUFF",
    title: "Blefe em múltiplos oponentes",
    description: "A frequência de sucesso de um blefe diminui exponencialmente com cada oponente adicional. Blefar em potes multiway (3+ jogadores) raramente é lucrativo.",
    bookSource: "Easy Game Vol. I — Andrew Seidman, Capítulo 7: Frequência e Alvo de Blefes",
    severity: "MEDIUM",
    triggerConditions: "Jogador aposta > 60% do pote em pote multiway (3+ jogadores ativos) sem equity suficiente para value",
  },
];

// NOTA: as demais regras (PRE_FLOP_003, POST_FLOP_*, POSITION_*, ICM_*, BLUFF_*) também
// devem receber seu próprio `predicate`. Padrão recomendado, traduzindo os triggerConditions:
//   POST_FLOP_002 (fold com pot odds corretas):
//     predicate: (ctx) => ctx.action === "FOLD" && ctx.equity > ctx.potOddsNeeded
//   ICM_001 (all-in irresponsável na bolha):
//     predicate: (ctx) => ctx.action === "ALL_IN" && ctx.bubbleFactor > 0
//                       && ctx.equity < 0.55 && ctx.effectiveStackBB > 15
//   BLUFF_001 (blefe multiway):
//     predicate: (ctx) => ctx.activePlayers >= 3 && ["BET","RAISE"].includes(ctx.action)
//                       && ctx.betSize > 0.6 * ctx.pot && ctx.equity < 0.5

// Avalia TODAS as regras contra o contexto de uma ação e retorna os IDs violados.
// Chamada pela engine a cada ação do jogador humano (e usada para marcar errorsFlagged).
export function evaluateViolations(ctx: HandContext): string[] {
  return POKER_RULES.filter(rule => {
    try {
      return rule.predicate(ctx);
    } catch {
      return false; // um predicado defeituoso nunca deve derrubar a engine
    }
  }).map(rule => rule.id);
}

// Função utilitária para buscar regras por IDs violados
export function getRulesById(ids: string[]): PokerRule[] {
  return POKER_RULES.filter(rule => ids.includes(rule.id));
}

// Função para montar o contexto do Gemini com apenas as regras violadas
export function buildViolationsContext(violatedIds: string[]): string {
  const rules = getRulesById(violatedIds);
  if (rules.length === 0) return "Nenhuma regra violada detectada nesta mão.";
  
  return rules.map(r => `
**[${r.id}] ${r.title}** (Severidade: ${r.severity})
- Descrição: ${r.description}
- Fonte: ${r.bookSource}
`).join("\n");
}
```

---

## Passo 10: Orquestrador de Torneio MTT (Multi-Mesas)

> **Arquitetura de simulação (decisão de projeto).** Funções serverless da Vercel **não mantêm processo vivo** entre requisições nem suportam loops longos (limite de execução de segundos). Portanto **NÃO** rodaremos todas as mesas carta a carta em background numa API Route. Em vez disso:
>
> - **Apenas a mesa do humano** é simulada carta a carta (engine completa + bots).
> - **As demais mesas são abstraídas estatisticamente**: a cada "tick" do torneio, o número de eliminações é amostrado a partir de um modelo de distribuição de stacks/ICM (jogadores com stack curto têm maior probabilidade de eliminação por intervalo de blind). Não distribuímos cartas para mesas onde o humano não está.
> - O avanço do torneio é **dirigido por tick**: cada ação/rodada do humano (ou um cron leve) chama `advanceTournament(dt)`, que aplica eliminações abstratas, sobe blinds quando devido e rebalanceia as mesas. Nada roda "em background" de forma contínua.
> - Isso mantém o custo baixo, cabe em serverless e é **suficiente para um app de treino** — o foco analítico é o jogo do humano, não a fidelidade das mesas invisíveis.
>
> O `MttManager` abaixo cobre o **balanceamento de mesas**. O modelo de eliminação abstrata (`simulateEliminations(stacks, dt)`) deve ser implementado como módulo separado e chamado pelo orquestrador de tick.

Para o balanceamento dinâmico das mesas, crie o arquivo `src/lib/poker/MttManager.ts`:

```typescript
export interface MttTable {
  id: string;
  players: string[]; // Nomes ou IDs dos jogadores
}

export class MttManager {
  // Executa o balanceamento dinâmico das mesas (padrão: 9 por mesa, 27 jogadores = 3 mesas)
  public static balanceTables(tables: MttTable[], activePlayers: string[]): MttTable[] {
    const maxPlayersPerTable = 9;
    
    // Remove jogadores eliminados das mesas
    let updatedTables = tables.map(t => ({
      ...t,
      players: t.players.filter(p => activePlayers.includes(p))
    })).filter(t => t.players.length > 0);

    const totalActive = activePlayers.length;
    const targetNumTables = Math.ceil(totalActive / maxPlayersPerTable);

    // Se precisamos consolidar e fechar alguma mesa
    if (updatedTables.length > targetNumTables) {
      updatedTables.sort((a, b) => a.players.length - b.players.length);
      const tableToDissolve = updatedTables.shift()!;
      const playersToMove = [...tableToDissolve.players];

      for (const player of playersToMove) {
        updatedTables.sort((a, b) => a.players.length - b.players.length);
        if (updatedTables[0].players.length < maxPlayersPerTable) {
          updatedTables[0].players.push(player);
        }
      }
    }

    return updatedTables;
  }

  // Cria as mesas iniciais distribuindo 27 jogadores em 3 mesas de 9
  public static createInitialTables(playerIds: string[]): MttTable[] {
    const tables: MttTable[] = [];
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    const chunkSize = 9;

    for (let i = 0; i < shuffled.length; i += chunkSize) {
      tables.push({
        id: `table-${tables.length + 1}`,
        players: shuffled.slice(i, i + chunkSize),
      });
    }

    return tables;
  }
}
```

---

## Passo 11: Modo Treinamento e Integração do Gemini com Regras Estáticas

> **Decisão de projeto — Gemini fora do caminho crítico.** O painel de treino exibe em tempo real, de forma **100% local e instantânea**, os dados determinísticos: **outs, equity (lookup table), pot odds, SPR e EV**. O Gemini **não** é chamado a cada ação (seria lento — segundos — e custoso/rate-limited). Ele é acionado **apenas sob demanda** (botão "Pedir Dica ao Tutor") e na **geração do relatório pós-torneio**. A função `getRealTimeAdvice` abaixo, portanto, roda **on-demand**, não a cada decisão.

A API do Gemini recebe **apenas as regras violadas** (não os livros inteiros) para gerar explicações eficientes e relatórios críticos.

### 1. Criar o Serviço do Tutor de IA (`src/lib/gemini/TutorService.ts`)

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildViolationsContext } from "@/lib/poker/POKER_RULES";

// ⚠️ Verifique o SDK/modelo atuais antes de codar: o pacote `@google/generative-ai`
// vem sendo substituído pelo novo `@google/genai`, e o nome do modelo
// ("gemini-2.5-flash") deve ser confirmado na documentação vigente do Google AI Studio.
export class TutorService {
  private static genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  private static model = TutorService.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // Gera a dica para o modo treino em tempo real (com base nas regras violadas)
  public static async getRealTimeAdvice(
    playerCards: string[],
    boardCards: string[],
    actionToCall: number,
    pot: number,
    position: string,
    violatedRuleIds: string[] = []
  ): Promise<string> {
    const violationsContext = buildViolationsContext(violatedRuleIds);

    const prompt = `
Você é um treinador profissional de poker Texas Hold'em. Ajude o jogador a tomar a melhor decisão com base nas seguintes informações.

## Situação Atual
- Cartas do Jogador: ${playerCards.join(", ")}
- Cartas Comunitárias (Board): ${boardCards.length > 0 ? boardCards.join(", ") : "Ainda não abertas (Pré-Flop)"}
- Posição do Jogador: ${position}
- Tamanho do Pote: ${pot} fichas
- Valor Necessário para Pagar (Call): ${actionToCall} fichas

## Regras Violadas Detectadas pelo Sistema
${violationsContext}

## Instruções
1. Calcule e sugira a melhor opção matemática (GTO) para esta situação.
2. Se houver regra violada, explique o erro cometido citando o livro de origem.
3. Seja encorajador, didático e direto.
4. Responda em Português do Brasil de forma concisa (máximo 200 palavras).
    `;

    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }

  // Gera o relatório final de erros pós-torneio
  public static async generateTournamentReport(handsJson: string, violatedRuleIds: string[]): Promise<string> {
    const violationsContext = buildViolationsContext(violatedRuleIds);

    const prompt = `
Você é um auditor e professor especialista em poker de torneio.

## Regras Violadas Durante o Torneio
${violationsContext}

## Log de Mãos Jogadas pelo Usuário
${handsJson}

## Instruções
Gere um relatório detalhado em Markdown (Português do Brasil) contendo:
1. **Avaliação Geral** — Estilo de jogo do usuário baseado em agressividade, seleção de mãos e frequência de erros.
2. **Análise das 3 Principais Falhas** — Cite cada regra violada, o livro de origem e a lição exata correspondente.
3. **Plano de Ação** — Exercícios específicos de foco para a próxima simulação.

Seja construtivo, técnico e motivador.
    `;

    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }
}
```

---

## Passo 12: Desenvolvimento do Frontend (Mesa 2D Premium Animada)

### 1. Criar o CSS de Design System (`src/app/globals.css`)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --felt-gradient: radial-gradient(circle, #0e5c2d 0%, #063016 100%);
  --background-dark: #07090e;
}

body {
  background-color: var(--background-dark);
  color: #f3f4f6;
  font-family: 'Inter', sans-serif;
  overflow-x: hidden;
}

/* Efeito Vidro Jateado (Glassmorphism) */
.glass-panel {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  border-radius: 16px;
}

/* Estilo premium do Feltro da Mesa */
.poker-felt {
  background: var(--felt-gradient);
  box-shadow: inset 0 0 100px rgba(0,0,0,0.8), 0 20px 50px rgba(0,0,0,0.6);
  border: 12px solid #2b1f1d;
  border-radius: 50% / 40%;
}
```

### 2. Componente da Mesa de Jogo (`src/components/PokerTable.tsx`)

```tsx
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, ShieldAlert, Award } from "lucide-react";

interface CardComponentProps {
  card: string;
}

const CardComponent: React.FC<CardComponentProps> = ({ card }) => {
  const isRed = card.includes("h") || card.includes("d");
  const value = card[0];
  const suitSymbol = card.includes("h") ? "♥" : card.includes("d") ? "♦" : card.includes("s") ? "♠" : "♣";

  return (
    <motion.div
      initial={{ scale: 0, y: -50, rotate: -45 }}
      animate={{ scale: 1, y: 0, rotate: 0 }}
      exit={{ scale: 0 }}
      className={`w-14 h-20 bg-white rounded-lg flex flex-col justify-between p-1.5 shadow-lg border border-gray-300 font-bold select-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}
    >
      <div className="text-sm leading-none">{value}</div>
      <div className="text-xl align-middle text-center">{suitSymbol}</div>
      <div className="text-sm leading-none text-right rotate-180">{value}</div>
    </motion.div>
  );
};

export default function PokerTable() {
  const [board, setBoard] = useState<string[]>(["As", "Kd", "Qc"]);
  const [playerCards, setPlayerCards] = useState<string[]>(["Kh", "Qh"]);
  const [advice, setAdvice] = useState<string>("");
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  const requestAdvice = async () => {
    setLoadingAdvice(true);
    try {
      const res = await fetch("/api/tutor/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerCards, boardCards: board, position: "BTN", pot: 500, toCall: 50, violatedRuleIds: [] })
      });
      const data = await res.json();
      setAdvice(data.advice);
    } catch {
      setAdvice("Erro ao conectar ao tutor de IA.");
    } finally {
      setLoadingAdvice(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] p-6 flex flex-col items-center justify-between text-white">
      {/* Topo / Placar */}
      <header className="w-full max-w-5xl flex justify-between items-center glass-panel px-6 py-4">
        <div className="flex items-center gap-2">
          <Award className="text-yellow-500" />
          <h1 className="font-extrabold text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-200">
            POKER TRAINER PRO
          </h1>
        </div>
        <div className="flex gap-4">
          <span className="text-sm text-gray-300">Nível 3 Blinds: 50/100</span>
          <span className="text-sm font-bold text-green-400">Stack: 9.850 Fichas</span>
        </div>
      </header>

      {/* Feltro de Poker */}
      <main className="w-full max-w-4xl h-[420px] poker-felt relative my-8 flex items-center justify-center">
        {/* Board */}
        <div className="flex items-center gap-2 bg-black/40 px-6 py-4 rounded-xl border border-white/10 shadow-2xl">
          <AnimatePresence>
            {board.map((card, idx) => (
              <CardComponent key={card + idx} card={card} />
            ))}
          </AnimatePresence>
        </div>

        {/* Fichas do Pote */}
        <div className="absolute top-[32%] text-xs font-semibold px-3 py-1 bg-black/60 rounded-full border border-yellow-500/30">
          POTE: 1.500 fichas
        </div>

        {/* Assento do Usuário */}
        <div className="absolute bottom-[-20px] flex flex-col items-center">
          <div className="flex gap-2 mb-2">
            {playerCards.map((card, idx) => (
              <CardComponent key={card + idx} card={card} />
            ))}
          </div>
          <div className="bg-[#1b1c22] border border-gray-700/50 px-4 py-1.5 rounded-lg text-sm font-bold shadow-lg">
            Você (BTN)
          </div>
        </div>
      </main>

      {/* Controles de Ação & Painel do Tutor */}
      <footer className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Painel do Treinador */}
        <section className="col-span-2 glass-panel p-5 flex flex-col gap-3 min-h-[140px]">
          <div className="flex items-center gap-2 text-yellow-400 font-bold border-b border-white/10 pb-2">
            <ShieldAlert size={18} />
            <h2>DICAS E INSTRUÇÃO DO TREINADOR</h2>
          </div>
          <p className="text-sm text-gray-200">
            {advice || "Clique em 'Pedir Dica' para obter análise matemática e teórica imediata desta mão!"}
          </p>
          <button
            id="btn-pedir-dica"
            onClick={requestAdvice}
            disabled={loadingAdvice}
            className="self-start px-4 py-1.5 bg-yellow-500 hover:bg-yellow-600 active:scale-95 text-gray-900 rounded-md font-bold text-xs transition duration-200"
          >
            {loadingAdvice ? "Analisando..." : "Pedir Dica ao Tutor"}
          </button>
        </section>

        {/* Painel de Botões de Ação */}
        <section className="glass-panel p-5 flex flex-col gap-4">
          <h3 className="text-xs text-gray-400 font-bold uppercase tracking-wider">Ações de Jogo</h3>
          <div className="grid grid-cols-2 gap-2">
            <button id="btn-fold" className="py-2.5 bg-red-600/80 hover:bg-red-700/80 transition font-bold rounded-lg text-sm">Fold</button>
            <button id="btn-check" className="py-2.5 bg-gray-600/80 hover:bg-gray-700/80 transition font-bold rounded-lg text-sm">Check</button>
            <button id="btn-call" className="py-2.5 bg-green-600/80 hover:bg-green-700/80 transition font-bold rounded-lg text-sm col-span-2">Call (50)</button>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-semibold text-gray-400">
              <span>Bet/Raise size:</span>
              <span className="text-green-400 font-bold">250 fichas</span>
            </div>
            <input id="slider-bet" type="range" min="100" max="1000" className="w-full accent-green-500 bg-gray-700 h-1.5 rounded-lg appearance-none cursor-pointer" />
          </div>
        </section>
      </footer>
    </div>
  );
}
```

---

## Passo 13: Testes Locais da Engine

> **Testes automatizados obrigatórios (Roadmap Fases 0 e 1).** O script manual abaixo é útil para inspeção rápida, mas **não substitui** a suíte automatizada. Antes de avançar de fase, estes testes (ex.: Vitest/Jest) devem estar **verdes**:
>
> - **0.2 — Avaliador:** comparar a saída do avaliador (lookup table) com os **vetores de teste do `phevaluator`** (em `Aplicativo para avaliar mãos/`); cobrir wheel (A-2-3-4-5), Royal Flush, desempate por kicker e split. Garantir a convenção `maior score = mais forte`.
> - **0.3 — ShowdownManager:** side pots com múltiplos all-ins de valores diferentes, split pot, **odd chip** indo ao primeiro vencedor à esquerda do dealer, e pote uncontested.
> - **0.4 — Equity:** coin-flips conhecidos (ex.: AKs vs QQ ≈ 46/54) dentro de ±1% com iterações suficientes.
> - **1.5 — Mão completa:** rodar uma mão heads-up e uma 3-way de ponta a ponta e asserir que a **soma total de fichas é conservada** (nenhuma ficha criada/destruída) e que `applyAction` rejeita raises abaixo do min-raise.
>
> Recomendado: `npm install -D vitest` e script `"test": "vitest run"` no `package.json`, com os arquivos em `src/lib/poker/__tests__/`.

Para uma inspeção manual rápida da engine sem subir toda a interface visual, crie um script de teste em `src/scripts/testGame.ts`:

```typescript
import { PokerEngine, PlayerState } from "../lib/poker/PokerEngine";
import { HandEvaluator } from "../lib/poker/HandEvaluator";
import { BotDecision } from "../lib/poker/BotDecision";

const mockPlayers: PlayerState[] = [
  { id: "1", name: "Jogador 1 (Humano)", isBot: false, chips: 10000, currentBet: 0, cards: [], hasFolded: false, isAllIn: false, position: "BTN" },
  { id: "2", name: "Bot 1 (TAG)", isBot: true, botProfile: "TAG", chips: 10000, currentBet: 0, cards: [], hasFolded: false, isAllIn: false, position: "SB" },
  { id: "3", name: "Bot 2 (LAG)", isBot: true, botProfile: "LAG", chips: 10000, currentBet: 0, cards: [], hasFolded: false, isAllIn: false, position: "BB" }
];

console.log("=== INICIANDO SIMULAÇÃO DE MÃO ===");
const state = PokerEngine.startNewHand(mockPlayers, 50, 100, 0);

console.log(`Pote Inicial: ${state.pot} fichas`);
state.players.forEach(p => {
  console.log(`${p.name} recebeu as cartas: ${p.cards.join(", ")}`);
});

// Testa a avaliação de mãos (sem binários nativos)
const testHand = [...state.players[0].cards, ...["As", "Kd", "Qc"]];
const result = HandEvaluator.evaluateBestHand(testHand);
console.log(`Melhor mão do Jogador 1: ${result.description} (score: ${result.score})`);

// Testa a tomada de decisão do Bot 1
const nextAct = state.activePlayerIndex;
if (state.players[nextAct].isBot) {
  const decision = BotDecision.getAction(state, nextAct);
  console.log(`IA ${state.players[nextAct].name} decidiu: ${decision.action} | Montante: ${decision.amount}`);
}

// Testa cálculo de equidade
const equity = HandEvaluator.calculateEquity(state.players[0].cards, [], 2, 200);
console.log(`Equidade pré-flop do Jogador 1 vs. 2 oponentes: ${(equity * 100).toFixed(1)}%`);
```

Rode com:
```bash
npx ts-node src/scripts/testGame.ts
```

---

## Passo 14: Deploy em Produção (Vercel)

Quando o desenvolvimento local estiver funcional, siga estes passos para ir a produção.

### 1. Preparar o Repositório GitHub

```bash
git init
git add .
git commit -m "feat: initial poker trainer implementation"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/poker-trainer.git
git push -u origin main
```

### 2. Conectar ao Vercel

1. Acesse [vercel.com](https://vercel.com) e clique em **Add New Project**
2. Importe o repositório do GitHub
3. Framework Preset: **Next.js** (detectado automaticamente)
4. Clique em **Deploy**

### 3. Configurar Variáveis de Ambiente na Vercel

No painel do projeto em Vercel → **Settings → Environment Variables**, adicione **todas** as variáveis do seu `.env.local`:

| Variável | Onde obter |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → Connection String |
| `NEXTAUTH_SECRET` | Qualquer string aleatória longa |
| `NEXTAUTH_URL` | `https://seu-dominio.vercel.app` (URL de produção) |
| `GEMINI_API_KEY` | Google AI Studio |
| `PUSHER_APP_ID` | Dashboard do Pusher |
| `PUSHER_KEY` | Dashboard do Pusher |
| `PUSHER_SECRET` | Dashboard do Pusher |
| `PUSHER_CLUSTER` | Dashboard do Pusher |
| `NEXT_PUBLIC_PUSHER_KEY` | Mesmo que `PUSHER_KEY` |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Mesmo que `PUSHER_CLUSTER` |

### 4. Atualizar o Banco de Dados para Produção

Após configurar as variáveis na Vercel, rode o push do schema no banco de produção (Supabase já está na nuvem, então só é necessário garantir que o schema está aplicado):

```bash
# Com DATABASE_URL apontando para o Supabase de produção
npx prisma db push
```

### 5. Deploy Contínuo

A partir deste ponto, qualquer `git push origin main` dispara um novo deploy automático no Vercel. Você pode também criar um branch `develop` para testar features antes de fazer merge na `main`.

---

## Resumo da Arquitetura Final

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENTE (Browser)                              │
│  Next.js App Router (React) · Tailwind CSS · Framer Motion             │
│  Pusher Client SDK (recebe atualizações em tempo real dos bots)        │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS (fetch / WebSocket)
┌───────────────────────────────▼─────────────────────────────────────────┐
│                        SERVIDOR (Vercel)                                │
│  Next.js API Routes (Node.js / TypeScript)                             │
│                                                                         │
│  /api/auth/[...nextauth]  ──► NextAuth.js (Google + Credenciais)       │
│  /api/game/action         ──► PokerEngine + BotDecision                │
│  /api/tournament/start    ──► MttManager + Prisma                      │
│  /api/tutor/advice        ──► POKER_RULES.ts + Gemini API              │
│  /api/report/generate     ──► HandHistory + POKER_RULES.ts + Gemini    │
│  /api/pusher/auth         ──► Pusher Server Auth                       │
└──────────┬──────────────────────────────────┬───────────────────────────┘
           │                                  │
┌──────────▼──────────┐             ┌─────────▼───────────┐
│  Supabase (Nuvem)   │             │  Pusher (Nuvem)     │
│  PostgreSQL + Auth  │             │  WebSocket / Canais │
└─────────────────────┘             └─────────────────────┘
           │
┌──────────▼──────────┐
│   Google Gemini API │
│  gemini-2.5-flash   │
│  (dicas + relatório)│
└─────────────────────┘
```
