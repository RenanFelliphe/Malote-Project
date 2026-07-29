import { useState } from 'react';

import type { EmailConteudo } from '../types/email';
import { ConfirmDialog } from './ConfirmDialog';
import { Dialog } from './Dialog';
import { EmailEditorRico } from './EmailEditorRico';

interface Props {
  /** Título/corpo atualmente salvos, usados para preencher os campos ao abrir. */
  email: EmailConteudo;
  onFechar: () => void;
  /**
   * Persiste o novo título/corpo (via `emailsApi`, seção 2.2 — gravação
   * imediata). Deve rejeitar/lançar em caso de falha, para que o modal
   * exiba a mensagem de erro e não feche sozinho.
   */
  onSalvar: (novoEmail: EmailConteudo) => Promise<void>;
}

/**
 * Modal de edição de título/corpo do e-mail (Etapa 3 de
 * REFATORACAO-EMAIL-TITULO-CONTEUDO.md), aberto pelo item "Editar e-mail" do
 * dropdown de configurações (`Header`). Construído diretamente sobre o
 * `Dialog` (mesmo padrão do `ExportarModal`) — não é um conflito real, então
 * não usa o template `ConflictDialog`.
 *
 * `titulo` é um input de texto simples. `conteudo` usa o editor de
 * formatação rica (`EmailEditorRico`, baseado em Tiptap — ver
 * refatoracaoEmailFormatado.md, Etapa 2), que produz/consome HTML em vez de
 * texto puro; o contador de caracteres reflete o texto visível
 * (`editor.getText().length`, via `onContagemChange`), não o tamanho da
 * string HTML.
 *
 * "Salvar" persiste imediatamente e fecha o modal ao concluir com sucesso;
 * em caso de falha, o modal permanece aberto exibindo a mensagem de erro,
 * preservando o que o usuário já digitou.
 *
 * Etapa 6 (RefatoracaoModais.md): fechar (clique fora, ESC ou "Cancelar")
 * com `titulo`/`conteudo` diferentes dos valores originais de `email`
 * dispara uma confirmação (`ConfirmDialog`, reaproveitando o mesmo padrão
 * visual usado pelo `ImportWizardModal`) antes de descartar as alterações.
 */
export function EmailConteudoModal({ email, onFechar, onSalvar }: Props) {
  const [titulo, setTitulo] = useState(email.titulo);
  const [conteudo, setConteudo] = useState(email.conteudo);
  // Contador de caracteres do corpo (Etapa 2 — "Atenção", refatoracaoEmailFormatado.md):
  // precisa refletir o texto visível (`editor.getText().length`), não o
  // tamanho da string HTML de `conteudo`. Inicializado com o tamanho do HTML
  // salvo só como placeholder até o editor montar e reportar a contagem real
  // via `onContagemChange` (`onCreate` do Tiptap já dispara isso no mount).
  const [contagemCaracteres, setContagemCaracteres] = useState(email.conteudo.length);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoFechamento, setConfirmandoFechamento] = useState(false);

  const alteracoesPendentes = titulo !== email.titulo || conteudo !== email.conteudo;

  function solicitarFechamento() {
    if (salvando) return;
    if (alteracoesPendentes) {
      setConfirmandoFechamento(true);
      return;
    }
    onFechar();
  }

  function continuarEditando() {
    setConfirmandoFechamento(false);
  }

  function descartarAlteracoes() {
    setConfirmandoFechamento(false);
    onFechar();
  }

  async function handleSalvar() {
    if (salvando) return;

    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({ titulo, conteudo, atualizado_em: new Date().toISOString() });
      onFechar();
    } catch {
      setErro('Não foi possível salvar as alterações. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog
      isOpen
      onClose={solicitarFechamento}
      title="Editar e-mail"
      className="modal-email-conteudo"
      // Enquanto a confirmação de descarte (dialog aninhado) está aberta, o
      // Esc deve fechar apenas ela — não também disparar solicitarFechamento
      // deste dialog externo (mesmo padrão do ImportWizardModal).
      closeOnEsc={!confirmandoFechamento}
      footer={
        <>
          <button
            type="button"
            className="dialog-botao-cancelar"
            onClick={solicitarFechamento}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="dialog-botao-primario"
            onClick={() => void handleSalvar()}
            disabled={salvando}
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <div className="modal-campo">
        <label htmlFor="email-conteudo-titulo" className="modal-campo-label">
          Título
        </label>
        <input
          id="email-conteudo-titulo"
          type="text"
          value={titulo}
          onChange={(evento) => setTitulo(evento.target.value)}
          placeholder="Assunto do e-mail"
        />
      </div>

      <div className="modal-campo">
        <label htmlFor="email-conteudo-corpo" className="modal-campo-label">
          Corpo
        </label>
        <EmailEditorRico
          id="email-conteudo-corpo"
          value={conteudo}
          onChange={setConteudo}
          onContagemChange={setContagemCaracteres}
          placeholder="Corpo do e-mail"
        />
        <span className="modal-campo-contador">{contagemCaracteres} caracteres</span>
      </div>

      {erro && <p className="erro-salvamento">{erro}</p>}

      {confirmandoFechamento && (
        <ConfirmDialog
          ariaLabel="Descartar alterações do e-mail"
          titulo="Descartar alterações?"
          descricao="As alterações feitas no título e/ou corpo do e-mail não foram salvas e serão perdidas."
          rotuloCancelar="Continuar editando"
          rotuloConfirmar="Descartar alterações"
          onCancelar={continuarEditando}
          onConfirmar={descartarAlteracoes}
        />
      )}
    </Dialog>
  );
}
