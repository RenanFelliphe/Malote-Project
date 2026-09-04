/**
 * Motor de merge compartilhado — Etapa 4 de AtualizacaoDaPlanilhaViaUI.md.
 *
 * Módulo puro, sem dependências de Node (`fs`, `path`, etc.) — pensado para
 * rodar no navegador, consumido pelos dois wizards desta demanda:
 *   - "Atualizar Registros" (Etapa 5), com todos os 6 tipos de conflito
 *     habilitados;
 *   - "Atualizar Dados > Colunas" (Etapa 7), que reprocessa o mesmo
 *     `sheet.<ext>` já persistido e só habilita um subconjunto (ver
 *     `TIPOS_CONFLITO_ATUALIZAR_DADOS` abaixo, espelhando a tabela de
 *     aplicabilidade da seção 4 do planner).
 *
 * `calcularMerge` é intencionalmente sem estado: cada chamada recebe o
 * snapshot atual de `registrosAtuais` e devolve uma classificação completa
 * num único passe. O comportamento em cascata descrito na seção 4 do
 * planner (ex.: um registro "Enviado" que o usuário decide "desenviar"
 * passa a ser avaliado na seção "Atributo alterado" seguinte) é
 * responsabilidade da UI (Etapas 5/6/7): ela aplica a decisão do usuário
 * aos registros pendentes e chama `calcularMerge` de novo com o resultado
 * atualizado como novo `registrosAtuais` — nenhuma chamada única faz a
 * cascata inteira sozinha. Pelo mesmo motivo, a contagem de duplicados em
 * `registrosSemConflito` reflete só os registros já resolvidos nesta
 * chamada; registros ainda pendentes de decisão (em qualquer lista de
 * `conflitos`) não entram nesse cálculo até serem resolvidos e
 * reenviados numa chamada seguinte.
 *
 * Nota de execução (Etapa 4): a validação de e-mail (`isValidEmail`/
 * `normalizeEmail`) e a detecção da coluna de ID (`identificarColunaId`)
 * são reimplementações locais deste módulo, não importações de
 * `src/scripts/utils/validateEmail.ts` / `identifyColumns.ts`. Motivo:
 * `sync.ts` (arquivo Fonte desta etapa) importa esses dois módulos no
 * topo do arquivo, mas nenhum dos dois fez parte dos "Arquivos
 * Necessários" (seção 7) desta demanda — não vieram neste ZIP de entrega
 * cumulativa. Reimportar `sync.ts` inteiro para reaproveitar
 * `applyStatusRules` também não era viável: o módulo faz
 * `import { existsSync, readFileSync, ... } from 'node:fs'` no topo do
 * arquivo, o que quebraria o bundle do navegador mesmo a função em si não
 * usando `fs`. A lógica de validade/duplicado abaixo (`recalcularStatusENotas`)
 * replica o comportamento de `applyStatusRules` linha a linha; a lógica de
 * `pickFirstFilled`/detecção de ID replica o comentário de `syncRecords`
 * ("usa a coluna de ID se existir e for numérica; caso contrário, usa a
 * ordem original da linha"), mas sem o arquivo `identifyColumns.ts` real
 * não é possível garantir 100% de paridade na heurística de qual coluna
 * conta como "ID" (aqui: cabeçalho igual a "id", case-insensitive). Se a
 * versão real for mais permissiva (ex.: aceitar "código", "id_planilha"
 * etc.), envie `identifyColumns.ts` e `validateEmail.ts` no próximo ZIP
 * para eu alinhar com exatidão antes da Etapa 5 depender disso na prática.
 */

import type { EmailRecord, TStatus } from '../../types/email';
import type { LinhaPlanilha } from '../../components/import/utils/parseSheetBrowser';

/* ------------------------------------------------------------------ */
/* Tipos                                                                */
/* ------------------------------------------------------------------ */

/** Taxonomia de conflitos — seção 4 do planner. */
export type TipoConflito =
  | 'enviado'
  | 'deletado_revivido'
  | 'sumido'
  | 'atributo_alterado'
  | 'corrigido'
  | 'status_alterado';

/** Subconjunto habilitado no fluxo "Atualizar Registros" (todos os tipos). */
export const TIPOS_CONFLITO_ATUALIZAR_REGISTROS: TipoConflito[] = [
  'enviado',
  'deletado_revivido',
  'sumido',
  'atributo_alterado',
  'corrigido',
  'status_alterado',
];

/**
 * Subconjunto habilitado no fluxo "Atualizar Dados > Colunas" — remapear
 * colunas não adiciona nem remove linhas, então "deletado_revivido" e
 * "sumido" nunca se aplicam (tabela de aplicabilidade, seção 4).
 */
