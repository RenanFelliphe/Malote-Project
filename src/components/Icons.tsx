import {
  FiAlertTriangle,
  FiAlignCenter,
  FiAlignJustify,
  FiAlignLeft,
  FiAlignRight,
  FiBold,
  FiCheck,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiChevronUp,
  FiCopy,
  FiDownload,
  FiEdit3,
  FiFileText,
  FiItalic,
  FiLink,
  FiMail,
  FiMinus,
  FiMoon,
  FiMoreHorizontal,
  FiMoreVertical,
  FiPaperclip,
  FiPlus,
  FiRefreshCw,
  FiRotateCcw,
  FiSearch,
  FiSend,
  FiSettings,
  FiSun,
  FiTrash2,
  FiUnderline,
  FiUpload,
  FiX,
} from 'react-icons/fi';
// O conjunto Feather (react-icons/fi), usado em todo o resto do projeto, não
// tem ícones de tachado/cor de texto/realce/listas/"botão". Para esses seis,
// usa-se o conjunto Bootstrap Icons (react-icons/bi), que mantém o mesmo
// estilo de contorno (outline) do Feather — evita misturar um estilo
// preenchido (solid) no meio da toolbar.
import {
  BiColorFill,
  BiFontColor,
  BiHighlight,
  BiLeftIndent,
  BiListOl,
  BiListUl,
  BiRightIndent,
  BiSquareRounded,
  BiStrikethrough,
  BiTable,
} from 'react-icons/bi';
// A barra contextual de tabela (RefatoracaoTabela.md — Etapa 2) precisa de
// ícones de inserir/excluir linha e coluna, que não existem nem no conjunto
// Feather nem no Bootstrap Icons já usados acima. O conjunto Tabler Icons
// (react-icons/tb) tem exatamente esses ícones, no mesmo estilo de contorno
// (outline) dos demais — por isso um terceiro conjunto, em vez de forçar um
// símbolo genérico (ex.: `FiPlus`/`FiMinus`) que não distinguiria linha de
// coluna visualmente.
import {
  TbArrowAutofitWidth,
  TbBorderOuter,
  TbColumnInsertLeft,
  TbColumnInsertRight,
  TbColumnRemove,
  TbRowInsertBottom,
  TbRowInsertTop,
  TbRowRemove,
  TbTableColumn,
  TbTableOff,
  TbTableRow,
} from 'react-icons/tb';
// Mesclar/dividir células (RefatoracaoTabela.md — Etapa 3) não têm
// equivalente nem no Feather, nem no Bootstrap Icons, nem no Tabler Icons já
// usados acima (Tabler tem ícones de linha/coluna de tabela, mas não de
// mesclagem de célula). O conjunto Remix Icon (react-icons/ri) tem
// `MergeCells`/`SplitCells` dedicados, no mesmo estilo de contorno
// (outline) dos demais — por isso um quarto conjunto, pelo mesmo motivo que
// justificou o terceiro (Tabler) na Etapa 2: símbolo genérico não
// distinguiria mesclar de dividir visualmente.
// Duplicar célula (RefatoracaoTabela.md — Etapa 7) precisa de dois símbolos
// direcionais ("copiar para a direita"/"para baixo") que não existem nem no
// Feather, nem no Bootstrap Icons, nem no Tabler já usados acima (Tabler só
// tem `Copyleft`/`Copyright`, símbolos de © sem relação com direção). O
// mesmo conjunto Remix Icon já importado acima para mesclar/dividir célula
// tem `ArrowRightBoxLine`/`ArrowDownBoxLine` — uma seta entrando numa caixa,
// que comunica "copiar para dentro" na direção indicada — no mesmo estilo de
// contorno dos demais, sem precisar de um quinto conjunto de ícones.
import {
  RiArrowDownBoxLine,
  RiArrowRightBoxLine,
  RiMergeCellsHorizontal,
  RiSplitCellsHorizontal,
} from 'react-icons/ri';

export function IconeCopiar() {
  return <FiCopy size={14} aria-hidden="true" />;
}

export function IconeLixeira() {
  return <FiTrash2 size={15} aria-hidden="true" />;
}

