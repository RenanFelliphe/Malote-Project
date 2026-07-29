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
  FiMoon,
  FiMoreVertical,
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
import { BiFontColor, BiHighlight, BiListOl, BiListUl, BiSquareRounded, BiStrikethrough } from 'react-icons/bi';

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
