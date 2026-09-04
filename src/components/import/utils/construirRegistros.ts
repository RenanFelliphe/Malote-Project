/**
 * Conversão linhas → registros — Etapa 3 de `implementacaoImportacao.md`.
 *
 * Função pura do lado browser: recebe as linhas já lidas por
 * `parsearPlanilha` (`parseSheetBrowser.ts`) e as colunas de nome/e-mail já
 * mapeadas manualmente pelo usuário no wizard (`EtapaMapeamento.tsx`), e
 * devolve `EmailRecord[]` prontos para persistir via `criarProjeto`
 * (Etapa 6).
 *
 * Duas decisões seguem diretamente a seção 2 do plano:
 *
 * 1. Não importa nada de `src/scripts/` (lado Node). O wizard já sabe
 *    exatamente quais colunas usar — o usuário mapeou manualmente — então
 *    não precisa das listas hardcoded de nomes candidatos que
 *    `identifyColumns.ts` usa para *adivinhar* colunas no `sync.ts`.
 *    `pickFirstFilled` é por isso reimplementado aqui, em versão local
 *    mínima, em vez de importado — evitando repetir a mesma violação de
 *    separação browser/Node já presente (fora do escopo desta etapa) em
 *    `statsPreliminares.ts`.
 * 2. O cálculo de status (válido/inválido/duplicado) é delegado a
 *    `recalcularStatusAutomatico`, de `EmailStatus.ts` — a mesma regra já
 *    usada por `sync.ts` e pela ação "Restaurar" da interface — para não
 *    duplicar a lógica de prioridade/duplicados em um terceiro lugar.
 *
 * Nota de execução (Demanda 7, Etapa 2 — Mapeamento de ID Personalizado):
 * `colunaId` segue a mesma lógica de resolução usada em
 * `calcularMerge.ts` (`resolverIdDaLinha`), reimplementada aqui localmente
 * pelo mesmo motivo do item 1 acima (este módulo não importa de
 * `src/scripts/`) — mesmo padrão já usado para `pickFirstFilled`. A
 * validação bloqueante (vazio/duplicado/não numérico) é delegada a
 * `validarColunaId` (`./validarColunaId`), compartilhada com o seletor de
 * UI (Etapa 5): se inválida, `construirRegistros` lança `Error` com a
 * mensagem pronta para exibição — mesmo padrão de `identifyColumns.ts`
 * (`throw new Error(...)`), único precedente de erro síncrono no projeto.
 */
import { recalcularStatusAutomatico } from '../../EmailStatus';
import type { EmailRecord } from '../../../types/email';
import type { LinhaPlanilha } from './parseSheetBrowser';
import { validarColunaId } from './validarColunaId';

/**
 * Retorna o valor da primeira coluna preenchida, dentre `colunas`, para uma
 * linha da planilha. Cobre o caso de o usuário ter mapeado mais de uma
 * coluna de e-mail (ex.: planilha com perguntas diferentes de formulário
 * para o mesmo dado) — mesma ideia de `pickFirstFilled` do lado Node
 * (`identifyColumns.ts`), reimplementada aqui localmente (ver nota acima).
 * Diferente da versão Node, não faz correspondência case-insensitive por
 * nome: `colunas` aqui já são os cabeçalhos exatos que o usuário selecionou
 * no mapeamento, não uma lista de candidatos a serem procurados.
 */
function pickFirstFilled(linha: LinhaPlanilha, colunas: string[]): string {
  for (const coluna of colunas) {
    const valor = linha[coluna];
    if (valor && valor.trim() !== '') {
      return valor.trim();
    }
  }
  return '';
}

/**
 * Resolve o `id` de uma linha a partir da coluna de ID escolhida, com
 * fallback para a ordem da linha — mesma lógica de `resolverIdDaLinha` em
 * `calcularMerge.ts` (ver nota de execução no topo do arquivo).
 */
function resolverIdDaLinha(linha: LinhaPlanilha, colunaId: string | null, indice: number): number {
  if (colunaId) {
    const valor = linha[colunaId];
    const numero = Number(valor);
    if (valor !== '' && !Number.isNaN(numero)) return numero;
  }
  return indice + 1;
}

/**
 * Converte as linhas de uma planilha já parseada em `EmailRecord[]`, usando
 * as colunas de nome/e-mail mapeadas manualmente pelo usuário no wizard.
 *
 * - `id`: se `colunaId` for informado, resolvido a partir do valor dessa
 *   coluna em cada linha (fallback para a ordem da linha em caso de valor
 *   vazio/não numérico); se `colunaId` for `null`, comportamento anterior
 *   preservado — sequencial 1-based, na ordem original das linhas. Não há
 *   conceito de "sincronizar por id" aqui, já que o projeto está sendo
 *   criado do zero (diferente de `sync.ts`, que casa com registros já
 *   existentes).
 * - `backup_dados`: omitido — nenhum registro novo pode já ter sido alterado
 *   manualmente.
 * - `status`: cada registro nasce com `'válido'` provisório; o valor final
 *   (válido/inválido/duplicado) é decidido de uma vez só, para o array
 *   inteiro, por `recalcularStatusAutomatico` — mesmo padrão de
 *   inicialização usado em `syncRecords`/`applyStatusRules` de `sync.ts`.
 * - `last_updated`: mesmo timestamp para todos os registros novos (o
 *   momento da importação); `recalcularStatusAutomatico` só o atualiza de
 *   novo para registros cujo status calculado difira do provisório.
 *
 * @throws {Error} se `colunaId` for informado e a validação bloqueante
 * (`validarColunaId`) encontrar valor vazio, duplicado ou não numérico —
 * a mensagem já vem pronta para exibição ao usuário.
 */
export function construirRegistros(
  linhas: LinhaPlanilha[],
  colunasNome: string[],
  colunasEmail: string[],
  colunaId: string | null
): EmailRecord[] {
  const validacao = validarColunaId(linhas, colunaId);
  if (!validacao.valido) {
    throw new Error(validacao.erro);
  }

  const now = new Date().toISOString();

  const registrosProvisorios: EmailRecord[] = linhas.map((linha, index) => ({
    id: resolverIdDaLinha(linha, colunaId, index),
    nome: pickFirstFilled(linha, colunasNome),
    email: pickFirstFilled(linha, colunasEmail),
    status: 'válido', // provisório; recalculado logo abaixo
    last_updated: now,
  }));

  return recalcularStatusAutomatico(registrosProvisorios);
}
