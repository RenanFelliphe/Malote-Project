import { useEditorState, type Editor } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';

import { ToolbarGrupo } from './editor/ToolbarGrupo';
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
 * Painel de seleção de cor reaproveitado pelos botões de "cor de texto" e
 * "realce" (Etapa 4) — ambos são a mesma UI (grade de amostras + opção de
 * remover), só muda a paleta e o comando aplicado por quem chama.
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
    <div className="email-editor-toolbar-popover email-editor-toolbar-popover-cores">
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
    </div>
  );
}

/**
 * Barra de ferramentas do corpo do e-mail (refatoracaoEmailFormatado.md —
 * Etapa 3, com Etapas 4 a 8 completadas aqui). Cada botão de marca simples
 * liga diretamente a um comando do Tiptap
 * (`editor.chain().focus().toggleX().run()`); o estado ativo/inativo vem de
 * `useEditorState`, que reage a toda transação do editor sem precisar de
 * listeners manuais.
 *
 * Seções fixas da toolbar (refatoracaoEmailFormatado.md, revisão — Etapa 4):
 * Funções Básicas, Extras, Listas, Alinhamento, Limpar Formatação, nessa
 * ordem, cada uma montada com `ToolbarGrupo` (`editor/ToolbarGrupo.tsx`).
 * "Transformar em botão" (Etapa 7) mudou de posição nesta revisão — antes
 * ficava sozinho entre Listas e Alinhamento, agora entra no grupo Extras,
 * junto de Cor/Realce/Link (é o agrupamento definido na revisão, não uma
 * mudança de comportamento do próprio botão).
 *
 * Cor de texto e realce (Etapa 4) abrem um painel próprio (`PainelCores`)
 * com a paleta fixa definida acima — não um `<input type="color">` livre,
 * por decisão de escopo registrada em refatoracaoEmailFormatado.md. Link
 * (Etapa 5) abre um popover com um campo de URL; reaproveita
 * `editor.getAttributes('link').href` para pré-preencher o campo quando o
 * cursor já está sobre um link existente (edição), e
 * `extendMarkRange('link')` para que a marca inteira seja substituída, não
 * só o trecho selecionado no momento do clique.
 *
 * Os três painéis (cor, realce, link) são popovers independentes, cada um
 * com sua própria ref para fechamento ao clicar fora — só um fica aberto
 * por vez (abrir um fecha os outros dois).
 *
 * Listas (Etapa 6): dois botões de toggle simples, sem UI própria —
 * `toggleBulletList`/`toggleOrderedList` já vêm prontos do
 * `BulletList`/`OrderedList`/`ListItem` do StarterKit (nenhuma extensão
 * adicional foi necessária). Por decisão de escopo não há numeração
 * aninhada tipo "2.1." — o estilo de cada nível (disc/circle/decimal) é só
 * CSS, em `index.css`.
 *
 * Botão estilizado (Etapa 7, completada aqui): `toggleNoBotao()` — comando
 * exposto pela extensão de nó customizado `NoBotao` (ver
 * `editor/extensoes/NoBotao.ts`). Não abre painel próprio; é um toggle
 * direto, igual aos de lista, já que o estilo do "botão" é fixo (decisão de
 * escopo).
 *
 * Alinhamento (Etapa 8, completada aqui; direita/justificado adicionados na
 * revisão — Etapa 2): quatro botões de toggle simples (esquerda/centro/
 * direita/justificado), chamando `setTextAlign('left' | 'center' | 'right' |
 * 'justify')`. Não usa `toggleX()` como as marcas simples porque `TextAlign`
 * não expõe um comando de toggle — cada botão define o alinhamento
 * diretamente; clicar no botão do valor já ativo simplesmente o reaplica
 * (sem efeito perceptível), então não há necessidade de um estado "nenhum
 * alinhamento" na UI. O estado ativo de cada botão vem de `ed.isActive({
 * textAlign: <valor> })`; "esquerda" é o único calculado por exclusão (nenhum
 * dos outros três ativo), já que `defaultAlignment: 'left'` (configurado em
 * `EmailEditorRico.tsx`) não deixa o schema gravar `text-align: left`
 * explicitamente no HTML.
 *
 * Limpar formatação (Etapa 11, completada aqui): botão de ação simples (não
 * um toggle — não tem estado ativo/inativo), chamando
 * `unsetAllMarks().clearNodes().run()`. Não precisa de nenhum código extra
 * para restringir o efeito à seleção atual: é o comportamento padrão do
 * Tiptap/ProseMirror para esses dois comandos — eles operam sobre o range
 * selecionado no momento (ou, com a seleção colapsada, não têm nada para
 * limpar) — nunca sobre o documento inteiro. `clearNodes()` também remove o
 * envolvimento do nó de botão (Etapa 7) e o alinhamento (Etapa 8) quando a
 * seleção estiver dentro deles, já que ambos contam como "nó" para esse
 * comando, não como marca. Reaproveita `IconeRestaurar` (já usado alhures no
 * projeto para "desfazer"/"restaurar") em vez de um ícone novo — a ação é,
 * em espírito, a mesma: reverter para o estado sem formatação.
 */
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
  alinhamentoCentro: false,
  alinhamentoDireita: false,
  alinhamentoJustificado: false,
};

