export interface PaginaInfo {
  totalPaginas: number;
  paginaAtual: number;
  intervalo: { inicio: number; fim: number };
}

export function calcularPaginacao(totalRegistros: number, registrosPorPagina: number, paginaAtualInformada: number): PaginaInfo {
  const tamanhoValido = Math.max(1, registrosPorPagina);
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / tamanhoValido));
  const paginaAtual = Math.min(Math.max(1, paginaAtualInformada), totalPaginas);

  const inicio = (paginaAtual - 1) * tamanhoValido;
  const fim = Math.min(inicio + tamanhoValido, totalRegistros);

  return { totalPaginas, paginaAtual, intervalo: { inicio, fim } };
}
