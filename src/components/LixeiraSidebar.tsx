import { useCallback, useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import { FiRotateCcw, FiSearch } from 'react-icons/fi';

import { CheckboxCustomizado } from './CheckboxCustomizado';
import { ConfirmDialog } from './ConfirmDialog';
import { ConflitoRestauracaoModal } from './ConflitoRestauracaoModal';
import { IconeLixeira } from './Icons';
import {
  excluirPermanentemente,
  listarLixeira,
  restaurarProjetos,
  type ItemLixeira,
  type ResultadoRestauracaoProjeto,
} from '../services/lixeiraApi';

interface Props {
  /** Controla a abertura do `Drawer` — estado (`sidebarLixeiraAberta`) vive em `home.tsx`. */
  aberto: boolean;
  /** Chamado ao fechar (clique fora, Esc, ou clique no próprio botão flutuante de novo). */
  onFechar: () => void;
  /**
   * Notifica `home.tsx` a cada listagem bem-sucedida, para o badge de
   * contagem do botão flutuante — que precisa do número mesmo antes do
   * primeiro clique, então esta sidebar já busca a lista ao montar,
   * independente de `aberto`.
   */
  onContagemAtualizada?: (contagem: number) => void;
}

/** Formata `deletado_em` (ISO) para exibição — dia/mês/ano + hora, padrão BR. */
const formatadorDataExclusao = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Sidebar da Lixeira (Etapa 7 de implementacaoDelecao.md) — abre a partir do
 * botão flutuante em `home.tsx`, canto inferior esquerdo. Usa `Drawer` da
 * biblioteca `vaul` (`direction="left"`), única dependência nova desta
 * revisão (ver seção 2 do plano): cobre de fábrica sobreposição sem
 * empurrar layout, fechamento por clique fora/Esc e foco básico, sem
 * precisar reimplementar isso à mão como `Dialog.tsx` faz para modais
 * centrais.
 *
 * A partir da Etapa 8, cada item ganha uma checkbox de seleção; com pelo
 * menos um item selecionado, uma barra interna (abaixo da lista) mostra a
 * contagem e o botão "Restaurar" — mesmo fluxo para restauração individual
 * (um item selecionado) e em lote, via `restaurarProjetos` (sempre em lote,
 * seção 2 do plano). Itens que voltam marcados como conflito (slug já
 * ativo) permanecem na lista, selecionados, com um aviso.
 *
 * A partir da Etapa 9, cada conflito devolvido pelo lote é enfileirado em
 * `conflitosPendentes`: o primeiro da fila abre `ConflitoRestauracaoModal`
 * (renderizado como irmão do `Drawer`, não dentro dele — os dois se
 * sobrepõem sem problema, cada um com seu próprio overlay). Resolver um
 * conflito remove só aquele item da fila e recarrega a lixeira; se ainda
 * restar mais de um conflito no mesmo lote, o próximo modal abre em
 * seguida, sem precisar de uma nova tentativa de "Restaurar".
 *
 * A partir da Etapa 10, cada item ganha um botão de exclusão permanente
 * (ícone `IconeLixeira`), e a barra de seleção ganha um segundo botão ao
 * lado de "Restaurar". Os dois casos — individual e em lote — convergem
 * para o mesmo estado (`confirmacaoExclusao`, a lista de slugs pendente de
 * confirmação) e o mesmo `ConfirmDialog`, espelhando o padrão já usado para
 * o soft delete em `home.tsx`/`Header.tsx` (Etapa 5 de
 * `implementacaoDelecao.md`). "Esvaziar lixeira" reaproveita o mesmo fluxo
 * em lote, só que pré-selecionando todos os itens carregados.
 */
export function LixeiraSidebar({ aberto, onFechar, onContagemAtualizada }: Props) {
  const [itens, setItens] = useState<ItemLixeira[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [termoBusca, setTermoBusca] = useState('');
  const [slugsSelecionados, setSlugsSelecionados] = useState<Set<string>>(new Set());
  const [restaurando, setRestaurando] = useState(false);
  const [erroRestauracao, setErroRestauracao] = useState<string | null>(null);
  // Fila de conflitos de restauração (Etapa 9) — cada item tem `conflito`
  // preenchido (ver `ResultadoRestauracaoProjeto`, Etapa 8). Só o primeiro
  // da fila é exibido por vez, num `ConflitoRestauracaoModal`.
  const [conflitosPendentes, setConflitosPendentes] = useState<ResultadoRestauracaoProjeto[]>([]);
  const [confirmacaoRestauracao, setConfirmacaoRestauracao] = useState<string[] | null>(null);
  // Exclusão permanente (Etapa 10) — `confirmacaoExclusao` guarda o lote
  // pendente de confirmação (`null` quando o `ConfirmDialog` está fechado);
  // tanto o botão por item quanto o da barra de seleção e "Esvaziar
  // lixeira" só preenchem esse estado, convergindo para o mesmo
  // `handleConfirmarExclusaoPermanente`.
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState<string[] | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const carregarLixeira = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await listarLixeira();
      setItens(dados);
      onContagemAtualizada?.(dados.length);
      // Itens que desapareceram da listagem (restaurados, expurgados por
      // expiração — Etapa 6) não fazem mais sentido selecionados.
      setSlugsSelecionados((atual) => {
        const slugsAtuais = new Set(dados.map((item) => item.slug));
        const novo = new Set([...atual].filter((slug) => slugsAtuais.has(slug)));
        return novo.size === atual.size ? atual : novo;
      });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível carregar a lixeira.');
    } finally {
      setCarregando(false);
    }
  }, [onContagemAtualizada]);

  // Carrega uma vez ao montar: o botão flutuante em `home.tsx` precisa da
  // contagem para o badge mesmo antes do primeiro clique em "abrir".
  useEffect(() => {
    let cancelado = false;
    queueMicrotask(() => {
      if (!cancelado) void carregarLixeira();
    });
    return () => {
      cancelado = true;
    };
  }, [carregarLixeira]);

  // Recarrega a cada abertura — `diasRestantes` muda com o tempo, e o
  // expurgo de itens vencidos (Etapa 6) só acontece a cada chamada da rota,
  // então reabrir é a chance natural de refletir isso na lista.
  useEffect(() => {
    if (!aberto) return;

    let cancelado = false;
    queueMicrotask(() => {
      if (!cancelado) void carregarLixeira();
    });
    return () => {
      cancelado = true;
    };
  }, [aberto, carregarLixeira]);

  // Fechar a sidebar limpa a seleção e qualquer erro de restauração
  // pendente — reabrir começa do zero, não com o estado de uma sessão
  // anterior de seleção.
  useEffect(() => {
    if (aberto) return;

    let cancelado = false;
    queueMicrotask(() => {
      if (cancelado) return;
      setSlugsSelecionados(new Set());
      setErroRestauracao(null);
      setErroExclusao(null);
      setConfirmacaoExclusao(null);
      setConfirmacaoRestauracao(null);
    });
    return () => {
      cancelado = true;
    };
  }, [aberto]);

  function alternarSelecaoItem(slug: string) {
    setSlugsSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(slug)) {
        novo.delete(slug);
      } else {
        novo.add(slug);
      }
      return novo;
    });
  }

  /**
   * Restaura o(s) item(ns) selecionado(s) (Etapa 8) — mesmo botão para o
   * caso individual (um único item selecionado) e em lote, já que
   * `restaurarProjetos` sempre envia `{ slugs }`. Itens restaurados com
   * sucesso somem da lixeira (recarregada ao final); itens em conflito
   * (slug já ativo) permanecem selecionados, com um aviso — resolução de
   * fato é a Etapa 9 (`ConflitoRestauracaoModal`), ainda não implementada.
   */
  async function handleRestaurar() {
    if (slugsSelecionados.size === 0) return;

    setRestaurando(true);
    setErroRestauracao(null);

    try {
      const resultados = await restaurarProjetos([...slugsSelecionados]);
      const conflitos = resultados.filter((resultado) => resultado.conflito);
      const outrasFalhas = resultados.filter((resultado) => !resultado.ok && !resultado.conflito);

      if (conflitos.length > 0) {
        setSlugsSelecionados(new Set(conflitos.map((resultado) => resultado.slug)));
        setConflitosPendentes(conflitos);
        setErroRestauracao(
          conflitos.length === 1
            ? 'Não foi possível restaurar: já existe um projeto ativo com esse nome.'
            : `Não foi possível restaurar ${conflitos.length} planilha(s): já existe um projeto ativo com o mesmo nome.`
        );
      } else if (outrasFalhas.length > 0) {
        setErroRestauracao(outrasFalhas[0].error ?? 'Não foi possível restaurar uma ou mais planilhas selecionadas.');
      } else {
        setSlugsSelecionados(new Set());
      }

      await carregarLixeira();
    } catch (err) {
      setErroRestauracao(err instanceof Error ? err.message : 'Não foi possível restaurar as planilhas selecionadas.');
    } finally {
      setRestaurando(false);
    }
  }

  function abrirConfirmarRestauracao() {
    if (slugsSelecionados.size === 0) return;
    setConfirmacaoRestauracao([...slugsSelecionados]);
  }

  async function handleConfirmarRestauracao() {
    if (!confirmacaoRestauracao) return;
    setConfirmacaoRestauracao(null);
    await handleRestaurar();
  }

  /**
   * Chamado pelo `ConflitoRestauracaoModal` (Etapa 9) após renomear e
   * restaurar com sucesso. Remove só esse item da fila de conflitos — se
   * ainda restarem outros do mesmo lote, o próximo modal abre em seguida —
   * e recarrega a lixeira (o item resolvido já saiu dela).
   */
  function handleConflitoResolvido(slugResolvido: string) {
    const restante = conflitosPendentes.filter((resultado) => resultado.slug !== slugResolvido);
    setConflitosPendentes(restante);
    if (restante.length === 0) {
      setErroRestauracao(null);
    }
    void carregarLixeira();
  }

  /**
   * "Cancelar" do modal de conflito — só tira este item da fila, sem
   * resolver nada. O item continua selecionado na sidebar com o aviso de
   * conflito (`erroRestauracao`), do jeito que já ficava antes da Etapa 9;
   * o usuário pode reabrir o modal clicando em "Restaurar" de novo.
   */
  function handleConflitoCancelado(slugCancelado: string) {
    setConflitosPendentes((atual) => atual.filter((resultado) => resultado.slug !== slugCancelado));
  }

  /**
   * Abre a confirmação de exclusão permanente (Etapa 10) para um lote de
   * slugs — um único item (botão por linha) ou vários (barra de seleção /
   * "Esvaziar lixeira"). Não decide sozinho o texto do `ConfirmDialog`:
   * isso é derivado de `confirmacaoExclusao` no render, já que depende do
   * nome do item quando o lote tem exatamente um slug.
   */
  function abrirConfirmarExclusao(slugs: string[]) {
    setErroExclusao(null);
    setConfirmacaoExclusao(slugs);
  }

  /**
   * "Esvaziar lixeira" — seleciona todos os itens carregados (refletido
   * visualmente nas checkboxes, já que reaproveita `slugsSelecionados`) e
   * abre a mesma confirmação em lote. Não existe um endpoint dedicado: é o
   * mesmo `DELETE /api/lixeira` com todos os slugs de uma vez.
   */
  function handleEsvaziarLixeira() {
    const todosOsSlugs = itens.map((item) => item.slug);
    setSlugsSelecionados(new Set(todosOsSlugs));
    abrirConfirmarExclusao(todosOsSlugs);
  }

  /**
   * Confirma a exclusão permanente do lote pendente em `confirmacaoExclusao`
   * via `excluirPermanentemente` (Etapa 10) — mesmo padrão de tratamento de
   * falha parcial de `handleConfirmarDelecaoLote` (`home.tsx`, Etapa 5): a
   * primeira falha do lote vira a mensagem de erro exibida, mas o lote
   * inteiro já foi processado no servidor (cada slug é independente). Em
   * sucesso (parcial ou total), os slugs excluídos somem da seleção e a
   * lixeira é recarregada — o que falhou permanece na lista e selecionado,
   * para nova tentativa.
   */
  async function handleConfirmarExclusaoPermanente() {
    if (!confirmacaoExclusao) return;
    const slugsParaExcluir = confirmacaoExclusao;
    setConfirmacaoExclusao(null);
    setExcluindo(true);
    setErroExclusao(null);

    try {
      const resultados = await excluirPermanentemente(slugsParaExcluir);
      const falhas = new Set(resultados.filter((resultado) => !resultado.ok).map((resultado) => resultado.slug));
      const primeiraFalha = resultados.find((resultado) => !resultado.ok);

      setSlugsSelecionados((atual) => {
        const novo = new Set(atual);
        for (const slug of slugsParaExcluir) {
          if (!falhas.has(slug)) novo.delete(slug);
        }
        return novo;
      });

      if (primeiraFalha) {
        setErroExclusao(
          resultados.length === 1
            ? primeiraFalha.error ?? 'Não foi possível excluir permanentemente a planilha.'
            : 'Não foi possível excluir permanentemente uma ou mais planilhas selecionadas.'
        );
      }

      await carregarLixeira();
    } catch (err) {
      setErroExclusao(err instanceof Error ? err.message : 'Não foi possível excluir permanentemente as planilhas selecionadas.');
    } finally {
      setExcluindo(false);
    }
  }

  const termoNormalizado = termoBusca.trim().toLowerCase();
  const itensFiltrados =
    termoNormalizado === ''
      ? itens
      : itens.filter((item) => item.projeto.toLowerCase().includes(termoNormalizado));

  // Primeiro conflito da fila (Etapa 9) — só ele é exibido por vez.
  const conflitoAtual = conflitosPendentes[0];

  // Texto do `ConfirmDialog` de exclusão permanente (Etapa 10) — singular
  // com o nome da planilha quando o lote tem exatamente um slug, plural com
  // a contagem nos demais casos, seguindo literalmente o texto do plano.
  const nomeParaExclusaoUnica =
    confirmacaoExclusao?.length === 1
      ? itens.find((item) => item.slug === confirmacaoExclusao[0])?.projeto
      : undefined;
  const descricaoConfirmacaoExclusao =
    confirmacaoExclusao?.length === 1
      ? `Tem certeza que deseja excluir permanentemente a planilha "${nomeParaExclusaoUnica ?? ''}"? Esta ação é irreversível e não poderá ser desfeita.`
      : `Tem certeza que deseja excluir permanentemente as ${confirmacaoExclusao?.length ?? 0} planilhas selecionadas? Esta ação é irreversível e não poderá ser desfeita.`;
  const descricaoConfirmacaoRestauracao =
    confirmacaoRestauracao?.length === 1
      ? `Tem certeza que deseja restaurar a planilha "${itens.find((item) => item.slug === confirmacaoRestauracao[0])?.projeto ?? ''}"?`
      : `Tem certeza que deseja restaurar as ${confirmacaoRestauracao?.length ?? 0} planilhas selecionadas?`;

  return (
    <>
      <Drawer.Root
        direction="left"
        open={aberto}
        onOpenChange={(novoAberto) => {
          if (!novoAberto) onFechar();
        }}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="lixeira-sidebar-overlay" />
          <Drawer.Content className="lixeira-sidebar-conteudo">
            <div className="lixeira-sidebar-cabecalho">
              <Drawer.Title className="lixeira-sidebar-titulo">Lixeira</Drawer.Title>
              <Drawer.Description className="lixeira-sidebar-subtitulo">
                Planilhas excluídas ficam aqui por 30 dias antes de serem removidas definitivamente.
              </Drawer.Description>
              {itens.length > 0 && (
                <button
                  type="button"
                  className="lixeira-sidebar-esvaziar"
                  onClick={handleEsvaziarLixeira}
                  disabled={excluindo}
                >
                  Esvaziar lixeira
                </button>
              )}
            </div>
  
            <label className="lixeira-sidebar-busca">
              <FiSearch aria-hidden="true" />
              <input
                type="text"
                value={termoBusca}
                onChange={(evento) => setTermoBusca(evento.target.value)}
                placeholder="Buscar planilha..."
                aria-label="Buscar planilha na lixeira"
              />
            </label>
  
            <div className="lixeira-sidebar-lista">
              {carregando && itens.length === 0 && !erro && (
                <p className="lixeira-sidebar-estado">Carregando...</p>
              )}
  
              {erro && <p className="lixeira-sidebar-estado lixeira-sidebar-erro">{erro}</p>}
  
              {!carregando && !erro && itensFiltrados.length === 0 && (
                <p className="lixeira-sidebar-estado">
                  {itens.length === 0
                    ? 'A lixeira está vazia.'
                    : 'Nenhuma planilha encontrada para essa busca.'}
                </p>
              )}
  
              {itensFiltrados.map((item) => (
                <div key={item.slug} className="lixeira-item">
                  <span className="lixeira-item-checkbox">
                    <CheckboxCustomizado
                      checked={slugsSelecionados.has(item.slug)}
                      onChange={() => alternarSelecaoItem(item.slug)}
                      disabled={restaurando}
                    >
                      <span className="sr-only">Selecionar planilha {item.projeto}</span>
                    </CheckboxCustomizado>
                  </span>
                  <div className="lixeira-item-info">
                    <span className="lixeira-item-nome">{item.projeto}</span>
                    <span className="lixeira-item-meta">
                      Excluída em {formatadorDataExclusao.format(new Date(item.deletado_em))} ·{' '}
                      {item.totalRegistros} registro(s)
                    </span>
                  </div>
                  <span
                    className={`lixeira-item-prazo ${
                      item.diasRestantes <= 5 ? 'lixeira-item-prazo-urgente' : ''
                    }`}
                    title={`${item.diasRestantes} dia(s) até a remoção definitiva`}
                  >
                    {item.diasRestantes}d
                  </span>
                  <button
                    type="button"
                    className="lixeira-item-excluir"
                    onClick={(evento) => {
                      evento.stopPropagation();
                      abrirConfirmarExclusao([item.slug]);
                    }}
                    aria-label={`Excluir permanentemente ${item.projeto}`}
                    title="Excluir permanentemente"
                    disabled={excluindo}
                  >
                    <IconeLixeira />
                  </button>
                </div>
              ))}
            </div>
  
            {erroRestauracao && (
              <p className="lixeira-sidebar-estado lixeira-sidebar-erro lixeira-sidebar-erro-restauracao">
                {erroRestauracao}
              </p>
            )}

            {erroExclusao && (
              <p className="lixeira-sidebar-estado lixeira-sidebar-erro lixeira-sidebar-erro-restauracao">
                {erroExclusao}
              </p>
            )}
  
            {slugsSelecionados.size > 0 && (
              <div className="lixeira-sidebar-barra-selecao" role="toolbar" aria-label="Ações da lixeira">
                <p className="lixeira-sidebar-barra-selecao-contagem">
                  {slugsSelecionados.size} selecionada(s)
                </p>
                <div className="lixeira-sidebar-barra-selecao-acoes">
                  <button
                    type="button"
                    className="dialog-botao-primario lixeira-sidebar-barra-selecao-restaurar"
                    onClick={abrirConfirmarRestauracao}
                    disabled={restaurando || excluindo}
                  >
                    <FiRotateCcw aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="dialog-botao-deletar lixeira-sidebar-barra-selecao-excluir"
                    onClick={() => abrirConfirmarExclusao([...slugsSelecionados])}
                    disabled={restaurando || excluindo}
                  >
                    <IconeLixeira />
                  </button>
                </div>
              </div>
            )}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {confirmacaoExclusao && (
        <ConfirmDialog
          ariaLabel="Confirmar exclusão permanente"
          titulo="Excluir permanentemente"
          descricao={descricaoConfirmacaoExclusao}
          rotuloCancelar="Cancelar"
          rotuloConfirmar="Excluir"
          onCancelar={() => setConfirmacaoExclusao(null)}
          onConfirmar={() => void handleConfirmarExclusaoPermanente()}
        />
      )}

      {confirmacaoRestauracao && (
        <ConfirmDialog
          ariaLabel="Confirmar restauração"
          titulo="Restaurar planilha(s)"
          descricao={descricaoConfirmacaoRestauracao}
          rotuloCancelar="Cancelar"
          rotuloConfirmar="Restaurar"
          onCancelar={() => setConfirmacaoRestauracao(null)}
          onConfirmar={() => void handleConfirmarRestauracao()}
        />
      )}

      {conflitoAtual?.conflito && (
        <ConflitoRestauracaoModal
          slugConflito={conflitoAtual.slug}
          projetoAtivo={conflitoAtual.conflito.ativo}
          projetoLixeira={conflitoAtual.conflito.lixeira}
          outrosSlugsLixeira={itens
            .map((item) => item.slug)
            .filter((slug) => slug !== conflitoAtual.slug)}
          onCancelar={() => handleConflitoCancelado(conflitoAtual.slug)}
          onResolvido={() => handleConflitoResolvido(conflitoAtual.slug)}
        />
      )}
    </>
  );
}
