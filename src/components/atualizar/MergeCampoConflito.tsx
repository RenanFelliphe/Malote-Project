export interface ItemMergeConflito {
  id: number;
  ours: { nome: string; email: string };
  theirs: { nome: string; email: string };
  camposConflitantes?: Array<'nome' | 'email'>;
}

interface Props {
  /** Rótulo do tipo de conflito, exibido antes do id em cada item (ex. "Registro enviado"). */
  titulo: string;
  instrucao: string;
  itens: ItemMergeConflito[];
  rotuloOurs: string;
  rotuloTheirs: string;
  /**
   * Valores livres de decisão (não fixos em "ours"/"theirs") — o
   * significado muda por seção: em "Enviado", por exemplo, as opções são
   * "manter-enviado"/"desenviar", não um genérico aceitar-ours/
   * aceitar-theirs. `onDecisaoChange`/`onDecisaoEmMassa` sempre recebem um
   * destes dois valores.
   */
  valorOurs: string;
  valorTheirs: string;
  decisoes: Record<number, string>;
  onDecisaoChange: (id: number, decisao: string) => void;
  /** Atalho de resolução em massa — aplica `decisao` a todos os `itens` de uma vez. */
  onDecisaoEmMassa: (decisao: string) => void;
}

/**
 * Componente de merge theirs/ours — Etapa 6 de AtualizacaoDaPlanilhaViaUI.md.
 *
 * Compartilhado pelas 3 seções de conflito que comparam um valor atual
 * ("ours") contra o valor vindo da planilha ("theirs") registro a registro:
 * Enviado, Deletado/revivido e Atributo alterado (seção 4 do planner,
 * tabela de aplicabilidade). A seção "Sumido da planilha" não usa este
 * componente — não tem um "theirs" de nome/e-mail para comparar, só a
 * decisão ignorar/marcar como deletado (`RegistrosSumidosSection`, Etapa 5).
 *
 * Não reaproveita `ConflictDialog` como casco de conteúdo — refatorá-lo
 * fica fora do escopo desta demanda (seção 2 do planner, "débito técnico");
 * usa só o padrão visual do wizard de importação (`.etapa-importacao`/
 * `.revisao-lista`, ver `EtapaRevisao.tsx`) como referência de layout,
 * nascendo como um componente à parte.
 *
 * Substitui `SecaoMergeSimples`, a UI provisória que vivia embutida em
 * `AtualizarRegistrosModal.tsx` desde a Etapa 5 — mesmo layout item a
 * item, com o acréscimo dos atalhos de resolução em massa ("aceitar todos
 * os theirs" / "aceitar todos os ours") previstos no "O que fazer" desta
 * etapa. `onDecisaoEmMassa` é responsabilidade do chamador (substitui o
 * `Record` de decisões inteiro de uma vez) para não duplicar aqui a lógica
 * de quais ids pertencem à seção — o chamador já tem essa lista em `itens`.
 */
export function MergeCampoConflito({
  titulo,
  instrucao,
  itens,
  rotuloOurs,
  rotuloTheirs,
  valorOurs,
  valorTheirs,
  decisoes,
  onDecisaoChange,
  onDecisaoEmMassa,
}: Props) {
  const totalResolvidos = itens.filter((item) => decisoes[item.id] !== undefined).length;

  return (
    <div className="etapa-atualizar secao-conflito">
      <p className="etapa-atualizar-instrucao">{instrucao}</p>

      <div className="conflito-acoes-massa">
        <span className="conflito-acoes-massa-contador">
          {totalResolvidos} de {itens.length} resolvido(s)
        </span>
        <button type="button" className="botao-acao-massa" onClick={() => onDecisaoEmMassa(valorOurs)}>
          Aceitar todos: {rotuloOurs}
        </button>
        <button type="button" className="botao-acao-massa" onClick={() => onDecisaoEmMassa(valorTheirs)}>
          Aceitar todos: {rotuloTheirs}
        </button>
      </div>

      <ul className="lista-conflitos">
        {itens.map((item) => (
          <li key={item.id} className="lista-conflitos-item">
            <p className="lista-conflitos-titulo">
              {titulo} — id {item.id}
              {item.camposConflitantes && item.camposConflitantes.length > 0 && (
                <span className="lista-conflitos-campos"> ({item.camposConflitantes.join(', ')})</span>
              )}
            </p>

            <div className="conflito-valores">
              <div className="conflito-valor">
                <span className="conflito-valor-rotulo">Valor atual</span>
                <span>{item.ours.nome || '(sem nome)'}</span>
                <span>{item.ours.email || '(sem e-mail)'}</span>
              </div>
              <div className="conflito-valor">
                <span className="conflito-valor-rotulo">Valor da planilha</span>
                <span>{item.theirs.nome || '(sem nome)'}</span>
                <span>{item.theirs.email || '(sem e-mail)'}</span>
              </div>
            </div>

            <div className="conflito-opcoes" role="radiogroup" aria-label={`Decisão para o registro de id ${item.id}`}>
              <button
                type="button"
                className={`opcao-decisao ${decisoes[item.id] === valorOurs ? 'selecionada' : ''}`}
                onClick={() => onDecisaoChange(item.id, valorOurs)}
                aria-pressed={decisoes[item.id] === valorOurs}
              >
                {rotuloOurs}
              </button>
              <button
                type="button"
                className={`opcao-decisao ${decisoes[item.id] === valorTheirs ? 'selecionada' : ''}`}
                onClick={() => onDecisaoChange(item.id, valorTheirs)}
                aria-pressed={decisoes[item.id] === valorTheirs}
              >
                {rotuloTheirs}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
