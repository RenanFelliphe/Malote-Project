import { useEffect, useState } from 'react';

import { Dialog } from './Dialog';
import { ConflitoImportacaoProjetoModal } from './ConflitoImportacaoProjetoModal';
import {
  confirmarImportacaoPacote,
  previewImportacaoPacote,
  type DecisaoConflitoPacote,
  type ResultadoConfirmacaoPacote,
  type ResultadoPreviewPacote,
} from '../services/pacoteProjetosApi';
import { PROJETOS } from '../data/projetos';

interface Props {
  /** Arquivo `.zip` escolhido no seletor do SO (`pages/home.tsx`, mesmo papel de `arquivo` em `ImportWizardModal`). */
  arquivo: File;
  onFechar: () => void;
}

/** Rótulo de exibição de cada resultado possível de `handleConfirmarImportacaoPacote` (`pacoteProjetosApi.ts`, `ResultadoItemConfirmacaoPacote`). */
const ROTULO_RESULTADO: Record<'adicionado' | 'mantido' | 'substituido' | 'importado_como_novo', string> = {
  adicionado: 'Adicionado',
  mantido: 'Mantido (sem conflito resolvido nesta importação)',
  substituido: 'Substituído pelo do pacote',
  importado_como_novo: 'Importado como novo projeto',
};

/**
 * Modal de importação de um pacote de portabilidade de projetos (Demanda
 * 11 — `ExportacaoImportacaoDeProjetos.md`), aberto pelo item "Importar
 * Projetos" do dropdown "Importar" da Home (`pages/home.tsx`).
 *
 * Três fases, todas dentro deste componente:
 * 1. **Preview** (Etapa 5): ao montar, chama `previewImportacaoPacote` e
 *    mostra o resumo dos projetos do pacote (nome, registros, conflito de
 *    slug). Nada é gravado em `data/active/` ainda.
 * 2. **Resolução de conflitos** (Etapa 6): ao clicar em "Importar", se
 *    houver 1+ projeto em `resultado.conflitos`, abre
 *    `ConflitoImportacaoProjetoModal` em cascata — um projeto conflitante
 *    por vez (seção 4 do planner) — acumulando uma `DecisaoConflitoPacote`
 *    por projeto. Sem conflito, pula direto para a fase 3.
 * 3. **Confirmação** (Etapa 6): com todas as decisões em mãos (ou lista
 *    vazia, se não havia conflito), chama `confirmarImportacaoPacote` e
 *    mostra o resultado por projeto. Fechar depois de uma confirmação
 *    bem-sucedida recarrega a página — mesmo critério de
 *    `handleConfirmarDelecaoLote` (`pages/home.tsx`): `PROJETOS`
 *    (`src/data/projetos.ts`) vem de um `import.meta.glob` resolvido uma
 *    única vez no carregamento do módulo, só um reload reflete os projetos
 *    recém-importados.
 */
