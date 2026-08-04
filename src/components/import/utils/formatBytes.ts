/**
 * Formata um tamanho em bytes para a unidade mais legível (KB/MB/GB),
 * evitando casas decimais desnecessárias (ex.: "344 KB", não "344.0 KB")
 * e usando separador de milhar no padrão pt-BR.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const unidades = ['KB', 'MB', 'GB'] as const;
  let valor = bytes;
  let indiceUnidade = -1;

  do {
    valor /= 1024;
    indiceUnidade++;
  } while (valor >= 1024 && indiceUnidade < unidades.length - 1);

  const temCasasSignificativas = valor < 10 && !Number.isInteger(valor);
  const arredondado = temCasasSignificativas ? Math.round(valor * 10) / 10 : Math.round(valor);

  return `${arredondado.toLocaleString('pt-BR')} ${unidades[indiceUnidade]}`;
}
