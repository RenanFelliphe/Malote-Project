import { useMemo, useState } from 'react';

import type { TStatus } from '../types/email';
import { Dialog } from './Dialog';
import { exportarRegistrosEmLote, type TFormatoExportacao } from './utils/exportarPlanilha';
import {
  calcularContadoresPorPlanilha,
  somarContadores,
  type PlanilhaParaContagem,
} from './utils/emailData';

/**
 * Uma planilha selecionada para exportação: slug + nome de exibição +
 * registros atuais (já no estado da tela, não a cópia estática do JSON).
 * Reaproveita a mesma forma de `PlanilhaParaContagem` (`emailData.ts`) — o
 * modal não precisa de nada além disso para exportar.
 */
export type PlanilhaParaExportar = PlanilhaParaContagem;

interface Props {
  /**
   * Planilhas a exportar (Etapa 3 de implementacaoExportacaoHome.md).
   * Dentro da página de uma planilha (`pages/emails.tsx`, via `Header`), é
   * sempre um array de 1 item — a planilha atualmente aberta; o
   * comportamento nesse caso é idêntico ao anterior (à época em que a prop
   * era `slug` + `registros` isolados). Pela Home, pode conter várias
   * planilhas escolhidas através do modo de seleção múltipla (ver
   * `pages/home.tsx`).
   */
  planilhas: PlanilhaParaExportar[];
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
 * configurações (`Header`) — tanto de dentro de uma planilha (uma única
 * planilha, sempre) quanto, a partir de implementacaoExportacaoHome.md, da
 * Home (uma ou mais planilhas, escolhidas via seleção múltipla).
 *
 * Seleção de registros: "Enviados" vem marcado por padrão (conforme
 * solicitado); os demais status ficam desmarcados até o usuário escolher.
 * A lista de status sempre trabalha com o total agregado de todas as
 * planilhas recebidas — com 1 planilha (caso de sempre dentro da página de
 * uma planilha), os números são idênticos aos de antes; com 2+ (Home), os
 * contadores somam todas juntas. Quando há mais de uma planilha, um
 * cabeçalho extra mostra quantas planilhas estão selecionadas e o
 * breakdown por planilha (nº filtrado / total) logo acima da lista de
 * status — com apenas uma planilha esse cabeçalho não aparece, mantendo o
 * modal visualmente idêntico ao comportamento anterior.
 *
 * Formato do arquivo: seleção única (CSV por padrão), renderizada como
 * cartões com monograma (`.formato-card`) em vez do antigo grupo de botões
 * de texto puro — mais fácil de escanear com o olho quando os quatro
 * formatos têm nomes parecidos (CSV / CSV UTF-8).
 */
export function ExportarModal({ planilhas, onFechar }: Props) {
  const [statusSelecionados, setStatusSelecionados] = useState<Set<TStatus>>(() => new Set(['enviado']));
  const [formato, setFormato] = useState<TFormatoExportacao>('csv');
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const todosMarcados = STATUS_EXPORTAVEIS.every(({ value }) => statusSelecionados.has(value));

  // Contadores "brutos" de cada planilha (sem filtro de status aplicado) —
  // alimentam tanto o breakdown por planilha quanto, somados, a lista de
  // status principal (que sempre exibe o total agregado).
  const contadoresPorPlanilha = useMemo(() => calcularContadoresPorPlanilha(planilhas), [planilhas]);
  const contadores = useMemo(
    () => somarContadores(contadoresPorPlanilha.map((item) => item.contadores)),
    [contadoresPorPlanilha]
  );

  // Registros de cada planilha já filtrados pelo status selecionado no
  // momento — mantém o vínculo com a planilha de origem (slug/nome),
  // necessário tanto para o breakdown quanto para a exportação em si
  // (cada planilha é exportada separadamente, ver `handleExportar`).
  const planilhasFiltradas = useMemo(
    () =>
      planilhas.map((planilha) => ({
        ...planilha,
        registrosFiltrados: planilha.registros.filter((registro) => statusSelecionados.has(registro.status)),
      })),
    [planilhas, statusSelecionados]
  );

  const totalRegistros = contadores.total;
  const totalFiltrado = useMemo(
    () => planilhasFiltradas.reduce((soma, planilha) => soma + planilha.registrosFiltrados.length, 0),
    [planilhasFiltradas]
  );
  const proporcaoSelecionada = totalRegistros === 0 ? 0 : totalFiltrado / totalRegistros;

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

  /**
   * Dispara a exportação em lote (`exportarRegistrosEmLote`, Etapa 4 de
   * implementacaoExportacaoHome.md), descartando antes qualquer planilha
   * sem nenhum registro no filtro de status atual — a função de baixo só
   * cuida de gerar/baixar, a filtragem é responsabilidade daqui. Com 1
   * planilha (sempre o caso dentro da página de uma planilha), o
   * comportamento é idêntico ao de antes: um único arquivo baixado direto,
   * sem zip. Com 2+ planilhas pela Home, o resultado é um único `.zip`
   * contendo um arquivo por planilha.
   */
  async function handleExportar() {
    if (totalFiltrado === 0 || exportando) return;

    const planilhasComRegistros = planilhasFiltradas
      .filter((planilha) => planilha.registrosFiltrados.length > 0)
      .map((planilha) => ({ slug: planilha.slug, registros: planilha.registrosFiltrados }));

    setExportando(true);
    setErro(null);
    try {
      await exportarRegistrosEmLote(planilhasComRegistros, formato);
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
          {totalFiltrado === 0 && (
            <p className="exportar-rodape-aviso">Selecione ao menos um status para exportar.</p>
          )}
          <button
            type="button"
            className="dialog-botao-copiar"
            onClick={() => void handleExportar()}
            disabled={totalFiltrado === 0 || exportando}
          >
            {exportando ? 'Exportando…' : 'Exportar'}
          </button>
        </div>
      }
    >
      {planilhas.length > 1 && (
        <section className="exportar-secao exportar-secao-planilhas">
          <p className="modal-campo-label">
            {planilhas.length} planilhas selecionadas · {totalRegistros} registros no total
          </p>
          <ul className="exportar-lista-planilhas">
            {planilhasFiltradas.map((planilha) => (
              <li key={planilha.slug} className="exportar-lista-planilhas-item">
                <span className="exportar-lista-planilhas-nome">{planilha.nome}</span>
                <span className="exportar-lista-planilhas-contador">
                  {planilha.registrosFiltrados.length} de {planilha.registros.length}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
          <span className="exportar-rodape-numero">{totalFiltrado}</span>
          <span className="exportar-rodape-texto">de {totalRegistros} selecionado(s)</span>
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
