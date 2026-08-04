import { useState } from 'react';

import { IconeArrastar, IconeSetaBaixo, IconeSetaCima } from '../Icons';
import { HighlightTexto } from './utils/HighlightTexto';

interface Props {
  titulo: string;
  /** Todas as colunas encontradas na planilha (headers). */
  headers: string[];
  /** Colunas selecionadas, em ordem de prioridade (índice 0 = maior prioridade). */
  selecionadas: string[];
  busca: string;
  onBuscaChange: (valor: string) => void;
  onAlternarColuna: (coluna: string) => void;
  onReordenar: (novaOrdem: string[]) => void;
  /** Prefixo usado para gerar ids/aria únicos entre as duas seções (nome/e-mail). */
  idPrefix: string;
}

/**
 * Seção de mapeamento de uma "família" de colunas (Nome ou E-mail): busca +
 * lista de checkboxes com todas as colunas da planilha, e — quando mais de
 * uma coluna é selecionada — uma lista de prioridade reordenável por
 * drag-and-drop (Etapa 2 do assistente de importação).
 */
export function ColunaSeletora({
  titulo,
  headers,
  selecionadas,
  busca,
  onBuscaChange,
  onAlternarColuna,
  onReordenar,
  idPrefix,
}: Props) {
  const [indiceArrastado, setIndiceArrastado] = useState<number | null>(null);

  const headersFiltrados = headers.filter((coluna) =>
    coluna.toLowerCase().includes(busca.trim().toLowerCase())
  );

  function moverPrioridade(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= selecionadas.length) return;

    const nova = [...selecionadas];
    [nova[indice], nova[destino]] = [nova[destino], nova[indice]];
    onReordenar(nova);
  }

  function handleSoltar(indiceDestino: number) {
    if (indiceArrastado === null || indiceArrastado === indiceDestino) {
      setIndiceArrastado(null);
      return;
    }

    const nova = [...selecionadas];
    const [item] = nova.splice(indiceArrastado, 1);
    nova.splice(indiceDestino, 0, item);
    onReordenar(nova);
    setIndiceArrastado(null);
  }

  return (
    <div className="coluna-seletora">
      <div className="coluna-seletora-cabecalho">
        <h3>{titulo}</h3>
        <span className="coluna-seletora-contagem">
          {selecionadas.length} coluna{selecionadas.length === 1 ? '' : 's'} selecionada
          {selecionadas.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="coluna-seletora-busca">
        <input
          type="text"
          placeholder="Pesquisar coluna..."
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          aria-label={`Pesquisar em ${titulo}`}
        />
      </div>

      <ul className="coluna-seletora-lista">
        {headersFiltrados.length === 0 ? (
          <li className="coluna-seletora-vazia">Nenhuma coluna encontrada.</li>
        ) : (
          headersFiltrados.map((coluna) => {
            const id = `${idPrefix}-${coluna}`;
            return (
              <li key={coluna}>
                <label htmlFor={id}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={selecionadas.includes(coluna)}
                    onChange={() => onAlternarColuna(coluna)}
                  />
                  <span className="coluna-seletora-nome">
                    <HighlightTexto texto={coluna} termo={busca} />
                  </span>
                </label>
              </li>
            );
          })
        )}
      </ul>

      {selecionadas.length > 1 && (
        <div className="coluna-prioridade">
          <h4>Definir prioridade</h4>
          <ul className="coluna-prioridade-lista">
            {selecionadas.map((coluna, indice) => (
              <li
                key={coluna}
                className={`coluna-prioridade-item ${indiceArrastado === indice ? 'arrastando' : ''}`}
                draggable
                onDragStart={() => setIndiceArrastado(indice)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleSoltar(indice)}
                onDragEnd={() => setIndiceArrastado(null)}
              >
                <span className="coluna-prioridade-alca" aria-hidden="true">
                  <IconeArrastar />
                </span>
                <span className="coluna-prioridade-posicao">{indice + 1}</span>
                <span className="coluna-prioridade-nome">{coluna}</span>
                <span className="coluna-prioridade-setas">
                  <button
                    type="button"
                    onClick={() => moverPrioridade(indice, -1)}
                    disabled={indice === 0}
                    aria-label={`Mover "${coluna}" para prioridade mais alta`}
                  >
                    <IconeSetaCima />
                  </button>
                  <button
                    type="button"
                    onClick={() => moverPrioridade(indice, 1)}
                    disabled={indice === selecionadas.length - 1}
                    aria-label={`Mover "${coluna}" para prioridade mais baixa`}
                  >
                    <IconeSetaBaixo />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <p className="coluna-prioridade-descricao">
            A primeira coluna será utilizada. Caso ela esteja vazia, o sistema tentará utilizar a
            próxima coluna da lista.
          </p>
        </div>
      )}
    </div>
  );
}
