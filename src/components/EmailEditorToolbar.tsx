import { useEditorState, type Editor } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';

import { ToolbarPopover } from './editor/ToolbarPopover';
import {
  IconeAlinharCentro,
  IconeAlinharDireita,
  IconeAlinharEsquerda,
  IconeAlinharJustificado,
  IconeBotaoEmail,
  IconeCorTexto,
  IconeItalico,
  IconeLink,
  IconeListaNaoOrdenada,
  IconeListaOrdenada,
  IconeNegrito,
  IconeRealce,
  IconeRestaurar,
  IconeSublinhado,
  IconeTachado,
} from './Icons';

interface Props {
  /**
   * Instância do editor exposta pelo `EmailEditorRico` via `onEditorPronto`.
   * `null` enquanto o editor ainda não foi criado (primeiro render) — os
   * botões ficam desabilitados nesse intervalo.
   */
  editor: Editor | null;
}

/**
 * Paleta fixa de cor de texto (Etapa 4 — refatoracaoEmailFormatado.md). Por
 * decisão de escopo o editor não oferece um color-picker livre, só esta
 * lista curada — mantém o resultado visual consistente entre e-mails.
 */
const PALETA_COR_TEXTO: { nome: string; valor: string }[] = [
  { nome: 'Preto', valor: '#1f2933' },
  { nome: 'Cinza', valor: '#6b7280' },
  { nome: 'Vermelho', valor: '#dc2626' },
  { nome: 'Laranja', valor: '#ea580c' },
  { nome: 'Amarelo', valor: '#ca8a04' },
  { nome: 'Verde', valor: '#16a34a' },
  { nome: 'Azul', valor: '#2563eb' },
  { nome: 'Roxo', valor: '#7c3aed' },
];

/**
 * Paleta fixa de realce/highlight (Etapa 4). Tons claros (fundo), pensados
 * para continuar legível com qualquer cor de texto da paleta acima.
 */
const PALETA_REALCE: { nome: string; valor: string }[] = [
  { nome: 'Amarelo', valor: '#fef08a' },
  { nome: 'Verde', valor: '#bbf7d0' },
  { nome: 'Azul', valor: '#bfdbfe' },
  { nome: 'Rosa', valor: '#fbcfe8' },
  { nome: 'Laranja', valor: '#fed7aa' },
  { nome: 'Roxo', valor: '#e9d5ff' },
];

/**
 * Grade de amostras + botão de remover, reaproveitada pelos botões de "cor
 * de texto" e "realce" (Etapa 4) e também pelo popover de "Transformar em
 * botão" — ali ela entra como uma peça a mais dentro de um popover maior
 * (que também tem o toggle de wrap/unwrap e o campo de URL), por isso não é
 * mais ela quem desenha o wrapper `.email-editor-toolbar-popover` — isso é
 * responsabilidade de `ToolbarPopover`, para poder compor esta grade com
 * outro conteúdo dentro do mesmo popover quando for o caso.
 */
function PainelCores({
  paleta,
  corAtiva,
  rotuloRemover,
  onEscolher,
  onRemover,
}: {
  paleta: { nome: string; valor: string }[];
  corAtiva?: string;
  rotuloRemover: string;
  onEscolher: (cor: string) => void;
  onRemover: () => void;
}) {
  return (
    <>
      <div className="email-editor-toolbar-popover-grade">
        {paleta.map((cor) => (
          <button
            key={cor.valor}
            type="button"
            className={`email-editor-toolbar-amostra ${corAtiva === cor.valor ? 'ativa' : ''}`}
            style={{ backgroundColor: cor.valor }}
            onClick={() => onEscolher(cor.valor)}
            title={cor.nome}
            aria-label={cor.nome}
            aria-pressed={corAtiva === cor.valor}
          />
        ))}
      </div>
      <button type="button" className="email-editor-toolbar-popover-remover" onClick={onRemover}>
        {rotuloRemover}
      </button>
    </>
  );
}

