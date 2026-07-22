import { useEffect, useMemo, useState } from 'react';

import { IconeCheck } from '../Icons';
import { ConfirmDialog } from '../ConfirmDialog';
import { Dialog } from '../Dialog';
import { EtapaInformacoes } from './EtapaInformacoes';
import { EtapaMapeamento } from './EtapaMapeamento';
import { EtapaDefinicao } from './EtapaDefinicao';
import { EtapaRevisao } from './EtapaRevisao';
import { parsearPlanilha, type PlanilhaParseada } from './utils/parseSheetBrowser';
import { calcularEstatisticasPreliminares } from './utils/statsPreliminares';
import { ESTADO_IMPORTACAO_INICIAL, type EstadoImportacao, type TEtapaImportacao } from './types';

interface Props {
  arquivo: File;
  onFechar: () => void;
}

const ETAPAS: { numero: TEtapaImportacao; rotulo: string }[] = [
  { numero: 1, rotulo: 'Informações' },
  { numero: 2, rotulo: 'Mapeamento' },
  { numero: 3, rotulo: 'Definição' },
  { numero: 4, rotulo: 'Revisão' },
];

/**
 * Assistente de importação de planilha (4 etapas). Implementação apenas de
 * interface/navegação — ver descrição da tarefa: nenhuma importação real é
 * realizada aqui. "Confirmar Importação" apenas fecha o modal.
 */
