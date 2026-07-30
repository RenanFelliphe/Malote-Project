import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import { useEffect, useRef, useState } from 'react';

interface Props {
  /**
   * Chamado com o caractere Unicode do emoji escolhido
   * (`emojiData.emoji`, ex.: '😀') assim que o usuário clica em um emoji no
   * popover — o popover já se fecha sozinho em seguida. A inserção de fato
   * no editor (`editor.chain().focus().insertContent(emoji).run()`) fica a
   * cargo de quem usa este componente; ele só abre/fecha o próprio popover
   * e repassa a escolha adiante — ver `EmailEditorRico.tsx` (revisão —
   * Etapa 10) para a conexão real com o Tiptap.
   */
  onSelecionarEmoji: (emoji: string) => void;
}

/**
 * Botão flutuante de emojis (refatoracaoEmailFormatado.md, revisão — Etapa
 * 9). Pensado para ficar ancorado no canto inferior direito de
 * `EmailConteudoModal.tsx` (ver JSDoc de `.email-emoji-flutuante` em
 * `index.css`): o container pai precisa declarar `position: relative` —
 * já feito em `.modal-email-conteudo` — para que este `position: absolute`
 * se posicione em relação ao modal, sobrepondo o conteúdo em vez de ocupar
 * espaço no fluxo normal, no mesmo espírito de outros elementos flutuantes
 * já existentes no projeto.
 *
 * Usa a biblioteca `emoji-picker-react` (decisão de escopo da Etapa 9: usar
 * uma solução pronta, já madura em categorias/busca/spec Unicode, em vez de
 * implementar do zero). Foi a escolhida entre as candidatas por ter
 * `peerDependencies` compatível com React 19 (`emoji-mart`/`@emoji-mart/react`
 * ainda travam em `^16 || ^17 || ^18`).
 *
 * O popover segue o mesmo padrão de estado/fechamento (clique fora + Esc)
 * já usado em `EmailEditorToolbar.tsx` para os painéis de cor/realce/link/
 * botão — aqui simplificado para uma única ref, por só existir um popover
 * neste componente (não há necessidade de decidir "qual painel" fechar).
 *
 * A conexão com o editor (renderização dentro do modal e ligação de
 * `onSelecionarEmoji` à inserção real no Tiptap) é feita em
 * `EmailEditorRico.tsx` (revisão — Etapa 10) — este componente permanece
 * agnóstico ao Tiptap, só abre/fecha o próprio popover e repassa a escolha
 * adiante via `onSelecionarEmoji`.
 */
export function EmojiPickerFlutuante({ onSelecionarEmoji }: Props) {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora do botão/popover — mesmo padrão já usado nos
  // popovers de `EmailEditorToolbar.tsx`.
  useEffect(() => {
    if (!aberto) return;

    function handleClickFora(e: MouseEvent) {
      const alvo = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(alvo)) {
        setAberto(false);
      }
    }

    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, [aberto]);

  // Fecha com ESC.
  useEffect(() => {
    if (!aberto) return;

    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false);
    }

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [aberto]);

  function handleEmojiClick(emojiData: EmojiClickData) {
    onSelecionarEmoji(emojiData.emoji);
    setAberto(false);
  }

  return (
    <div className="email-emoji-flutuante" ref={containerRef}>
      <button
        type="button"
        className="email-emoji-flutuante-gatilho"
        onClick={() => setAberto((atual) => !atual)}
        title="Inserir emoji"
        aria-label="Inserir emoji"
        aria-haspopup="true"
        aria-expanded={aberto}
      >
        🙂
      </button>

      {aberto && (
        <div className="email-emoji-flutuante-painel">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            width={280}
            height={320}
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}
    </div>
  );
}
