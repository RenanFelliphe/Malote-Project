import { formatBytes } from './utils/formatBytes';
import type { EstatisticasPreliminares } from './utils/statsPreliminares';
import type { EstadoImportacao } from './types';

interface Props {
  estado: EstadoImportacao;
  headers: string[];
  formato: 'csv' | 'xlsx';
  tamanhoBytes: number;
  estatisticas: EstatisticasPreliminares;
}

export function EtapaRevisao({ estado, headers, formato, tamanhoBytes, estatisticas }: Props) {
  return (
    <div className="etapa-importacao etapa-revisao">
      <p className="etapa-revisao-instrucao">
        Confira as informações abaixo antes de confirmar a importação.
      </p>

      <dl className="revisao-lista">
        <div>
          <dt>Nome do projeto</dt>
          <dd>{estado.nomeProjeto}</dd>
        </div>
        <div>
          <dt>Nome do arquivo</dt>
          <dd>{estado.nomeArquivoSlug}</dd>
        </div>
        <div>
          <dt>URL do projeto</dt>
          <dd>
            <code>/projetos/{estado.nomeArquivoSlug}</code>
          </dd>
        </div>
        <div>
          <dt>Formato da planilha</dt>
          <dd>.{formato}</dd>
        </div>
        <div>
          <dt>Total de registros</dt>
          <dd>{estatisticas.total.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>E-mails válidos</dt>
          <dd>{estatisticas.validos.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>E-mails inválidos</dt>
          <dd>{estatisticas.invalidos.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>E-mails duplicados</dt>
          <dd>{estatisticas.duplicados.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>Quantidade de colunas</dt>
          <dd>{headers.length.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>Tamanho do arquivo</dt>
          <dd>{formatBytes(tamanhoBytes)}</dd>
        </div>
        <div>
          <dt>Coluna(s) de Nome (por prioridade)</dt>
          <dd>
            <ol className="revisao-prioridade-lista">
              {estado.colunasNome.map((coluna) => (
                <li key={coluna}>{coluna}</li>
              ))}
            </ol>
          </dd>
        </div>
        <div>
          <dt>Coluna(s) de E-mail (por prioridade)</dt>
          <dd>
            <ol className="revisao-prioridade-lista">
              {estado.colunasEmail.map((coluna) => (
                <li key={coluna}>{coluna}</li>
              ))}
            </ol>
          </dd>
        </div>
      </dl>
    </div>
  );
}
