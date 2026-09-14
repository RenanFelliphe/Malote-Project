import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { IconeCheck } from '../Icons';
import { Dialog } from '../Dialog';
import { ConfirmDialog } from '../ConfirmDialog';
import { ColunaSeletora } from '../import/ColunaSeletora';
import { parsearPlanilha, type PlanilhaParseada } from '../import/utils/parseSheetBrowser';
import { slugify, slugifyDigitando } from '../import/utils/slugify';
import {
  calcularMerge,
  identificarColunasAutomaticamente,
  TIPOS_CONFLITO_ATUALIZAR_DADOS,
  type NotaCorrigido,
  type NotaStatusAlterado,
  type ResultadoMerge,
} from '../../scripts/utils/calcularMerge';
import { validarColunaId } from '../import/utils/validarColunaId';
import { calcularEmailsDuplicados, normalizeEmail } from '../EmailStatus';
import { MergeCampoConflito } from './MergeCampoConflito';
import type { EmailConteudo, EmailRecord } from '../../types/email';
import { salvarEmails, obterSheet } from '../../services/emailsApi';
import { renomearProjeto } from '../../services/projetosApi';

interface Props {
  slug: string;
  nomeAtual: string;
  registrosAtuais: EmailRecord[];
  emailAtual: EmailConteudo;
  onFechar: () => void;
  /**
   * `colunaId` persistido do projeto (Demanda 7 — Mapeamento de ID
   * Personalizado, Etapa 3). Ausente/`undefined` = "Gerar Automaticamente"
   * (mesmo fallback de `EmailsData.colunaId`). Usado só como valor
   * inicial do seletor local (Etapa 8) — a partir daqui, a escolha em
   * curso vive em `colunaIdSelecionado`, dentro deste componente.
   *
   * Ajuste de rota (fechado): `Header.tsx` repassa esta prop, e
   * `pages/emails.tsx` já passa `colunaId={dados.colunaId}` para
   * `Header.tsx` — cadeia de wiring completa, sem pendências.
   */
  colunaId?: string;
}

/** Adiciona (ao final, ou seja, com menor prioridade) ou remove uma coluna de uma lista de seleção — mesma lógica de `EtapaMapeamento.tsx`. */
function alternarColuna(atual: string[], coluna: string): string[] {
  return atual.includes(coluna) ? atual.filter((c) => c !== coluna) : [...atual, coluna];
}

type DecisaoEnviado = 'manter-enviado' | 'desenviar';
type DecisaoAtributoAlterado = 'ours' | 'theirs';

/**
 * Ordem em cascata das seções de conflito navegáveis neste fluxo — só um
 * subconjunto da taxonomia completa (seção 4 do planner): remapear colunas
 * não adiciona nem remove linhas, então "deletado_revivido" e "sumido"
 * nunca se aplicam aqui (tabela de aplicabilidade, seção 4;
 * `TIPOS_CONFLITO_ATUALIZAR_DADOS`).
 */
type TipoSecaoConflito = 'enviado' | 'atributo-alterado';
const ORDEM_SECOES_CONFLITO: TipoSecaoConflito[] = ['enviado', 'atributo-alterado'];

type Secao = 'projeto' | 'colunas' | TipoSecaoConflito | 'resumo';

const ETAPAS: { numero: Secao; rotulo: string }[] = [
  { numero: 'projeto', rotulo: 'Projeto' },
  { numero: 'colunas', rotulo: 'Colunas' },
  { numero: 'enviado', rotulo: 'Registros enviados' },
  { numero: 'atributo-alterado', rotulo: 'Atributo alterado' },
  { numero: 'resumo', rotulo: 'Resumo' },
];

function quantoAConflitos(resultado: ResultadoMerge, tipo: TipoSecaoConflito): number {
  return tipo === 'enviado' ? resultado.conflitos.enviado.length : resultado.conflitos.atributoAlterado.length;
}

/** Primeira seção de conflito, a partir de `apartirIndice`, que ainda tem pendência em `resultado`. */
function proximaSecao(resultado: ResultadoMerge, apartirIndice: number): Secao {
  for (let indice = apartirIndice; indice < ORDEM_SECOES_CONFLITO.length; indice++) {
    const tipo = ORDEM_SECOES_CONFLITO[indice];
    if (quantoAConflitos(resultado, tipo) > 0) return tipo;
  }
  return 'resumo';
}