/**
 * Estado "tudo desligado" usado tanto para o primeiro render (editor ainda
 * `null`, ver `Props`) quanto como fallback de `useEditorState` — a
 * sobrecarga do Tiptap para `editor: Editor | null` sempre tipa o retorno
 * como `TSelectorResult | null`, mesmo quando o seletor abaixo já trata o
 * caso `null` e nunca retorna `null` de fato em tempo de execução.
 */
const ESTADO_EDITOR_INDISPONIVEL = {
  negrito: false,
  italico: false,
  sublinhado: false,
  tachado: false,
  corAtiva: undefined as string | undefined,
  realceAtivo: false,
  realceCorAtiva: undefined as string | undefined,
  linkAtivo: false,
  linkHref: '',
  listaNaoOrdenadaAtiva: false,
  listaOrdenadaAtiva: false,
  noBotaoAtivo: false,
  noBotaoCorAtiva: undefined as string | undefined,
  noBotaoHrefAtiva: '',
  alinhamentoCentro: false,
  alinhamentoDireita: false,
  alinhamentoJustificado: false,
};

/**
 * Barra de ferramentas do corpo do e-mail.
 *
 * RefatoracaoToolbarEmail.md — Etapa 1 (checkpoint): reconstrução da
 * estrutura base, sem nenhuma função nova em relação ao que já existia.
 * Duas mudanças estruturais em relação à revisão anterior
 * (refatoracaoEmailFormatado.md):
 *
 * 1. Faixa única de botões individuais, sem agrupamento em seções fixas
 *    (`ToolbarGrupo.tsx`, descontinuado) e sem colapso "por grupo" atrás de
 *    um gatilho. `.email-editor-toolbar` usa `flex-wrap: nowrap` e não tem
 *    mais `overflow: hidden` (ver `index.css`). A responsividade por "Ver
 *    Mais" (botão individual, não grupo) é a Etapa 2 desta revisão — ainda
 *    não existe aqui: numa toolbar mais estreita que a soma dos botões, a
 *    faixa pode, por ora, estourar a largura do container.
 * 2. Todo popover (cor, realce, link, botão) é renderizado por
 *    `ToolbarPopover` (`editor/ToolbarPopover.tsx`), que usa `createPortal`
 *    para `document.body` e calcula sua própria posição a partir do
 *    botão-gatilho — nunca mais como filho posicionado de um ancestral
 *    dentro da faixa de botões. Isso resolve a causa raiz diagnosticada na
 *    Etapa 0: o antigo `overflow: hidden` da toolbar cortava e deslocava os
 *    popovers, que nasciam dentro dela.
 *
 * Cada botão de marca simples liga diretamente a um comando do Tiptap
 * (`editor.chain().focus().toggleX().run()`); o estado ativo/inativo vem de
 * `useEditorState`, que reage a toda transação do editor sem precisar de
 * listeners manuais.
 *
 * Cor de texto e realce abrem um painel próprio (`PainelCores`) com a
 * paleta fixa definida acima — não um `<input type="color">` livre, por
 * decisão de escopo registrada em refatoracaoEmailFormatado.md. Link abre
 * um popover com um campo de URL; reaproveita
 * `editor.getAttributes('link').href` para pré-preencher o campo quando o
 * cursor já está sobre um link existente (edição), e
 * `extendMarkRange('link')` para que a marca inteira seja substituída, não
 * só o trecho selecionado no momento do clique.
 *
 * Os quatro painéis (cor, realce, link, botão) são popovers independentes;
 * só um fica aberto por vez (abrir um fecha os outros). Fechamento por
 * clique-fora e Esc agora é responsabilidade única de `ToolbarPopover`.
 *
 * Listas: dois botões de toggle simples, sem UI própria —
 * `toggleBulletList`/`toggleOrderedList` já vêm prontos do
 * `BulletList`/`OrderedList`/`ListItem` do StarterKit. Por decisão de
 * escopo não há numeração aninhada tipo "2.1." — o estilo de cada nível
 * (disc/circle/decimal) é só CSS, em `index.css`.
 *
 * Botão estilizado: `toggleNoBotao()` — comando exposto pela extensão de
 * nó customizado `NoBotao` (ver `editor/extensoes/NoBotao.ts`). Nesta
 * etapa o popover ainda tem o botão de ação textual "Transformar em
 * botão"/"Remover botão" (o redesenho de cor+link direto no ícone é a
 * Etapa 8 desta revisão — fora do escopo do checkpoint da Etapa 1).
 *
 * Alinhamento: quatro botões de toggle simples (esquerda/centro/
 * direita/justificado), chamando `setTextAlign('left' | 'center' | 'right' |
 * 'justify')`. Não usa `toggleX()` como as marcas simples porque `TextAlign`
 * não expõe um comando de toggle — cada botão define o alinhamento
 * diretamente; clicar no botão do valor já ativo simplesmente o reaplica
 * (sem efeito perceptível), então não há necessidade de um estado "nenhum
 * alinhamento" na UI. O estado ativo de cada botão vem de `ed.isActive({
 * textAlign: <valor> })`; "esquerda" é o único calculado por exclusão
 * (nenhum dos outros três ativo), já que `defaultAlignment: 'left'`
 * (configurado em `EmailEditorRico.tsx`) não deixa o schema gravar
 * `text-align: left` explicitamente no HTML.
 *
 * Limpar formatação: botão de ação simples (não um toggle — não tem estado
 * ativo/inativo), chamando `unsetAllMarks().clearNodes().run()`. Não
 * precisa de nenhum código extra para restringir o efeito à seleção atual:
 * é o comportamento padrão do Tiptap/ProseMirror para esses dois comandos —
 * eles operam sobre o range selecionado no momento (ou, com a seleção
 * colapsada, não têm nada para limpar) — nunca sobre o documento inteiro.
 * `clearNodes()` também remove o envolvimento do nó de botão e o
 * alinhamento quando a seleção estiver dentro deles, já que ambos contam
 * como "nó" para esse comando, não como marca. Reaproveita `IconeRestaurar`
 * (já usado alhures no projeto para "desfazer"/"restaurar") em vez de um
 * ícone novo — a ação é, em espírito, a mesma: reverter para o estado sem
 * formatação.
 */