export function IconeEditarStatus() {
  return <FiEdit3 size={14} aria-hidden="true" />;
}

export function IconeRestaurar() {
  return <FiRotateCcw size={15} aria-hidden="true" />;
}

/** Ícone do botão "Confirmar envio" no cabeçalho da tabela (mesmo tamanho dos demais botões de ação do cabeçalho: Deletar/Restaurar). */
export function IconeConfirmarEnvio() {
  return <FiSend size={15} aria-hidden="true" />;
}

export function IconeFechar() {
  return <FiX size={18} aria-hidden="true" />;
}

export function IconeTemaClaro() {
  return <FiSun size={16} aria-hidden="true" />;
}

export function IconeTemaEscuro() {
  return <FiMoon size={16} aria-hidden="true" />;
}

export function IconePaginaAnterior() {
  return <FiChevronLeft size={14} aria-hidden="true" />;
}

export function IconePaginaProxima() {
  return <FiChevronRight size={14} aria-hidden="true" />;
}

export function IconeBuscarPagina() {
  return <FiSearch size={14} aria-hidden="true" />;
}

export function IconeImportar() {
  return <FiUpload size={16} aria-hidden="true" />;
}

export function IconePlanilha() {
  return <FiFileText size={18} aria-hidden="true" />;
}

export function IconeConfiguracoes() {
  return <FiSettings size={16} aria-hidden="true" />;
}

export function IconeExportar() {
  return <FiDownload size={15} aria-hidden="true" />;
}

export function IconeAtualizarPlanilha() {
  return <FiRefreshCw size={15} aria-hidden="true" />;
}

/** Ícone do item "Editar e-mail" no dropdown de configurações (REFATORACAO-EMAIL-TITULO-CONTEUDO.md). */
export function IconeEditarEmail() {
  return <FiMail size={15} aria-hidden="true" />;
}

export function IconeAlerta() {
  return <FiAlertTriangle size={20} aria-hidden="true" />;
}

export function IconeCheck() {
  return <FiCheck size={13} aria-hidden="true" />;
}

export function IconeArrastar() {
  return <FiMoreVertical size={15} aria-hidden="true" />;
}

export function IconeSetaCima() {
  return <FiChevronUp size={13} aria-hidden="true" />;
}

export function IconeSetaBaixo() {
  return <FiChevronDown size={13} aria-hidden="true" />;
}

/**
 * Ícones da toolbar do editor de corpo do e-mail
 * (refatoracaoEmailFormatado.md — Etapas 3 a 8, 11). `IconeRestaurar`
 * (definido acima) é reaproveitado para "limpar formatação" — não entra
 * aqui de novo.
 */
export function IconeNegrito() {
  return <FiBold size={14} aria-hidden="true" />;
}

export function IconeItalico() {
  return <FiItalic size={14} aria-hidden="true" />;
}

export function IconeSublinhado() {
  return <FiUnderline size={14} aria-hidden="true" />;
}

export function IconeTachado() {
  return <BiStrikethrough size={16} aria-hidden="true" />;
}

export function IconeCorTexto() {
  return <BiFontColor size={17} aria-hidden="true" />;
}

export function IconeRealce() {
  return <BiHighlight size={17} aria-hidden="true" />;
}

export function IconeLink() {
  return <FiLink size={14} aria-hidden="true" />;
}

export function IconeListaNaoOrdenada() {
  return <BiListUl size={18} aria-hidden="true" />;
}

export function IconeListaOrdenada() {
  return <BiListOl size={18} aria-hidden="true" />;
}

export function IconeBotaoEmail() {
  return <BiSquareRounded size={16} aria-hidden="true" />;
}

export function IconeAlinharEsquerda() {
  return <FiAlignLeft size={14} aria-hidden="true" />;
}

export function IconeAlinharCentro() {
  return <FiAlignCenter size={14} aria-hidden="true" />;
}

/** Alinhar à direita/justificado (refatoracaoEmailFormatado.md, revisão — Etapa 2). */
export function IconeAlinharDireita() {
  return <FiAlignRight size={14} aria-hidden="true" />;
}

