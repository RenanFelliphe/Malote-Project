import { useEffect, useRef, useState } from 'react';

import type { EmailRecord, TStatusManual } from '../types/email';
import { STATUS_SELECIONAVEIS } from '../types/email';
import { restaurarCampos, type TCampoRestauravel } from './utils/restaurarCampos';
import { isValidEmail, normalizeEmail } from './EmailStatus';
import {
  IconeAlerta,
  IconeArrastar,
  IconeConfirmarEnvio,
  IconeCopiar,
  IconeEditarStatus,
  IconeLixeira,
  IconeRestaurar,
} from './Icons';

/** Colunas copiáveis via botão no cabeçalho (seção 7). */
export type TColunaCopiavel = 'nome' | 'email';

/** Por quanto tempo o botão de copiar mostra o feedback "Copiado!" antes de voltar ao normal. */
const DURACAO_FEEDBACK_COPIA_MS = 1500;

/**
 * Campos de `EmailRecord` editáveis inline por esta demanda (seção 2,
 * "Não cobre": `id` nunca é editável, é a chave de sincronização; `status`
 * já tem seu próprio fluxo via select em `renderStatus`, com regra de
 * proteção equivalente mas independente).
 */
export type TCampoEditavel = 'nome' | 'email';

/**
 * Aplica a regra de captura "primeira vez vence" (`EdicaoIndividualdeRegistro.md`,
 * seção 3) ao confirmar a edição inline de `nome` ou `email`: se
 * `backup_dados[campo]` já existe, permanece intocado — a primeira captura
 * nunca é sobrescrita por edições seguintes do mesmo campo. Caso contrário,
 * captura o valor **atual** do registro (que neste momento ainda é o valor
 * anterior a esta edição — vindo da planilha ou de uma edição anterior de
 * um campo diferente) como o "original da planilha" para fins de futura
 * restauração.
 *
 * Função pura, sem efeitos colaterais (não persiste nada) — chamada pelo
 * handler de confirmação da edição inline de célula (`confirmarEdicaoCelula`,
 * Etapa 4, logo abaixo) antes de propagar o registro atualizado para
 * `persistirRegistros` (`emails.tsx`). Não faz recálculo de status: o
 * chamador decide o que fazer com o valor já validado antes de invocar esta
 * função, e não recalcula status aqui porque a edição de `nome`/`email` não
 * necessariamente afeta o status (só a edição de `email` pode, e mesmo
 * assim apenas quando `backup_dados.status` estiver ausente — regra que
 * também fica por conta do chamador, seção 4 do planner).
 */
export function capturarEdicaoCampo(
  registro: EmailRecord,
  campo: TCampoEditavel,
  novoValor: string
): EmailRecord {
  const jaCapturado = registro.backup_dados?.[campo] !== undefined;

  return {
    ...registro,
    [campo]: novoValor,
    backup_dados: jaCapturado
      ? registro.backup_dados
      : { ...registro.backup_dados, [campo]: registro[campo] },
    last_updated: new Date().toISOString(),
  };
}