export const TIPOS_CONFLITO_ATUALIZAR_DADOS: TipoConflito[] = [
  'enviado',
  'atributo_alterado',
  'corrigido',
  'status_alterado',
];

interface ValoresRegistro {
  nome: string;
  email: string;
}

export interface ConflitoEnviado {
  tipo: 'enviado';
  id: number;
  ours: ValoresRegistro;
  theirs: ValoresRegistro;
}

export interface ConflitoDeletadoRevivido {
  tipo: 'deletado_revivido';
  id: number;
  ours: ValoresRegistro;
  theirs: ValoresRegistro;
}

export interface ConflitoAtributoAlterado {
  tipo: 'atributo_alterado';
  id: number;
  ours: ValoresRegistro;
  theirs: ValoresRegistro;
  camposConflitantes: Array<'nome' | 'email'>;
}

export interface RegistroSumido {
  id: number;
  nome: string;
  email: string;
  status: TStatus;
}

export interface NotaCorrigido {
  id: number;
  campos: Array<'nome' | 'email'>;
}

export interface NotaStatusAlterado {
  id: number;
  statusAnterior: TStatus;
  statusNovo: TStatus;
}

export interface ResultadoMerge {
  /** Registros já prontos para persistir — nenhum conflito pendente de decisão. */
  registrosSemConflito: EmailRecord[];
  /** Listas por tipo de conflito navegável — cada uma exige decisão do usuário no wizard. */
  conflitos: {
    enviado: ConflitoEnviado[];
    deletadoRevivido: ConflitoDeletadoRevivido[];
    sumido: RegistroSumido[];
    atributoAlterado: ConflitoAtributoAlterado[];
  };
  /** Resoluções automáticas — só para nota informativa no resumo final, não abrem seção. */
  notas: {
    corrigido: NotaCorrigido[];
    statusAlterado: NotaStatusAlterado[];
  };
}

/* ------------------------------------------------------------------ */
/* Auxiliares puros (ver nota de execução no topo do arquivo)          */
/* ------------------------------------------------------------------ */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Ajuste de rota (Etapa 6): exportadas — `AtualizarRegistrosModal.tsx`
 * (Etapa 5) já as importava daqui para calcular as estatísticas cruas do
 * resumo inicial, mas nenhuma das duas tinha `export` nesta entrega
 * anterior, o que quebraria o build. Comportamento inalterado.
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const CANDIDATOS_EXATOS_NOME = ['nome', 'name'];
const CANDIDATOS_EXATOS_EMAIL = ['email', 'e-mail', 'e mail'];

function normalizarHeader(header: string): string {
  return header.trim().toLowerCase();
}

/** Candidatos com correspondência exata (ignorando maiúsculas/espaços) vêm primeiro. */
function priorizarExatos(candidatos: string[], exatos: string[]): string[] {
  return [...candidatos].sort((a, b) => {
    const prioridadeA = exatos.includes(normalizarHeader(a)) ? 0 : 1;
    const prioridadeB = exatos.includes(normalizarHeader(b)) ? 0 : 1;
    return prioridadeA - prioridadeB;
  });
}

/**
 * Ajuste de rota (Etapa 6): implementada — também já era importada por
 * `AtualizarRegistrosModal.tsx` (Etapa 5) sem existir neste módulo em
 * nenhuma entrega anterior. Detecta automaticamente as colunas de
 * nome/e-mail a partir dos cabeçalhos da planilha reimportada, para o
 * fluxo "Atualizar Registros" não exigir que o usuário repita o
 * remapeamento manual do `EtapaMapeamento` a cada reimportação. Heurística
 * simples: qualquer cabeçalho contendo "nome" vira candidato de nome;
 * qualquer cabeçalho contendo "email"/"e-mail" vira candidato de e-mail;
 * correspondências exatas (ex. cabeçalho literalmente "Nome" ou "E-mail")
 * ganham prioridade sobre correspondências parciais (ex. "Nome completo").
 * Devolve o mesmo formato `{ nome: string[]; email: string[] }` esperado
 * por `calcularMerge` (parâmetro `colunas`).
 */
export function identificarColunasAutomaticamente(headers: string[]): { nome: string[]; email: string[] } {
  const candidatosNome = headers.filter((h) => normalizarHeader(h).includes('nome'));
  const candidatosEmail = headers.filter((h) => /e-?mail/.test(normalizarHeader(h)));

  return {
    nome: priorizarExatos(candidatosNome, CANDIDATOS_EXATOS_NOME),
    email: priorizarExatos(candidatosEmail, CANDIDATOS_EXATOS_EMAIL),
  };
}

