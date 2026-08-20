# DEMANDAS.md

> Este documento reúne as demandas levantadas para evolução do sistema, além da especificação já formalizada em `Especificacao_Sistema_Emails_v3.md`. Diferente da especificação (que descreve o que **já foi decidido e está pronto para ser implementado**), este arquivo serve para registrar objetivos e ideias em diferentes estágios de maturidade — desde melhorias pontuais até a visão de longo prazo do projeto — para que não se percam entre uma conversa e outra.

---

## Demanda 1: Envio Automático dos E-mails

Hoje o sistema é uma ferramenta de **organização de destinatários**: ele importa planilhas, valida e-mails, identifica duplicados, e permite copiar a lista de e-mails selecionada para colar manualmente em outro programa (Outlook). O próprio envio nunca foi parte do escopo (ver seção 1 da especificação: *"O sistema não realizará o envio de e-mails"*).

A visão de longo prazo é transformar o sistema em um **disparador controlado de e-mails com proteção anti-spam** — ou seja, o sistema passa a enviar os e-mails de fato, não apenas organizar quem vai recebê-los. O objetivo por trás disso é evitar que envios em massa (dezenas ou centenas de e-mails de uma vez) façam com que o remetente seja identificado como spam pelos provedores (Gmail, Outlook, etc.), através de um envio **fatiado em blocos, espaçado no tempo**.

### Como o fluxo deve funcionar, na visão do usuário

1. O usuário seleciona os registros que devem receber o e-mail (os mesmos filtros/seleção que já existem hoje na tabela);
2. O usuário define (ou reaproveita) o **título** e o **conteúdo** do e-mail;
3. O usuário define em **quantos blocos** a lista selecionada deve ser dividida;
4. O usuário define o **intervalo de tempo** entre o envio de um bloco e o próximo;
5. O sistema realiza o envio **automaticamente**, bloco a bloco, respeitando o intervalo definido, sem exigir que o usuário repita nenhuma etapa manual.

**Exemplo concreto:**
- 100 e-mails selecionados;
- Divididos em 5 blocos de 20;
- Intervalo de 10 minutos entre blocos;
- Resultado: a cada 10 minutos, o sistema dispara automaticamente 20 e-mails, até completar os 5 blocos (40 minutos no total).

### O que essa implementação exigiria, tecnicamente

Registrando aqui os principais blocos de trabalho, para quando o projeto chegar nessa fase:

1. **Capacidade real de envio de e-mail**
   - Integração com Microsoft Graph API (`sendMail`), autenticando como a conta que hoje envia manualmente pelo Outlook. Exige registro de um aplicativo no Azure AD, consentimento OAuth e permissão `Mail.Send`.
   - Alternativa mais simples (porém mais limitada/menos "nativa" ao Outlook): envio via SMTP direto, se houver um servidor/relay disponível.

2. **Novo modelo de dados: "Disparo" (ou "Campanha")**
   - Registros selecionados (lista de IDs);
   - Título e corpo do e-mail (ligados à demanda de armazenamento de template, descrita abaixo);
   - Tamanho do bloco (ou número de blocos — um decorre do outro);
   - Intervalo entre blocos;
   - Status do disparo: pendente / em andamento / pausado / concluído / cancelado;
   - Progresso: quantos blocos já foram enviados, quando será o próximo;
   - Log de envio: data/hora de cada bloco, e-mails enviados com sucesso e com falha.

3. **Agendador (scheduler)**
   - Um processo que verifica periodicamente se algum disparo tem um bloco pendente cujo horário já chegou, e o executa.
   - Precisa sobreviver ao fechamento da aba/navegador — o que implica rodar como parte de um backend real, não apenas no client React.

4. **Tratamento de falhas e controle do usuário**
   - Registrar e-mails que falharam no envio de um bloco (sem travar o restante do disparo);
   - Permitir pausar, retomar ou cancelar um disparo em andamento;
   - Permitir reenviar apenas os e-mails que falharam.

5. **Boas práticas adicionais anti-spam** (fora do que foi pedido, mas relevante para o objetivo final)
   - Respeitar os limites diários de envio da própria conta usada (contas comuns do Microsoft 365/Gmail têm teto de e-mails por dia);
   - Considerar incluir link/opção de descadastro nos e-mails;
   - Evitar variações que possam disparar filtros de spam (links suspeitos, excesso de maiúsculas, etc.).

**O que agrega:** transforma o sistema de "organizador de destinatários" em disparador de verdade, com proteção anti-spam via fatiamento em blocos.

**Dificuldade: 🔴 Alta — é a maior mudança de arquitetura do lote.**