export function IconeAlinharJustificado() {
  return <FiAlignJustify size={14} aria-hidden="true" />;
}

/** Diminuir tamanho da fonte (RefatoracaoFonteGruposCores.md — Etapa 1):
 * substitui o antigo botão único com ícone "A" (`IconeTamanhoFonte`,
 * `FiType`) — o stepper `[ − ] N [ + ]` no padrão Word não tem mais um
 * ícone só, cada botão de ação usa o sinal correspondente. Mesmo ícone
 * (`FiMinus`) que `IconeLinhaHorizontal` usa para outro botão — reuso de
 * símbolo em contexto diferente, sem conflito visual (não aparecem lado a
 * lado). */
export function IconeFonteDiminuir() {
  return <FiMinus size={13} aria-hidden="true" />;
}

/** Aumentar tamanho da fonte (Etapa 1) — par de `IconeFonteDiminuir`. */
export function IconeFonteAumentar() {
  return <FiPlus size={13} aria-hidden="true" />;
}

/** Diminuir recuo (RefatoracaoToolbarEmail.md — Etapa 5). */
export function IconeRecuoEsquerda() {
  return <BiLeftIndent size={17} aria-hidden="true" />;
}

/** Aumentar recuo (Etapa 5). */
export function IconeRecuoDireita() {
  return <BiRightIndent size={17} aria-hidden="true" />;
}

/** Linha horizontal (RefatoracaoToolbarEmail.md — Etapa 6): traço simples,
 * mesmo ícone que Word/Docs usam para esse comando. */
export function IconeLinhaHorizontal() {
  return <FiMinus size={15} aria-hidden="true" />;
}

/** Tabela (RefatoracaoToolbarEmail.md — Etapa 7, placeholder; RefatoracaoTabela.md
 * — Etapa 2, função real: abre o popover de inserção). Vem do conjunto
 * Bootstrap Icons (como os demais ícones sem equivalente no Feather, acima)
 * por não haver um ícone de tabela no conjunto Feather usado no resto do
 * projeto. */
export function IconeTabela() {
  return <BiTable size={16} aria-hidden="true" />;
}

/** Inserir linha acima do cursor (RefatoracaoTabela.md — Etapa 2, barra
 * contextual da tabela — comando `addRowBefore`). */
export function IconeInserirLinhaAcima() {
  return <TbRowInsertTop size={16} aria-hidden="true" />;
}

/** Inserir linha abaixo do cursor (Etapa 2 — comando `addRowAfter`). */
export function IconeInserirLinhaAbaixo() {
  return <TbRowInsertBottom size={16} aria-hidden="true" />;
}

/** Excluir a linha atual (Etapa 2 — comando `deleteRow`). */
export function IconeExcluirLinha() {
  return <TbRowRemove size={16} aria-hidden="true" />;
}

/** Inserir coluna à esquerda do cursor (Etapa 2 — comando `addColumnBefore`). */
export function IconeInserirColunaEsquerda() {
  return <TbColumnInsertLeft size={16} aria-hidden="true" />;
}

/** Inserir coluna à direita do cursor (Etapa 2 — comando `addColumnAfter`). */
export function IconeInserirColunaDireita() {
  return <TbColumnInsertRight size={16} aria-hidden="true" />;
}

/** Excluir a coluna atual (Etapa 2 — comando `deleteColumn`). */
export function IconeExcluirColuna() {
  return <TbColumnRemove size={16} aria-hidden="true" />;
}

/** Excluir a tabela inteira (Etapa 2 — comando `deleteTable`). Ícone
 * distinto de `IconeTabela` (o "off"/barrado comunica remoção completa,
 * não confundir com excluir linha/coluna, que operam dentro da tabela). */
export function IconeExcluirTabela() {
  return <TbTableOff size={16} aria-hidden="true" />;
}

/** Mesclar a seleção de células atual em uma só (Etapa 3 — comando
 * `mergeCells`). */
export function IconeMesclarCelulas() {
  return <RiMergeCellsHorizontal size={16} aria-hidden="true" />;
}

