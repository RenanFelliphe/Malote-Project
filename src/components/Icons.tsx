import {
  FiActivity,
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
  FiDroplet,
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
  BiFontColor,
  BiHighlight,
  BiLeftIndent,
  BiListOl,
  BiListUl,
  BiRightIndent,
  BiSquareRounded,
  BiStrikethrough,
} from 'react-icons/bi';

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

/** Ícone do item "Visualizar Logs" no dropdown de configurações e do título da tela `/logs` (Demanda 9, Etapa 6). */
export function IconeLogs() {
  return <FiActivity size={15} aria-hidden="true" />;
}

export function IconeEscolherTema() {
  return <FiDroplet size={15} aria-hidden="true" />;
}

export function IconePaginaAnterior() {
  return <FiChevronLeft size={14} aria-hidden="true" />;
}

export function IconePaginaProxima() {
  return <FiChevronRight size={14} aria-hidden="true" />;
}

export function IconeBuscarPagina({ className }: { className?: string }) {
  return <FiSearch size={14} aria-hidden="true" className={className} />;
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