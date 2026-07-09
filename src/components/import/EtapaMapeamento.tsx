import { ColunaSeletora } from './ColunaSeletora';
import type { EstadoImportacao } from './types';

interface Props {
  estado: EstadoImportacao;
  onEstadoChange: (novoEstado: Partial<EstadoImportacao>) => void;
  headers: string[];
}

/** Adiciona (ao final, ou seja, com menor prioridade) ou remove uma coluna de uma lista de seleção. */
function alternarColuna(atual: string[], coluna: string): string[] {
  return atual.includes(coluna) ? atual.filter((c) => c !== coluna) : [...atual, coluna];
}

export function EtapaMapeamento({ estado, onEstadoChange, headers }: Props) {
  return (
    <div className="etapa-importacao etapa-mapeamento">
      <p className="etapa-mapeamento-instrucao">
        Selecione quais colunas da planilha representam o nome e o e-mail de cada registro.
      </p>

      <div className="etapa-mapeamento-secoes">
        <ColunaSeletora
          titulo="Colunas de Nome"
          headers={headers}
          selecionadas={estado.colunasNome}
          busca={estado.buscaColunasNome}
          onBuscaChange={(valor) => onEstadoChange({ buscaColunasNome: valor })}
          onAlternarColuna={(coluna) =>
            onEstadoChange({ colunasNome: alternarColuna(estado.colunasNome, coluna) })
          }
          onReordenar={(nova) => onEstadoChange({ colunasNome: nova })}
          idPrefix="col-nome"
        />

        <ColunaSeletora
          titulo="Colunas de E-mail"
          headers={headers}
          selecionadas={estado.colunasEmail}
          busca={estado.buscaColunasEmail}
          onBuscaChange={(valor) => onEstadoChange({ buscaColunasEmail: valor })}
          onAlternarColuna={(coluna) =>
            onEstadoChange({ colunasEmail: alternarColuna(estado.colunasEmail, coluna) })
          }
          onReordenar={(nova) => onEstadoChange({ colunasEmail: nova })}
          idPrefix="col-email"
        />
      </div>
    </div>
  );
}