export function EmailEditorToolbar({ editor }: Props) {
  const [painelAberto, setPainelAberto] = useState<'cor' | 'realce' | 'link' | null>(null);
  const [linkValorInput, setLinkValorInput] = useState('');

  const painelCorRef = useRef<HTMLDivElement>(null);
  const painelRealceRef = useRef<HTMLDivElement>(null);
  const painelLinkRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

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
        // Etapa 8 (revisão — Etapa 2 adiciona direita/justificado): cada
        // botão calcula seu próprio estado ativo; "esquerda" (abaixo, no
        // botão) é o único obtido por exclusão dos outros três, já que
        // `defaultAlignment: 'left'` não grava `text-align: left` no HTML.
        alinhamentoCentro: ed.isActive({ textAlign: 'center' }),
        alinhamentoDireita: ed.isActive({ textAlign: 'right' }),
        alinhamentoJustificado: ed.isActive({ textAlign: 'justify' }),
      };
    },
  }) ?? ESTADO_EDITOR_INDISPONIVEL;

  // Fecha o painel aberto ao clicar fora dele (Etapa 4/5) — mesmo padrão já
  // usado em outros dropdowns do projeto (ex.: menu de configurações do
  // cabeçalho).
  useEffect(() => {
    if (!painelAberto) return;

    function handleClickFora(e: MouseEvent) {
      const alvo = e.target as Node;
      const refAtual =
        painelAberto === 'cor' ? painelCorRef : painelAberto === 'realce' ? painelRealceRef : painelLinkRef;
      if (refAtual.current && !refAtual.current.contains(alvo)) {
        setPainelAberto(null);
      }
    }

    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, [painelAberto]);

  // Fecha com ESC, de qualquer um dos três painéis.
  useEffect(() => {
    if (!painelAberto) return;

    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setPainelAberto(null);
    }

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [painelAberto]);

  // Foca (e seleciona) o campo de URL ao abrir o popover de link. Só DOM,
  // sem setState — o pré-preenchimento do valor acontece em `alternarPainel`,
  // no clique que abre o painel, não aqui.
  useEffect(() => {
    if (painelAberto !== 'link') return;
    linkInputRef.current?.focus();
    linkInputRef.current?.select();
  }, [painelAberto]);

  function alternarPainel(painel: 'cor' | 'realce' | 'link') {
    const abrindo = painelAberto !== painel;
    setPainelAberto(abrindo ? painel : null);
    // Pré-preenche com a URL do link atual (se o cursor estiver sobre um) ao
    // abrir o painel de link — feito aqui, no clique, não num efeito.
    if (abrindo && painel === 'link') {
      setLinkValorInput(estado.linkHref);
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
   * Limpar formatação (Etapa 11 — refatoracaoEmailFormatado.md). Restrito à
   * seleção atual por padrão do próprio Tiptap (ver JSDoc do componente,
   * acima) — não precisa de nenhum recorte manual de range aqui.
   */
  function limparFormatacao() {
    editor?.chain().focus().unsetAllMarks().clearNodes().run();
  }

  return (
    <div className="email-editor-toolbar" role="toolbar" aria-label="Formatação do corpo do e-mail">
      <ToolbarGrupo titulo="Funções Básicas">
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
      </ToolbarGrupo>

      <div className="email-editor-toolbar-separador" role="separator" />

      <ToolbarGrupo titulo="Extras">
        <div className="email-editor-toolbar-grupo" ref={painelCorRef}>
          <button
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
            <PainelCores
              paleta={PALETA_COR_TEXTO}
              corAtiva={estado.corAtiva}
              rotuloRemover="Remover cor"
              onEscolher={aplicarCorTexto}
              onRemover={removerCorTexto}
            />
          )}
        </div>

        <div className="email-editor-toolbar-grupo" ref={painelRealceRef}>
          <button
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
            <PainelCores
              paleta={PALETA_REALCE}
              corAtiva={estado.realceCorAtiva}
              rotuloRemover="Remover realce"
              onEscolher={aplicarRealce}
              onRemover={removerRealce}
            />
          )}
        </div>

        <div className="email-editor-toolbar-grupo" ref={painelLinkRef}>
          <button
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
            <div className="email-editor-toolbar-popover email-editor-toolbar-popover-link">
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
            </div>
          )}
        </div>

        <button
          type="button"
          className={`email-editor-toolbar-botao ${estado.noBotaoAtivo ? 'ativo' : ''}`}
          onClick={() => editor?.chain().focus().toggleNoBotao().run()}
          disabled={!editor}
          title="Transformar em botão"
          aria-label="Transformar em botão"
          aria-pressed={estado.noBotaoAtivo}
        >
          <IconeBotaoEmail />
        </button>
      </ToolbarGrupo>

      <div className="email-editor-toolbar-separador" role="separator" />

      <ToolbarGrupo titulo="Listas">
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
      </ToolbarGrupo>

      <div className="email-editor-toolbar-separador" role="separator" />

      <ToolbarGrupo titulo="Alinhamento">
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
      </ToolbarGrupo>

      <div className="email-editor-toolbar-separador" role="separator" />

      <ToolbarGrupo titulo="Limpar Formatação">
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
      </ToolbarGrupo>
    </div>
  );
}