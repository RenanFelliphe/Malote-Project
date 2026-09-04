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
import { construirRegistros } from './utils/construirRegistros';
import { validarColunaId } from './utils/validarColunaId';
import { ESTADO_IMPORTACAO_INICIAL, type EstadoImportacao, type TEtapaImportacao } from './types';
import { PROJETOS } from '../../data/projetos';
import { EMAIL_CONTEUDO_VAZIO } from '../../types/email';
import { criarProjeto, ProjetoSlugDuplicadoError } from '../../services/projetosApi';

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
 * Assistente de importação de planilha (4 etapas). A partir da Etapa 7 de
 * `implementacaoImportacao.md`, "Confirmar Importação" persiste de verdade:
 * converte as linhas mapeadas em `EmailRecord[]` (`construirRegistros`,
 * Etapa 3) e cria o projeto via `criarProjeto` (`projetosApi`, Etapa 6).
 * Em sucesso (Etapa 8), redireciona via reload completo para o projeto
 * recém-criado, em vez de só fechar o modal.
 */
export function ImportWizardModal({ arquivo, onFechar }: Props) {
  const [planilha, setPlanilha] = useState<PlanilhaParseada | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [etapa, setEtapa] = useState<TEtapaImportacao>(1);
  const [estado, setEstado] = useState<EstadoImportacao>(ESTADO_IMPORTACAO_INICIAL);
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  // Etapa 7 (implementacaoImportacao.md): estado da chamada real a
  // `criarProjeto`, disparada por "Confirmar Importação".
  const [importando, setImportando] = useState(false);
  const [erroImportacao, setErroImportacao] = useState<string | null>(null);

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

  // Etapa 4 (implementacaoImportacao.md): checagem de unicidade do slug
  // no client, contra os projetos ativos já descobertos em `PROJETOS`.
  // Conveniência de UX — a garantia real fica com o servidor (Etapa 5).
  const slugJaExiste = useMemo(() => {
    const slugAtual = estado.nomeArquivoSlug.trim();
    if (slugAtual === '') return false;
    return PROJETOS.some((projeto) => projeto.slug === slugAtual);
  }, [estado.nomeArquivoSlug]);

  function atualizarEstado(parcial: Partial<EstadoImportacao>) {
    setEstado((atual) => ({ ...atual, ...parcial }));
  }

  function solicitarFechamento() {
    // Mesmo padrão de `EmailConteudoModal`: uma persistência em andamento
    // não pode ser interrompida por Esc/clique fora/botão "X".
    if (importando) return;
    setConfirmandoCancelamento(true);
  }

  function continuarEditando() {
    setConfirmandoCancelamento(false);
  }

  function cancelarImportacao() {
    setConfirmandoCancelamento(false);
    onFechar();
  }

  async function confirmarImportacao() {
    if (importando || !planilha) return;

    setImportando(true);
    setErroImportacao(null);
    try {
      // Etapa 3: mesma regra de status (válido/inválido/duplicado) já usada
      // por `sync.ts`, aplicada às colunas mapeadas manualmente pelo
      // usuário nas Etapas 1/2 do wizard.
      // Demanda 7 (Mapeamento de ID Personalizado, Etapa 7): `estado.colunaId`
      // repassado como 4º argumento — `etapa2Valida` já impede chegar aqui
      // com uma coluna de ID inválida (vazia/duplicada/não numérica), mas
      // `construirRegistros` também valida e lança `Error` como segunda
      // camada de proteção (ex.: planilha mudou entre etapas do wizard).
      const registros = construirRegistros(
        planilha.linhas,
        estado.colunasNome,
        estado.colunasEmail,
        estado.colunaId
      );

      // Título/corpo (Etapa 3 do wizard, `EtapaDefinicao`) são opcionais —
      // se nenhum dos dois foi preenchido, o projeto nasce com o mesmo
      // `EmailConteudo` "vazio" usado em qualquer outro lugar do sistema
      // (inclusive `atualizado_em: ''`), em vez de um timestamp que
      // sugeriria uma edição que não aconteceu.
      const emailPreenchido = estado.titulo.trim() !== '' || estado.conteudo.trim() !== '';
      const email = emailPreenchido
        ? { titulo: estado.titulo, conteudo: estado.conteudo, atualizado_em: new Date().toISOString() }
        : EMAIL_CONTEUDO_VAZIO;

      // Etapa 6: persiste de verdade via `POST /api/projetos` (Etapa 5).
      // A partir da Etapa 1 de AtualizacaoDaPlanilhaViaUI.md, `criarProjeto`
      // também envia `arquivo` (o `File` já recebido como prop deste
      // componente) para o servidor persistir `sheet.<ext>` — nenhuma outra
      // mudança neste fluxo de importação.
      //
      // Demanda 7 (Mapeamento de ID Personalizado, Etapa 7): `estado.colunaId`
      // repassado como 6º argumento, para o servidor persistir em
      // `EmailsData.colunaId` — depende do middleware do servidor
      // (`projetosApiPlugin`) ler e gravar esse campo; ver pendência
      // registrada em `services/projetosApi.ts`.
      const slugCriado = await criarProjeto(
        estado.nomeArquivoSlug,
        estado.nomeProjeto,
        email,
        registros,
        arquivo,
        estado.colunaId
      );

      // Etapa 8: reload completo para o projeto recém-criado, não
      // navegação client-side — `PROJETOS` só é resolvido uma vez, via
      // `import.meta.glob({ eager: true })`, no carregamento do módulo
      // (ver seção 2 do plano); navegar sem reload cairia na rota
      // fallback, já que o slug novo não existe no array em memória até a
      // página recarregar.
      window.location.href = '/' + slugCriado;
    } catch (erro) {
      setErroImportacao(
        erro instanceof ProjetoSlugDuplicadoError
          ? 'Já existe um projeto com esse nome de arquivo. Volte à Etapa 1 e escolha outro.'
          : 'Não foi possível concluir a importação. Tente novamente.'
      );
    } finally {
      setImportando(false);
    }
  }

  const nomeProjetoValido = estado.nomeProjeto.trim() !== '';
  const nomeArquivoValido = estado.nomeArquivoSlug.trim() !== '';
  const etapa1Valida = nomeProjetoValido && nomeArquivoValido && !slugJaExiste;

  // Demanda 7 (Mapeamento de ID Personalizado, Etapa 7): a validação
  // bloqueante da coluna de ID (vazio/duplicado/não numérico) já é exibida
  // dentro de `EtapaMapeamento` (Etapa 5), mas quem decide se o botão
  // "Avançar" fica desabilitado é este container — mesma validação
  // (`validarColunaId`), rodada aqui contra `planilha.linhas` e
  // `estado.colunaId`, para satisfazer o critério de aceite de bloquear o
  // avanço, não só mostrar a mensagem de erro.
  const validacaoColunaId = useMemo(
    () => (planilha ? validarColunaId(planilha.linhas, estado.colunaId) : { valido: true }),
    [planilha, estado.colunaId]
  );
  const etapa2Valida =
    estado.colunasNome.length > 0 && estado.colunasEmail.length > 0 && validacaoColunaId.valido;

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
                disabled={importando}
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
              <button
                type="button"
                className="dialog-botao-primario"
                onClick={() => void confirmarImportacao()}
                disabled={importando}
              >
                {importando ? 'Importando…' : 'Confirmar Importação'}
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
                slugJaExiste={slugJaExiste}
              />
            )}

            {etapa === 2 && planilha && (
              <EtapaMapeamento
                estado={estado}
                onEstadoChange={atualizarEstado}
                headers={planilha.headers}
                linhas={planilha.linhas}
              />
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

          {erroImportacao && <p className="erro-salvamento">{erroImportacao}</p>}
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