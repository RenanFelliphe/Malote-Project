import { useMemo, useState } from 'react';

import type { TStatus } from '../types/email';
import { Dialog } from './Dialog';
import { calcularEmailsDuplicados } from './EmailStatus';
import { exportarRegistrosEmLote, type TFormatoExportacao } from './utils/exportarPlanilha';
import {
  calcularContadoresPorPlanilha,
  filtrarPorStatusMultiplo,
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

/**
 * Os 4 status reais selecionáveis, na ordem em que devem ficar marcados
 * quando "Selecionar todos"/"Limpar seleção" é acionado. Desde a Demanda 10
 * (Etapa 1), `'duplicado'` não é mais um `TStatus` — ver `ITENS_EXPORTAVEIS`
 * abaixo para a lista completa exibida no modal, que inclui "Duplicados"
 * como item à parte.
 */
const STATUS_VALORES: TStatus[] = ['enviado', 'válido', 'inválido', 'deletado'];

/**
 * Itens exibidos na lista de seleção do modal, na ordem em que aparecem.
 * `chave` indexa tanto `EmailCounters` (para o contador exibido) quanto,
 * para os 4 itens de status, o `Set<TStatus>` de seleção — "Duplicados" é
 * a exceção: desde a Demanda 10 (Etapa 1, `RefatoracaoSistemadeDuplicatas.md`),
 * deixou de ser um valor de `status` e passou a ser uma flag calculada
 * (`calcularEmailsDuplicados`), então seu estado de seleção vive à parte
 * (`duplicadosSelecionado`), não dentro do `Set<TStatus>` dos demais.
 * "Enviados" vem marcado por padrão.
 */
const ITENS_EXPORTAVEIS: { chave: TStatus | 'duplicado'; label: string }[] = [
  { chave: 'enviado', label: 'Enviados' },
  { chave: 'válido', label: 'Válidos' },
  { chave: 'inválido', label: 'Inválidos' },
  { chave: 'duplicado', label: 'Duplicados' },
  { chave: 'deletado', label: 'Deletados' },
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
 * Desde a Demanda 10 (Etapa 11, `RefatoracaoSistemadeDuplicatas.md`), o
 * checkbox "Duplicados" não filtra mais por `status === 'duplicado'` (valor
 * que deixou de existir na Etapa 1) — é um switch independente
 * (`duplicadosSelecionado`) que passa a incluir, por união com o status,
 * todo registro ativo cujo e-mail apareça mais de uma vez na planilha,
 * podendo coexistir com qualquer status real marcado ao mesmo tempo (ex.:
 * "Válidos" + "Duplicados" exporta válidos, duplicados, e quem for as duas
 * coisas — uma vez só cada).
 *
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
  /**
   * Estado do checkbox "Duplicados", separado de `statusSelecionados` desde
   * a Demanda 10 (Etapa 11) — mesmo padrão de `duplicadosFiltroAtivo` em
   * `emails.tsx` (Etapa 5). Começa desmarcado, igual ao comportamento
   * anterior (só "Enviados" vinha marcado por padrão).
   */
  const [duplicadosSelecionado, setDuplicadosSelecionado] = useState(false);
  const [formato, setFormato] = useState<TFormatoExportacao>('csv');
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const todosMarcados = STATUS_VALORES.every((status) => statusSelecionados.has(status)) && duplicadosSelecionado;

  // Contadores "brutos" de cada planilha (sem filtro de status aplicado) —
  // alimentam tanto o breakdown por planilha quanto, somados, a lista de
  // status principal (que sempre exibe o total agregado).
  const contadoresPorPlanilha = useMemo(() => calcularContadoresPorPlanilha(planilhas), [planilhas]);
  const contadores = useMemo(
    () => somarContadores(contadoresPorPlanilha.map((item) => item.contadores)),
    [contadoresPorPlanilha]
  );

  /**
   * Registros de cada planilha já filtrados pela seleção atual (status +
   * duplicados) — mantém o vínculo com a planilha de origem (slug/nome),
   * necessário tanto para o breakdown quanto para a exportação em si
   * (cada planilha é exportada separadamente, ver `handleExportar`).
   *
   * Demanda 10 (Etapa 11): reaproveita `filtrarPorStatusMultiplo`
   * (`emailData.ts`), a mesma função usada pela tabela principal desde a
   * Etapa 5 — um único passo de filtro por união (status selecionado OU
   * duplicado com o switch ativo), em vez de filtrar por status e depois
   * concatenar os duplicados à parte. É essa passagem única que evita
   * registro repetido no resultado quando um mesmo registro satisfaz dois
   * critérios ao mesmo tempo (ex.: "Válidos" + "Duplicados" marcados e o
   * registro é válido e duplicado): ele é avaliado uma vez por `.filter`,
   * então só pode aparecer uma vez no array de saída, nunca duas.
   * `emailsDuplicados` é calculado por planilha (nunca entre planilhas
   * diferentes), mesma decisão já registrada em `calcularContadoresPorPlanilha`.
   */
  const planilhasFiltradas = useMemo(
    () =>
      planilhas.map((planilha) => ({
        ...planilha,
        registrosFiltrados: filtrarPorStatusMultiplo(planilha.registros, statusSelecionados, {
          ativo: duplicadosSelecionado,
          emailsDuplicados: calcularEmailsDuplicados(planilha.registros),
        }),
      })),
    [planilhas, statusSelecionados, duplicadosSelecionado]
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

  /** Alterna o checkbox "Duplicados" — switch independente do `Set` de status, mesmo papel de `duplicadosFiltroAtivo` em `emails.tsx`. */
  function alternarDuplicados() {
    setDuplicadosSelecionado((atual) => !atual);
  }

  function alternarTodos() {
    setDuplicadosSelecionado(!todosMarcados);
    setStatusSelecionados(todosMarcados ? new Set() : new Set(STATUS_VALORES));
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
          {ITENS_EXPORTAVEIS.map(({ chave, label }) => {
            const marcado = chave === 'duplicado' ? duplicadosSelecionado : statusSelecionados.has(chave);
            return (
              <li key={chave} className={marcado ? 'marcado' : undefined}>
                <label className={`exportar-lista-status-item exportar-lista-status-${chave}`}>
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => (chave === 'duplicado' ? alternarDuplicados() : alternarStatus(chave))}
                  />
                  <span className="exportar-lista-status-indicador" aria-hidden="true" />
                  <span className="exportar-lista-status-texto">{label}</span>
                  <span className="exportar-lista-status-contador">{contadores[chave]}</span>
                </label>
              </li>
            );
          })}
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
