# Documento de Requisitos do Produto (PRD)
## Plataforma de Treinamento e Simulação de Poker — Texas Hold'em

**Versão**: 2.1  
**Data**: Junho de 2026  
**Stack Principal**: Next.js 14 (App Router) + TypeScript + Supabase (PostgreSQL) + Pusher + Google Gemini API

> **Ordem de execução:** a implementação segue o **Roadmap de Implementação Priorizado (Fases 0–4)** definido no início de `INSTRUCOES_PASSO_A_PASSO.md`. Os requisitos funcionais abaixo descrevem o "o quê"; o roadmap define o "em que ordem e com quais critérios de pronto".

---

## 1. Visão Geral do Produto

A **Plataforma de Treinamento e Simulação de Poker** é um aplicativo web premium voltado para o aprendizado prático e aperfeiçoamento de jogadores de Texas Hold'em No-Limit. O objetivo é guiar o usuário a se tornar um jogador lucrativo por meio de simulações realistas e feedbacks analíticos contínuos.

O sistema divide-se em **duas grandes frentes**:
1. **Modo Torneio Competitivo (MTT)**: O usuário simula torneios reais multi-mesas contra bots matematicamente inteligentes, com balanceamento dinâmico de mesas e escalada de blinds.
2. **Modo Treinamento Interativo**: Uma mesa didática com cálculos de equidade, pot odds, análise posicional e dicas em tempo real extraídas das **regras estáticas** do sistema (derivadas dos livros do Material de Apoio).

Ao final de qualquer sessão, a plataforma gera um **Relatório Analítico personalizado** com o auxílio da API do Google Gemini, identificando erros sistemáticos, jogadas de valor esperado negativo (-EV) e referências diretas às lições teóricas codificadas nas regras do sistema.

---

## 2. Personas do Usuário

### Persona 1: Carlos — o Iniciante Recreativo
- **Perfil**: Joga poker ocasionalmente com amigos, mas perde por não conhecer a força real das mãos ou o impacto da posição na mesa.
- **Objetivos**: Compreender a hierarquia de mãos, aprender ranges pré-flop e entender como a posição afeta as decisões.
- **Necessidades**: Modo de treino com indicações visuais claras, explicações em tempo real e alertas imediatos ao cometer erros graves.

### Persona 2: Roberto — o Competidor Intermediário
- **Perfil**: Joga online em limites baixos, conhece a matemática básica de outs, quer dominar conceitos como equidade pós-flop, ranges de oponentes e evitar jogadas -EV.
- **Objetivos**: Simular torneios MTT contra bots difíceis e receber relatórios pós-jogo extremamente detalhados.
- **Necessidades**: Bots com perfis de jogo variados, simulador robusto de MTT e relatórios que cruzem o histórico de mãos com a teoria clássica de poker.

---

## 3. Fluxo de Navegação entre Telas

```
[ Landing Page ] ──► [ Tela de Login / Cadastro ] ──► [ Dashboard do Usuário ]
                                                              │
                              ┌───────────────────────────────┤
                              │                               │
                              ▼                               ▼
                   [ Configurar Torneio MTT ]      [ Modo Treinamento ]
                              │                               │
                              ▼                               ▼
                   [ Mesa de Jogo (MTT) ] ◄────────► [ Mesa Didática ]
                              │
                              ▼
                   [ Relatório Pós-Torneio ] ──► [ Dashboard (atualizado) ]
```

### Descrição das Telas

| Rota Next.js                  | Descrição                                                                                   |
|-------------------------------|---------------------------------------------------------------------------------------------|
| `/`                           | **Landing Page** — Apresentação, CTAs de cadastro/login, screenshot do app                  |
| `/auth/login`                 | **Login** — Formulário de e-mail/senha e botão de Login com Google                         |
| `/auth/register`              | **Cadastro** — Criação de conta com e-mail, senha e apelido                                |
| `/dashboard`                  | **Dashboard** — Estatísticas do usuário, histórico de torneios, botões de ação             |
| `/tournament/setup`           | **Configurar MTT** — Formulário com fichas iniciais, blinds, velocidade, nº de jogadores   |
| `/tournament/[id]/play`       | **Mesa de Jogo MTT** — Mesa 2D interativa com bots, ações e painel do treinador            |
| `/tournament/[id]/report`     | **Relatório Pós-Torneio** — Análise gerada pelo Gemini com erros e dicas                   |
| `/training`                   | **Modo Treinamento** — Mesa didática com exibição de equidade, outs e dicas em tempo real  |

---

