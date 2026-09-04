/**
 * Validação bloqueante da coluna escolhida como ID — Demanda 7 (Mapeamento
 * de ID Personalizado), Etapa 2 de `MapeamentoDeIDPersonalizado.md`.
 *
 * Módulo compartilhado entre `construirRegistros.ts` (Etapa 2, valida antes
 * de construir os registros na criação do projeto) e o seletor de UI
 * (Etapa 5, valida ao escolher a coluna no wizard/`AtualizarDadosModal`) —
 * evita duplicar a checagem de vazio/duplicado/não numérico em dois
 * lugares.
 *
 * `colunaId: null` representa "Gerar Automaticamente" (comportamento
 * atual: ordem da linha) — sempre válido, não há valores de planilha para
 * checar.
 */
import type { LinhaPlanilha } from './parseSheetBrowser';

export interface ResultadoValidacaoColunaId {
  valido: boolean;
  /** Mensagem pronta para exibir ao usuário quando `valido` for `false`. */
  erro?: string;
}

/**
 * Valida os valores de `colunaId` em `linhas`, na ordem em que os
 * problemas são checados (o primeiro encontrado é o reportado — não
 * agrega todos de uma vez, para manter a mensagem simples e acionável):
 *
 * 1. Vazio: qualquer linha sem valor para a coluna.
 * 2. Não numérico: qualquer valor que não converta para número
 *    (`Number(valor.trim())` resultando em `NaN`).
 * 3. Duplicado: dois ou mais valores numéricos iguais entre si.
 *
 * A checagem de vazio precisa vir antes da de não numérico porque
 * `Number('')` é `0`, não `NaN` — sem essa ordem, um valor vazio passaria
 * silenciosamente pela checagem de numericidade.
 */
export function validarColunaId(
  linhas: LinhaPlanilha[],
  colunaId: string | null
): ResultadoValidacaoColunaId {
  if (!colunaId) {
    return { valido: true };
  }

  for (let indice = 0; indice < linhas.length; indice++) {
    const valorBruto = linhas[indice][colunaId];
    if (valorBruto === undefined || valorBruto.trim() === '') {
      return {
        valido: false,
        erro: `A coluna "${colunaId}" tem valor vazio na linha ${indice + 1} da planilha. Escolha outra coluna ou use "Gerar Automaticamente".`,
      };
    }
  }

  const valoresNumericos = new Map<number, number>(); // valor => primeira linha (1-based) em que apareceu

  for (let indice = 0; indice < linhas.length; indice++) {
    const valor = linhas[indice][colunaId].trim();
    const numero = Number(valor);

    if (Number.isNaN(numero)) {
      return {
        valido: false,
        erro: `A coluna "${colunaId}" tem um valor não numérico ("${valor}", linha ${indice + 1}). Só colunas com valores numéricos podem ser usadas como ID.`,
      };
    }

    const primeiraOcorrencia = valoresNumericos.get(numero);
    if (primeiraOcorrencia !== undefined) {
      return {
        valido: false,
        erro: `A coluna "${colunaId}" tem o valor "${valor}" repetido nas linhas ${primeiraOcorrencia} e ${indice + 1}. Cada linha precisa de um ID único.`,
      };
    }

    valoresNumericos.set(numero, indice + 1);
  }

  return { valido: true };
}