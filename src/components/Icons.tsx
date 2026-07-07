import {
  FiChevronLeft,
  FiChevronRight,
  FiCopy,
  FiEdit3,
  FiMoon,
  FiRotateCcw,
  FiSearch,
  FiSun,
  FiTrash2,
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