interface Props {
  registros: EmailRecord[];
  /**
   * Conjunto de e-mails (normalizados) que aparecem em mais de um registro
   * ativo — calculado uma única vez em `emails.tsx` (Demanda 10, Etapa 3 de
   * `RefatoracaoSistemadeDuplicatas.md`) e repassado aqui em vez de esta
   * tabela recalculá-lo por conta própria. A partir da Etapa 7, decide a
   * exibição do ícone de alerta ao lado do status (`renderIconeDuplicado`).
   */
  emailsDuplicados: Set<string>;
  selecionados: Set<string>;
  onAlternarSelecao: (id: string) => void;
  onAlternarSelecaoTodos: () => void;
  /**
   * Chamada ao clicar no botão de copiar do cabeçalho de "Nome" ou "E-mail"
   * (seção 7). Corrige o bug em que a cópia só enxergava os registros
   * selecionados que estivessem na página/filtro/busca atualmente exibidos
   * (`registros` aqui é só o slice renderizado — `registrosExibidos` em
   * `emails.tsx`): a montagem dos valores a copiar passa a acontecer do
   * lado de fora, sobre o array completo de registros (`registros`, o
   * state em `emails.tsx`, não o slice), que é a única fonte que conhece
   * todos os registros selecionados independentemente de paginação. Esta
   * tabela permanece responsável só pelo feedback visual ("Copiado!") —
   * mesmo padrão já usado por `onDeletar`/`onConfirmarEnvio` para ações que
   * dependem da seleção global. Sem esta prop, os botões de copiar do
   * cabeçalho continuam ocultos (mesmo padrão condicional das demais ações
   * do cabeçalho).
   */
  onCopiarColuna?: (coluna: TColunaCopiavel) => Promise<void> | void;
  /**
   * Indica se um registro pode ser (des)selecionado no momento. Usada para
   * desabilitar visualmente os registros do "outro grupo" quando já há uma
   * seleção em andamento — regra de seleção da seção 7: não é permitido
   * selecionar deletados e não deletados simultaneamente.
   */
  selecionavel?: (registro: EmailRecord) => boolean;
  /**
   * Chamada ao clicar no ícone de alerta de duplicidade ao lado do status
   * de um registro (Demanda 10, Etapa 7 — antes, badge de status
   * `'duplicado'`), para abrir o modal com os demais registros do mesmo
   * e-mail. Ver `renderIconeDuplicado` abaixo.
   */
  onClicarDuplicado?: (registro: EmailRecord) => void;
  /**
   * Chamada ao selecionar uma nova opção no select inline de status de um
   * registro individual (qualquer status exceto "duplicado" e "deletado" —
   * ver `renderStatus` abaixo). Atualiza imediatamente apenas aquele
   * registro.
   */
  onAtualizarStatusIndividual?: (id: string, status: TStatusManual) => void;
  /**
   * Chamada ao escolher uma opção no select de atualização em massa, aberto
   * pelo ícone de edição ao lado do cabeçalho da coluna Status. Aplica o
   * novo status a todos os registros atualmente selecionados — a exclusão
   * dos registros com status "duplicado" dentre os selecionados é feita no
   * handler (seção 7, regra importante da alteração em massa), não aqui.
   * Desde a Etapa 3, "enviado" não é mais uma opção deste select: passou a
   * ser exclusivo do botão "Confirmar envio" no cabeçalho da tabela.
   */
  onAtualizarStatusEmMassa?: (status: TStatusManual) => void;
  /**
   * true quando TODOS os registros selecionados já estão com status
   * "deletado" — decide qual dos dois ícones aparece no cabeçalho (seção 7):
   * registros já deletados não podem ser deletados de novo, então o ícone de
   * lixeira dá lugar ao de restaurar nesse caso.
   */
  todosSelecionadosDeletados?: boolean;
  /**
   * Chamada ao clicar no ícone de lixeira no extremo direito do cabeçalho
   * da tabela (Etapa 3). Dispara a mesma lógica de exclusão de sempre
   * (inclusive o modal de conflito para registros "enviado") — só a
   * posição do botão mudou.
   */
  onDeletar?: () => void;
  /**
   * Chamada ao clicar no ícone "Confirmar envio" no cabeçalho da tabela
   * (Etapa 3), posicionado à esquerda do botão de deletar. Segue o mesmo
   * padrão do botão de deletar: aplica o status "enviado" a todos os
   * registros atualmente selecionados. Fica oculto quando o grupo
   * selecionado é o de registros "deletado" (mesma condição que troca
   * Deletar por Restaurar), já que não faz sentido confirmar o envio de
   * registros já deletados.
   */
  onConfirmarEnvio?: () => void;
  /**
   * Chamada ao confirmar (blur ou Enter) a edição inline de `nome`/`email`
   * de um registro (Etapa 4). O registro recebido já vem com `backup_dados`
   * atualizado pela regra "primeira vez vence" (`capturarEdicaoCampo`,
   * Etapa 3) e com o novo valor gravado no campo editado — o chamador só
   * precisa persistir (`persistirRegistros`, `emails.tsx`) e, quando
   * `campo === 'email'`, recalcular o status automático do conjunto (a
   * edição pode formar ou desfazer um grupo de duplicados). A validação de
  * formato do e-mail é aplicado pelo recálculo de status no chamador.
   * Quando ausente, as células de `nome`/`email` continuam como texto
   * estático não editável (mesmo padrão condicional de
   * `onAtualizarStatusIndividual` sobre o select de status).
   */
  onEditarCampo?: (registroAtualizado: EmailRecord, campo: TCampoEditavel) => void;
  /** Registros que receberam feedback visual temporário após uma restauração. */
  idsRestaurados?: ReadonlySet<string>;
  /**
   * Chamada ao clicar no botão "Restaurar" de uma linha (Etapa 6, `td-acoes`)
   * quando `backup_dados` daquele registro tem **exatamente 1 chave** — o
   * caso "restaura direto, sem modal" da seção 4 do planner. O registro
   * recebido já vem pronto de `restaurarCampos` (Etapa 5, `utils/restaurarCampos.ts`):
   * nome/email já reescritos literalmente e/ou `backup_dados.status` já
   * removido. O chamador só precisa persistir (`persistirRegistros`,
   * `emails.tsx`) e, quando `status` estiver entre `camposRestaurados`,
   * recalcular o status automático do conjunto inteiro — `restaurarCampos`
   * não tem acesso aos demais registros para recontar duplicados, então
   * quem de fato decide o novo valor de status é `recalcularStatusAutomatico`
   * (`EmailStatus.ts`), chamado pelo chamador depois desta propagação.
   * Nome deliberadamente diferente de `onRestaurar` (que já existe e cobre
   * a restauração em lote de registros deletados, vinda da seleção via
   * checkbox) — os dois fluxos não têm relação entre si.
   */
  onRestaurarCampos?: (
    registroAtualizado: EmailRecord,
    camposRestaurados: TCampoRestauravel[]
  ) => void;
  /**
   * Chamada ao clicar no botão "Restaurar" de uma linha quando
   * `backup_dados` daquele registro tem **2 ou mais chaves** — o caso "abre
   * modal de escolha" da seção 4 do planner. Recebe o registro e a lista de
   * campos disponíveis para restaurar (`Object.keys(registro.backup_dados)`),
   * para que quem escuta monte o modal de conflito (`RestaurarCamposModal`,
   * Etapa 7) sem precisar recalcular essa lista. Ainda não é passada por
   * `emails.tsx` nesta etapa — o próprio modal só existe a partir da Etapa
   * 7 — então, por ora, clicar em "Restaurar" num registro com 2+ campos
   * alterados não tem efeito visível, mesmo padrão de degradação graciosa
   * já usado por `onEditarCampo`/`onAtualizarStatusIndividual` quando
   * ausentes.
   */
  onAbrirConflitoRestaurarCampos?: (
    registro: EmailRecord,
    camposDisponiveis: TCampoRestauravel[]
  ) => void;
  /**
   * Chamada ao clicar em "Restaurar campos" no dropdown de ações do
   * cabeçalho (variante em massa da seção 5 do planner), disponível quando
   * ao menos um registro selecionado tem `backup_dados` com 1+ chave.
   * Recebe só os registros selecionados que de fato têm algo em
   * `backup_dados` (os demais não têm nada para restaurar, e ficam de fora
   * para não exigir filtro repetido de quem escuta) e a **união** de todos
   * os campos alterados entre eles, para que quem escuta (`emails.tsx`)
   * monte o mesmo `RestaurarCamposModal` da Etapa 7, agora em modo "em
   * massa". O no-op por registro/campo que não se aplica (tabela de
   * exemplo da seção 5) já é responsabilidade de `restaurarCampos` (Etapa
   * 5) — este componente só decide quais registros e campos entram na
   * escolha, não a aplica.
   *
   * Nome deliberadamente distinto de `onRestaurar` (que já existe e cobre
   * só a remoção em lote de `backup_dados.status`, sem escolha de campos e
   * sem passar por modal algum) — os dois convivem no mesmo dropdown, mas
   * não têm relação entre si.
   */
  onAbrirConflitoRestaurarCamposEmMassa?: (
    registros: EmailRecord[],
    camposDisponiveis: TCampoRestauravel[]
  ) => void;
}