export function EmailEditorToolbar({ editor }: Props) {
  const [painelAberto, setPainelAberto] = useState<'cor' | 'realce' | 'link' | 'botao' | null>(null);
  const [linkValorInput, setLinkValorInput] = useState('');
  // Campo de URL próprio do popover de "Transformar em botão" — separado de
  // `linkValorInput` (popover de Link, marca de texto) porque são dois
  // popovers independentes que podem, em tese, ter sido abertos e
  // preenchidos em momentos diferentes; compartilhar o mesmo state faria um
  // vazar valor pro outro.
  const [botaoHrefInput, setBotaoHrefInput] = useState('');

  // Refs dos botões-gatilho — usadas por `ToolbarPopover` (Etapa 1) para
  // calcular a posição do popover correspondente. Substituem as antigas
  // refs de container (`painelCorRef` etc.), que apontavam para o `<div>`
  // pai usado no fechamento manual por clique-fora — isso agora é
  // responsabilidade do próprio `ToolbarPopover`.
  const gatilhoCorRef = useRef<HTMLButtonElement>(null);
  const gatilhoRealceRef = useRef<HTMLButtonElement>(null);
  const gatilhoLinkRef = useRef<HTMLButtonElement>(null);
  const gatilhoBotaoRef = useRef<HTMLButtonElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const botaoHrefInputRef = useRef<HTMLInputElement>(null);

  const estado = useEditorState({
    editor,
    selector: (contexto) => {
      const ed = contexto.editor;
      if (!ed) {
        return ESTADO_EDITOR_INDISPONIVEL;
      }
      return {
        negrito: ed.isActive('bold'),
        italico: ed.isActive('italic'),
        sublinhado: ed.isActive('underline'),
        tachado: ed.isActive('strike'),
        corAtiva: ed.getAttributes('textStyle').color as string | undefined,
        realceAtivo: ed.isActive('highlight'),
        realceCorAtiva: ed.getAttributes('highlight').color as string | undefined,
        linkAtivo: ed.isActive('link'),
        linkHref: (ed.getAttributes('link').href as string | undefined) ?? '',
        listaNaoOrdenadaAtiva: ed.isActive('bulletList'),
        listaOrdenadaAtiva: ed.isActive('orderedList'),
        noBotaoAtivo: ed.isActive('noBotao'),
        // Atributos próprios do nó, gravados pela extensão `NoBotao`. Só
        // fazem sentido quando `noBotaoAtivo` — fora de um botão,
        // `getAttributes('noBotao')` devolve os defaults do schema
        // (`null`/`null`), nunca resíduo de um botão diferente que o cursor
        // já tenha visitado antes.
        noBotaoCorAtiva: ed.getAttributes('noBotao').cor as string | undefined,
        noBotaoHrefAtiva: (ed.getAttributes('noBotao').href as string | undefined) ?? '',
        // Cada botão de alinhamento calcula seu próprio estado ativo;
        // "esquerda" (abaixo, no botão) é o único obtido por exclusão dos
        // outros três, já que `defaultAlignment: 'left'` não grava
        // `text-align: left` no HTML.
        alinhamentoCentro: ed.isActive({ textAlign: 'center' }),
        alinhamentoDireita: ed.isActive({ textAlign: 'right' }),
        alinhamentoJustificado: ed.isActive({ textAlign: 'justify' }),
      };
    },
  }) ?? ESTADO_EDITOR_INDISPONIVEL;

  // Foca (e seleciona) o campo de URL ao abrir o popover de link. Só DOM,
  // sem setState — o pré-preenchimento do valor acontece em `alternarPainel`,
  // no clique que abre o painel, não aqui.
  useEffect(() => {
    if (painelAberto !== 'link') return;
    linkInputRef.current?.focus();
    linkInputRef.current?.select();
  }, [painelAberto]);

  // Mesmo padrão do efeito acima, para o campo de URL do popover de
  // "Transformar em botão" — só foca quando o botão já existe e o popover
  // mostra o campo (ver JSX: o campo só aparece com `estado.noBotaoAtivo`).
  useEffect(() => {
    if (painelAberto !== 'botao' || !estado.noBotaoAtivo) return;
    botaoHrefInputRef.current?.focus();
    botaoHrefInputRef.current?.select();
  }, [painelAberto, estado.noBotaoAtivo]);

  function alternarPainel(painel: 'cor' | 'realce' | 'link' | 'botao') {
    const abrindo = painelAberto !== painel;
    setPainelAberto(abrindo ? painel : null);
    // Pré-preenche com a URL do link atual (se o cursor estiver sobre um) ao
    // abrir o painel de link — feito aqui, no clique, não num efeito.
    if (abrindo && painel === 'link') {
      setLinkValorInput(estado.linkHref);
    }
    // Mesma ideia para o destino do botão.
    if (abrindo && painel === 'botao') {
      setBotaoHrefInput(estado.noBotaoHrefAtiva);
    }
  }

  function aplicarCorTexto(cor: string) {
    editor?.chain().focus().setColor(cor).run();
    setPainelAberto(null);
  }

  function removerCorTexto() {
    editor?.chain().focus().unsetColor().run();
    setPainelAberto(null);
  }

  function aplicarRealce(cor: string) {
    editor?.chain().focus().toggleHighlight({ color: cor }).run();
    setPainelAberto(null);
  }

  function removerRealce() {
    editor?.chain().focus().unsetHighlight().run();
    setPainelAberto(null);
  }

  function aplicarLink() {
    const url = linkValorInput.trim();
    if (!url) {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setPainelAberto(null);
  }

  function removerLink() {
    editor?.chain().focus().extendMarkRange('link').unsetLink().run();
    setPainelAberto(null);
  }

  /**
   * Transforma o(s) parágrafo(s) selecionado(s) em botão, ou desfaz o
   * envolvimento se já estiver dentro de um.
   */
  function alternarNoBotao() {
    editor?.chain().focus().toggleNoBotao().run();
  }

  /** Cor de fundo do botão — mesmo comando genérico do Tiptap para atualizar
   * atributos de um nó, aplicado a `noBotao` em vez de a uma mark. */
  function aplicarCorBotao(cor: string) {
    editor?.chain().focus().updateAttributes('noBotao', { cor }).run();
  }

  /** `null` volta o botão à cor padrão do CSS (`.email-botao`, ver
   * `NoBotao.ts`: `renderHTML` de `cor` devolve `{}` quando o atributo é
   * `null`, então nenhum `style` extra sai no HTML). */
  function removerCorBotao() {
    editor?.chain().focus().updateAttributes('noBotao', { cor: null }).run();
  }

  function aplicarHrefBotao() {
    const url = botaoHrefInput.trim();
    editor
      ?.chain()
      .focus()
      .updateAttributes('noBotao', { href: url || null })
      .run();
  }

  function removerHrefBotao() {
    setBotaoHrefInput('');
    editor?.chain().focus().updateAttributes('noBotao', { href: null }).run();
  }

  /**
   * Limpar formatação. Restrito à seleção atual por padrão do próprio
   * Tiptap (ver JSDoc do componente, acima) — não precisa de nenhum recorte
   * manual de range aqui.
   */
  function limparFormatacao() {
    editor?.chain().focus().unsetAllMarks().clearNodes().run();
  }

  return (
    <div className="email-editor-toolbar" role="toolbar" aria-label="Formatação do corpo do e-mail">
      <button
        type="button"
        className={`email-editor-toolbar-botao ${estado.negrito ? 'ativo' : ''}`}
        onClick={() => editor?.chain().focus().toggleBold().run()}
        disabled={!editor}
        title="Negrito"
        aria-label="Negrito"
        aria-pressed={estado.negrito}
      >
        <IconeNegrito />
      </button>

      <button
        type="button"
        className={`email-editor-toolbar-botao ${estado.italico ? 'ativo' : ''}`}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
        disabled={!editor}
        title="Itálico"
        aria-label="Itálico"
        aria-pressed={estado.italico}
      >
        <IconeItalico />
      </button>

      <button
        type="button"
        className={`email-editor-toolbar-botao ${estado.sublinhado ? 'ativo' : ''}`}
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
        disabled={!editor}
        title="Sublinhado"
        aria-label="Sublinhado"
        aria-pressed={estado.sublinhado}
      >
        <IconeSublinhado />
      </button>

      <button
        type="button"
        className={`email-editor-toolbar-botao ${estado.tachado ? 'ativo' : ''}`}
        onClick={() => editor?.chain().focus().toggleStrike().run()}
        disabled={!editor}
        title="Tachado"
        aria-label="Tachado"
        aria-pressed={estado.tachado}
      >
        <IconeTachado />
      </button>

      <div className="email-editor-toolbar-separador" role="separator" />

      <button
        ref={gatilhoCorRef}
        type="button"
        className={`email-editor-toolbar-botao ${estado.corAtiva ? 'ativo' : ''}`}
        onClick={() => alternarPainel('cor')}
        disabled={!editor}
        title="Cor do texto"
        aria-label="Cor do texto"
        aria-haspopup="true"
        aria-expanded={painelAberto === 'cor'}
      >
        <IconeCorTexto />
        {estado.corAtiva && (
          <span className="email-editor-toolbar-indicador" style={{ backgroundColor: estado.corAtiva }} />
        )}
      </button>
      {painelAberto === 'cor' && (
        <ToolbarPopover
          anchorRef={gatilhoCorRef}
          onClose={() => setPainelAberto(null)}
          className="email-editor-toolbar-popover-cores"
        >
          <PainelCores
            paleta={PALETA_COR_TEXTO}
            corAtiva={estado.corAtiva}
            rotuloRemover="Remover cor"
            onEscolher={aplicarCorTexto}
            onRemover={removerCorTexto}
          />
        </ToolbarPopover>
      )}

      <button
        ref={gatilhoRealceRef}
        type="button"
        className={`email-editor-toolbar-botao ${estado.realceAtivo ? 'ativo' : ''}`}
        onClick={() => alternarPainel('realce')}
        disabled={!editor}
        title="Realce (cor de fundo)"
        aria-label="Realce"
        aria-haspopup="true"
        aria-expanded={painelAberto === 'realce'}
      >
        <IconeRealce />
        {estado.realceCorAtiva && (
          <span className="email-editor-toolbar-indicador" style={{ backgroundColor: estado.realceCorAtiva }} />
        )}
      </button>
      {painelAberto === 'realce' && (
        <ToolbarPopover
          anchorRef={gatilhoRealceRef}
          onClose={() => setPainelAberto(null)}
          className="email-editor-toolbar-popover-cores"
        >
          <PainelCores
            paleta={PALETA_REALCE}
            corAtiva={estado.realceCorAtiva}
            rotuloRemover="Remover realce"
            onEscolher={aplicarRealce}
            onRemover={removerRealce}
          />
        </ToolbarPopover>
      )}

      <button
        ref={gatilhoLinkRef}
        type="button"
        className={`email-editor-toolbar-botao ${estado.linkAtivo ? 'ativo' : ''}`}
        onClick={() => alternarPainel('link')}
        disabled={!editor}
        title="Link"
        aria-label="Link"
        aria-haspopup="true"
        aria-expanded={painelAberto === 'link'}
      >
        <IconeLink />
      </button>
      {painelAberto === 'link' && (
        <ToolbarPopover
          anchorRef={gatilhoLinkRef}
          onClose={() => setPainelAberto(null)}
          className="email-editor-toolbar-popover-link"
        >
          <input
            ref={linkInputRef}
            type="text"
            value={linkValorInput}
            onChange={(e) => setLinkValorInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                aplicarLink();
              }
            }}
            placeholder="https://exemplo.com"
            className="email-editor-toolbar-popover-input"
            aria-label="Endereço do link"
          />
          <div className="email-editor-toolbar-popover-acoes">
            <button type="button" className="email-editor-toolbar-popover-botao-aplicar" onClick={aplicarLink}>
              Aplicar
            </button>
            {estado.linkAtivo && (
              <button type="button" className="email-editor-toolbar-popover-remover" onClick={removerLink}>
                Remover link
              </button>
            )}
          </div>
        </ToolbarPopover>
      )}

      <button
        ref={gatilhoBotaoRef}
        type="button"
        className={`email-editor-toolbar-botao ${estado.noBotaoAtivo ? 'ativo' : ''}`}
        onClick={() => alternarPainel('botao')}
        disabled={!editor}
        title="Transformar em botão"
        aria-label="Transformar em botão"
        aria-haspopup="true"
        aria-expanded={painelAberto === 'botao'}
      >
        <IconeBotaoEmail />
        {estado.noBotaoCorAtiva && (
          <span className="email-editor-toolbar-indicador" style={{ backgroundColor: estado.noBotaoCorAtiva }} />
        )}
      </button>
      {painelAberto === 'botao' && (
        <ToolbarPopover
          anchorRef={gatilhoBotaoRef}
          onClose={() => setPainelAberto(null)}
          className="email-editor-toolbar-popover-botao"
        >
          <button type="button" className="email-editor-toolbar-popover-botao-aplicar" onClick={alternarNoBotao}>
            {estado.noBotaoAtivo ? 'Remover botão' : 'Transformar em botão'}
          </button>

          {estado.noBotaoAtivo && (
            <>
              <div className="email-editor-toolbar-popover-separador" />

              <PainelCores
                paleta={PALETA_COR_TEXTO}
                corAtiva={estado.noBotaoCorAtiva}
                rotuloRemover="Cor padrão"
                onEscolher={aplicarCorBotao}
                onRemover={removerCorBotao}
              />

              <div className="email-editor-toolbar-popover-separador" />

              <input
                ref={botaoHrefInputRef}
                type="text"
                value={botaoHrefInput}
                onChange={(e) => setBotaoHrefInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    aplicarHrefBotao();
                  }
                }}
                placeholder="https://exemplo.com"
                className="email-editor-toolbar-popover-input"
                aria-label="Destino do botão"
              />
              <div className="email-editor-toolbar-popover-acoes">
                <button type="button" className="email-editor-toolbar-popover-botao-aplicar" onClick={aplicarHrefBotao}>
                  Aplicar link
                </button>
                {estado.noBotaoHrefAtiva && (
                  <button type="button" className="email-editor-toolbar-popover-remover" onClick={removerHrefBotao}>
                    Remover link
                  </button>
                )}
              </div>
            </>
          )}
        </ToolbarPopover>
      )}

      <div className="email-editor-toolbar-separador" role="separator" />

      <button
        type="button"
        className={`email-editor-toolbar-botao ${estado.listaNaoOrdenadaAtiva ? 'ativo' : ''}`}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
        disabled={!editor}
        title="Lista não ordenada"
        aria-label="Lista não ordenada"
        aria-pressed={estado.listaNaoOrdenadaAtiva}
      >
        <IconeListaNaoOrdenada />
      </button>

      <button
        type="button"
        className={`email-editor-toolbar-botao ${estado.listaOrdenadaAtiva ? 'ativo' : ''}`}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        disabled={!editor}
        title="Lista ordenada"
        aria-label="Lista ordenada"
        aria-pressed={estado.listaOrdenadaAtiva}
      >
        <IconeListaOrdenada />
      </button>

      <div className="email-editor-toolbar-separador" role="separator" />

      <button
        type="button"
        className={`email-editor-toolbar-botao ${
          !estado.alinhamentoCentro && !estado.alinhamentoDireita && !estado.alinhamentoJustificado ? 'ativo' : ''
        }`}
        onClick={() => editor?.chain().focus().setTextAlign('left').run()}
        disabled={!editor}
        title="Alinhar à esquerda"
        aria-label="Alinhar à esquerda"
        aria-pressed={!estado.alinhamentoCentro && !estado.alinhamentoDireita && !estado.alinhamentoJustificado}
      >
        <IconeAlinharEsquerda />
      </button>

      <button
        type="button"
        className={`email-editor-toolbar-botao ${estado.alinhamentoCentro ? 'ativo' : ''}`}
        onClick={() => editor?.chain().focus().setTextAlign('center').run()}
        disabled={!editor}
        title="Centralizar"
        aria-label="Centralizar"
        aria-pressed={estado.alinhamentoCentro}
      >
        <IconeAlinharCentro />
      </button>

      <button
        type="button"
        className={`email-editor-toolbar-botao ${estado.alinhamentoDireita ? 'ativo' : ''}`}
        onClick={() => editor?.chain().focus().setTextAlign('right').run()}
        disabled={!editor}
        title="Alinhar à direita"
        aria-label="Alinhar à direita"
        aria-pressed={estado.alinhamentoDireita}
      >
        <IconeAlinharDireita />
      </button>

      <button
        type="button"
        className={`email-editor-toolbar-botao ${estado.alinhamentoJustificado ? 'ativo' : ''}`}
        onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
        disabled={!editor}
        title="Justificar"
        aria-label="Justificar"
        aria-pressed={estado.alinhamentoJustificado}
      >
        <IconeAlinharJustificado />
      </button>

      <div className="email-editor-toolbar-separador" role="separator" />

      <button
        type="button"
        className="email-editor-toolbar-botao"
        onClick={limparFormatacao}
        disabled={!editor}
        title="Limpar formatação"
        aria-label="Limpar formatação"
      >
        <IconeRestaurar />
      </button>
    </div>
  );
}