import { formatBytes } from './utils/formatBytes';
import { slugify, slugifyDigitando } from './utils/slugify';
import type { EstatisticasPreliminares } from './utils/statsPreliminares';
import type { LinhaPlanilha } from './utils/parseSheetBrowser';
import type { EstadoImportacao } from './types';

const QUANTIDADE_LINHAS_PREVIEW = 5;

interface Props {
  estado: EstadoImportacao;
  onEstadoChange: (novoEstado: Partial<EstadoImportacao>) => void;
  headers: string[];
  linhas: LinhaPlanilha[];
  formato: 'csv' | 'xlsx';
  tamanhoBytes: number;
  estatisticas: EstatisticasPreliminares;
  /** Etapa 4 (implementacaoImportacao.md): true quando o slug atual já é usado por um projeto ativo. */
  slugJaExiste: boolean;
}

export function EtapaInformacoes({
  estado,
  onEstadoChange,
  headers,
  linhas,
  formato,
  tamanhoBytes,
  estatisticas,
  slugJaExiste,
}: Props) {
  const linhasPreview = linhas.slice(0, QUANTIDADE_LINHAS_PREVIEW);

  function handleNomeProjetoChange(valor: string) {
    // Enquanto o nome do arquivo não tiver sido editado manualmente, ele
    // acompanha o nome do projeto automaticamente.
    if (estado.nomeArquivoEditadoManualmente) {
      onEstadoChange({ nomeProjeto: valor });
    } else {
      onEstadoChange({ nomeProjeto: valor, nomeArquivoSlug: slugify(valor) });
    }
  }

  function handleNomeArquivoChange(valor: string) {
    onEstadoChange({
      nomeArquivoSlug: slugifyDigitando(valor),
      nomeArquivoEditadoManualmente: true,
    });
  }

  return (
    <div className="etapa-importacao etapa-informacoes">
      <div className="campo-formulario">
        <label htmlFor="import-nome-projeto">Nome do projeto</label>
        <input
          id="import-nome-projeto"
          type="text"
          placeholder="Ex.: Leads Evento 2026"
          value={estado.nomeProjeto}
          onChange={(e) => handleNomeProjetoChange(e.target.value)}
          autoFocus
        />
      </div>

      <div className="campo-formulario">
        <label htmlFor="import-nome-arquivo">Nome do arquivo</label>
        <input
          id="import-nome-arquivo"
          type="text"
          placeholder="Ex.: leads-evento-2026"
          value={estado.nomeArquivoSlug}
          onChange={(e) => handleNomeArquivoChange(e.target.value)}
          aria-invalid={slugJaExiste}
          aria-describedby={slugJaExiste ? 'import-nome-arquivo-erro' : undefined}
        />
        {slugJaExiste ? (
          <p className="campo-formulario-erro" id="import-nome-arquivo-erro">
            Já existe um projeto com esse nome de arquivo. Escolha outro para continuar.
          </p>
        ) : (
          <p className="preview-url">
            /projetos/<strong>{estado.nomeArquivoSlug || '...'}</strong>
          </p>
        )}
      </div>

      <div className="preview-planilha">
        <h3>Prévia da planilha</h3>
        <div className="preview-planilha-tabela-wrapper">
          <table className="preview-planilha-tabela">
            <thead>
              <tr>
                {headers.map((coluna) => (
                  <th key={coluna}>{coluna}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhasPreview.map((linha, indice) => (
                <tr key={`linha-preview-${indice}`}>
                  {headers.map((coluna) => (
                    <td key={coluna}>{linha[coluna] || '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="preview-planilha-legenda">
          Mostrando {Math.min(QUANTIDADE_LINHAS_PREVIEW, linhas.length).toLocaleString('pt-BR')} de{' '}
          {linhas.length.toLocaleString('pt-BR')} registros.
        </p>
      </div>

      <div className="info-planilha">
        <h3>Informações da planilha</h3>
        <dl className="info-planilha-grade">
          <div>
            <dt>Formato</dt>
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
            <dt>Colunas</dt>
            <dd>{headers.length.toLocaleString('pt-BR')}</dd>
          </div>
          <div>
            <dt>Tamanho do arquivo</dt>
            <dd>{formatBytes(tamanhoBytes)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