/** Tabela com ID, Nome, E-mail e Status de cada registro (seção 6). */
export function EmailTable({
  registros,
  emailsDuplicados,
  selecionados,
  onAlternarSelecao,
  onAlternarSelecaoTodos,
  onCopiarColuna,
  selecionavel,
  onClicarDuplicado,
  onAtualizarStatusIndividual,
  onAtualizarStatusEmMassa,
  todosSelecionadosDeletados,
  onDeletar,
  onConfirmarEnvio,
  onEditarCampo,
  idsRestaurados,
  onRestaurarCampos,
  onAbrirConflitoRestaurarCampos,
  onAbrirConflitoRestaurarCamposEmMassa,
}: Props) {
  // Qual coluna mostrou "Copiado!" por último (null = nenhuma, ou o feedback já expirou).
  const [colunaCopiada, setColunaCopiada] = useState<TColunaCopiavel | null>(null);
  const [erroEdicaoEmail, setErroEdicaoEmail] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Célula de nome/e-mail atualmente em edição (Etapa 4) — no máximo uma por
  // vez, em qualquer linha. `valorEdicao` é o buffer local de digitação
  // (só propagado para fora no blur/Enter, nunca a cada tecla); revertido
  // sem persistir no Esc, no mesmo espírito do stepper de fonte do editor
  // (`EmailEditorToolbar.tsx`).
  const [edicaoCelula, setEdicaoCelula] = useState<{ id: string; campo: TCampoEditavel } | null>(
    null
  );
  const [valorEdicao, setValorEdicao] = useState('');
  const inputEdicaoRef = useRef<HTMLInputElement | null>(null);

  // Há registros selecionados no momento (usado tanto pelos hooks abaixo
  // quanto na renderização) — precisa vir antes dos hooks que dependem dela.
  const temSelecao = selecionados.size > 0;

  // Controla a exibição do select de atualização em massa, aberto pelo
  // ícone de edição ao lado do cabeçalho da coluna Status (seção 5.2).
  const [selectMassaAberto, setSelectMassaAberto] = useState(false);
  const selectMassaRef = useRef<HTMLSelectElement | null>(null);

  // Controla o dropdown compacto de ações do cabeçalho da tabela.
  const [menuAcoesAberto, setMenuAcoesAberto] = useState(false);
  const menuAcoesRef = useRef<HTMLDivElement | null>(null);
  const botaoAcoesRef = useRef<HTMLButtonElement | null>(null);

  // Limpa o timer pendente ao desmontar, para não chamar setState em um
  // componente já desmontado.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Ao entrar em edição de uma célula (Etapa 4), leva o foco ao `<input>` e
  // já seleciona o conteúdo — evita um clique extra para o usuário limpar o
  // valor antigo antes de digitar o novo. `requestAnimationFrame` garante
  // que o input já esteja montado no DOM antes de focar (mesmo padrão do
  // select de atualização em massa, acima).
  useEffect(() => {
    if (!edicaoCelula) return;

    const frame = window.requestAnimationFrame(() => {
      const input = inputEdicaoRef.current;
      if (!input) return;
      input.focus();
      input.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [edicaoCelula]);

  // Ao abrir o select de atualização em massa, leva o foco a ele e já
  // dispara o dropdown nativo (`showPicker`, quando suportado) — evita um
  // clique extra do usuário para ver as opções. `requestAnimationFrame`
  // garante que o `<select>` já esteja montado no DOM antes de focar.
  useEffect(() => {
    if (!selectMassaAberto) return;

    const frame = window.requestAnimationFrame(() => {
      const select = selectMassaRef.current;
      if (!select) return;

      select.focus();
      if ('showPicker' in select && typeof select.showPicker === 'function') {
        select.showPicker();
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectMassaAberto]);

  const menuAcoesVisivel = menuAcoesAberto && temSelecao;

  // Fecha o dropdown compacto de ações ao clicar fora dele ou pressionar Escape.
  useEffect(() => {
    if (!menuAcoesVisivel) return;

    const handlePointerDown = (event: MouseEvent) => {
      const alvo = event.target as Node | null;
      if (!alvo) return;

      const clicouDentro =
        menuAcoesRef.current?.contains(alvo) || botaoAcoesRef.current?.contains(alvo);
      if (!clicouDentro) {
        setMenuAcoesAberto(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuAcoesAberto(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuAcoesVisivel]);

  /**
   * Dispara a cópia da coluna indicada (nome ou e-mail) para quem escuta
   * (`onCopiarColuna`, `emails.tsx`) e só então exibe o feedback visual
   * "Copiado!". A montagem dos valores e a chamada a `copiarTexto` não
   * acontecem mais aqui — só o array completo de registros em `emails.tsx`
   * (o state `registros`, não o slice `registrosExibidos` recebido por
   * esta tabela) sabe resolver a seleção corretamente, independentemente de
   * paginação/filtro/busca/ordenação em vigor (correção do bug semântico da
   * cópia). Sem `onCopiarColuna`, os botões de copiar continuam ocultos
   * (ver `temSelecao` nos `th` abaixo) — mesmo padrão de degradação
   * graciosa das demais ações condicionais desta tabela.
   */
  async function copiarColuna(coluna: TColunaCopiavel) {
    if (selecionados.size === 0 || !onCopiarColuna) return;

    await onCopiarColuna(coluna);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setColunaCopiada(coluna);
    timeoutRef.current = setTimeout(() => setColunaCopiada(null), DURACAO_FEEDBACK_COPIA_MS);
  }

  /** Entra em modo de edição da célula de `nome`/`email` de um registro (Etapa 4). */
  function iniciarEdicaoCelula(registro: EmailRecord, campo: TCampoEditavel) {
    setEdicaoCelula({ id: registro.id, campo });
    setValorEdicao(registro[campo]);
    setErroEdicaoEmail(null);
  }

  /** Sai do modo de edição sem persistir nada — usado pelo Esc (reversão, seção 2). */
  function cancelarEdicaoCelula() {
    setEdicaoCelula(null);
    setErroEdicaoEmail(null);
  }

  /**
   * Confirma a edição em andamento (blur ou Enter, seção 2): valida,
   * captura em `backup_dados` via `capturarEdicaoCampo` (Etapa 3) e propaga
   * o registro atualizado para `onEditarCampo` (que persiste via
   * `persistirRegistros`, `emails.tsx`). Recebe o `registro` da linha
   * (e não só o id) para não depender de reler `registros` por índice.
   *
   * - Valor idêntico ao atual (inclusive só espaços a mais): encerra a
   *   edição silenciosamente, sem capturar nem persistir — não é uma
   *   correção de fato.
    * - `email` sintaticamente inválido mantém a edição aberta e exibe erro
    *   inline; nenhum valor inválido é persistido.
   * - Valor vazio (após trim): mesmo tratamento de "sem correção" acima —
   *   apagar um nome/e-mail por engano ao editar não é uma correção válida.
   */
  function confirmarEdicaoCelula(registro: EmailRecord) {
    if (!edicaoCelula) return;
    const { campo } = edicaoCelula;
    const valorFinal = valorEdicao.trim();

    if (campo === 'email' && !isValidEmail(valorFinal)) {
      setErroEdicaoEmail('Informe um e-mail válido.');
      return;
    }

    if (valorFinal === '' || valorFinal === registro[campo]) {
      cancelarEdicaoCelula();
      return;
    }

    const registroAtualizado = capturarEdicaoCampo(registro, campo, valorFinal);
    onEditarCampo?.(registroAtualizado, campo);
    cancelarEdicaoCelula();
  }

  /**
   * Renderiza a célula de `nome`/`email` de um registro (Etapa 4): texto
   * estático por padrão, vira `<input>` ao clicar, no mesmo espírito do
   * stepper de tamanho de fonte do editor (`EmailEditorToolbar.tsx`). Sem
   * `onEditarCampo`, a célula permanece somente leitura (mesmo padrão
   * condicional de `renderStatus` sobre `onAtualizarStatusIndividual`).
   */
  function renderCelulaEditavel(registro: EmailRecord, campo: TCampoEditavel) {
    const emEdicao = edicaoCelula?.id === registro.id && edicaoCelula.campo === campo;

    if (!emEdicao) {
      return (
        <span
          className={`celula-editavel ${onEditarCampo ? '' : 'celula-editavel-desabilitada'}`}
          onClick={() => onEditarCampo && iniciarEdicaoCelula(registro, campo)}
          title={onEditarCampo ? `Clique para editar o ${campo}` : undefined}
          tabIndex={onEditarCampo ? 0 : undefined}
          role={onEditarCampo ? 'button' : undefined}
          aria-label={onEditarCampo ? `Editar ${campo} do registro ${registro.id}` : undefined}
          onKeyDown={(evento) => {
            if (onEditarCampo && (evento.key === 'Enter' || evento.key === ' ')) {
              evento.preventDefault();
              iniciarEdicaoCelula(registro, campo);
            }
          }}
        >
          {registro[campo]}
        </span>
      );
    }

    return (
      <>
        <input
          ref={inputEdicaoRef}
          type="text"
          className="input-edicao-inline"
          value={valorEdicao}
          onChange={(evento) => {
            setValorEdicao(evento.target.value);
          }}
          onBlur={() => confirmarEdicaoCelula(registro)}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter') {
              evento.preventDefault();
              confirmarEdicaoCelula(registro);
            } else if (evento.key === 'Escape') {
              evento.preventDefault();
              cancelarEdicaoCelula();
            }
          }}
          aria-label={`Editar ${campo} do registro ${registro.id}`}
          aria-invalid={campo === 'email' && erroEdicaoEmail ? 'true' : undefined}
          aria-describedby={campo === 'email' && erroEdicaoEmail ? `erro-edicao-email-${registro.id}` : undefined}
        />
        {campo === 'email' && erroEdicaoEmail && (
          <span id={`erro-edicao-email-${registro.id}`} className="erro-edicao-inline" role="alert">
            {erroEdicaoEmail}
          </span>
        )}
      </>
    );
  }

  /**
   * Clique no botão "Restaurar" de uma linha (Etapa 6, `td-acoes`): decide
   * entre restaurar direto ou delegar a escolha ao modal de conflito,
   * conforme a seção 4 do planner (o botão só é renderizado, mais abaixo,
   * quando `backup_dados` do registro já tem ao menos 1 chave — chamar esta
   * função com um registro sem `backup_dados` não deveria acontecer, mas a
   * checagem é mantida como salvaguarda).
   *
   * - **1 chave em `backup_dados`:** `restaurarCampos` (Etapa 5) resolve
   *   tudo de uma vez — o registro já atualizado segue direto para
   *   `onRestaurarCampos`, sem abrir modal.
   * - **2+ chaves:** repassa o registro e a lista de campos disponíveis
   *   para `onAbrirConflitoRestaurarCampos`, que vai renderizar o modal de
   *   escolha (Etapa 7).
   */
  function handleClicarRestaurarLinha(registro: EmailRecord) {
    if (!registro.backup_dados) return;
    const camposDisponiveis = Object.keys(registro.backup_dados) as TCampoRestauravel[];
    if (camposDisponiveis.length === 0) return;

    if (camposDisponiveis.length === 1) {
      const registroAtualizado = restaurarCampos(registro, camposDisponiveis);
      onRestaurarCampos?.(registroAtualizado, camposDisponiveis);
      return;
    }

    onAbrirConflitoRestaurarCampos?.(registro, camposDisponiveis);
  }

  /**
   * Clique em "Restaurar campos" no dropdown de ações do cabeçalho —
  * variante em massa (seção 5 do planner). Filtra, dentre os selecionados,
   * só os registros que de fato têm algo em `backup_dados` (os demais não
   * têm nada para restaurar) e calcula a união de todos os campos alterados
   * entre eles, para repassar a `onAbrirConflitoRestaurarCamposEmMassa` —
  * mesmo prop que decide, do lado de fora, como montar o modal em massa
  * (Etapa 7), exceto quando há um único registro e um único campo, caso
  * em que segue diretamente o fluxo individual.
   */
  function handleAbrirRestaurarCamposEmMassa() {
    const candidatos = registros.filter(
      (registro) =>
        selecionados.has(registro.id) &&
        registro.backup_dados &&
        Object.keys(registro.backup_dados).length > 0
    );
    if (candidatos.length === 0) return;

    const camposDisponiveis = Array.from(
      new Set(
        candidatos.flatMap(
          (registro) => Object.keys(registro.backup_dados ?? {}) as TCampoRestauravel[]
        )
      )
    );

    if (candidatos.length === 1 && camposDisponiveis.length === 1) {
      const [registro] = candidatos;
      const registroAtualizado = restaurarCampos(registro, camposDisponiveis);
      onRestaurarCampos?.(registroAtualizado, camposDisponiveis);
      return;
    }

    onAbrirConflitoRestaurarCamposEmMassa?.(candidatos, camposDisponiveis);
  }

  /**
   * Renderiza a célula de status de um registro (seção 7, revisão pós-Etapa
   * 4 — antes vivia numa seção fixa acima da tabela, agora distribuída na
   * própria célula). Dois casos, conforme as respostas de esclarecimento:
   *
   * - "deletado": badge não editável e não clicável — só pode ser revertido
   *   pelo botão de restaurar (seleção em massa), nunca por este select.
   * - demais status (válido/inválido/enviado): badge vira um select inline.
   *   As opções exibidas são sempre "válido"/"inválido" (Etapa 3: "enviado"
   *   deixou de ser uma opção deste select, pois agora só é alcançável pelo
   *   botão "Confirmar envio" no cabeçalho). Quando o registro já está
   *   "enviado", sua opção atual é mantida no select (como último item, na
   *   mesma posição que ocupava antes) só para que o valor selecionado
   *   continue correspondendo a uma opção existente — escolhê-la de novo
   *   não tem efeito, mas o usuário pode trocar para válido/inválido
   *   normalmente.
   *
   * Demanda 10, Etapa 7 (`RefatoracaoSistemadeDuplicatas.md`): o antigo
   * terceiro caso ("duplicado") foi removido daqui — "duplicado" deixou de
   * ser um valor de `status` (Etapa 1). O badge/select que este método
   * renderiza volta a ser sempre o status real do registro; o alerta visual
   * de duplicidade passou a ser um elemento separado, ao lado deste
   * (`renderIconeDuplicado`, abaixo), que pode coexistir com qualquer um
   * dos dois casos que sobraram aqui.
   */
  function renderStatus(registro: EmailRecord) {
    if (registro.status === 'deletado' || !onAtualizarStatusIndividual) {
      return <span className={`status-badge status-${registro.status}`}>{registro.status}</span>;
    }

    const opcoes: TStatusManual[] =
      registro.status === 'enviado' ? [...STATUS_SELECIONAVEIS, 'enviado'] : STATUS_SELECIONAVEIS;

    return (
      <select
        className={`status-select status-${registro.status}`}
        value={registro.status}
        onChange={(evento) =>
          onAtualizarStatusIndividual(registro.id, evento.target.value as TStatusManual)
        }
        aria-label={`Alterar status do registro ${registro.id}`}
      >
        {opcoes.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    );
  }

  /**
   * Ícone de alerta ao lado do badge/select de status (Demanda 10, Etapa 7),
   * exibido sempre que o e-mail do registro estiver em `emailsDuplicados`
   * (`Set` calculado uma única vez em `emails.tsx`, Etapa 3) — nunca para
   * `registro.status === 'deletado'`: o próprio cálculo do `Set` (Etapa 1,
   * `calcularEmailsDuplicados`) já ignora registros deletados ao formar os
   * grupos, então um par onde um dos dois foi excluído deixa de ter
   * duplicidade — o restante ativo passa a não ter mais "irmãos", com ou
   * sem soft delete. Esse comportamento já existia antes desta demanda e
   * não muda; a checagem aqui só evita mostrar o ícone no próprio registro
   * deletado, caso ele compartilhe o e-mail de um grupo ainda ativo.
   *
   * Aplica a **todos** os demais status, inclusive `enviado`: um registro
   * enviado duplicado também recebe o ícone normalmente — é o sinal visual
   * de que existe um possível envio repetido para a mesma pessoa, o alerta
   * que esta demanda existe para dar.
   *
   * É o único elemento clicável da célula que abre o modal de conflito
   * (`onClicarDuplicado`) — o badge/select de `renderStatus` mantém sua
   * função normal (editar, ou só exibir se `deletado`), sem sobreposição de
   * clique na mesma célula.
   *
   * Reaproveita `IconeAlerta` (`Icons.tsx`) sem alterá-lo — hoje usado a
   * 20px em `ErrorBoundary`/`ConfirmDialog`/`ConflictDialog`. Aqui ele
   * precisa ser menor para caber inline na linha da tabela; como o
   * componente não recebe um `size` próprio, a redução é só via CSS, na
   * classe `icone-alerta-duplicado` abaixo (regra ainda não incluída neste
   * pacote — falta o CSS real do projeto, mesma pendência já registrada em
   * `EdicaoIndividualdeRegistro.md`).
   */
  function renderIconeDuplicado(registro: EmailRecord) {
    if (registro.status === 'deletado') return null;
    if (!emailsDuplicados.has(normalizeEmail(registro.email))) return null;

    if (!onClicarDuplicado) {
      return (
        <span className="icone-alerta-duplicado" title="Este registro está duplicado">
          <IconeAlerta />
        </span>
      );
    }

    return (
      <button
        type="button"
        className="icone-alerta-duplicado"
        onClick={() => onClicarDuplicado(registro)}
        title="Este registro está duplicado"
      >
        <IconeAlerta />
      </button>
    );
  }

  /**
   * Aplica o novo status a todos os registros selecionados (seção 5.2, ícone
   * de edição no cabeçalho da coluna Status). A exclusão dos registros
   * "duplicado" dentre os selecionados é responsabilidade do handler
   * (`handleAtualizarStatus`, em emails.tsx) — aqui apenas repassamos a
   * escolha e fechamos o select.
   */
  function handleSelecionarStatusEmMassa(evento: React.ChangeEvent<HTMLSelectElement>) {
    const valor = evento.target.value as TStatusManual | '';
    setSelectMassaAberto(false);
    if (valor && onAtualizarStatusEmMassa) onAtualizarStatusEmMassa(valor);
  }

  if (registros.length === 0) {
    return <p className="tabela-vazia">Nenhum registro encontrado.</p>;
  }

  // "Selecionar todos" considera apenas os registros exibidos (após busca/filtro).
  const todosSelecionados = registros.every((r) => selecionados.has(r.id));

  return (
    <table className="email-table">
      <thead>
        <tr>
          <th>
            <input
              type="checkbox"
              checked={todosSelecionados}
              onChange={onAlternarSelecaoTodos}
              aria-label="Selecionar todos os registros exibidos"
            />
          </th>
          <th>ID</th>
          <th>
            <span className="th-com-copia">
              Nome
              <button
                type="button"
                className={`botao-icone-th ${colunaCopiada === 'nome' ? 'copiado' : ''} ${temSelecao ? '' : 'botao-icone-th-invisivel'
                  }`}
                onClick={() => void copiarColuna('nome')}
                title="Copiar nomes exibidos"
                aria-label="Copiar nomes exibidos"
              >
                <IconeCopiar />
              </button>
            </span>
          </th>
          <th>
            <span className="th-com-copia">
              E-mail
              <button
                type="button"
                className={`botao-icone-th ${colunaCopiada === 'email' ? 'copiado' : ''} ${temSelecao ? '' : 'botao-icone-th-invisivel'
                  }`}
                onClick={() => void copiarColuna('email')}
                title="Copiar e-mails exibidos"
                aria-label="Copiar e-mails exibidos"
              >
                <IconeCopiar />
              </button>
            </span>
          </th>
          <th>
            <span className="th-com-copia">
              Status
              {onAtualizarStatusEmMassa && (
                <span className="th-status-massa">
                  <button
                    type="button"
                    className={`botao-icone-th ${temSelecao ? '' : 'botao-icone-th-invisivel'}`}
                    onClick={() => {
                      if (!temSelecao) return;
                      setSelectMassaAberto((aberto) => !aberto);
                    }}
                    title="Atualizar status dos selecionados"
                    aria-label="Atualizar status dos registros selecionados"
                    aria-expanded={selectMassaAberto}
                  >
                    <IconeEditarStatus />
                  </button>
                  {selectMassaAberto && (
                    <select
                      ref={selectMassaRef}
                      className="select-atualizar-status-massa"
                      value=""
                      onChange={handleSelecionarStatusEmMassa}
                      onBlur={() => setSelectMassaAberto(false)}
                      aria-label="Novo status para os registros selecionados"
                    >
                      <option value="" disabled>
                        Selecione...
                      </option>
                      {STATUS_SELECIONAVEIS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  )}
                </span>
              )}
            </span>
          </th>
          <th className="th-acoes">
            {(onConfirmarEnvio || onDeletar || onAbrirConflitoRestaurarCamposEmMassa) && (
              <div className="th-acoes-menu" ref={menuAcoesRef}>
                <button
                  ref={botaoAcoesRef}
                  type="button"
                  className={`botao-icone-th botao-icone-th-menu ${menuAcoesVisivel ? 'botao-icone-th-menu-aberto' : ''} ${temSelecao ? '' : 'botao-icone-th-invisivel'
                    }`}
                  onClick={() => setMenuAcoesAberto((aberto) => !aberto)}
                  title="Mais ações"
                  aria-label="Abrir mais ações para os registros selecionados"
                  aria-haspopup="menu"
                  aria-expanded={menuAcoesVisivel}
                >
                  <IconeArrastar />
                </button>

                {menuAcoesVisivel && (
                  <div className="acoes-dropdown" role="menu">
                    {onConfirmarEnvio && !todosSelecionadosDeletados && (
                      <button
                        type="button"
                        className="acoes-dropdown-item acoes-dropdown-item-sucesso"
                        onClick={() => {
                          setMenuAcoesAberto(false);
                          onConfirmarEnvio();
                        }}
                        role="menuitem"
                      >
                        <span>Confirmar Envio</span>
                        <IconeConfirmarEnvio />
                      </button>
                    )}

                    {onAbrirConflitoRestaurarCamposEmMassa &&
                      registros.some(
                        (registro) =>
                          selecionados.has(registro.id) &&
                          registro.backup_dados &&
                          Object.keys(registro.backup_dados).length > 0
                      ) && (
                        <button
                          type="button"
                          className="acoes-dropdown-item acoes-dropdown-item-info"
                          onClick={() => {
                            setMenuAcoesAberto(false);
                            handleAbrirRestaurarCamposEmMassa();
                          }}
                          role="menuitem"
                        >
                          <span>Restaurar</span>
                          <IconeRestaurar />
                        </button>
                      )}

                    {!todosSelecionadosDeletados && onDeletar && (
                      <button
                        type="button"
                        className="acoes-dropdown-item acoes-dropdown-item-perigo"
                        onClick={() => {
                          setMenuAcoesAberto(false);
                          onDeletar();
                        }}
                        role="menuitem"
                      >
                        <span>Deletar</span>
                        <IconeLixeira />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </th>
        </tr>
      </thead>
      <tbody>
        {registros.map((registro) => {
          const podeSelecionar = selecionavel ? selecionavel(registro) : true;
          return (
            <tr key={registro.id}>
              <td>
                <input
                  type="checkbox"
                  checked={selecionados.has(registro.id)}
                  onChange={() => onAlternarSelecao(registro.id)}
                  disabled={!podeSelecionar}
                  title={
                    podeSelecionar
                      ? undefined
                      : 'Não é possível selecionar registros deletados e não deletados ao mesmo tempo.'
                  }
                  aria-label={`Selecionar registro ${registro.id}`}
                />
              </td>
              <td>{registro.id}</td>
              <td>{renderCelulaEditavel(registro, 'nome')}</td>
              <td>{renderCelulaEditavel(registro, 'email')}</td>
              <td className="td-status">
                {renderStatus(registro)}
                {renderIconeDuplicado(registro)}
              </td>
              <td className="td-acoes">
                {idsRestaurados?.has(registro.id) && (
                  <span className="feedback-restaurado" role="status">Restaurado</span>
                )}
                {onRestaurarCampos &&
                  registro.backup_dados &&
                  Object.keys(registro.backup_dados).length > 0 && (
                    <button
                      type="button"
                      className={`botao-restaurar-linha ${selecionados.has(registro.id) ? '' : 'botao-restaurar-linha-invisivel'
                        }`}
                      onClick={() => handleClicarRestaurarLinha(registro)}
                      title="Restaurar valor(es) original(is) deste registro"
                      aria-label={`Restaurar valores originais do registro ${registro.id}`}
                    >
                      <IconeRestaurar />
                    </button>
                  )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}