O motivo é estrutural, não só de código: hoje **não existe backend persistente**. O middleware do Vite (`emailsApiPlugin`) só roda em `npm run dev` e só grava um JSON quando o navegador está aberto fazendo a requisição. Um "disparo" precisa sobreviver ao fechamento da aba — isso exige:
- Um processo servidor real (Node standalone, não middleware de dev server) rodando o scheduler.
- Persistência de estado do disparo (pendente/em andamento/pausado) independente da sessão do navegador.
- Integração com Microsoft Graph API (`Mail.Send`) — cadastro de app no Azure AD, fluxo OAuth, tokens com refresh.

**Caminho recomendado, em fatias:**
1. Primeiro, criar o modelo de dados "Disparo" (tipo `types/dispatch.ts`) e a tela de configuração (blocos, intervalo) — isso é só UI, reaproveitando a seleção que já existe em `emails.tsx`.
2. Depois, um servidor Node separado (Express/Fastify) com um scheduler simples (`setInterval` checando disparos pendentes, ou `node-cron`) — foge do escopo do Vite dev server.
3. Por último, a integração de envio de fato (Graph API ou SMTP via Nodemailer, mais simples de começar).
---

## Demanda 2 — Variáveis no Texto (merge tags)

Personalização por destinatário (merge tags). O título/corpo do e-mail (EmailConteudo) é um único texto estático pra todos os registros da planilha — não existe nenhum {{nome}} ou placeholder dinâmico. Pra uma ferramenta de disparo em massa, isso costuma ser básico.

Na toolbar do modal, deve haver um novo botão: "Criar Variável" ao lado do "Criar Botão".

Esta variável deve funcionar, inicialmente, apenas para adicionar no texto, o conteúdo de uma célula com base nos registro da planilha. Assim, para cada envio, aquela variável receberá um dado diferente.

Exemplo:
"Olá, [ NomeAluno ]! 

Parabéns por concluir o curso [ NomeCurso ] no dia [ DataConclusão ]

Os certificados serão enviados no dia [ DataEnvio ]!"

**O que agrega:** personalização por destinatário (`{{nome}}`, `{{curso}}` etc.) — pré-requisito conceitual pra Demanda 1 fazer sentido em escala.

**Dificuldade: 🟡 Média** — é só extensão do Tiptap, mas com pegadinhas de integração com o pipeline existente.

Pontos de atenção no código atual:
- Seguiria o mesmo padrão do `NoBotao.ts`: um **node customizado** do Tiptap (não uma mark), já que a variável é um "chip" atômico, não texto editável por dentro. Renderiza como `<span data-variavel="NomeAluno" contenteditable="false">`.
- Precisa entrar na allowlist do `sanitizarHtml.ts` (`ALLOWED_TAGS`/`ALLOWED_ATTR` — hoje `span` já é permitido, mas o atributo `data-variavel` teria que ser adicionado).
- O botão "Criar Variável" na toolbar segue o padrão de popover já usado (`ToolbarPopover`), listando as colunas identificadas em `identifyColumns.ts`.
- **O ponto mais delicado:** hoje o e-mail é um texto único salvo em `EmailConteudo.conteudo`. Para o envio funcionar por registro, o `emailHtmlInline.ts` (ou uma nova função) precisaria, na hora do disparo, substituir cada `<span data-variavel="X">` pelo valor de `registro[X]` — ou seja, essa demanda só "fecha o ciclo" quando acoplada à Demanda 1. Sozinha, ela dá pra implementar (inserir/visualizar a variável no editor), mas o "renderizar por destinatário" depende do sistema de envio existir.

---

## Demanda 3 — Atualizar Planilha (reimportação via UI)
Reimportação de planilha. Já é o botão fantasma "Atualizar planilha" no menu — a lógica de sincronizar por ID já existe em sync.ts, só roda via terminal (Node), fora do navegador. Dava pra expor esse fluxo na UI.

**O que agrega:** fecha um botão que já existe visualmente mas está desabilitado (`Header.tsx`, item "Atualizar planilha", `disabled` com título "Em breve").

**Dificuldade: 🟢 Baixa-Média** — a lógica de negócio (`sync.ts`) já existe e é só Node puro (não depende de nada do browser).

O desafio real não é a lógica de sincronização (já pronta e testada), é **rodá-la a partir do navegador**:
1. Expandir o middleware do `vite.config.ts` com uma nova rota `POST /api/emails/:slug/sync`, que recebe o arquivo via `FormData`/multipart.
2. Essa rota chama as mesmas funções de `sync.ts` (`syncRecords`, `applyStatusRules`) — hoje elas estão em `src/scripts/`, com `tsconfig.scripts.json` separado do bundle do Vite. Ou o middleware roda em Node puro fora do bundle (mais fácil, já que o middleware já é código Node), ou você refatora essas funções pra um lugar compartilhado.
3. No frontend, reaproveitar o parsing já existente em `parseSheetBrowser.ts` (usado no wizard de importação) pra pré-visualizar antes de confirmar, e então mandar o arquivo pro novo endpoint.