## 4. Arquitetura de Sistema

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
│  /api/tutor/advice        ──► POKER_RULES + Gemini API                 │
│  /api/report/generate     ──► HandHistory + Gemini API                 │
│  /api/pusher/auth         ──► Pusher Server Auth                       │
└──────────┬──────────────────────────────────┬───────────────────────────┘
           │                                  │
┌──────────▼──────────┐             ┌─────────▼───────────┐
│  Supabase (Nuvem)   │             │  Pusher (Nuvem)     │
│  PostgreSQL + Auth  │             │  WebSocket / Canais │
│  (banco de dados)   │             │  (tempo real)       │
└─────────────────────┘             └─────────────────────┘
           │
┌──────────▼──────────┐
│   Google Gemini API │
│  (análise de mãos   │
│   e relatórios)     │
└─────────────────────┘
```

---

## 5. Requisitos Funcionais (RF)

### RF01: Autenticação, Cadastro e Perfil de Usuário
- **Especificações**:
  - Registro com e-mail/senha (criptografados com bcrypt) ou login social (Google OAuth).
  - Implementação via **NextAuth.js** com Prisma Adapter conectado ao Supabase.
  - Perfil com apelido, avatar, estatísticas (VPIP, PFR, total de mãos, taxa de vitória no Showdown) e nível de conhecimento.
  - Middleware de proteção de rotas: rotas como `/dashboard`, `/tournament/*` e `/training` exigem sessão ativa.

### RF02: Engine de Jogo Texas Hold'em No-Limit
- **Especificações**:
  - Máquina de estados: Pré-flop → Flop → Turn → River → Showdown.
  - Controle de blinds, rotação do Dealer Button e posições (UTG, UTG+1, MP, Hijack, Cutoff, Button, SB, BB).
  - Ações: Fold, Check, Call, Bet, Raise, All-in, com validação do tamanho mínimo de raise.
  - Controle de pote principal e potes laterais (side pots) para múltiplos all-ins.
  - Estado do jogo serializado em JSON e persistido via API Route a cada ação.

### RF03: Avaliador de Mãos (PH Evaluator)
- **Especificações**:
  - Utilizar um **port por lookup table** do algoritmo de hash perfeito do `phevaluator`, exportando as tabelas como **dados puros em JS/TS (ou WASM)** — sem addon nativo, compatível com serverless (Vercel). *Não* usar o pacote npm com binário nativo.
  - Classificar mãos de 5 a 7 cartas em menos de 2ms.
  - **Convenção única de score em todo o sistema: maior score = mão mais forte** (usada por avaliador, cálculo de equidade e showdown — nunca invertida entre módulos).
  - Resolução de empates por kicker e cálculo de equidade via simulação Monte Carlo, com avaliador combinatório em TypeScript como referência/fallback para testes.

### RF04: Simulação de Torneio Multi-Mesas (MTT)
- **Especificações**:
  - Configuração: número de jogadores (ex: 27, 54, 180), nº de mesas, stack inicial, estrutura de blinds (schedule) e velocidade (Turbo, Regular, Deep).
  - **Modelo de simulação (abstração estatística):** apenas a **mesa do jogador humano** é simulada carta a carta (engine completa + bots). As demais mesas têm eliminações **amostradas por um modelo estatístico de stacks/ICM** a cada tick do torneio — sem distribuição de cartas. Isso evita loops longos em funções serverless (incompatíveis com Vercel) e mantém o foco analítico no jogo do humano.
  - **Avanço dirigido por tick**: `advanceTournament(dt)` aplica eliminações abstratas, sobe blinds quando devido e rebalanceia mesas. Nada roda em processo contínuo de background.
  - Balanceamento dinâmico: quando uma mesa fica vazia ou com poucos jogadores, o `MttManager` redistribui os sobreviventes.

### RF05: Lógica dos Bots Autônomos de IA
- **Especificações**:
  - Cálculo de equidade por Monte Carlo (PH Evaluator) sem acesso às cartas adversárias.
  - Tomada de decisão baseada em EV: `EV = (Equidade × Pote) - ((1 - Equidade) × Custo do Call)`.
  - Consciência posicional: ranges de abertura pré-flop variam por posição (UTG fechado, Button amplo).
  - Quatro perfis comportamentais: **TAG, LAG, NIT, Calling Station** com fatores de blefe distintos.

### RF06: Arquivo de Regras Estáticas do Poker (`POKER_RULES.ts`)
- **Descrição**: Em vez de RAG dinâmico com vetores, as regras e boas práticas extraídas dos livros do Material de Apoio serão codificadas em um arquivo TypeScript estruturado. Este arquivo serve como a "constituição" do sistema de análise, consultado pela engine local e pelo prompt do Gemini.
- **Especificações**:
  - O arquivo `src/lib/poker/POKER_RULES.ts` contém regras categorizadas por tema: seleção de mãos, posição, pot odds, blefe, value betting, jogo pós-flop, ICM (pressão de torneio).
  - Cada regra possui: `id`, `category`, `title`, `description`, `bookSource` (citação do livro), `severity`, `triggerConditions` (descrição **legível** das condições) e um **`predicate(ctx: HandContext) => boolean` executável** que efetivamente detecta a violação. O campo de texto é só documentação; quem aciona a marcação é o `predicate`.
  - A engine local avalia os `predicate` de todas as regras a cada ação (via `evaluateViolations(ctx)`) e marca a mão com `errorsFlagged = true` e `rulesViolated[]` quando alguma retorna `true`.
  - O Gemini recebe apenas as regras violadas (não todas as regras) para gerar a análise, tornando o prompt eficiente.

### RF07: Módulo de Treinamento com Tutor de IA
- **Especificações**:
  - Exibe **em tempo real e de forma 100% local/determinística** (sem chamada de rede): probabilidade de melhorar a mão (outs), equidade atual, pot odds necessárias, SPR e EV.
  - O **Gemini fica fora do caminho crítico**: é acionado **apenas sob demanda** (botão "Pedir Dica") e no relatório pós-torneio — nunca a cada ação (evita latência de segundos, custo e rate limit).
  - Painel do Tutor com sugestões baseadas nas regras estáticas violadas (`predicate`) + explicação do Gemini sob demanda.
  - Referência explícita ao livro e lição correspondente ao erro cometido.

### RF08: Comunicação em Tempo Real (Pusher)
- **Descrição**: O frontend precisa ser atualizado automaticamente após cada ação de um bot, sem que o jogador precise recarregar a página.
- **Especificações**:
  - Integração com **Pusher** (serviço gerenciado de WebSocket, compatível com Vercel serverless).
  - A cada ação de bot processada pela API Route, o servidor publica um evento no canal `game-[tournamentId]`.
  - O frontend assina o canal via `pusher-js` e atualiza o estado da mesa em tempo real.
  - Eventos: `bot-action` (atualiza o estado do jogo), `street-advance` (nova rua aberta), `hand-end` (vencedor da mão), `tournament-update` (eliminações em outras mesas).

### RF09: Histórico de Mãos e Relatório Analítico Pós-Torneio (Gemini)
- **Especificações**:
  - Todas as mãos do usuário são registradas no banco com: cartas do jogador, cartas do board, ações em cada street, tamanho do pote, stacks, decisão tomada e regras violadas.
  - Análise local marca as mãos com EV negativo (`errorsFlagged = true`) usando as `triggerConditions` das `POKER_RULES`.
  - O Gemini recebe as mãos com erros + as regras violadas específicas e gera um relatório em Markdown contendo:
    1. Resumo do torneio (posição final, VPIP/PFR).
    2. Análise crítica das 3 principais falhas com citação do livro e lição de origem.
    3. Plano de ação para as próximas sessões.

### RF10: Dashboard do Usuário
- **Especificações**:
  - Exibe: total de torneios jogados, melhor colocação, média de posição final, VPIP e PFR acumulados.
  - Lista de torneios recentes com link para o relatório de cada um.
  - Gráfico simples de evolução do stack médio ao longo dos torneios.

---

## 6. Requisitos Não Funcionais (RNF)

### RNF01: Design Visual Premium
- Tema escuro e profundo com gradiente radial verde no feltro.
- **Glassmorphism** nos painéis flutuantes (backdrop-filter, bordas luminosas).
- **Micro-animações** com Framer Motion: distribuição de cartas, fichas voando ao pote, indicador de ação piscando.
- Design responsivo: mesa se ajusta a desktop (prioridade), tablet e mobile.
- Tipografia: fonte **Inter** do Google Fonts.

### RNF02: Performance
- Avaliação de mãos (lookup table do PH Evaluator): máximo 2ms por mão de 7 cartas.
- Painel de treino (outs/equity/pot odds/EV): cálculo local instantâneo, sem chamada de rede no caminho crítico.
- Simulação MTT: dirigida por tick com abstração estatística das mesas sem o humano — sem loops longos em funções serverless.
- Pusher: latência máxima de 500ms entre a ação do bot no servidor e a atualização visual no cliente.

### RNF03: Segurança
- Senhas criptografadas com bcrypt (salt rounds = 12).
- Middleware Next.js protegendo todas as rotas autenticadas.
- Chaves de API (Gemini, Pusher) apenas no servidor, nunca expostas no cliente.
- **Hole cards dos oponentes/bots nunca são enviadas ao cliente**: o estado do jogo é filtrado por jogador antes de ser serializado/publicado (o `GameState` completo permanece apenas no servidor). Só são reveladas no showdown.
- **Concorrência de estado**: cada mesa usa locking otimista (coluna `version`) para evitar *lost updates* entre a ação do humano e as ações de bots disparadas em paralelo.
- Rate limiting na rota `/api/report/generate` (máximo 1 relatório por torneio).

---

## 7. Infraestrutura de Produção

| Serviço          | Papel                                                        | Plano Sugerido          |
|------------------|--------------------------------------------------------------|-------------------------|
| **Vercel**       | Hospedagem do Next.js (frontend + API Routes serverless)     | Hobby (gratuito) / Pro  |
| **Supabase**     | PostgreSQL gerenciado + Auth + pgvector (opcional futuro)    | Free tier               |
| **Pusher**       | WebSocket gerenciado para atualizações em tempo real         | Sandbox (gratuito)      |
| **Google Gemini**| LLM para dicas e relatórios                                  | Pay-per-use             |
| **GitHub**       | Repositório + CI/CD integrado com Vercel (deploy automático) | Free                    |

---

## 8. Modelagem de Dados (PostgreSQL/Prisma)

```
User ──────────────────────────────────┐
 id, name, email, passwordHash          │ 1:N
 statsVpip, statsPfr, statsHands        │
 tourneysWon, createdAt                 ▼
                                    Tournament
                                     id, userId, initialChips, buyIn
                                     blindSpeed, totalPlayers       1:N
                                     finalPosition, createdAt        │
                                                                     ▼
                                                               HandHistory
                                                                id, tournamentId, handNumber
                                                                boardCards[], playerCards[]
                                                                actionsJson (JSON completo)
                                                                rulesViolated[] (IDs das regras)
                                                                errorsFlagged, potSize
                                                                isTrainingMode, createdAt
                                                                     │ 1:1
                                                                     ▼
                                                               AiAnalysis
                                                                id, handHistoryId
                                                                feedbackText (Markdown)
                                                                referencedBook
                                                                createdAt
```

---

## 9. Integração com Material de Apoio — Abordagem de Regras Estáticas

Em vez de RAG dinâmico com vetorização, os livros do Material de Apoio foram estudados e suas regras mais importantes codificadas em um arquivo TypeScript estruturado (`POKER_RULES.ts`).

**Vantagens desta abordagem**:
- Determinística: a mesma situação sempre gera o mesmo feedback de regra.
- Rápida: nenhuma chamada de API adicional para buscar contexto.
- Controlável: as regras podem ser revisadas, editadas e expandidas facilmente.
- Eficiente em tokens: o Gemini recebe apenas as regras violadas, não todos os livros.

**Fontes das regras**:
| Livro                                          | Principais Regras Extraídas                                     |
|------------------------------------------------|------------------------------------------------------------------|
| *Poker em 50 Lições* — Leo Bello              | Seleção de mãos, posição, dominância, agressividade seletiva    |
| *Easy Game Vol. I* — Andrew Seidman           | Value betting, polarização, frequência de blefe, jogo pós-flop  |
| *A Matemática do Poker* — Rafael Polesi       | Pot odds, equidade, outs exatos, EV cálculos                    |
| *Hold'em Wisdom* — Daniel Negreanu            | Leitura de mesa, adaptação ao adversário, plays emocionais      |

---

## 10. Mapeamento de Portas e Conflitos em Localhost

Para o desenvolvimento local das aplicações do sistema, foi realizada uma conferência das portas TCP em uso para mitigar conflitos durante a inicialização dos serviços em `localhost`:

* **Next.js (Web App)**: Porta padrão `3000`. Atualmente **disponível (livre)**.
* **Banco de Dados (PostgreSQL)**:
  * Porta padrão do Postgres: `5432` está livre.
  * Existe uma instância de PostgreSQL local rodando e ouvindo na porta **`5435`** (PID 6560).
  * *Recomendação:* Caso o desenvolvedor opte por utilizar um banco de dados local em vez de Supabase na nuvem, deve-se apontar a URL de conexão para a porta `5435` ou parar o serviço existente.
* **Outras Portas Ocupadas no Sistema**:
  * Portas `9000` / `9001`: Java (`javaw.exe`, PID 19108) em execução. Evitar configurar serviços locais nestas portas.
  * Porta `19300`: Antigravity IDE (PID 8284).
  * Porta `5939`: TeamViewer (PID 4936).
  * Porta `26822`: MSI Terminal Server (PID 13052).
