import { useState } from 'react';

import type { EmailConteudo } from '../types/email';
import { ConfirmDialog } from './ConfirmDialog';
import { Dialog } from './Dialog';

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
 * Só o campo `conteudo` é multilinha (textarea); `titulo` é um input de
 * texto simples. Por enquanto ambos são texto puro, sem WYSIWYG/HTML
 * (formatação rica fica como possível melhoria futura, conforme o plano).
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
        <textarea
          id="email-conteudo-corpo"
          className="campo-corpo-email"
          value={conteudo}
          onChange={(evento) => setConteudo(evento.target.value)}
          placeholder="Corpo do e-mail"
        />
        <span className="modal-campo-contador">{conteudo.length} caracteres</span>
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
