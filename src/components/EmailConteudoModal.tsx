import { useState } from 'react';

import type { EmailConteudo } from '../types/email';
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
 */
export function EmailConteudoModal({ email, onFechar, onSalvar }: Props) {
  const [titulo, setTitulo] = useState(email.titulo);
  const [conteudo, setConteudo] = useState(email.conteudo);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    if (salvando) return;
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
      onClose={fechar}
      title="Editar e-mail"
      className="modal-email-conteudo"
      footer={
        <>
          <button type="button" className="dialog-botao-cancelar" onClick={fechar} disabled={salvando}>
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
          value={conteudo}
          onChange={(evento) => setConteudo(evento.target.value)}
          placeholder="Corpo do e-mail"
          rows={10}
        />
      </div>

      {erro && <p className="erro-salvamento">{erro}</p>}
    </Dialog>
  );
}
