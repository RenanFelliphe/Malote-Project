import { useMemo, useState } from 'react';

import type { EmailRecord, TStatus } from '../types/email';
import { IconeFechar } from './Icons';
import { exportarRegistros, type TFormatoExportacao } from './utils/exportarPlanilha';

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

const FORMATOS: { value: TFormatoExportacao; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'csv-utf8', label: 'CSV (UTF-8)' },
  { value: 'xlsx', label: 'XLSX' },
  { value: 'pdf', label: 'PDF' },
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
 * "Selecionar todos" é um atalho que marca/desmarca os cinco de uma vez,
 * mesmo padrão de switch agregador já usado em `ConflitoExclusaoModal`.
 *
 * Formato do arquivo: seleção única (CSV por padrão), renderizada como um
 * grupo de botões (`.modal-modo-botoes`, reaproveitado do design system —
 * classe existente porém sem uso até então).
 */
export function ExportarModal({ registros, onFechar }: Props) {
  const [statusSelecionados, setStatusSelecionados] = useState<Set<TStatus>>(() => new Set(['enviado']));
  const [formato, setFormato] = useState<TFormatoExportacao>('csv');
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const todosMarcados = STATUS_EXPORTAVEIS.every(({ value }) => statusSelecionados.has(value));

  const registrosFiltrados = useMemo(
    () => registros.filter((registro) => statusSelecionados.has(registro.status)),
    [registros, statusSelecionados]
  );

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
    <div className="modal-overlay" onClick={fechar}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Exportar registros</h2>
          <button type="button" className="modal-fechar" onClick={fechar} aria-label="Fechar">
            <IconeFechar />
          </button>
        </div>

        <section className="exportar-secao">
          <p className="modal-campo-label">Quais registros deseja exportar?</p>

          <label className="modal-selecionar-todos">
            <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} />
            Selecionar todos
          </label>

          <ul className="modal-lista">
            {STATUS_EXPORTAVEIS.map(({ value, label }) => (
              <li key={value}>
                <label>
                  <input
                    type="checkbox"
                    checked={statusSelecionados.has(value)}
                    onChange={() => alternarStatus(value)}
                  />
                  <span className="modal-lista-texto">{label}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="exportar-secao">
          <p className="modal-campo-label">Formato do arquivo</p>
          <div className="modal-modo-botoes" role="radiogroup" aria-label="Formato do arquivo">
            {FORMATOS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={formato === value}
                className={formato === value ? 'ativo' : ''}
                onClick={() => setFormato(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {erro && <p className="erro-salvamento">{erro}</p>}

        <div className="modal-rodape">
          <p className="modal-contagem-selecionados">{registrosFiltrados.length} registro(s) selecionado(s)</p>
          <button
            type="button"
            className="modal-botao-copiar"
            onClick={() => void handleExportar()}
            disabled={registrosFiltrados.length === 0 || exportando}
          >
            {exportando ? 'Exportando…' : 'Exportar'}
          </button>
        </div>
      </div>
    </div>
  );
}