/** Dividir de volta a célula mesclada sob o cursor (Etapa 3 — comando
 * `splitCell`). */
export function IconeDividirCelula() {
  return <RiSplitCellsHorizontal size={16} aria-hidden="true" />;
}

/** Alternar a linha atual como linha de cabeçalho (Etapa 3 — comando
 * `toggleHeaderRow`). */
export function IconeAlternarLinhaCabecalho() {
  return <TbTableRow size={16} aria-hidden="true" />;
}

/** Alternar a coluna atual como coluna de cabeçalho (Etapa 3 — comando
 * `toggleHeaderColumn`). */
export function IconeAlternarColunaCabecalho() {
  return <TbTableColumn size={16} aria-hidden="true" />;
}

/** Cor de fundo da célula (RefatoracaoTabela.md — Etapa 4): balde de tinta,
 * do mesmo conjunto Bootstrap Icons já usado por `IconeCorTexto`/
 * `IconeRealce` — mantém o estilo de contorno consistente entre os três
 * controles de cor da toolbar. */
export function IconeCorCelula() {
  return <BiColorFill size={17} aria-hidden="true" />;
}

/** Cor/espessura da borda da tabela (RefatoracaoTabela.md — Etapa 6): borda
 * externa, do mesmo conjunto Tabler já usado pelo resto dos controles de
 * linha/coluna/cabeçalho desta barra contextual — `BiColorFill` (balde de
 * tinta, `IconeCorCelula` acima) não distinguiria "cor da célula" de "cor
 * da borda" visualmente, por isso um ícone de borda dedicado em vez de
 * reaproveitar o mesmo símbolo. */
export function IconeBordaTabela() {
  return <TbBorderOuter size={16} aria-hidden="true" />;
}

/** Alternar a tabela para largura total (100%) (RefatoracaoTabela.md —
 * Etapa 6): mesmo conjunto Tabler, símbolo de "ajustar à largura"
 * (`TbArrowAutofitWidth`) — não há um equivalente no Feather nem no
 * Bootstrap Icons já usados no resto da toolbar. */
export function IconeLarguraTotalTabela() {
  return <TbArrowAutofitWidth size={16} aria-hidden="true" />;
}

/** Duplicar o conteúdo da célula atual para a célula à direita
 * (RefatoracaoTabela.md — Etapa 7 — `duplicarCelula('direita')`). */
export function IconeDuplicarParaDireita() {
  return <RiArrowRightBoxLine size={16} aria-hidden="true" />;
}

/** Duplicar o conteúdo da célula atual para a célula abaixo
 * (RefatoracaoTabela.md — Etapa 7 — `duplicarCelula('baixo')`). */
export function IconeDuplicarParaBaixo() {
  return <RiArrowDownBoxLine size={16} aria-hidden="true" />;
}

/** Gatilho "Ver Mais" da toolbar do editor de e-mail (RefatoracaoToolbarEmail.md
 * — Etapa 2): reticências horizontais, padrão Word/Excel para menu de
 * itens que não couberam na largura disponível. Distinto de `IconeArrastar`
 * (`FiMoreVertical`, reticências verticais, usado como alça de arrasto em
 * `OrdenacaoPrioridade`) — mesmo conceito de "mais opções", ícone e contexto
 * diferentes. */
export function IconeVerMais() {
  return <FiMoreHorizontal size={15} aria-hidden="true" />;
}

/** Ícone do botão "Anexar arquivo" no modal "Editar e-mail"
 * (RefatoracaoToolbarEmail.md — Etapa 9): clipe de papel, símbolo padrão
 * para anexos em qualquer cliente de e-mail. */
export function IconeAnexar() {
  return <FiPaperclip size={14} aria-hidden="true" />;
}

/** Ícone do botão de remover um anexo já selecionado da lista (Etapa 9) —
 * reaproveita o mesmo símbolo de "fechar" de `IconeFechar`, em tamanho
 * reduzido para caber ao lado do nome do arquivo em cada item da lista. */
export function IconeRemoverAnexo() {
  return <FiX size={13} aria-hidden="true" />;
}