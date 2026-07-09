/**
 * Destaca (em <mark>) a primeira ocorrência do termo pesquisado dentro de
 * `texto`, usado nas listas de colunas da Etapa 2 (Mapeamento). Comparação
 * sem diferenciar maiúsculas/minúsculas; sem termo de busca, renderiza o
 * texto normalmente.
 */
interface Props {
  texto: string;
  termo: string;
}

export function HighlightTexto({ texto, termo }: Props) {
  const termoLimpo = termo.trim();
  if (!termoLimpo) return <>{texto}</>;

  const indice = texto.toLowerCase().indexOf(termoLimpo.toLowerCase());
  if (indice === -1) return <>{texto}</>;

  const antes = texto.slice(0, indice);
  const correspondencia = texto.slice(indice, indice + termoLimpo.length);
  const depois = texto.slice(indice + termoLimpo.length);

  return (
    <>
      {antes}
      <mark className="texto-destacado">{correspondencia}</mark>
      {depois}
    </>
  );
}