---

## Demanda 4: Histórico de Alterações
Histórico/auditoria. Toda alteração (salvarEmails) sobrescreve o emails.json inteiro, sem versionamento nem log de quem/quando mudou o quê. Não tem desfazer.

**O que agrega:** auditoria e desfazer, hoje inexistentes (`salvarEmails` sobrescreve o JSON inteiro sem rastro).

**Dificuldade: 🟡 Média**, mas cresce dependendo da ambição.

Duas abordagens bem diferentes:
- **Versão simples (log append-only):** cada `PUT /api/emails/:slug` no middleware, antes de sobrescrever, grava um snapshot em `data/<slug>/history/<timestamp>.json` (ou um `history.jsonl` com um diff). Dá pra implementar em algumas horas — é só interceptar a escrita existente.
- **Versão com "desfazer" de verdade:** exige guardar um diff estruturado (quem mudou o quê, de/para) em vez de snapshot bruto, senão "desfazer" vira "restaurar arquivo inteiro", o que pode sobrescrever alterações concorrentes de outros campos.

---

## Demanda 5: Correção de Registros Individualmente
Edição individual de nome/e-mail — pra corrigir um erro de digitação num registro, hoje o único caminho é reimportar a planilha inteira via sync.ts. Permitir editar nome/e-mail direto na célula da tabela (like já acontece com status) resolveria isso sem depender do terminal.

**O que agrega:** corrige o ponto mais frustrante do fluxo atual — hoje um erro de digitação exige reimportar a planilha inteira via terminal.

**Dificuldade: 🟢 Baixa** — é o item mais barato do lote, e o padrão já existe no código.

A própria tabela já faz exatamente isso pra `status` (`EmailTable.renderStatus`, com `<select>` inline substituindo o badge). O mesmo padrão vale pra nome/e-mail:
1. Trocar `<td>{registro.nome}</td>` por um campo editável inline (clique vira `<input>`, blur/Enter confirma) — visualmente parecido com o `campoTamanhoFonte` do editor (buffer local + confirmação só no blur).
2. Novo handler em `emails.tsx`, no mesmo molde de `handleAtualizarStatusIndividual`: monta o registro atualizado, marca `last_updated`, chama `persistirRegistros`.
3. **Decisão de negócio a tomar:** editar o e-mail manualmente devia setar algo equivalente a `status_alterado = true`? Hoje esse campo só existe pra status. Se `sync.ts` rodar de novo depois, ele vai sobrescrever esse nome/e-mail editado manualmente com o que tiver na planilha — vale a pena decidir se isso é aceitável ou se precisa de um novo campo tipo `dados_alterados_manualmente`.

---

## Demanda 6: Armazenamento duplo - Banco e Local
O armazenamento local, hoje, já existe. Toda planilha importada é armazenada dentro da pasta do projeto
Porem, deve também haver a opção de armazenar os dados da planilha num banco de dados real, exigindo requisição e rotas.

**O que agrega:** camada de persistência real, abrindo caminho pra multiusuário/hospedagem (já mapeado como visão de longo prazo na seção 9 do `DEVME.md`).

**Dificuldade: 🔴 Alta** — é a mudança de arquitetura mais ampla, e sobrepõe praticamente tudo (Demandas 1, 3, 4 dependem ou se beneficiam dela).

Pontos centrais:
- Escolher o banco (SQLite é o caminho natural pra manter "local-first" — arquivo único, sem servidor externo; Postgres se já mirar hospedagem).
- Precisa de um ORM/query builder (Drizzle ou Prisma se TypeScript, pra manter o estilo tipado do projeto).
- O middleware do `vite.config.ts` deixaria de escrever JSON diretamente e passaria a chamar o banco — mas o próprio README já é explícito que isso é dívida técnica conhecida e faz parte do roadmap (seção 9 da especificação, "Backend e persistência").
- "Duplo" sugere manter o JSON como fallback/export, não synced em tempo real com o banco — o que é mais simples do que sincronizar bidirecionalmente dois armazenamentos.

---

### Sugestão de prioridade

| Ordem | Demanda | Por quê |
|---|---|---|
| 1 | **5 — Edição individual** | Baixíssimo custo, alto valor imediato, zero risco arquitetural |
| 2 | **3 — Atualizar planilha via UI** | Lógica já pronta, só falta expor; fecha um botão fantasma |
| 3 | **4 — Histórico (versão snapshot)** | Rede de segurança barata antes de mexer em coisas mais arriscadas |
| 4 | **2 — Variáveis no texto** | Prepara terreno pra Demanda 1, mas entrega valor sozinha (visualização) |
| 5 | **6 — Banco de dados** | Pré-requisito de infraestrutura pra Demanda 1 rodar de forma confiável |
| 6 | **1 — Envio automático** | A mais complexa e a que mais depende das outras já estarem prontas |