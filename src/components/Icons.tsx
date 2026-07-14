import {
  FiAlertTriangle,
  FiCheck,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiChevronUp,
  FiCopy,
  FiDownload,
  FiEdit3,
  FiFileText,
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
  FiUpload,
  FiX,
} from 'react-icons/fi';

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
