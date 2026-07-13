import { useMemo, useState } from 'react';

import type { EmailRecord, TStatus } from '../types/email';
import { Dialog } from './Dialog';
import { exportarRegistros, type TFormatoExportacao } from './utils/exportarPlanilha';
import { calcularContadores } from './utils/emailData';

interface Props {
  /** Registros da planilha atualmente carregada (já no estado da tela, não a cópia estática do JSON). */
  registros: EmailRecord[];
  onFechar: () => void;
}

/** Status disponíveis para exportação, na ordem em que aparecem no modal. "Enviados" vem marcado por padrão. */
const STATUS_EXPORTAVEIS: { value: TStatus; label: string }[] = [
  { value: 'enviado', label: 'Enviados' },
  { value: 'válido', label: 'Válidos' },
  { value: 'inválido', label: 'Inválidos' },
  { value: 'duplicado', label: 'Duplicados' },
  { value: 'deletado', label: 'Deletados' },
];

/** Sigla + rótulo de cada formato. A sigla vira o monograma do card (ver `.formato-card-monograma`). */
const FORMATOS: { value: TFormatoExportacao; sigla: string; label: string }[] = [
  { value: 'csv', sigla: 'CSV', label: 'Separado por vírgulas' },
  { value: 'csv-utf8', sigla: 'CSV', label: 'UTF-8 (acentos)' },
  { value: 'xlsx', sigla: 'XLS', label: 'Planilha Excel' },
  { value: 'pdf', sigla: 'PDF', label: 'Documento' },
];

/**
 * Modal de exportação, aberto pelo item "Exportar planilha" do menu de
 * configurações (`Header`). Deliberadamente componentizado à parte do
 * `Header` (que só decide quando abri-lo) para poder ser reaproveitado no
 * futuro em outros contextos além do cabeçalho — ex.: uma ação por card na
 * Home, quando ela deixar de ser um mock estático.
 *
 * Seleção de registros: "Enviados" vem marcado por padrão (conforme
 * solicitado); os demais status ficam desmarcados até o usuário escolher.
 * Cada linha da lista ganha um indicador de cor que reaproveita a mesma
 * paleta semântica dos badges de status já usados na tabela principal
 * (`.status-válido`, `.status-inválido` etc.) — a lista de exportação e a
 * tabela falam a mesma linguagem visual.
 *
 * Formato do arquivo: seleção única (CSV por padrão), renderizada como
 * cartões com monograma (`.formato-card`) em vez do antigo grupo de botões
 * de texto puro — mais fácil de escanear com o olho quando os quatro
 * formatos têm nomes parecidos (CSV / CSV UTF-8).
 */
export function ExportarModal({ registros, onFechar }: Props) {
  const [statusSelecionados, setStatusSelecionados] = useState<Set<TStatus>>(() => new Set(['enviado']));
  const [formato, setFormato] = useState<TFormatoExportacao>('csv');
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const todosMarcados = STATUS_EXPORTAVEIS.every(({ value }) => statusSelecionados.has(value));

  const contadores = useMemo(() => calcularContadores(registros), [registros]);

  const registrosFiltrados = useMemo(
    () => registros.filter((registro) => statusSelecionados.has(registro.status)),
    [registros, statusSelecionados]
  );

  const proporcaoSelecionada = registros.length === 0 ? 0 : registrosFiltrados.length / registros.length;

  function alternarStatus(status: TStatus) {
    setStatusSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(status)) {
        novo.delete(status);
      } else {
        novo.add(status);
      }
      return novo;
    });
  }

  function alternarTodos() {
    setStatusSelecionados(todosMarcados ? new Set() : new Set(STATUS_EXPORTAVEIS.map((s) => s.value)));
  }

  function fechar() {
    if (exportando) return;
    onFechar();
  }

  async function handleExportar() {
    if (registrosFiltrados.length === 0 || exportando) return;

    setExportando(true);
    setErro(null);
    try {
      await exportarRegistros(registrosFiltrados, formato);
      onFechar();
    } catch {
      setErro('Não foi possível gerar o arquivo. Tente novamente.');
    } finally {
      setExportando(false);
    }
  }

  return (
    <Dialog
      isOpen
      onClose={fechar}
      title="Exportar registros"
      className="modal-exportar"
      footer={
        <div className="exportar-rodape">
          <button
            type="button"
            className="dialog-botao-copiar"
            onClick={() => void handleExportar()}
            disabled={registrosFiltrados.length === 0 || exportando}
          >
            {exportando ? 'Exportando…' : 'Exportar'}
          </button>
        </div>
      }
    >
      <section className="exportar-secao">
        <p className="modal-campo-label">Quais registros deseja exportar?</p>
        <label className="exportar-selecionar-todos">
          <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} />
          <span>{todosMarcados ? 'Limpar seleção' : 'Selecionar todos'}</span>
        </label>

        <ul className="exportar-lista-status">
          {STATUS_EXPORTAVEIS.map(({ value, label }) => (
            <li key={value} className={statusSelecionados.has(value) ? 'marcado' : undefined}>
              <label className={`exportar-lista-status-item exportar-lista-status-${value}`}>
                <input
                  type="checkbox"
                  checked={statusSelecionados.has(value)}
                  onChange={() => alternarStatus(value)}
                />
                <span className="exportar-lista-status-indicador" aria-hidden="true" />
                <span className="exportar-lista-status-texto">{label}</span>
                <span className="exportar-lista-status-contador">{contadores[value]}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="exportar-rodape-contagem">
          <span className="exportar-rodape-numero">{registrosFiltrados.length}</span>
          <span className="exportar-rodape-texto">de {registros.length} selecionado(s)</span>
          <div className="exportar-rodape-barra">
            <div
              className="exportar-rodape-barra-preenchida"
              style={{ width: `${Math.round(proporcaoSelecionada * 100)}%` }}
            />
          </div>
        </div>
      </section>

      <section className="exportar-secao">
        <p className="modal-campo-label">Formato do arquivo</p>
        <div className="exportar-grade-formatos" role="radiogroup" aria-label="Formato do arquivo">
          {FORMATOS.map(({ value, sigla, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={formato === value}
              className={`formato-card${formato === value ? ' ativo' : ''}`}
              onClick={() => setFormato(value)}
            >
              <span className="formato-card-monograma">{sigla}</span>
              <span className="formato-card-label">{label}</span>
              {formato === value && (
                <svg className="formato-card-check" viewBox="0 0 16 16" aria-hidden="true">
                  <path
                    d="M3.5 8.5L6.5 11.5L12.5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      </section>

      {erro && <p className="erro-salvamento">{erro}</p>}
    </Dialog>
  );
}