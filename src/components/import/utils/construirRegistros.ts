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
 */
import { recalcularStatusAutomatico } from '../../EmailStatus';
import type { EmailRecord } from '../../../types/email';
import type { LinhaPlanilha } from './parseSheetBrowser';

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
 * Converte as linhas de uma planilha já parseada em `EmailRecord[]`, usando
 * as colunas de nome/e-mail mapeadas manualmente pelo usuário no wizard.
 *
 * - `id`: sequencial 1-based, na ordem original das linhas — não há
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
 */
export function construirRegistros(
  linhas: LinhaPlanilha[],
  colunasNome: string[],
  colunasEmail: string[]
): EmailRecord[] {
  const now = new Date().toISOString();

  const registrosProvisorios: EmailRecord[] = linhas.map((linha, index) => ({
    id: index + 1,
    nome: pickFirstFilled(linha, colunasNome),
    email: pickFirstFilled(linha, colunasEmail),
    status: 'válido', // provisório; recalculado logo abaixo
    last_updated: now,
  }));

  return recalcularStatusAutomatico(registrosProvisorios);
}