export function ImportarProjetosModal({ arquivo, onFechar }: Props) {
  const [carregando, setCarregando] = useState(true);
  const [resultado, setResultado] = useState<ResultadoPreviewPacote | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Cascata de conflitos (fase 2) — `projetosConflitantes` é derivado de
  // `resultado`, então só o índice da fila e as decisões já tomadas
  // precisam de estado próprio.
  const [resolvendoConflitos, setResolvendoConflitos] = useState(false);
  const [indiceConflitoAtual, setIndiceConflitoAtual] = useState(0);
  const [decisoesAcumuladas, setDecisoesAcumuladas] = useState<DecisaoConflitoPacote[]>([]);

  // Confirmação (fase 3).
  const [confirmando, setConfirmando] = useState(false);
  const [decisoesEnviadas, setDecisoesEnviadas] = useState<DecisaoConflitoPacote[] | null>(null);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);
  const [resultadoConfirmacao, setResultadoConfirmacao] = useState<ResultadoConfirmacaoPacote | null>(null);

  useEffect(() => {
    let cancelado = false;

    setCarregando(true);
    setErro(null);
    setResultado(null);
    setResolvendoConflitos(false);
    setIndiceConflitoAtual(0);
    setDecisoesAcumuladas([]);
    setConfirmando(false);
    setDecisoesEnviadas(null);
    setErroConfirmacao(null);
    setResultadoConfirmacao(null);

    previewImportacaoPacote(arquivo)
      .then((resposta) => {
        if (cancelado) return;
        setResultado(resposta);
      })
      .catch((erroPreview) => {
        if (cancelado) return;
        setErro(
          erroPreview instanceof Error ? erroPreview.message : 'Não foi possível ler o pacote selecionado.'
        );
      })
      .finally(() => {
        if (cancelado) return;
        setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [arquivo]);

  const conjuntoConflitos = new Set(resultado?.conflitos ?? []);
  const totalConflitos = conjuntoConflitos.size;
  const projetosConflitantes = resultado
    ? resultado.projetos.filter((projeto) => conjuntoConflitos.has(projeto.slug))
    : [];

  /**
   * Slugs a evitar na sugestão de "novo slug" do modal de conflito — os já
   * ativos (`PROJETOS`) e os demais do próprio pacote, para não sugerir um
   * nome que colide com outro projeto do mesmo pacote. Só conveniência de
   * UX (a checagem real é do servidor, ver `ConflitoImportacaoProjetoModal.tsx`).
   */
  const slugsParaEvitarNaSugestao = new Set<string>([
    ...PROJETOS.map((projeto) => projeto.slug),
    ...(resultado?.projetos.map((projeto) => projeto.slug) ?? []),
  ]);

  function nomeExistentePara(slug: string): string | undefined {
    return PROJETOS.find((projeto) => projeto.slug === slug)?.dados.projeto;
  }

  async function confirmarComDecisoes(decisoes: DecisaoConflitoPacote[]) {
    if (!resultado) return;

    setDecisoesEnviadas(decisoes);
    setErroConfirmacao(null);
    setConfirmando(true);

    try {
      const resposta = await confirmarImportacaoPacote(resultado.pacoteId, decisoes);
      setResultadoConfirmacao(resposta);
    } catch (erroConfirmar) {
      setErroConfirmacao(
        erroConfirmar instanceof Error
          ? erroConfirmar.message
          : 'Não foi possível confirmar a importação do pacote.'
      );
    } finally {
      setConfirmando(false);
    }
  }

  /** Clique em "Importar" no resumo (fase 1 → 2 ou direto pra 3, se não houver conflito). */
  function handleIniciarImportacao() {
    if (!resultado) return;

    if (totalConflitos === 0) {
      void confirmarComDecisoes([]);
      return;
    }

    setIndiceConflitoAtual(0);
    setDecisoesAcumuladas([]);
    setResolvendoConflitos(true);
  }

  /** `onResolver` do `ConflitoImportacaoProjetoModal` — avança a fila ou, no último conflito, dispara a confirmação. */
  function handleResolverConflito(decisao: DecisaoConflitoPacote) {
    const decisoesAteAqui = [...decisoesAcumuladas, decisao];
    const proximoIndice = indiceConflitoAtual + 1;

    if (proximoIndice < projetosConflitantes.length) {
      setDecisoesAcumuladas(decisoesAteAqui);
      setIndiceConflitoAtual(proximoIndice);
      return;
    }

    setResolvendoConflitos(false);
    void confirmarComDecisoes(decisoesAteAqui);
  }

  /**
   * Cancela a importação inteira — tanto o botão "Cancelar" do resumo
   * quanto "Cancelar importação" de dentro da cascata de conflitos. Nada
   * foi gravado em `data/active/` ainda nesse ponto (só o estágio efêmero
   * em `data/tmp/`, que expira sozinho — seção 8, notas da Etapa 3), então
   * fechar sem recarregar a página é suficiente.
   */
  function handleCancelarImportacao() {
    setResolvendoConflitos(false);
    onFechar();
  }

  /** Fecha depois de uma confirmação (com ou sem falhas parciais) — recarrega a página, ver JSDoc do componente. */
  function handleFecharAposConfirmacao() {
    onFechar();
    window.location.reload();
  }

  // Fase 2: um `ConflitoImportacaoProjetoModal` por vez, substituindo o
  // Dialog do resumo em vez de empilhar sobre ele.
  if (resolvendoConflitos) {
    const projetoAtual = projetosConflitantes[indiceConflitoAtual];
    if (!projetoAtual) {
      // Defensivo: fila vazia não deveria acontecer (só entramos aqui com
      // totalConflitos > 0), mas evita renderizar o modal sem projeto.
      setResolvendoConflitos(false);
      return null;
    }

    return (
      <ConflitoImportacaoProjetoModal
        projetoDoPacote={projetoAtual}
        nomeExistente={nomeExistentePara(projetoAtual.slug)}
        posicao={indiceConflitoAtual + 1}
        totalConflitos={projetosConflitantes.length}
        slugsParaEvitarNaSugestao={slugsParaEvitarNaSugestao}
        onResolver={handleResolverConflito}
        onCancelarImportacao={handleCancelarImportacao}
      />
    );
  }

  return (
    <Dialog
      isOpen
      onClose={resultadoConfirmacao ? handleFecharAposConfirmacao : handleCancelarImportacao}
      title="Importar Projetos"
      className="modal-importar-projetos"
      footer={
        resultadoConfirmacao ? (
          <div className="exportar-rodape">
            <button type="button" className="dialog-botao-copiar" onClick={handleFecharAposConfirmacao}>
              Concluir
            </button>
          </div>
        ) : (
          <div className="exportar-rodape">
            <button type="button" className="dialog-botao-cancelar" onClick={handleCancelarImportacao}>
              Cancelar
            </button>
            {resultado && !confirmando && (
              <button type="button" className="dialog-botao-primario" onClick={handleIniciarImportacao}>
                Importar
              </button>
            )}
            {confirmando && (
              <button type="button" className="dialog-botao-primario" disabled>
                Importando…
              </button>
            )}
            {erroConfirmacao && decisoesEnviadas && (
              <button
                type="button"
                className="dialog-botao-copiar"
                onClick={() => void confirmarComDecisoes(decisoesEnviadas)}
              >
                Tentar novamente
              </button>
            )}
          </div>
        )
      }
    >
      {carregando && <p className="modal-campo-label">Lendo o pacote selecionado…</p>}

      {erro && <p className="erro-salvamento">{erro}</p>}

      {resultado && !resultadoConfirmacao && (
        <section className="exportar-secao">
          <p className="modal-campo-label">
            {resultado.projetos.length === 1
              ? '1 projeto encontrado no pacote'
              : `${resultado.projetos.length} projetos encontrados no pacote`}
          </p>

          <ul className="importar-projetos-lista">
            {resultado.projetos.map((projeto) => {
              const emConflito = conjuntoConflitos.has(projeto.slug);
              return (
                <li key={projeto.slug} className="importar-projetos-item">
                  <span className="importar-projetos-item-nome">{projeto.nome}</span>
                  <span className="importar-projetos-item-registros">
                    {projeto.totalRegistros} registro(s)
                  </span>
                  {emConflito && (
                    <span className="importar-projetos-item-conflito">
                      Já existe um projeto com este slug
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {totalConflitos > 0 && (
            <p className="logs-exportar-dica">
              {totalConflitos === 1
                ? '1 projeto colide com um já existente — você vai decidir o que fazer com ele antes de confirmar.'
                : `${totalConflitos} projetos colidem com projetos já existentes — você vai decidir o que fazer com cada um antes de confirmar.`}
            </p>
          )}

          {erroConfirmacao && <p className="erro-salvamento">{erroConfirmacao}</p>}
        </section>
      )}

      {resultadoConfirmacao && (
        <section className="exportar-secao">
          <p className="modal-campo-label">
            {resultadoConfirmacao.ok
              ? 'Importação concluída.'
              : 'Importação concluída com falhas em um ou mais projetos.'}
          </p>

          <ul className="importar-projetos-lista">
            {resultadoConfirmacao.resultados.map((item) => (
              <li key={item.slug} className="importar-projetos-item">
                <span className="importar-projetos-item-nome">{item.slug}</span>
                {item.ok ? (
                  <span className="importar-projetos-item-registros">
                    {item.resultado ? ROTULO_RESULTADO[item.resultado] : 'Concluído'}
                    {item.novoSlug ? ` (${item.novoSlug})` : ''}
                  </span>
                ) : (
                  <span className="importar-projetos-item-conflito">
                    {item.error ?? 'Não foi possível gravar este projeto.'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Dialog>
  );
}