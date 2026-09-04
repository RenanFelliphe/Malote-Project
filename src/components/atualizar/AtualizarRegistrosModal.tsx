import { useEffect, useMemo, useState } from 'react';

import { IconeCheck } from '../Icons';
import { Dialog } from '../Dialog';
import { ConfirmDialog } from '../ConfirmDialog';
import { parsearPlanilha, type PlanilhaParseada } from '../import/utils/parseSheetBrowser';
import {
  calcularMerge,
  identificarColunasAutomaticamente,
  isValidEmail,
  normalizeEmail,
  TIPOS_CONFLITO_ATUALIZAR_REGISTROS,
  type NotaCorrigido,
  type NotaStatusAlterado,
  type ResultadoMerge,
} from '../../scripts/utils/calcularMerge';
import { RegistrosSumidosSection, type DecisaoSumido } from './RegistrosSumidosSection';
import { MergeCampoConflito } from './MergeCampoConflito';
import type { EmailConteudo, EmailRecord } from '../../types/email';
import { enviarSheet, salvarEmails } from '../../services/emailsApi';

interface Props {
  slug: string;
  arquivo: File;
  registrosAtuais: EmailRecord[];
  emailAtual: EmailConteudo;
  onFechar: () => void;
  /**
   * `colunaId` persistido do projeto (Demanda 7 — Mapeamento de ID
   * Personalizado, Etapa 3). Ausente/`undefined` = "Gerar Automaticamente"
   * (mesmo fallback de `EmailsData.colunaId`) — este fluxo **não** tem
   * seletor próprio (Etapa 9): só lê a escolha já feita em "Atualizar
   * Dados > Colunas" (Etapa 8) e repassa ao motor de merge, para que o
   * `id` usado para casar registros na reimportação não divirja
   * silenciosamente do `id` usado na criação/último remapeamento do
   * projeto.
   *
   * Ajuste de rota (fechado): `Header.tsx` repassa esta prop, e
   * `pages/emails.tsx` já passa `colunaId={dados.colunaId}` para
   * `Header.tsx` — cadeia de wiring completa, sem pendências.
   */
  colunaId?: string;
}

type DecisaoEnviado = 'manter-enviado' | 'desenviar';
type DecisaoDeletadoRevivido = 'manter-deletado' | 'reviver';
type DecisaoAtributoAlterado = 'ours' | 'theirs';

/** Ordem em cascata das seções de conflito navegáveis (seção 4 do planner). */
type TipoSecaoConflito = 'enviado' | 'deletado-revivido' | 'sumido' | 'atributo-alterado';
const ORDEM_SECOES_CONFLITO: TipoSecaoConflito[] = ['enviado', 'deletado-revivido', 'sumido', 'atributo-alterado'];

type Secao = 'resumo-inicial' | TipoSecaoConflito | 'resumo-final';

/**
 * `formatBytes` (`./utils/formatBytes`, usado por `EtapaRevisao.tsx`) não
 * fez parte dos "Arquivos Necessários" desta demanda e não veio em nenhum
 * ZIP até agora — equivalente local, mesmo formato de saída esperado
 * ("1,2 MB", "480 KB", etc.).
 */