/**
 * Assistente do fluxo "Atualizar Dados" (Etapa 7 de
 * AtualizacaoDaPlanilhaViaUI.md) — 3 seções: Projeto (nome de exibição e
 * nome do arquivo/rota), Colunas (remapeamento sem exigir novo upload) e
 * Resumo. Reaproveita o mesmo casco de `AtualizarRegistrosModal` (Dialog
 * com footer fixo e stepper de etapas rotuladas) e o mesmo motor de merge sem estado
 * (`calcularMerge`, Etapa 4), mas com um subconjunto menor de seções de
 * conflito navegáveis — só "Enviado" e "Atributo alterado" se aplicam
 * quando a origem da mudança é um remapeamento de colunas, não uma
 * planilha nova (tabela de aplicabilidade, seção 4 do planner).
 *
 * Diferente de `AtualizarRegistrosModal`, a planilha não vem de um
 * `<input type="file">` — é buscada do servidor (`GET
 * /api/emails/:slug/sheet`, Etapa 1) e reparseada no navegador, para o
 * remapeamento não exigir que o usuário tenha o arquivo original em mãos
 * de novo. `sheet.<ext>` nunca é sobrescrito por este fluxo — remapear
 * colunas é reinterpretar o mesmo arquivo já salvo, não uma reimportação
 * de dados novos (seção 3 do planner).
 *
 * Assunção de implementação (resolvida na Etapa 8): `ColunaSeletora`
 * (`../import/ColunaSeletora`) foi inicialmente usado aqui com uma
 * assinatura de props inferida do uso em `EtapaMapeamento.tsx`, já que o
 * arquivo real não fazia parte dos "Arquivos Necessários" desta demanda.
 * O arquivo real chegou (entrega da Etapa 6) e a assinatura inferida
 * bateu exatamente: `titulo`, `headers`, `selecionadas`, `busca`,
 * `onBuscaChange`, `onAlternarColuna`, `onReordenar`, `idPrefix`, mais o
 * prop opcional `colunasExcluidas` (Etapa 6) — agora também usado aqui,
 * junto com o seletor de ID e a exclusividade de 3 vias.
 *
 * Seção "Projeto": mesma lógica de acompanhamento automático de slug de
 * `EtapaInformacoes.tsx` (o nome do arquivo acompanha o nome do projeto
 * até ser editado manualmente). Sem checagem em tempo real de colisão de
 * slug (a versão do wizard de importação usa uma lista de projetos em
 * memória, não disponível aqui) — a validação real acontece no servidor
 * ao confirmar (`PATCH /api/projetos/:slug`), com o erro exibido no
 * resumo final.
 *
 * Ajuste de rota: sem suporte a "Voltar" entre seções — mesmo motivo de
 * `AtualizarRegistrosModal` (cada "Avançar" aplica decisões/recalcula o
 * snapshot, desfazer exigiria pilha de snapshots).
 */
