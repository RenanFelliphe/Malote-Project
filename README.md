# Etapa 0 + Etapa 2 — Modelo de dados (Demanda 10)

**Correção nesta versão do pacote:** o ZIP anterior só continha os arquivos
das Etapas 0 e 2, sem seguir o modelo de mapeamento adotado desde a
Demanda 5 — a Etapa 0 deve reunir, num único ZIP, o conteúdo *atual* de
**todos** os arquivos Fonte/Alterados/Criados das 15 etapas da demanda,
para que os próximos envios troquem só esse ZIP, nunca o projeto inteiro.
Este pacote foi refeito para corrigir isso: além do que já estava aqui
(Etapa 0 + Etapa 2), agora inclui, no estado atual do projeto (pós Etapa 1
e 2 aplicadas), todos os arquivos que as Etapas 3 a 14 vão tocar ou
consultar. O detalhamento de qual arquivo pertence a qual etapa está em
`public/RefatoracaoSistemadeDuplicatas.md`, na seção "Arquivos
Necessários" de cada etapa (3 a 14).

Arquivos adicionados nesta correção (nenhum é novo no projeto — são o
conteúdo atual de arquivos já existentes, incluídos aqui só para que as
próximas etapas não precisem do projeto inteiro de novo):

- `src/types/email.ts`, `src/components/EmailStatus.ts` — Etapa 1 (já
  aplicada; incluídos como referência para as etapas seguintes)
- `src/pages/emails.tsx` — Etapas 3 e 8
- `src/components/EmailTable.tsx` — Etapas 3 e 7
- `src/components/EmailCounters.tsx`, `src/components/utils/emailData.ts`
  — Etapas 3, 4, 5 e 6
- `src/components/EmailToolbar.tsx` — Etapas 3 e 5
- `src/components/ExportarModal.tsx`, `src/components/utils/exportarPlanilha.ts`
  — Etapas 3 e 11
- `src/components/Icons.tsx` — Etapa 7 (referência, `IconeAlerta`)
- `src/components/StatusUpdateConflict.tsx` — Etapa 9 (será removido)
- `src/components/DuplicadosConflitoModal.tsx` — Etapa 10 (revisão)
- `src/components/import/utils/statsPreliminares.ts`,
  `src/components/import/EtapaRevisao.tsx`,
  `src/components/import/EtapaInformacoes.tsx` — Etapa 12 (conferência)
- `DEVME.md` — Etapa 14

Este pacote assume que a Etapa 1 (`Etapa1-Demanda10.zip`: `src/types/email.ts`
+ `src/components/EmailStatus.ts`) já foi aplicada. Todo o build/lint abaixo
foi validado com a Etapa 1 aplicada.

## Etapa 0 — Migração dos dados existentes (finalizada)

- **Novo:** `src/scripts/migrarStatusDuplicado.ts` — script único que varre
  todo `emails.json` existente e regrava cada registro `status: 'duplicado'`
  com o status real (`válido`/`inválido`, via `isValidEmail`).
- **`package.json`:** novo script `npm run migrar-status-duplicado`
  (aceita `--dry-run`).
- **Rodado nesta sessão** contra os dados reais do projeto (não é só o
  script — a migração já foi executada; os 3 `emails.json` deste pacote são
  o resultado, prontos para substituir os originais):
  - `data/active/alunos-aprovados-rpv/emails.json`: 341/381 migrados
  - `data/active/projeto-teste/emails.json`: 25/100 migrados
  - `data/trash/boletim-fundacao--2026-09-05T19-19-31-173Z/emails.json`: 2/12 migrados
  - (os outros dois projetos na lixeira, `avaliacao-mentores` e
    `chamada-alunos-ibm`, não tinham nenhum registro `'duplicado'` — não
    precisaram de arquivo neste pacote.)
- Verificação pós-migração: busca por `"status": "duplicado"` em todos os
  `emails.json` do projeto retorna zero ocorrências.

**Ajuste de escopo em relação ao texto original desta etapa:** o script
varre `data/active/**` **e** `data/trash/**`, não só `data/active` como o
planner descrevia. Um projeto na lixeira pode ser restaurado a qualquer
momento (`LixeiraSidebar.tsx`), e nada no fluxo de restauração recalcula
status — sem migrar a lixeira também, um projeto excluído hoje com
`'duplicado'` reintroduziria o valor legado silenciosamente ao ser
restaurado, depois do tipo já ter mudado. Registrei essa decisão no próprio
script e em `public/RefatoracaoSistemadeDuplicatas.md`.

## Etapa 2 — Script de sincronização (`sync.ts`) — finalizada, escopo ampliado

**Arquivos deste pacote, todos alterados:**

- `src/scripts/sync.ts` — `applyStatusRules` não decide mais duplicidade
  (só válido/inválido); resumo final do terminal usa `calcularEmailsDuplicados`
  em vez de `status === 'duplicado'`.
- `src/scripts/utils/validateEmail.ts` — ganhou `calcularEmailsDuplicados`,
  contraparte Node de `EmailStatus.ts` (mesmo desacoplamento Node/browser que
  `sync.ts` já documentava para `isValidEmail`/`normalizeEmail`).
- `src/scripts/utils/calcularMerge.ts` — `recalcularStatusENotas` simplificada
  (só válido/inválido, mesma simplificação da Etapa 1).
- `src/components/atualizar/AtualizarDadosModal.tsx` e
  `AtualizarRegistrosModal.tsx` — contagem "Duplicados" do resumo final passa
  a usar a flag calculada (`calcularEmailsDuplicados`, de `EmailStatus.ts`)
  em vez de `status === 'duplicado'`.
- `public/RefatoracaoSistemadeDuplicatas.md` — Etapas 0/1/2 marcadas como
  concluídas; os 3 arquivos acima documentados como incorporados à Etapa 2.

## Validação feita nesta sessão

- `npm install` (do zero, sem `node_modules` anterior) + Etapa 1 aplicada
  por cima do projeto base antes de qualquer verificação.
- `npx tsc -b --force` no projeto inteiro: **zero erros** em qualquer
  arquivo tocado por Etapa 0/1/2.
- `npx eslint .`: 6 erros/3 warnings, todos em arquivos que este pacote não
  toca — pré-existentes, nenhum novo introduzido por esta refatoração.
- Migração da Etapa 0 rodada de fato contra os dados reais (não só
  simulada) — ver contagens acima.

## Como aplicar

1. Substituir os arquivos de Etapa 0/2 (`scripts/`, `atualizar/`,
   `data/`, `package.json`) pelos correspondentes no projeto — igual antes.
2. Os arquivos listados em "Correção nesta versão" acima **não precisam ser
   substituídos agora**: são cópias do estado atual do projeto, incluídas só
   para consulta/uso nas próximas etapas (3 em diante). Nenhum deles foi
   alterado nesta entrega.
3. Os 3 `emails.json` deste pacote **já são o resultado da migração** — não
   é necessário rodar `npm run migrar-status-duplicado` de novo para eles.
4. Rodar `npx tsc -b` para conferir a lista de erros remanescentes antes de
   seguir para a Etapa 3.