function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const unidades = ['KB', 'MB', 'GB'];
  let valor = bytes / 1024;
  let indice = 0;
  while (valor >= 1024 && indice < unidades.length - 1) {
    valor /= 1024;
    indice++;
  }
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${unidades[indice]}`;
}

function quantoAConflitos(resultado: ResultadoMerge, tipo: TipoSecaoConflito): number {
  if (tipo === 'enviado') return resultado.conflitos.enviado.length;
  if (tipo === 'deletado-revivido') return resultado.conflitos.deletadoRevivido.length;
  if (tipo === 'sumido') return resultado.conflitos.sumido.length;
  return resultado.conflitos.atributoAlterado.length;
}

/** Primeira seção, a partir de `apartirIndice`, que ainda tem pendência em `resultado`. */
function proximaSecao(resultado: ResultadoMerge, apartirIndice: number): Secao {
  for (let indice = apartirIndice; indice < ORDEM_SECOES_CONFLITO.length; indice++) {
    const tipo = ORDEM_SECOES_CONFLITO[indice];
    if (quantoAConflitos(resultado, tipo) > 0) return tipo;
  }
  return 'resumo-final';
}

const ETAPAS: { numero: Secao; rotulo: string }[] = [
  { numero: 'resumo-inicial', rotulo: 'Resumo inicial' },
  { numero: 'enviado', rotulo: 'Registros enviados' },
  { numero: 'deletado-revivido', rotulo: 'Deletados/revividos' },
  { numero: 'sumido', rotulo: 'Registros sumidos' },
  { numero: 'atributo-alterado', rotulo: 'Atributo alterado' },
  { numero: 'resumo-final', rotulo: 'Resumo final' },
];

/**
 * Assistente do fluxo "Atualizar Registros" (Etapa 5 de
 * AtualizacaoDaPlanilhaViaUI.md) — reaproveita o mesmo casco de
 * `ImportWizardModal` (Dialog com footer fixo, corpo scrollável, indicador
 * de progresso), adaptado para um número variável de seções: nem todo
 * projeto tem os 4 tipos de conflito navegáveis (seção 4 do planner), e a
 * resolução de uma seção pode revelar/eliminar pendências das seções
 * seguintes (cascata) — por isso o stepper de bolhas fixas do wizard de
 * importação foi trocado por um rótulo textual + barra de progresso
 * (ajuste de rota: um stepper de bolhas não descreve bem um fluxo de
 * comprimento variável).
 *
 * As 3 seções de merge theirs/ours (Enviado, Deletado/revivido, Atributo
 * alterado) usam o componente compartilhado `MergeCampoConflito` (Etapa 6),
 * com atalhos de resolução em massa ("aceitar todos os theirs/ours"). A
 * seção "Sumido da planilha" usa um componente à parte, de lista simples
 * (`RegistrosSumidosSection`, Etapa 5) — não tem um "theirs" de nome/e-mail
 * para comparar, só a decisão ignorar/marcar como deletado.
 *
 * Cascata: o motor de merge (`calcularMerge`, Etapa 4) é sem estado — cada
 * chamada recebe um snapshot de `registrosAtuais` e classifica tudo num
 * único passe. Este componente implementa a cascata reaplicando, a cada
 * "Avançar", as decisões da seção atual sobre o snapshot e chamando
 * `calcularMerge` de novo (exatamente como documentado no cabeçalho de
 * `calcularMerge.ts`) — a seção seguinte é sempre calculada a partir do
 * resultado já atualizado, nunca do resultado original.
 *
 * Ajuste de rota: sem suporte a "Voltar" entre seções de conflito. Ao
 * contrário de `ImportWizardModal` (onde voltar só reexibe um formulário),
 * aqui cada "Avançar" aplica decisões que mudam o snapshot usado pela
 * seção seguinte — desfazer exigiria manter uma pilha de snapshots por
 * seção, fora do escopo desta etapa. "Cancelar" continua disponível a
 * qualquer momento e descarta todo o progresso, sem persistir nada.
 */
export function AtualizarRegistrosModal({ slug, arquivo, registrosAtuais, emailAtual, onFechar, colunaId }: Props) {
  // Normaliza a prop (`undefined` quando ausente/projeto sem estratégia de
  // ID definida) para o `string | null` esperado por `calcularMerge` —
  // mesmo padrão de `colunaIdSelecionado` em `AtualizarDadosModal.tsx`,
  // só que aqui não é estado editável: este fluxo só lê a escolha já
  // persistida (ver comentário da prop `colunaId` em `Props`).
  const colunaIdNormalizado = colunaId ?? null;

  const [planilha, setPlanilha] = useState<PlanilhaParseada | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroLeitura, setErroLeitura] = useState<string | null>(null);

  const [secaoAtual, setSecaoAtual] = useState<Secao>('resumo-inicial');
  const [snapshot, setSnapshot] = useState<EmailRecord[]>(registrosAtuais);

  const [decisoesEnviado, setDecisoesEnviado] = useState<Record<number, DecisaoEnviado>>({});
  const [decisoesDeletadoRevivido, setDecisoesDeletadoRevivido] = useState<Record<number, DecisaoDeletadoRevivido>>(
    {}
  );
  const [decisoesSumido, setDecisoesSumido] = useState<Record<number, DecisaoSumido>>({});
  const [decisoesAtributoAlterado, setDecisoesAtributoAlterado] = useState<Record<number, DecisaoAtributoAlterado>>(
    {}
  );

  const [notasAcumuladas, setNotasAcumuladas] = useState<{
    corrigido: NotaCorrigido[];
    statusAlterado: NotaStatusAlterado[];
  }>({ corrigido: [], statusAlterado: [] });

  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    parsearPlanilha(arquivo)
      .then((resultado) => {
        if (!cancelado) setPlanilha(resultado);
      })
      .catch((erro: unknown) => {
        if (!cancelado) {
          setErroLeitura(erro instanceof Error ? erro.message : 'Não foi possível ler o arquivo selecionado.');
        }
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [arquivo]);

  const registrosAtuaisPorId = useMemo(
    () => new Map(registrosAtuais.map((registro) => [registro.id, registro])),
    [registrosAtuais]
  );

  const colunasDetectadas = useMemo(
    () => (planilha ? identificarColunasAutomaticamente(planilha.headers) : { nome: [], email: [] }),
    [planilha]
  );

  // Demanda 7 — Mapeamento de ID Personalizado, Etapa 9: `colunaIdNormalizado`
  // (persistido do projeto, lido só uma vez via prop — sem seletor próprio
  // neste fluxo) substitui o `null` fixo que este fluxo usava antes desta
  // etapa. Se a coluna não existir na planilha reimportada (renomeada/
  // removida), `resolverIdDaLinha` (dentro de `calcularMerge`) já cai no
  // fallback de ordem de linha sozinho — `colunaIdAusenteNaPlanilha`
  // abaixo só detecta esse caso para exibir o aviso visível exigido pelo
  // critério de aceite (não muda o cálculo do merge em si).
  const resultadoAtual = useMemo<ResultadoMerge | null>(() => {
    if (!planilha) return null;
    return calcularMerge(
      snapshot,
      planilha.linhas,
      colunasDetectadas,
      TIPOS_CONFLITO_ATUALIZAR_REGISTROS,
      colunaIdNormalizado
    );
  }, [planilha, snapshot, colunasDetectadas, colunaIdNormalizado]);

  /**
   * Verdadeiro quando o projeto tem uma estratégia de ID explícita
   * (`colunaId` persistido) mas a planilha reimportada não traz mais essa
   * coluna no cabeçalho — o merge acima já caiu sozinho no fallback de
   * ordem de linha (`resolverIdDaLinha`); aqui só sinalizamos isso de
   * forma visível, em vez de deixar silencioso (Etapa 9, critério 7.2
   * "Aviso de coluna ausente").
   */
  const colunaIdAusenteNaPlanilha = useMemo(
    () => Boolean(colunaIdNormalizado) && Boolean(planilha) && !planilha!.headers.includes(colunaIdNormalizado!),
    [colunaIdNormalizado, planilha]
  );

  // Estatísticas cruas da planilha reimportada (independente do merge),
  // no mesmo modelo do resumo final de `EtapaRevisao` — usadas apenas na
  // seção de resumo inicial.
  const estatisticasPlanilha = useMemo(() => {
    if (!planilha) return { total: 0, validos: 0, invalidos: 0, duplicados: 0 };
    const colunaEmail = colunasDetectadas.email;
    const grupoPorEmail = new Map<string, number>();
    for (const linha of planilha.linhas) {
      const valor = colunaEmail.map((c) => linha[c]).find((v) => v && v.trim() !== '') ?? '';
      if (valor && isValidEmail(valor)) {
        const chave = normalizeEmail(valor);
        grupoPorEmail.set(chave, (grupoPorEmail.get(chave) ?? 0) + 1);
      }
    }
    let validos = 0;
    let invalidos = 0;
    let duplicados = 0;
    for (const linha of planilha.linhas) {
      const valor = colunaEmail.map((c) => linha[c]).find((v) => v && v.trim() !== '') ?? '';
      if (!valor || !isValidEmail(valor)) {
        invalidos++;
        continue;
      }
      const duplicado = (grupoPorEmail.get(normalizeEmail(valor)) ?? 0) > 1;
      if (duplicado) duplicados++;
      else validos++;
    }
    return { total: planilha.linhas.length, validos, invalidos, duplicados };
  }, [planilha, colunasDetectadas]);

  function solicitarFechamento() {
    if (salvando) return;
    setConfirmandoCancelamento(true);
  }

  function continuarEditando() {
    setConfirmandoCancelamento(false);
  }

  function cancelarAtualizacao() {
    setConfirmandoCancelamento(false);
    onFechar();
  }

  /**
   * Aplica as decisões da seção atual (se houver) sobre `resultadoAtual`,
   * produz o próximo snapshot e avança para a próxima seção com pendência
   * (ou "resumo-final", se não houver mais nenhuma) — mesma responsabilidade
   * descrita no cabeçalho de `calcularMerge.ts`: a UI reaplica a decisão do
   * usuário e chama o motor de novo.
   */
  function avancar() {
    if (!resultadoAtual) return;

    // 1. Acumula as notas informativas deste passe — "corrigido" e "status
    //    alterado" nunca abrem seção própria e, uma vez resolvidas no
    //    snapshot, não reaparecem num recálculo seguinte.
    setNotasAcumuladas((atual) => ({
      corrigido: [...atual.corrigido, ...resultadoAtual.notas.corrigido],
      statusAlterado: [...atual.statusAlterado, ...resultadoAtual.notas.statusAlterado],
    }));

    // 2. Registros já sem nenhum conflito pendente (em qualquer tipo) —
    //    ponto de partida do próximo snapshot.
    const aplicados = new Map<number, EmailRecord>(
      resultadoAtual.registrosSemConflito.map((registro) => [registro.id, registro])
    );

    const agora = new Date().toISOString();

    if (secaoAtual === 'enviado') {
      for (const conflito of resultadoAtual.conflitos.enviado) {
        const original = registrosAtuaisPorId.get(conflito.id);
        if (!original) continue;
        const decisao = decisoesEnviado[conflito.id];
        if (decisao === 'desenviar') {
          // Adota os valores da planilha e sai do status "enviado" — o
          // próximo cálculo decide válido/inválido/duplicado normalmente,
          // podendo inclusive revelar um conflito de "Atributo alterado"
          // se ainda houver um `backup_dados` divergente.
          aplicados.set(conflito.id, {
            ...original,
            nome: conflito.theirs.nome,
            email: conflito.theirs.email,
            status: 'válido',
            last_updated: agora,
          });
        } else {
          // "manter-enviado" (padrão de segurança se, por algum motivo,
          // a decisão não foi registrada): mantém como está, ignorando a
          // planilha para este registro.
          aplicados.set(conflito.id, original);
        }
      }
    } else if (secaoAtual === 'deletado-revivido') {
      for (const conflito of resultadoAtual.conflitos.deletadoRevivido) {
        const original = registrosAtuaisPorId.get(conflito.id);
        if (!original) continue;
        const decisao = decisoesDeletadoRevivido[conflito.id];
        if (decisao === 'reviver') {
          aplicados.set(conflito.id, {
            ...original,
            nome: conflito.theirs.nome,
            email: conflito.theirs.email,
            status: 'válido',
            last_updated: agora,
          });
        } else {
          aplicados.set(conflito.id, original);
        }
      }
    } else if (secaoAtual === 'sumido') {
      for (const registroSumido of resultadoAtual.conflitos.sumido) {
        const original = registrosAtuaisPorId.get(registroSumido.id);
        if (!original) continue;
        const decisao = decisoesSumido[registroSumido.id];
        aplicados.set(
          registroSumido.id,
          decisao === 'marcar-deletado' ? { ...original, status: 'deletado', last_updated: agora } : original
        );
      }
    } else if (secaoAtual === 'atributo-alterado') {
      for (const conflito of resultadoAtual.conflitos.atributoAlterado) {
        const original = registrosAtuaisPorId.get(conflito.id);
        if (!original) continue;
        const decisao = decisoesAtributoAlterado[conflito.id];
        if (decisao === 'theirs') {
          // Aceita o(s) valor(es) da planilha para o(s) campo(s) em
          // conflito e remove a proteção correspondente em `backup_dados`
          // — mesmo comportamento de `--aceitar-conflitos` em `sync.ts`.
          const backupRestante = original.backup_dados ? { ...original.backup_dados } : undefined;
          if (backupRestante) {
            for (const campo of conflito.camposConflitantes) delete backupRestante[campo];
          }
          aplicados.set(conflito.id, {
            ...original,
            nome: conflito.camposConflitantes.includes('nome') ? conflito.theirs.nome : original.nome,
            email: conflito.camposConflitantes.includes('email') ? conflito.theirs.email : original.email,
            backup_dados: backupRestante && Object.keys(backupRestante).length > 0 ? backupRestante : undefined,
            last_updated: agora,
          });
        } else {
          // "ours": mantém o valor atual (editado manualmente) intacto,
          // incluindo a proteção — a planilha diverge, mas o usuário optou
          // por preservar a edição.
          aplicados.set(conflito.id, original);
        }
      }
    }

    // 3. Novo snapshot: registros existentes assumem o valor aplicado
    //    (resolvido nesta seção ou já sem conflito) ou, se ainda pendentes
    //    numa seção futura, permanecem inalterados — recalculados de novo
    //    quando a vez deles chegar. Registros novos (id só presente na
    //    planilha) já vêm prontos em `registrosSemConflito`.
    const idsExistentes = new Set(registrosAtuais.map((registro) => registro.id));
    const novoSnapshot: EmailRecord[] = [
      ...registrosAtuais.map((registro) => aplicados.get(registro.id) ?? registro),
      ...Array.from(aplicados.values()).filter((registro) => !idsExistentes.has(registro.id)),
    ];

    // `avancar` só é chamada com `secaoAtual !== 'resumo-final'` (o footer
    // troca para `confirmarAtualizacao` nesse caso — ver JSX), mas o tipo
    // `Secao` inclui os dois extremos; a asserção reflete essa garantia.
    const indiceAPartirDe =
      secaoAtual === 'resumo-inicial' ? 0 : ORDEM_SECOES_CONFLITO.indexOf(secaoAtual as TipoSecaoConflito) + 1;
    const proximoResultado = calcularMerge(
      novoSnapshot,
      planilha!.linhas,
      colunasDetectadas,
      TIPOS_CONFLITO_ATUALIZAR_REGISTROS,
      colunaIdNormalizado
    );

    setSnapshot(novoSnapshot);
    setSecaoAtual(proximaSecao(proximoResultado, indiceAPartirDe));
  }

  async function confirmarAtualizacao() {
    if (salvando) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      // Ordem definida na Etapa 8: os registros são persistidos primeiro;
      // a planilha bruta só é sobrescrita depois de `salvarEmails` ter
      // sucesso, para não perder o arquivo anterior caso a gravação dos
      // registros falhe no meio do caminho.
      await salvarEmails(slug, { email: emailAtual, registros: snapshot });
      await enviarSheet(slug, arquivo);
      window.location.reload();
    } catch (erro) {
      setErroSalvar(erro instanceof Error ? erro.message : 'Não foi possível concluir a atualização.');
      setSalvando(false);
    }
  }

  const mostrarConteudo = Boolean(planilha) && !carregando && !erroLeitura;

  const secaoConflitoValida = (() => {
    if (!resultadoAtual) return false;
    if (secaoAtual === 'enviado') {
      return resultadoAtual.conflitos.enviado.every((c) => decisoesEnviado[c.id] !== undefined);
    }
    if (secaoAtual === 'deletado-revivido') {
      return resultadoAtual.conflitos.deletadoRevivido.every((c) => decisoesDeletadoRevivido[c.id] !== undefined);
    }
    if (secaoAtual === 'sumido') {
      return resultadoAtual.conflitos.sumido.every((c) => decisoesSumido[c.id] !== undefined);
    }
    if (secaoAtual === 'atributo-alterado') {
      return resultadoAtual.conflitos.atributoAlterado.every((c) => decisoesAtributoAlterado[c.id] !== undefined);
    }
    return true;
  })();

  return (
    <Dialog
      isOpen
      onClose={solicitarFechamento}
      title="Atualizar registros"
      className="modal-importacao modal-atualizar-registros"
      closeOnEsc={!confirmandoCancelamento}
      footer={
        mostrarConteudo ? (
          <>
            <button type="button" className="dialog-botao-cancelar" onClick={solicitarFechamento} disabled={salvando}>
              Cancelar
            </button>

            {secaoAtual === 'resumo-final' ? (
              <button
                type="button"
                className="dialog-botao-primario"
                onClick={() => void confirmarAtualizacao()}
                disabled={salvando}
              >
                {salvando ? 'Atualizando…' : 'Confirmar atualização'}
              </button>
            ) : (
              <button type="button" className="dialog-botao-primario" onClick={avancar} disabled={!secaoConflitoValida}>
                Avançar
              </button>
            )}
          </>
        ) : undefined
      }
    >
      {carregando && <p className="importacao-status">Lendo planilha selecionada...</p>}

      {erroLeitura && !carregando && (
        <div className="importacao-erro">
          <p>{erroLeitura}</p>
          <button type="button" className="dialog-botao-cancelar" onClick={onFechar}>
            Fechar
          </button>
        </div>
      )}

      {mostrarConteudo && resultadoAtual && (
        <>
          {colunaIdAusenteNaPlanilha && (
            <p className="atualizar-alerta-colunaid-ausente" role="alert">
              A coluna "{colunaId}", usada como identificador deste projeto, não foi encontrada na planilha
              reimportada (pode ter sido renomeada ou removida). Os registros estão sendo casados pela ordem das
              linhas nesta atualização.
            </p>
          )}

          <p className="importacao-stepper-resumo">
            Etapa {ETAPAS.findIndex(({ numero }) => numero === secaoAtual) + 1} de {ETAPAS.length} —{' '}
            {ETAPAS.find(({ numero }) => numero === secaoAtual)?.rotulo}
          </p>

          <ol className="importacao-stepper" aria-hidden="true">
            {ETAPAS.map(({ numero, rotulo }, indice) => {
              const indiceAtual = ETAPAS.findIndex((etapa) => etapa.numero === secaoAtual);
              const concluida = indice < indiceAtual;
              const ativa = numero === secaoAtual;
              return (
                <li
                  key={numero}
                  className={`importacao-stepper-item ${ativa ? 'ativa' : ''} ${concluida ? 'concluida' : ''}`}
                >
                  <span className="importacao-stepper-bolha">
                    {concluida ? <IconeCheck /> : indice + 1}
                  </span>
                  <span className="importacao-stepper-rotulo">{rotulo}</span>
                </li>
              );
            })}
          </ol>

          <div className="importacao-corpo">
            {secaoAtual === 'resumo-inicial' && (
              <ResumoInicial
                nomeArquivo={planilha!.nomeArquivo}
                formato={planilha!.formato}
                tamanhoBytes={planilha!.tamanhoBytes}
                estatisticas={estatisticasPlanilha}
                resultado={resultadoAtual}
                registrosAtuaisPorId={registrosAtuaisPorId}
              />
            )}

            {secaoAtual === 'enviado' && (
              <MergeCampoConflito
                titulo="Registro enviado"
                instrucao="Estes registros já foram marcados como enviados, mas a planilha nova traz um nome ou e-mail diferente. Escolha o que prevalece."
                itens={resultadoAtual.conflitos.enviado.map((c) => ({
                  id: c.id,
                  ours: c.ours,
                  theirs: c.theirs,
                }))}
                rotuloOurs="Manter enviado (ignorar planilha)"
                rotuloTheirs="Desenviar e adotar planilha"
                decisoes={decisoesEnviado}
                onDecisaoChange={(id, decisao) =>
                  setDecisoesEnviado((atual) => ({ ...atual, [id]: decisao as DecisaoEnviado }))
                }
                onDecisaoEmMassa={(decisao) => {
                  const nova: Record<number, DecisaoEnviado> = {};
                  for (const c of resultadoAtual.conflitos.enviado) nova[c.id] = decisao as DecisaoEnviado;
                  setDecisoesEnviado(nova);
                }}
                valorOurs="manter-enviado"
                valorTheirs="desenviar"
              />
            )}

            {secaoAtual === 'deletado-revivido' && (
              <MergeCampoConflito
                titulo="Registro deletado"
                instrucao="Estes registros estão deletados, mas voltaram a aparecer na planilha nova. Escolha se o registro continua deletado ou se deve ser revivido com os dados novos."
                itens={resultadoAtual.conflitos.deletadoRevivido.map((c) => ({
                  id: c.id,
                  ours: c.ours,
                  theirs: c.theirs,
                }))}
                rotuloOurs="Manter deletado"
                rotuloTheirs="Reviver com dados da planilha"
                decisoes={decisoesDeletadoRevivido}
                onDecisaoChange={(id, decisao) =>
                  setDecisoesDeletadoRevivido((atual) => ({ ...atual, [id]: decisao as DecisaoDeletadoRevivido }))
                }
                onDecisaoEmMassa={(decisao) => {
                  const nova: Record<number, DecisaoDeletadoRevivido> = {};
                  for (const c of resultadoAtual.conflitos.deletadoRevivido) {
                    nova[c.id] = decisao as DecisaoDeletadoRevivido;
                  }
                  setDecisoesDeletadoRevivido(nova);
                }}
                valorOurs="manter-deletado"
                valorTheirs="reviver"
              />
            )}

            {secaoAtual === 'sumido' && (
              <RegistrosSumidosSection
                registros={resultadoAtual.conflitos.sumido}
                decisoes={decisoesSumido}
                onDecisaoChange={(id, decisao) => setDecisoesSumido((atual) => ({ ...atual, [id]: decisao }))}
              />
            )}

            {secaoAtual === 'atributo-alterado' && (
              <MergeCampoConflito
                titulo="Atributo alterado"
                instrucao="Estes registros foram editados manualmente e a planilha traz um valor diferente tanto do original quanto do já corrigido. Escolha qual valor prevalece."
                itens={resultadoAtual.conflitos.atributoAlterado.map((c) => ({
                  id: c.id,
                  ours: c.ours,
                  theirs: c.theirs,
                  camposConflitantes: c.camposConflitantes,
                }))}
                rotuloOurs="Manter valor atual"
                rotuloTheirs="Adotar valor da planilha"
                decisoes={decisoesAtributoAlterado}
                onDecisaoChange={(id, decisao) =>
                  setDecisoesAtributoAlterado((atual) => ({ ...atual, [id]: decisao as DecisaoAtributoAlterado }))
                }
                onDecisaoEmMassa={(decisao) => {
                  const nova: Record<number, DecisaoAtributoAlterado> = {};
                  for (const c of resultadoAtual.conflitos.atributoAlterado) {
                    nova[c.id] = decisao as DecisaoAtributoAlterado;
                  }
                  setDecisoesAtributoAlterado(nova);
                }}
                valorOurs="ours"
                valorTheirs="theirs"
              />
            )}

            {secaoAtual === 'resumo-final' && (
              <ResumoFinal registros={snapshot} notas={notasAcumuladas} registrosAtuaisPorId={registrosAtuaisPorId} />
            )}
          </div>

          {erroSalvar && <p className="erro-salvamento">{erroSalvar}</p>}
        </>
      )}

      {confirmandoCancelamento && (
        <ConfirmDialog
          ariaLabel="Confirmar cancelamento da atualização de registros"
          titulo="Deseja cancelar a atualização?"
          descricao="Todo o progresso realizado neste assistente será perdido. Nada será gravado."
          rotuloCancelar="Continuar editando"
          rotuloConfirmar="Cancelar atualização"
          onCancelar={continuarEditando}
          onConfirmar={cancelarAtualizacao}
        />
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Subcomponentes locais                                                */
/* ------------------------------------------------------------------ */

interface ResumoInicialProps {
  nomeArquivo: string;
  formato: 'csv' | 'xlsx';
  tamanhoBytes: number;
  estatisticas: { total: number; validos: number; invalidos: number; duplicados: number };
  resultado: ResultadoMerge;
  registrosAtuaisPorId: Map<number, EmailRecord>;
}

function ResumoInicial({ nomeArquivo, formato, tamanhoBytes, estatisticas, resultado, registrosAtuaisPorId }: ResumoInicialProps) {
  const registrosAtualizados = resultado.registrosSemConflito.filter((registro) => {
    const original = registrosAtuaisPorId.get(registro.id);
    return original && (original.nome !== registro.nome || original.email !== registro.email);
  }).length;
  const registrosNovos = resultado.registrosSemConflito.filter((registro) => !registrosAtuaisPorId.has(registro.id)).length;
  const totalConflitos =
    resultado.conflitos.enviado.length +
    resultado.conflitos.deletadoRevivido.length +
    resultado.conflitos.sumido.length +
    resultado.conflitos.atributoAlterado.length;

  return (
    <div className="etapa-atualizar etapa-revisao">
      <p className="etapa-atualizar-instrucao">Confira as informações abaixo antes de continuar.</p>

      <dl className="revisao-lista">
        <div>
          <dt>Arquivo</dt>
          <dd>{nomeArquivo}</dd>
        </div>
        <div>
          <dt>Formato</dt>
          <dd>.{formato}</dd>
        </div>
        <div>
          <dt>Tamanho do arquivo</dt>
          <dd>{formatarTamanho(tamanhoBytes)}</dd>
        </div>
        <div>
          <dt>Total de registros na planilha</dt>
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
          <dt>Registros que serão atualizados</dt>
          <dd>{registrosAtualizados.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>Registros novos</dt>
          <dd>{registrosNovos.toLocaleString('pt-BR')}</dd>
        </div>
      </dl>

      {totalConflitos > 0 && (
        <p className="atualizar-alerta-conflitos">
          {totalConflitos} registro(s) com conflito serão revisados nas próximas seções.
        </p>
      )}
    </div>
  );
}

interface ResumoFinalProps {
  registros: EmailRecord[];
  notas: { corrigido: NotaCorrigido[]; statusAlterado: NotaStatusAlterado[] };
  registrosAtuaisPorId: Map<number, EmailRecord>;
}

function ResumoFinal({ registros, notas, registrosAtuaisPorId }: ResumoFinalProps) {
  const contagens = {
    válido: registros.filter((r) => r.status === 'válido').length,
    inválido: registros.filter((r) => r.status === 'inválido').length,
    duplicado: registros.filter((r) => r.status === 'duplicado').length,
    deletado: registros.filter((r) => r.status === 'deletado').length,
    enviado: registros.filter((r) => r.status === 'enviado').length,
  };
  const registrosNovos = registros.filter((r) => !registrosAtuaisPorId.has(r.id)).length;

  return (
    <div className="etapa-atualizar etapa-revisao">
      <p className="etapa-atualizar-instrucao">
        Revisão concluída. Confira o resultado final antes de confirmar a atualização.
      </p>

      <dl className="revisao-lista">
        <div>
          <dt>Total de registros</dt>
          <dd>{registros.length.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>Válidos</dt>
          <dd>{contagens.válido.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>Inválidos</dt>
          <dd>{contagens.inválido.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>Duplicados</dt>
          <dd>{contagens.duplicado.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>Deletados</dt>
          <dd>{contagens.deletado.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>Enviados</dt>
          <dd>{contagens.enviado.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>Registros novos</dt>
          <dd>{registrosNovos.toLocaleString('pt-BR')}</dd>
        </div>
      </dl>

      {(notas.corrigido.length > 0 || notas.statusAlterado.length > 0) && (
        <div className="notas-informativas">
          <p className="notas-informativas-titulo">Resolvidos automaticamente:</p>
          <ul>
            {notas.corrigido.map((nota, indice) => (
              <li key={`corrigido-${nota.id}-${indice}`}>
                Registro id {nota.id}: {nota.campos.join(', ')} corrigido(s) — a planilha alcançou a edição manual e
                a proteção foi removida.
              </li>
            ))}
            {notas.statusAlterado.map((nota, indice) => (
              <li key={`status-${nota.id}-${indice}`}>
                Registro id {nota.id}: status mudou automaticamente de {nota.statusAnterior} para {nota.statusNovo}.
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}