export function ImportWizardModal({ arquivo, onFechar }: Props) {
  const [planilha, setPlanilha] = useState<PlanilhaParseada | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [etapa, setEtapa] = useState<TEtapaImportacao>(1);
  const [estado, setEstado] = useState<EstadoImportacao>(ESTADO_IMPORTACAO_INICIAL);
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);

  useEffect(() => {
    let cancelado = false;

    parsearPlanilha(arquivo)
      .then((resultado) => {
        if (!cancelado) setPlanilha(resultado);
      })
      .catch((erroParsing: unknown) => {
        if (!cancelado) {
          setErro(
            erroParsing instanceof Error
              ? erroParsing.message
              : 'Não foi possível ler o arquivo selecionado.'
          );
        }
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [arquivo]);

  // Fechamento via Esc, clique fora e botão "X" agora são responsabilidade
  // do Dialog (ver onClose abaixo) — sempre passando pela confirmação de
  // cancelamento, igual antes.

  const estatisticas = useMemo(() => {
    if (!planilha) return { total: 0, validos: 0, invalidos: 0, duplicados: 0 };
    return calcularEstatisticasPreliminares(planilha.linhas, planilha.headers);
  }, [planilha]);

  function atualizarEstado(parcial: Partial<EstadoImportacao>) {
    setEstado((atual) => ({ ...atual, ...parcial }));
  }

  function solicitarFechamento() {
    setConfirmandoCancelamento(true);
  }

  function continuarEditando() {
    setConfirmandoCancelamento(false);
  }

  function cancelarImportacao() {
    setConfirmandoCancelamento(false);
    onFechar();
  }

  function confirmarImportacao() {
    // Etapa apenas de interface: nenhuma importação, persistência ou
    // criação de projeto acontece aqui — só fecha o modal.
    onFechar();
  }

  const nomeProjetoValido = estado.nomeProjeto.trim() !== '';
  const nomeArquivoValido = estado.nomeArquivoSlug.trim() !== '';
  const etapa1Valida = nomeProjetoValido && nomeArquivoValido;
  const etapa2Valida = estado.colunasNome.length > 0 && estado.colunasEmail.length > 0;

  const mostrarConteudo = Boolean(planilha) && !carregando && !erro;

  return (
    <Dialog
      isOpen
      onClose={solicitarFechamento}
      title="Importar planilha"
      className="modal-importacao"
      // Enquanto a confirmação de cancelamento (dialog aninhado) está
      // aberta, o Esc deve fechar apenas ela — não também disparar
      // solicitarFechamento deste dialog externo.
      closeOnEsc={!confirmandoCancelamento}
      footer={
        mostrarConteudo ? (
          <>
            {etapa === 1 ? (
              <span />
            ) : (
              <button
                type="button"
                className="dialog-botao-cancelar"
                onClick={() => setEtapa((atual) => (atual - 1) as TEtapaImportacao)}
              >
                Voltar
              </button>
            )}

            {etapa === 1 && (
              <button
                type="button"
                className="dialog-botao-primario"
                disabled={!etapa1Valida}
                onClick={() => setEtapa(2)}
              >
                Avançar
              </button>
            )}

            {etapa === 2 && (
              <button
                type="button"
                className="dialog-botao-primario"
                disabled={!etapa2Valida}
                onClick={() => setEtapa(3)}
              >
                Avançar
              </button>
            )}

            {etapa === 3 && (
              <button type="button" className="dialog-botao-primario" onClick={() => setEtapa(4)}>
                Avançar
              </button>
            )}

            {etapa === 4 && (
              <button type="button" className="dialog-botao-primario" onClick={confirmarImportacao}>
                Confirmar Importação
              </button>
            )}
          </>
        ) : undefined
      }
    >
      {carregando && <p className="importacao-status">Lendo planilha selecionada...</p>}

      {erro && !carregando && (
        // Etapa 10 (RefatoracaoModais.md): decisão explícita entre as duas
        // abordagens propostas — manter o fechamento direto (sem passar pela
        // confirmação de `cancelarImportacao`/`continuarEditando`), já que
        // esse estado é alcançado antes de qualquer etapa do wizard ser
        // exibida (a planilha nem chegou a ser lida com sucesso), então não
        // existe progresso do usuário para se perder aqui. O botão usa a
        // mesma classe (`dialog-botao-cancelar`) do par de botões do
        // `ConfirmDialog` compartilhado, mantendo a linguagem visual
        // consistente mesmo sem reaproveitar o componente em si.
        <div className="importacao-erro">
          <p>{erro}</p>
          <button type="button" className="dialog-botao-cancelar" onClick={onFechar}>
            Fechar
          </button>
        </div>
      )}

      {mostrarConteudo && (
        <>
          <p className="importacao-stepper-resumo">
            Etapa {etapa} de 4 — {ETAPAS[etapa - 1].rotulo}
          </p>

          <ol className="importacao-stepper" aria-hidden="true">
            {ETAPAS.map(({ numero, rotulo }) => {
              const concluida = numero < etapa;
              const ativa = numero === etapa;
              return (
                <li
                  key={numero}
                  className={`importacao-stepper-item ${ativa ? 'ativa' : ''} ${
                    concluida ? 'concluida' : ''
                  }`}
                >
                  <span className="importacao-stepper-bolha">
                    {concluida ? <IconeCheck /> : numero}
                  </span>
                  <span className="importacao-stepper-rotulo">{rotulo}</span>
                </li>
              );
            })}
          </ol>

          <div className="importacao-corpo">
            {etapa === 1 && planilha && (
              <EtapaInformacoes
                estado={estado}
                onEstadoChange={atualizarEstado}
                headers={planilha.headers}
                linhas={planilha.linhas}
                formato={planilha.formato}
                tamanhoBytes={planilha.tamanhoBytes}
                estatisticas={estatisticas}
              />
            )}

            {etapa === 2 && planilha && (
              <EtapaMapeamento estado={estado} onEstadoChange={atualizarEstado} headers={planilha.headers} />
            )}

            {etapa === 3 && planilha && <EtapaDefinicao estado={estado} onEstadoChange={atualizarEstado} />}

            {etapa === 4 && planilha && (
              <EtapaRevisao
                estado={estado}
                headers={planilha.headers}
                formato={planilha.formato}
                tamanhoBytes={planilha.tamanhoBytes}
                estatisticas={estatisticas}
              />
            )}
          </div>
        </>
      )}

      {confirmandoCancelamento && (
        <ConfirmDialog
          ariaLabel="Confirmar cancelamento da importação"
          titulo="Deseja cancelar a importação?"
          descricao="Todo o progresso realizado será perdido."
          rotuloCancelar="Continuar editando"
          rotuloConfirmar="Cancelar importação"
          onCancelar={continuarEditando}
          onConfirmar={cancelarImportacao}
        />
      )}
    </Dialog>
  );
}
