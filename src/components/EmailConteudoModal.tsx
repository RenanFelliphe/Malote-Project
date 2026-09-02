import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import type { EmailConteudo } from '../types/email';
import { ConfirmDialog } from './ConfirmDialog';
import { Dialog } from './Dialog';
import { EmailEditorRico } from './EmailEditorRico';
import { IconeAnexar, IconeRemoverAnexo } from './Icons';

/**
 * Anexo selecionado localmente no modal (RefatoracaoToolbarEmail.md —
 * Etapa 9). `id` é gerado na seleção só para servir de `key`/referência de
 * remoção na lista — não tem relação com o arquivo em si nem é persistido.
 */
interface AnexoSelecionado {
  id: string;
  arquivo: File;
}

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
 *
 * Etapa 9 (RefatoracaoToolbarEmail.md): botão "Anexar arquivo" abaixo do
 * editor, com lista dos arquivos escolhidos (cada um removível antes de
 * salvar). É só UI local (`anexos` nunca é lido por `onSalvar` nem enviado
 * a lugar nenhum). Por isso a lista de anexos também não entra em
 * `alteracoesPendentes`: fechar o modal sem salvar não pede confirmação por
 * causa só dos anexos, já que nada seria perdido que já não se perdesse ao
 * reabrir o modal (nenhum arquivo é de fato retido em lugar nenhum).
 *
 * A mesma etapa corrige o overflow do modal: os campos de título/corpo (que
 * podem crescer com a lista de anexos) ficam num wrapper interno rolável
 * (`.modal-email-conteudo-corpo`), enquanto o header e o rodapé
 * (Salvar/Cancelar), fornecidos pelo `Dialog`, permanecem fixos — em vez de
 * todo o `.dialog-content` rolar junto, o que arrastaria os botões de ação
 * para fora da vista.
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
  // Anexos selecionados localmente (Etapa 9) — ver comentário do componente.
  const [anexos, setAnexos] = useState<AnexoSelecionado[]>([]);
  const inputAnexoRef = useRef<HTMLInputElement>(null);

  const alteracoesPendentes = titulo !== email.titulo || conteudo !== email.conteudo;

  function handleSelecionarAnexos(evento: ChangeEvent<HTMLInputElement>) {
    const arquivosSelecionados = evento.target.files;
    if (arquivosSelecionados && arquivosSelecionados.length > 0) {
      const novos = Array.from(arquivosSelecionados).map((arquivo) => ({
        id: crypto.randomUUID(),
        arquivo,
      }));
      setAnexos((atuais) => [...atuais, ...novos]);
    }
    // Limpa o valor do input para permitir selecionar o mesmo arquivo de
    // novo mais tarde (sem isso, o navegador não dispara `onChange` numa
    // segunda seleção idêntica).
    evento.target.value = '';
  }

  function removerAnexo(id: string) {
    setAnexos((atuais) => atuais.filter((anexo) => anexo.id !== id));
  }

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
      <div className="modal-email-conteudo-corpo">
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

        <div className="modal-campo modal-anexo">
          <span className="modal-campo-label">Anexos</span>
          <div className="modal-anexo-acoes">
            <button
              type="button"
              className="modal-anexo-botao"
              onClick={() => inputAnexoRef.current?.click()}
            >
              <IconeAnexar />
              Anexar arquivo
            </button>
            <input
              ref={inputAnexoRef}
              type="file"
              multiple
              hidden
              onChange={handleSelecionarAnexos}
            />
          </div>

          {anexos.length > 0 && (
            <ul className="modal-anexo-lista">
              {anexos.map(({ id, arquivo }) => (
                <li key={id} className="modal-anexo-item">
                  <span className="modal-anexo-nome" title={arquivo.name}>
                    {arquivo.name}
                  </span>
                  <button
                    type="button"
                    className="modal-anexo-remover"
                    onClick={() => removerAnexo(id)}
                    aria-label={`Remover anexo ${arquivo.name}`}
                  >
                    <IconeRemoverAnexo />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
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