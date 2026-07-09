/**
 * Estatísticas PRELIMINARES exibidas na Etapa 1 (Informações), antes de o
 * usuário mapear manualmente as colunas de Nome/E-mail na Etapa 2.
 *
 * Como ainda não sabemos qual coluna é o e-mail, o cálculo aqui é uma
 * aproximação: para cada linha, procura em TODAS as colunas o primeiro
 * valor com formato de e-mail válido. É só uma prévia para ajudar o
 * usuário a conferir se selecionou a planilha certa — o cálculo definitivo
 * (usando as colunas que o usuário efetivamente escolher) fica para a
 * lógica de importação real, implementada em uma etapa futura.
 */
import { isValidEmail, normalizeEmail } from '../../../scripts/utils/validateEmail';
import type { LinhaPlanilha } from './parseSheetBrowser';

export interface EstatisticasPreliminares {
  total: number;
  validos: number;
  invalidos: number;
  duplicados: number;
}

export function calcularEstatisticasPreliminares(
  linhas: LinhaPlanilha[],
  headers: string[]
): EstatisticasPreliminares {
  const contagemPorEmail = new Map<string, number>();
  let validos = 0;
  let invalidos = 0;

  for (const linha of linhas) {
    const candidato = headers.map((coluna) => linha[coluna]).find((valor) => isValidEmail(valor));

    if (!candidato) {
      invalidos++;
      continue;
    }

    validos++;
    const normalizado = normalizeEmail(candidato);
    contagemPorEmail.set(normalizado, (contagemPorEmail.get(normalizado) ?? 0) + 1);
  }

  const duplicados = [...contagemPorEmail.values()]
    .filter((quantidade) => quantidade > 1)
    .reduce((soma, quantidade) => soma + quantidade, 0);

  return { total: linhas.length, validos, invalidos, duplicados };
}