export function AtualizarDadosModal({
  slug,
  nomeAtual,
  registrosAtuais,
  emailAtual,
  onFechar,
  colunaId,
}: Props) {
  const navigate = useNavigate();

  const [secaoAtual, setSecaoAtual] = useState<Secao>('projeto');

  // --- Seção "Projeto" ---
  const [nomeProjeto, setNomeProjeto] = useState(nomeAtual);
  const [nomeArquivoSlug, setNomeArquivoSlug] = useState(slug);
  const [nomeArquivoEditadoManualmente, setNomeArquivoEditadoManualmente] = useState(false);

  // --- Seção "Colunas" ---
  const [planilha, setPlanilha] = useState<PlanilhaParseada | null>(null);
  const [carregandoPlanilha, setCarregandoPlanilha] = useState(true);
  const [erroCarregarPlanilha, setErroCarregarPlanilha] = useState<string | null>(null);
  const [colunasNome, setColunasNome] = useState<string[]>([]);
  const [colunasEmail, setColunasEmail] = useState<string[]>([]);
  const [buscaColunasNome, setBuscaColunasNome] = useState('');
  const [buscaColunasEmail, setBuscaColunasEmail] = useState('');
  // Demanda 7 (Mapeamento de ID Personalizado, Etapa 8): estado local
  // editável, inicializado a partir do `colunaId` persistido do projeto
  // (prop) — mesma relação entre prop/estado local que `colunasNome` teria
  // se viesse pré-preenchida em vez de detectada automaticamente.
  const [colunaIdSelecionado, setColunaIdSelecionado] = useState<string | null>(colunaId ?? null);

  // --- Cascata de conflitos + resultado ---
  const [snapshot, setSnapshot] = useState<EmailRecord[]>(registrosAtuais);
  const [decisoesEnviado, setDecisoesEnviado] = useState<Record<string, DecisaoEnviado>>({});
  const [decisoesAtributoAlterado, setDecisoesAtributoAlterado] = useState<Record<string, DecisaoAtributoAlterado>>(
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

    obterSheet(slug)
      .then((arquivo) => parsearPlanilha(arquivo))
      .then((resultado) => {
        if (cancelado) return;
        setPlanilha(resultado);
        const automaticas = identificarColunasAutomaticamente(resultado.headers);
        setColunasNome(automaticas.nome);
        setColunasEmail(automaticas.email);
      })
      .catch((erro: unknown) => {
        if (!cancelado) {
          setErroCarregarPlanilha(
            erro instanceof Error ? erro.message : 'Não foi possível carregar a planilha já salva deste projeto.'
          );
        }
      })
      .finally(() => {
        if (!cancelado) setCarregandoPlanilha(false);
      });

    return () => {
      cancelado = true;
    };
  }, [slug]);

  const registrosAtuaisPorId = useMemo(
    () => new Map(registrosAtuais.map((registro) => [registro.id, registro])),
    [registrosAtuais]
  );

  const colunasSelecionadas = useMemo(
    () => ({ nome: colunasNome, email: colunasEmail }),
    [colunasNome, colunasEmail]
  );

  /**
   * Estado derivado de "colunas em uso" + exclusividade de 3 vias
   * (Demanda 7 — Mapeamento de ID Personalizado, Etapa 8) — mesma forma e
   * lógica de `EtapaMapeamento.tsx` (Etapas 4/6), reaproveitada aqui para
   * a seção "Colunas" deste fluxo.
   */
  const colunasEmUso = useMemo<Record<'id' | 'nome' | 'email', string[]>>(
    () => ({
      id: colunaIdSelecionado ? [colunaIdSelecionado] : [],
      nome: colunasNome,
      email: colunasEmail,
    }),
    [colunaIdSelecionado, colunasNome, colunasEmail]
  );

  const colunasExcluidas = useMemo<Record<'id' | 'nome' | 'email', string[]>>(
    () => ({
      id: [...colunasEmUso.nome, ...colunasEmUso.email],
      nome: [...colunasEmUso.id, ...colunasEmUso.email],
      email: [...colunasEmUso.id, ...colunasEmUso.nome],
    }),
    [colunasEmUso]
  );

  const opcoesColunaId = useMemo(
    () => (planilha ? planilha.headers.filter((coluna) => !colunasExcluidas.id.includes(coluna)) : []),
    [planilha, colunasExcluidas.id]
  );

  const validacaoColunaId = useMemo(
    () => (planilha ? validarColunaId(planilha.linhas, colunaIdSelecionado) : { valido: true }),
    [planilha, colunaIdSelecionado]
  );

  function handleColunaIdChange(valor: string) {
    setColunaIdSelecionado(valor === '' ? null : valor);
  }

  const resultadoAtual = useMemo<ResultadoMerge | null>(() => {
    if (!planilha) return null;
    return calcularMerge(
      snapshot,
      planilha.linhas,
      colunasSelecionadas,
      TIPOS_CONFLITO_ATUALIZAR_DADOS,
      colunaIdSelecionado
    );
  }, [planilha, snapshot, colunasSelecionadas, colunaIdSelecionado]);

  function handleNomeProjetoChange(valor: string) {
    if (nomeArquivoEditadoManualmente) {
      setNomeProjeto(valor);
    } else {
      setNomeProjeto(valor);
      setNomeArquivoSlug(slugify(valor));
    }
  }

  function handleNomeArquivoChange(valor: string) {
    setNomeArquivoSlug(slugifyDigitando(valor));
    setNomeArquivoEditadoManualmente(true);
  }

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
   * — mesma responsabilidade documentada no cabeçalho de `calcularMerge.ts`
   * e já implementada em `AtualizarRegistrosModal.avancar`.
   */
  function avancar() {
    if (secaoAtual === 'projeto') {
      setSecaoAtual('colunas');
      return;
    }

    if (!resultadoAtual || !planilha) return;

    setNotasAcumuladas((atual) => ({
      corrigido: [...atual.corrigido, ...resultadoAtual.notas.corrigido],
      statusAlterado: [...atual.statusAlterado, ...resultadoAtual.notas.statusAlterado],
    }));

    const aplicados = new Map<string, EmailRecord>(
      resultadoAtual.registrosSemConflito.map((registro) => [registro.id, registro])
    );

    const agora = new Date().toISOString();

    if (secaoAtual === 'enviado') {
      for (const conflito of resultadoAtual.conflitos.enviado) {
        const original = registrosAtuaisPorId.get(conflito.id);
        if (!original) continue;
        const decisao = decisoesEnviado[conflito.id];
        if (decisao === 'desenviar') {
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
    } else if (secaoAtual === 'atributo-alterado') {
      for (const conflito of resultadoAtual.conflitos.atributoAlterado) {
        const original = registrosAtuaisPorId.get(conflito.id);
        if (!original) continue;
        const decisao = decisoesAtributoAlterado[conflito.id];
        if (decisao === 'theirs') {
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
          aplicados.set(conflito.id, original);
        }
      }
    }
    // 'colunas': nenhuma decisão por registro — só recalcula com o novo mapeamento.

    const novoSnapshot: EmailRecord[] = registrosAtuais.map((registro) => aplicados.get(registro.id) ?? registro);

    const indiceAPartirDe =
      secaoAtual === 'colunas' ? 0 : ORDEM_SECOES_CONFLITO.indexOf(secaoAtual as TipoSecaoConflito) + 1;
    const proximoResultado = calcularMerge(
      novoSnapshot,
      planilha.linhas,
      colunasSelecionadas,
      TIPOS_CONFLITO_ATUALIZAR_DADOS,
      colunaIdSelecionado
    );

    setSnapshot(novoSnapshot);
    setSecaoAtual(proximaSecao(proximoResultado, indiceAPartirDe));
  }

  /**
   * Ao confirmar: se o nome do arquivo/rota mudou, renomeia via `PATCH
   * /api/projetos/:slug` (Etapa 3) primeiro — o slug devolvido pelo
   * servidor é usado no `PUT` seguinte e no redirecionamento. Se só o
   * nome de exibição mudou (ou nada mudou na seção Projeto), o `PUT`
   * sozinho já basta. `sheet.<ext>` nunca é tocado por este fluxo.
   */
  async function confirmarAtualizacao() {
    if (salvando) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      let slugFinal = slug;
      if (nomeArquivoSlug !== slug) {
        slugFinal = await renomearProjeto(slug, nomeArquivoSlug);
      }

      await salvarEmails(slugFinal, {
        email: emailAtual,
        registros: snapshot,
        projeto: nomeProjeto,
        // Demanda 7 — Mapeamento de ID Personalizado, Etapa 8: regrava
        // `EmailsData.colunaId` com a escolha feita nesta sessão
        // (`colunaIdSelecionado`), fechando a lacuna registrada na entrega
        // anterior — antes, só o merge em curso usava esse valor; a troca
        // não sobrevivia ao fechar o modal.
        colunaId: colunaIdSelecionado,
      });

      if (slugFinal !== slug) {
        navigate(`/projetos/${slugFinal}`);
      } else {
        window.location.reload();
      }
    } catch (erro) {
      setErroSalvar(erro instanceof Error ? erro.message : 'Não foi possível concluir a atualização.');
      setSalvando(false);
    }
  }

  const avancarHabilitado = (() => {
    if (secaoAtual === 'projeto') return nomeProjeto.trim() !== '' && nomeArquivoSlug.trim() !== '';
    if (secaoAtual === 'colunas') {
      return (
        !carregandoPlanilha &&
        !erroCarregarPlanilha &&
        colunasNome.length > 0 &&
        colunasEmail.length > 0 &&
        validacaoColunaId.valido
      );
    }
    if (!resultadoAtual) return false;
    if (secaoAtual === 'enviado') {
      return resultadoAtual.conflitos.enviado.every((c) => decisoesEnviado[c.id] !== undefined);
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
      title="Atualizar dados"
      className="modal-importacao modal-atualizar-dados"
      closeOnEsc={!confirmandoCancelamento}
      footer={
        <>
          <button type="button" className="dialog-botao-cancelar" onClick={solicitarFechamento} disabled={salvando}>
            Cancelar
          </button>

          {secaoAtual === 'resumo' ? (
            <button
              type="button"
              className="dialog-botao-primario"
              onClick={() => void confirmarAtualizacao()}
              disabled={salvando}
            >
              {salvando ? 'Atualizando…' : 'Confirmar atualização'}
            </button>
          ) : (
            <button type="button" className="dialog-botao-primario" onClick={avancar} disabled={!avancarHabilitado}>
              Avançar
            </button>
          )}
        </>
      }
    >
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
        {secaoAtual === 'projeto' && (
          <div className="etapa-atualizar etapa-informacoes">
            <p className="etapa-atualizar-instrucao">
              Ajuste o nome de exibição e o nome do arquivo/rota deste projeto.
            </p>

            <div className="campo-formulario">
              <label htmlFor="atualizar-dados-nome-projeto">Nome do projeto</label>
              <input
                id="atualizar-dados-nome-projeto"
                type="text"
                value={nomeProjeto}
                onChange={(e) => handleNomeProjetoChange(e.target.value)}
                autoFocus
              />
            </div>

            <div className="campo-formulario">
              <label htmlFor="atualizar-dados-nome-arquivo">Nome do arquivo</label>
              <input
                id="atualizar-dados-nome-arquivo"
                type="text"
                value={nomeArquivoSlug}
                onChange={(e) => handleNomeArquivoChange(e.target.value)}
              />
              <p className="preview-url">
                /projetos/<strong>{nomeArquivoSlug || '...'}</strong>
                {nomeArquivoSlug !== slug && ' (rota vai mudar ao confirmar)'}
              </p>
            </div>
          </div>
        )}

        {secaoAtual === 'colunas' && (
          <div className="etapa-atualizar etapa-mapeamento">
            <p className="etapa-mapeamento-instrucao">
              Selecione quais colunas da planilha já salva deste projeto representam o nome e o e-mail de cada
              registro. Não é preciso enviar o arquivo de novo.
            </p>

            {carregandoPlanilha && <p className="importacao-status">Carregando planilha salva do projeto...</p>}

            {erroCarregarPlanilha && !carregandoPlanilha && (
              <div className="importacao-erro">
                <p>{erroCarregarPlanilha}</p>
              </div>
            )}

            {planilha && !carregandoPlanilha && !erroCarregarPlanilha && (
              <div className="etapa-mapeamento-secoes">
                <div className="etapa-mapeamento-secao">
                  <ColunaSeletora
                    titulo="Colunas de Nome"
                    headers={planilha.headers}
                    selecionadas={colunasNome}
                    busca={buscaColunasNome}
                    onBuscaChange={setBuscaColunasNome}
                    onAlternarColuna={(coluna) => setColunasNome((atual) => alternarColuna(atual, coluna))}
                    onReordenar={setColunasNome}
                    idPrefix="atualizar-dados-col-nome"
                    colunasExcluidas={colunasExcluidas.nome}
                  />
                </div>

                <div className="etapa-mapeamento-secao">
                  <ColunaSeletora
                    titulo="Colunas de E-mail"
                    headers={planilha.headers}
                    selecionadas={colunasEmail}
                    busca={buscaColunasEmail}
                    onBuscaChange={setBuscaColunasEmail}
                    onAlternarColuna={(coluna) => setColunasEmail((atual) => alternarColuna(atual, coluna))}
                    onReordenar={setColunasEmail}
                    idPrefix="atualizar-dados-col-email"
                    colunasExcluidas={colunasExcluidas.email}
                  />
                </div>

                <div className="etapa-mapeamento-secao etapa-mapeamento-secao-id">
                  <h3>Coluna de ID</h3>
                  <p className="etapa-mapeamento-secao-id-descricao">
                    Opcional. Define qual coluna identifica cada registro nesta e nas próximas
                    importações/atualizações. Se não escolher nenhuma, o ID é a ordem da linha na
                    planilha.
                  </p>

                  <select
                    id="atualizar-dados-select-id"
                    aria-label="Coluna de ID"
                    value={colunaIdSelecionado ?? ''}
                    onChange={(e) => handleColunaIdChange(e.target.value)}
                    aria-invalid={!validacaoColunaId.valido}
                    aria-describedby={!validacaoColunaId.valido ? 'atualizar-dados-erro-coluna-id' : undefined}
                  >
                    <option value="">Gerar Automaticamente</option>
                    {opcoesColunaId.map((coluna) => (
                      <option key={coluna} value={coluna}>
                        {coluna}
                      </option>
                    ))}
                  </select>

                  {!validacaoColunaId.valido && (
                    <p id="atualizar-dados-erro-coluna-id" className="etapa-mapeamento-erro-bloqueante" role="alert">
                      {validacaoColunaId.erro}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {secaoAtual === 'enviado' && resultadoAtual && (
          <MergeCampoConflito
            titulo="Registro enviado"
            instrucao="Estes registros já foram marcados como enviados, mas o novo mapeamento de colunas traz um nome ou e-mail diferente. Escolha o que prevalece."
            itens={resultadoAtual.conflitos.enviado.map((c) => ({ id: c.id, ours: c.ours, theirs: c.theirs }))}
            rotuloOurs="Manter enviado (ignorar planilha)"
            rotuloTheirs="Desenviar e adotar planilha"
            decisoes={decisoesEnviado}
            onDecisaoChange={(id, decisao) =>
              setDecisoesEnviado((atual) => ({ ...atual, [id]: decisao as DecisaoEnviado }))
            }
            onDecisaoEmMassa={(decisao) => {
              const nova: Record<string, DecisaoEnviado> = {};
              for (const c of resultadoAtual.conflitos.enviado) nova[c.id] = decisao as DecisaoEnviado;
              setDecisoesEnviado(nova);
            }}
            valorOurs="manter-enviado"
            valorTheirs="desenviar"
          />
        )}

        {secaoAtual === 'atributo-alterado' && resultadoAtual && (
          <MergeCampoConflito
            titulo="Atributo alterado"
            instrucao="Estes registros foram editados manualmente e o novo mapeamento de colunas traz um valor diferente tanto do original quanto do já corrigido. Escolha qual valor prevalece."
            itens={resultadoAtual.conflitos.atributoAlterado.map((c) => ({
              id: c.id,
              ours: c.ours,
              theirs: c.theirs,
              camposConflitantes: c.camposConflitantes,
            }))}
            rotuloOurs="Manter valor atual"
            rotuloTheirs="Adotar valor recalculado"
            decisoes={decisoesAtributoAlterado}
            onDecisaoChange={(id, decisao) =>
              setDecisoesAtributoAlterado((atual) => ({ ...atual, [id]: decisao as DecisaoAtributoAlterado }))
            }
            onDecisaoEmMassa={(decisao) => {
              const nova: Record<string, DecisaoAtributoAlterado> = {};
              for (const c of resultadoAtual.conflitos.atributoAlterado) {
                nova[c.id] = decisao as DecisaoAtributoAlterado;
              }
              setDecisoesAtributoAlterado(nova);
            }}
            valorOurs="ours"
            valorTheirs="theirs"
          />
        )}

        {secaoAtual === 'resumo' && (
          <ResumoFinal
            nomeProjetoOriginal={nomeAtual}
            nomeProjetoFinal={nomeProjeto}
            slugOriginal={slug}
            slugFinal={nomeArquivoSlug}
            colunasNome={colunasNome}
            colunasEmail={colunasEmail}
            registros={snapshot}
            notas={notasAcumuladas}
            registrosAtuaisPorId={registrosAtuaisPorId}
          />
        )}
      </div>

      {erroSalvar && <p className="erro-salvamento">{erroSalvar}</p>}

      {confirmandoCancelamento && (
        <ConfirmDialog
          ariaLabel="Confirmar cancelamento da atualização de dados"
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

interface ResumoFinalProps {
  nomeProjetoOriginal: string;
  nomeProjetoFinal: string;
  slugOriginal: string;
  slugFinal: string;
  colunasNome: string[];
  colunasEmail: string[];
  registros: EmailRecord[];
  notas: { corrigido: NotaCorrigido[]; statusAlterado: NotaStatusAlterado[] };
  registrosAtuaisPorId: Map<string, EmailRecord>;
}

function ResumoFinal({
  nomeProjetoOriginal,
  nomeProjetoFinal,
  slugOriginal,
  slugFinal,
  colunasNome,
  colunasEmail,
  registros,
  notas,
  registrosAtuaisPorId,
}: ResumoFinalProps) {
  // Duplicidade não é mais um status (Etapa 1 de `RefatoracaoSistemadeDuplicatas.md`)
  // — conta-se aqui, entre os registros ativos, quantos têm um e-mail que
  // aparece em mais de um registro (Etapa 2).
  const emailsDuplicados = calcularEmailsDuplicados(registros);
  const contagens = {
    válido: registros.filter((r) => r.status === 'válido').length,
    inválido: registros.filter((r) => r.status === 'inválido').length,
    duplicado: registros.filter(
      (r) => r.status !== 'deletado' && !!r.email && emailsDuplicados.has(normalizeEmail(r.email))
    ).length,
    deletado: registros.filter((r) => r.status === 'deletado').length,
    enviado: registros.filter((r) => r.status === 'enviado').length,
  };
  const registrosAtualizados = registros.filter((registro) => {
    const original = registrosAtuaisPorId.get(registro.id);
    return original && (original.nome !== registro.nome || original.email !== registro.email);
  }).length;

  return (
    <div className="etapa-atualizar etapa-revisao">
      <p className="etapa-atualizar-instrucao">
        Revisão concluída. Confira o resultado final antes de confirmar a atualização.
      </p>

      <dl className="revisao-lista">
        <div>
          <dt>Nome do projeto</dt>
          <dd>
            {nomeProjetoFinal}
            {nomeProjetoFinal !== nomeProjetoOriginal && ` (antes: ${nomeProjetoOriginal})`}
          </dd>
        </div>
        <div>
          <dt>Nome do arquivo</dt>
          <dd>
            {slugFinal}
            {slugFinal !== slugOriginal && ` (antes: ${slugOriginal})`}
          </dd>
        </div>
        <div>
          <dt>URL do projeto</dt>
          <dd>
            <code>/projetos/{slugFinal}</code>
          </dd>
        </div>
        <div>
          <dt>Coluna(s) de Nome (por prioridade)</dt>
          <dd>
            <ol className="revisao-prioridade-lista">
              {colunasNome.map((coluna) => (
                <li key={coluna}>{coluna}</li>
              ))}
            </ol>
          </dd>
        </div>
        <div>
          <dt>Coluna(s) de E-mail (por prioridade)</dt>
          <dd>
            <ol className="revisao-prioridade-lista">
              {colunasEmail.map((coluna) => (
                <li key={coluna}>{coluna}</li>
              ))}
            </ol>
          </dd>
        </div>
        <div>
          <dt>Registros com nome/e-mail recalculado</dt>
          <dd>{registrosAtualizados.toLocaleString('pt-BR')}</dd>
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
      </dl>

      {(notas.corrigido.length > 0 || notas.statusAlterado.length > 0) && (
        <div className="notas-informativas">
          <p className="notas-informativas-titulo">Resolvidos automaticamente:</p>
          <ul>
            {notas.corrigido.map((nota, indice) => (
              <li key={`corrigido-${nota.id}-${indice}`}>
                Registro id {nota.id}: {nota.campos.join(', ')} corrigido(s) — o novo mapeamento alcançou a edição
                manual e a proteção foi removida.
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