# Plano de Refatoração — Armazenamento do Título e Corpo do E-mail

## Demanda

Hoje o título e o corpo do e-mail a ser enviado aos registros ficam fora da plataforma (bloco de notas, Word, ou qualquer outro editor externo), enquanto os destinatários já são gerenciados pelo sistema. Isso obriga o fluxo de envio manual a transitar por 3 ou mais janelas diferentes (plataforma → editor externo → Outlook).

A demanda é armazenar título e corpo do e-mail dentro do próprio sistema, junto dos registros da planilha correspondente, disponibilizando edição via modal e cópia rápida sem precisar abri-lo.

## Objetivo

Eliminar a dependência de aplicativos externos (bloco de notas, Word etc.) para guardar o conteúdo textual do e-mail, mantendo esse conteúdo junto da planilha à qual pertence — preparando o sistema para o cenário futuro de múltiplas planilhas geridas simultaneamente (seção 9 da especificação), em que cada planilha terá seu próprio conteúdo de e-mail associado.

## Funcionalidades

1. **Copiar e colar** — botões "Copiar título" e "Copiar corpo" direto no `Header`, sempre visíveis (1 clique cada), independentes do modal estar aberto ou fechado.
2. **Modal de edição** — título e corpo são editados dentro de um modal, acessível pelo item "Editar e-mail" no dropdown de configurações do `Header`.
3. **Seção opcional no assistente de importação** — o wizard de importação de planilha (`ImportWizardModal`) ganha uma seção não obrigatória para preencher título/corpo já durante a importação.
4. **Exportação inalterada** — os arquivos exportados (CSV/CSV UTF-8/XLSX/PDF) continuam contendo apenas os registros (ID, Nome, E-mail, Status); o conteúdo do e-mail nunca é exportado.
5. **Armazenamento em arquivo único** — `email` (título/corpo) e `registros` passam a conviver no mesmo `emails.json`, sem criar arquivos adicionais, preparando o formato para quando cada planilha tiver seu próprio arquivo autocontido.

---

## Premissas confirmadas

- **Localização dos botões (definida):**
  - "Copiar título" e "Copiar corpo" ficam **direto no `Header`**, visíveis sempre, fora do dropdown — minimizando cliques (1 clique = copiar).
  - "Editar e-mail" (abre o modal) fica **dentro do dropdown de configurações**, junto de "Exportar planilha", "Atualizar planilha" e "Deletar planilha" — ação menos frequente que copiar, então pode ficar um nível mais fundo.
- Campo `conteudo` é texto simples por enquanto (sem WYSIWYG/HTML); formatação rica fica registrada como possível melhoria futura.
- Botões de copiar ficam desabilitados quando o campo correspondente estiver vazio (sem mensagem adicional além do estado desabilitado).
- A seção de título/corpo no `ImportWizardModal` é adicionada **apenas como formulário/fluxo visual** — confirmado que não deve funcionar de verdade ainda, assim como o restante do wizard hoje (dívida técnica já existente, não criada por esta demanda).
- A migração do `emails.json` não se limita a converter o arquivo: **todo ponto do código que lê esse arquivo precisa ser auditado**, para não quebrar silenciosamente ao assumir o formato antigo (array puro).
- Estrutura do JSON:

```json
{
  "email": {
    "titulo": "",
    "conteudo": "",
    "atualizado_em": ""
  },
  "registros": [ ]
}
```

---

## Diagnóstico do estado atual do projeto (antes da Etapa 1)

Auditoria feita em todos os pontos que leem/escrevem `data/emails.json` (busca por `emails.json`/`emailsJson` em todo o `src/`), conforme pedido no ponto 5. Resultado: **o projeto já está parcialmente — e inconsistentemente — migrado.**

| Arquivo | Situação encontrada |
|---|---|
| `src/types/email.ts` | ✅ Já contém `EmailConteudo`, `EMAIL_CONTEUDO_VAZIO` e `EmailsData` |
| `data/emails.json` | ✅ Já está no novo formato (`{ email, registros }`) |
| `src/pages/emails.tsx` | ❌ Ainda faz `emailsJson as EmailRecord[]` — vai quebrar, pois `emailsJson` não é mais um array |
| `src/components/Header.tsx` | ❌ Mesmo problema: `emailsJson as EmailRecord[]` no fallback usado pela exportação |
| `src/services/emailsApi.ts` | ❌ `salvarEmails` ainda tem assinatura `(registros: EmailRecord[])`, sem noção de `email` |
| `vite.config.ts` | ❌ Middleware ainda salva o corpo recebido do `PUT` como se fosse sempre o mesmo formato do arquivo (não valida/distingue `email` de `registros`) |
| `src/scripts/sync.ts` | ❌ Ainda lê/grava assumindo array puro — ao rodar hoje, provavelmente sobrescreveria `data/emails.json` incorretamente ou quebraria |

**Conclusão prática:** antes de adicionar qualquer funcionalidade nova (modal, botões de copiar), a Etapa 1 precisa primeiro **destravar esse estado intermediário**, terminando a migração que já foi começada — não é mais só "criar tipos e migrar o JSON", é também **atualizar todo consumidor listado acima** para não quebrar a aplicação.

---

## Etapas de refatoração

### Etapa 1 — Concluir a migração de dados já iniciada

