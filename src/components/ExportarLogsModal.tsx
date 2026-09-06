import { useState } from 'react';

import { Dialog } from './Dialog';
import { exportarLogs } from '../services/logsApi';

interface Props {
  onFechar: () => void;
}

/** Sigla + rótulo de cada formato — mesmo padrão visual de `.formato-card` já usado por `ExportarModal` (exportação de planilha), com só dois formatos aqui (seção 6: "CSV ou JSON"). */
const FORMATOS: { value: 'csv' | 'json'; sigla: string; label: string }[] = [
  { value: 'csv', sigla: 'CSV', label: 'Colunas fixas + JSON embutido' },
  { value: 'json', sigla: 'JSON', label: 'Estrutura completa, como gravada' },
];

/** Mês atual no formato `AAAA-MM`, usado como valor inicial de "De". */
function mesAtual(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Modal de exportação dos próprios logs (Demanda 9 — `LogsDeAlteracoes.md`,
 * Etapa 7), aberto pelo botão "Exportar Logs" da tela `/logs`. Exporta
 * sempre por mês ou intervalo de meses — nunca por resultado de
 * busca/filtro nem um log específico (seção 6), por isso não recebe nenhum
 * filtro da tela como prop, diferente do `ExportarModal` de planilhas.
 *
 * "Até" vazio equivale a mês único, mesmo critério já usado pelo filtro de
 * data da própria tela `/logs` (Etapa 6) — não exige os dois campos
 * preenchidos para exportar um único mês.
 */
export function ExportarLogsModal({ onFechar }: Props) {
  const [mesInicio, setMesInicio] = useState(mesAtual());
  const [mesFim, setMesFim] = useState('');
  const [formato, setFormato] = useState<'csv' | 'json'>('csv');
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const intervaloInvalido = Boolean(mesFim) && mesFim < mesInicio;
  const ehIntervalo = Boolean(mesFim) && mesFim !== mesInicio;

  function fechar() {
    if (exportando) return;
    onFechar();
  }

  async function handleExportar() {
    if (!mesInicio || intervaloInvalido || exportando) return;

    setExportando(true);
    setErro(null);
    try {
      await exportarLogs({ mesInicio, mesFim: mesFim || undefined, formato });
      onFechar();
    } catch (erroExportacao) {
      setErro(erroExportacao instanceof Error ? erroExportacao.message : 'Não foi possível exportar os logs.');
    } finally {
      setExportando(false);
    }
  }

  return (
    <Dialog
      isOpen
      onClose={fechar}
      title="Exportar Logs"
      className="modal-exportar"
      footer={
        <div className="exportar-rodape">
          {intervaloInvalido && (
            <p className="exportar-rodape-aviso">"Até" não pode ser anterior a "De".</p>
          )}
          <button
            type="button"
            className="dialog-botao-copiar"
            onClick={() => void handleExportar()}
            disabled={!mesInicio || intervaloInvalido || exportando}
          >
            {exportando ? 'Exportando…' : 'Exportar'}
          </button>
        </div>
      }
    >
      <section className="exportar-secao">
        <p className="modal-campo-label">Mês ou intervalo</p>
        <div className="logs-exportar-meses">
          <label className="logs-filtro-data-campo">
            <span>De</span>
            <input
              type="month"
              value={mesInicio}
              onChange={(e) => setMesInicio(e.target.value)}
              max={mesFim || undefined}
            />
          </label>
          <label className="logs-filtro-data-campo">
            <span>Até (opcional)</span>
            <input
              type="month"
              value={mesFim}
              onChange={(e) => setMesFim(e.target.value)}
              min={mesInicio || undefined}
            />
          </label>
        </div>
        <p className="logs-exportar-dica">
          {ehIntervalo
            ? 'Mais de um mês selecionado — o download sai em um único .zip, um arquivo por mês.'
            : 'Um único mês selecionado — o download sai como um arquivo direto.'}
        </p>
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