/** Primeiro valor não vazio entre as colunas, na ordem de prioridade recebida. */
function pickFirstFilled(linha: LinhaPlanilha, colunas: string[]): string {
  for (const coluna of colunas) {
    const valor = linha[coluna];
    if (valor !== undefined && valor.trim() !== '') return valor.trim();
  }
  return '';
}

function resolverIdDaLinha(linha: LinhaPlanilha, colunaId: string | null, indice: number): number {
  if (colunaId) {
    const valor = linha[colunaId];
    const numero = Number(valor);
    if (valor !== '' && !Number.isNaN(numero)) return numero;
  }
  return indice + 1;
}

/**
 * Recalcula válido/inválido/duplicado sobre um conjunto de registros já
 * resolvidos (sem conflito pendente), e reporta as transições
 * válido↔inválido como notas (item 2 da taxonomia, seção 4). Registros
 * "enviado"/"deletado" ou com `backup_dados.status` nunca são recalculados
 * automaticamente — mesma regra de `applyStatusRules` em `sync.ts`.
 */
function recalcularStatusENotas(
  registros: EmailRecord[]
): { registros: EmailRecord[]; notas: NotaStatusAlterado[] } {
  const agora = new Date().toISOString();

  const grupoPorEmail = new Map<string, number>();
  for (const registro of registros) {
    if (!registro.email || !isValidEmail(registro.email)) continue;
    const chave = normalizeEmail(registro.email);
    grupoPorEmail.set(chave, (grupoPorEmail.get(chave) ?? 0) + 1);
  }

  const notas: NotaStatusAlterado[] = [];

  const atualizados = registros.map((registro) => {
    if (registro.backup_dados?.status) return registro;
    if (registro.status === 'enviado' || registro.status === 'deletado') return registro;

    const statusAnterior = registro.status;
    const emailValido = !!registro.email && isValidEmail(registro.email);
    const duplicado = emailValido && (grupoPorEmail.get(normalizeEmail(registro.email)) ?? 0) > 1;
    const novoStatus: TStatus = duplicado ? 'duplicado' : emailValido ? 'válido' : 'inválido';

    if (
      (statusAnterior === 'válido' || statusAnterior === 'inválido') &&
      (novoStatus === 'válido' || novoStatus === 'inválido') &&
      novoStatus !== statusAnterior
    ) {
      notas.push({ id: registro.id, statusAnterior, statusNovo: novoStatus });
    }

    if (novoStatus === statusAnterior) return registro;
    return { ...registro, status: novoStatus, last_updated: agora };
  });

  return { registros: atualizados, notas };
}

/* ------------------------------------------------------------------ */
/* Motor de merge                                                       */
/* ------------------------------------------------------------------ */

/**
 * Classifica `registrosAtuais` contra `linhasNovas` (planilha reimportada
 * ou `sheet.<ext>` persistido reparseado após remapeamento de colunas),
 * respeitando o subconjunto de tipos de conflito habilitado pelo chamador.
 *
 * Não muta `registrosAtuais` — sempre devolve objetos novos onde algo
 * mudou.
 *
 * `colunaId` (Demanda 7 — Mapeamento de ID Personalizado, Etapa 3):
 * recebido explicitamente do chamador — normalmente o `colunaId`
 * persistido no projeto (`EmailsData`) — em vez de detectado
 * internamente. Antes desta etapa, `calcularMerge` adivinhava a coluna de
 * ID procurando um cabeçalho igual a `"id"` (case-insensitive); essa
 * heurística foi removida daqui porque divergia silenciosamente da
 * escolha explícita do usuário. `colunaId: null` preserva o comportamento
 * anterior a esta demanda (ordem da linha) — mesmo fallback de sempre,
 * só que agora explícito em vez de depender de nenhum header bater com
 * `"id"`.
 */