**O que fazer:**
- Confirmar os tipos já existentes em `src/types/email.ts` (`EmailConteudo`, `EMAIL_CONTEUDO_VAZIO`, `EmailsData`) — não recriar, apenas validar se cobrem o necessário.
- Confirmar que `data/emails.json` já está correto no novo formato (parece estar).
- Atualizar `src/pages/emails.tsx`: trocar `emailsJson as EmailRecord[]` por leitura de `emailsJson.registros` (para o estado de registros) e `emailsJson.email` (novo estado, ainda sem UI nesta etapa).
- Atualizar `src/components/Header.tsx`: mesmo ajuste no fallback usado pela exportação (`emailsJson as EmailRecord[]` → `emailsJson.registros`).
- Atualizar `src/services/emailsApi.ts`: `salvarEmails` passa a aceitar o objeto completo (`EmailsData`), ou dividir em `salvarRegistros`/`salvarEmailConteudo` — o que for mais simples de integrar aos handlers já existentes.
- Atualizar `vite.config.ts` (plugin `emailsApiPlugin`) para lidar explicitamente com o objeto completo `{ email, registros }`.
- Atualizar `src/scripts/sync.ts` para ler/gravar respeitando a nova estrutura, **preservando `email` intacto** durante a sincronização (o script nunca deve sobrescrever título/corpo — ele só sincroniza `registros`).

**Critério de conclusão:** aplicação volta a rodar normalmente (build sem erros de tipo), tela de e-mails e exportação funcionando como antes, `sync.ts` rodando sem apagar `email`. Todos os 5 pontos da tabela de diagnóstico ficam consistentes com o novo formato.

### Etapa 2 — Botões de copiar direto no `Header`

**O que fazer:**
- Adicionar, no `Header` (fora do dropdown, sempre visíveis), dois botões — "Copiar título" e "Copiar corpo" — reaproveitando `copiarTexto` (`clipboard.ts`). Um clique cada, sem etapas intermediárias.
- Desabilitar cada botão quando o respectivo campo estiver vazio (sem mensagem adicional, só o estado desabilitado).
- Nesta etapa os botões leem o `email` vindo do estado carregado na Etapa 1 (ainda sem forma de editá-lo pela interface — isso vem na Etapa 3).

**Critério de conclusão:** com um `email.titulo`/`email.conteudo` já presente no JSON (editado manualmente no arquivo, se necessário, já que o modal ainda não existe), os botões copiam corretamente e ficam desabilitados quando vazios.

### Etapa 3 — Modal de edição de título/corpo + item "Editar e-mail" no dropdown

**O que fazer:**
- Criar `EmailConteudoModal.tsx`, reaproveitando o `Dialog.tsx` já existente (mesmo padrão dos outros modais do projeto).
- Dois campos: título (input de texto) e corpo (textarea).
- Botão "Salvar", persistindo via `emailsApi` e atualizando `atualizado_em` com o timestamp atual — seguindo a mesma regra de persistência imediata (sem botão "Salvar" solto fora do modal; seção 2.2 da especificação) usada no restante do sistema.
- Adicionar o item **"Editar e-mail"** dentro do dropdown de configurações do `Header`, junto de "Exportar planilha", "Atualizar planilha" e "Deletar planilha", abrindo esse modal.

**Critério de conclusão:** é possível abrir o modal pelo dropdown, editar título/corpo, salvar, e ver os botões de copiar da Etapa 2 refletirem o novo conteúdo imediatamente após fechar o modal.

### Etapa 4 — Seção opcional no assistente de importação

**O que fazer:**
- Adicionar ao `EstadoImportacao` (`types.ts`) os campos `titulo` e `conteudo`.
- Adicionar uma nova seção (dentro da Etapa 1 "Informações" do wizard, ou como bloco adicional visualmente destacado como opcional) com os dois campos, deixando claro que o preenchimento é opcional e pode ser feito depois pelo modal da tela principal.
- Nenhuma validação obrigatória: `etapa1Valida` continua dependendo apenas de nome do projeto/arquivo, como hoje.

**Critério de conclusão:** os campos aparecem no wizard, são opcionais, e não bloqueiam o avanço das etapas — mesmo sem estarem conectados a uma importação real ainda (consistente com o restante do wizard nesta fase, confirmado que não precisa funcionar de verdade agora).

### Etapa 5 — Confirmação de que a exportação permanece inalterada

**O que fazer:**
- Revisar `exportarPlanilha.ts` e `ExportarModal.tsx` para confirmar que nenhum dos formatos (CSV, CSV UTF-8, XLSX, PDF) referencia `email.titulo`/`email.conteudo` — apenas `registros`.
- Adicionar um teste manual: exportar cada formato após preencher título/corpo, conferindo que o conteúdo do e-mail não aparece em nenhum arquivo gerado.

**Critério de conclusão:** exportações seguem contendo exclusivamente ID, Nome, E-mail e Status.

### Etapa 6 — QA final

**O que fazer:**
- Testar o ciclo completo: editar título/corpo → copiar cada um → fechar o modal → copiar novamente sem reabrir.
- Testar importação com e sem preenchimento da seção opcional.
- Testar exportação em todos os formatos.
- Confirmar que `sync.ts` (sincronização via terminal) não apaga ou sobrescreve `email` ao rodar novamente.

**Critério de conclusão:** todos os fluxos acima validados manualmente, sem regressão nos comportamentos já existentes (status, duplicados, exclusão/restauração, exportação).