export function calcularMerge(
  registrosAtuais: EmailRecord[],
  linhasNovas: LinhaPlanilha[],
  colunas: { nome: string[]; email: string[] },
  tiposHabilitados: TipoConflito[],
  colunaId: string | null
): ResultadoMerge {
  const habilitado = (tipo: TipoConflito) => tiposHabilitados.includes(tipo);
  const agora = new Date().toISOString();

  const linhasPorId = new Map<number, ValoresRegistro>();
  linhasNovas.forEach((linha, indice) => {
    const id = resolverIdDaLinha(linha, colunaId, indice);
    linhasPorId.set(id, {
      nome: pickFirstFilled(linha, colunas.nome),
      email: pickFirstFilled(linha, colunas.email),
    });
  });

  const conflitosEnviado: ConflitoEnviado[] = [];
  const conflitosDeletadoRevivido: ConflitoDeletadoRevivido[] = [];
  const conflitosAtributoAlterado: ConflitoAtributoAlterado[] = [];
  const registrosSumidos: RegistroSumido[] = [];
  const notasCorrigido: NotaCorrigido[] = [];
  const semConflitoProvisorios: EmailRecord[] = [];

  for (const registro of registrosAtuais) {
    const linha = linhasPorId.get(registro.id);

    if (!linha) {
      if (habilitado('sumido')) {
        registrosSumidos.push({
          id: registro.id,
          nome: registro.nome,
          email: registro.email,
          status: registro.status,
        });
      } else {
        // Fluxo não permite remoção de linhas (ex.: Atualizar Dados >
        // Colunas, que só reinterpreta as mesmas linhas já persistidas) —
        // mantém o registro como está.
        semConflitoProvisorios.push(registro);
      }
      continue;
    }

    if (habilitado('enviado') && registro.status === 'enviado') {
      if (linha.nome !== registro.nome || linha.email !== registro.email) {
        conflitosEnviado.push({
          tipo: 'enviado',
          id: registro.id,
          ours: { nome: registro.nome, email: registro.email },
          theirs: { nome: linha.nome, email: linha.email },
        });
      } else {
        semConflitoProvisorios.push(registro);
      }
      continue;
    }

    if (habilitado('deletado_revivido') && registro.status === 'deletado') {
      conflitosDeletadoRevivido.push({
        tipo: 'deletado_revivido',
        id: registro.id,
        ours: { nome: registro.nome, email: registro.email },
        theirs: { nome: linha.nome, email: linha.email },
      });
      continue;
    }

    // Atributo alterado / corrigido, campo a campo.
    const camposConflitantes: Array<'nome' | 'email'> = [];
    let nomeFinal = registro.nome;
    let emailFinal = registro.email;
    const backupAtualizado = registro.backup_dados ? { ...registro.backup_dados } : undefined;

    for (const campo of ['nome', 'email'] as const) {
      const valorPlanilha = campo === 'nome' ? linha.nome : linha.email;
      const valorOriginal = registro.backup_dados?.[campo];

      if (valorOriginal === undefined) {
        // Campo não protegido — segue o valor da planilha normalmente.
        if (campo === 'nome') nomeFinal = valorPlanilha;
        else emailFinal = valorPlanilha;
        continue;
      }

      const valorAtual = campo === 'nome' ? registro.nome : registro.email;

      if (valorPlanilha === valorOriginal) {
        // Planilha ainda traz o valor antigo — permanece protegido, sem mudança.
        continue;
      }

      if (valorPlanilha === valorAtual) {
        // Planilha "alcançou" a correção manual — resolução automática.
        if (habilitado('corrigido')) {
          notasCorrigido.push({ id: registro.id, campos: [campo] });
        }
        if (backupAtualizado) delete backupAtualizado[campo];
        continue;
      }

      // Diverge tanto do original quanto do valor já corrigido — conflito real.
      camposConflitantes.push(campo);
    }

    if (camposConflitantes.length > 0 && habilitado('atributo_alterado')) {
      conflitosAtributoAlterado.push({
        tipo: 'atributo_alterado',
        id: registro.id,
        ours: { nome: registro.nome, email: registro.email },
        theirs: { nome: linha.nome, email: linha.email },
        camposConflitantes,
      });
      continue;
    }

    const backupFinal =
      backupAtualizado && Object.keys(backupAtualizado).length > 0 ? backupAtualizado : undefined;
    const mudou =
      nomeFinal !== registro.nome || emailFinal !== registro.email || backupFinal !== registro.backup_dados;

    semConflitoProvisorios.push(
      mudou
        ? { ...registro, nome: nomeFinal, email: emailFinal, backup_dados: backupFinal, last_updated: agora }
        : registro
    );
  }

  // Linhas novas sem registro existente correspondente (por id) => registro novo.
  const idsExistentes = new Set(registrosAtuais.map((r) => r.id));
  for (const [id, linha] of linhasPorId) {
    if (idsExistentes.has(id)) continue;
    semConflitoProvisorios.push({
      id,
      nome: linha.nome,
      email: linha.email,
      status: 'válido', // provisório; recalculado abaixo
      last_updated: agora,
    });
  }

  const { registros: registrosSemConflito, notas: notasStatusAlteradoBrutas } =
    recalcularStatusENotas(semConflitoProvisorios);
  const notasStatusAlterado = habilitado('status_alterado') ? notasStatusAlteradoBrutas : [];

  return {
    registrosSemConflito,
    conflitos: {
      enviado: conflitosEnviado,
      deletadoRevivido: conflitosDeletadoRevivido,
      sumido: registrosSumidos,
      atributoAlterado: conflitosAtributoAlterado,
    },
    notas: {
      corrigido: notasCorrigido,
      statusAlterado: notasStatusAlterado,
    },
  };
}
