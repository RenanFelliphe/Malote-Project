import { useRef, useState, type RefObject } from 'react';

import { RECOMMENDED_THEME_IDS, themes, type ThemeDefinition, type ThemeId, type ThemeMode, type ThemeType } from './utils/temas';
import { useTheme } from '../contexts/ThemeContext';
import { Dialog } from './Dialog';
import { IconeTemaClaro, IconeTemaEscuro } from './Icons';

interface Props {
  onFechar: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

const tipos: Array<{ value: ThemeType | 'todos'; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'padrao', label: 'Padrão' },
  { value: 'neutro', label: 'Neutros' },
  { value: 'colorido', label: 'Coloridos' },
  { value: 'intenso', label: 'Intensos' },
  { value: 'moderno', label: 'Modernos' },
];

const modos: Array<{ value: ThemeMode | 'todos'; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

export function ThemeSelectorModal({ onFechar, initialFocusRef }: Props) {
  const { tema, aplicarTema, definirTema } = useTheme();
  const temaAtualRef = useRef<ThemeId>(tema);
  const [temaInicial] = useState<ThemeId>(tema);
  const [previewTheme, setPreviewTheme] = useState<ThemeId>(tema);
  const [tipoSelecionado, setTipoSelecionado] = useState<ThemeType | 'todos'>('todos');
  const [modoSelecionado, setModoSelecionado] = useState<ThemeMode | 'todos'>('todos');

  const temasFiltrados = themes.filter((theme) => (
    (tipoSelecionado === 'todos' || theme.type === tipoSelecionado) &&
    (modoSelecionado === 'todos' || theme.mode === modoSelecionado)
  ));
  const temasRecomendados = temasFiltrados.filter((theme) => RECOMMENDED_THEME_IDS.includes(theme.id));

  function selecionarTema(id: ThemeId) {
    setPreviewTheme(id);
    aplicarTema(id);
  }

  function cancelar() {
    aplicarTema(temaAtualRef.current);
    onFechar();
  }

  function confirmar() {
    definirTema(previewTheme);
    onFechar();
  }

  function renderTema(theme: ThemeDefinition, compacto = false) {
    return (
      <button
        type="button"
        className={`theme-selector-opcao ${compacto ? 'theme-selector-opcao-recomendado' : ''} ${previewTheme === theme.id ? 'selecionada' : ''}`}
        key={theme.id}
        onClick={() => selecionarTema(theme.id)}
        aria-pressed={previewTheme === theme.id}
      >
        <span className="theme-selector-cores" aria-label={`Cores: ${theme.colors.join(', ')}`}>
          {theme.colors.map((color) => <span key={color} style={{ backgroundColor: color }} />)}
        </span>
        <span className="theme-selector-modo" title={theme.mode === 'light' ? 'Modo claro' : 'Modo escuro'}>
          {theme.mode === 'light' ? <IconeTemaClaro /> : <IconeTemaEscuro />}
        </span>
        <span className="theme-selector-texto">
          <strong>{theme.name}</strong>
          {!compacto && theme.id === temaInicial && <small>Tema atual</small>}
          {!compacto && <span>{theme.description}</span>}
        </span>
      </button>
    );
  }

  return (
    <Dialog
      isOpen
      onClose={cancelar}
      title="Escolher Tema"
      className="theme-selector-modal"
      initialFocusRef={initialFocusRef}
      footer={
        <div className="dialog-rodape-botoes">
          <button type="button" className="dialog-botao-cancelar" onClick={cancelar}>Cancelar</button>
          <button type="button" className="dialog-botao-primario" onClick={confirmar}>Confirmar</button>
        </div>
      }
    >
      <p className="theme-selector-descricao">Personalize a aparência da aplicação.</p>

      <div className="theme-selector-filtros" aria-label="Filtros de temas">
        <label>
          <span>Tipo</span>
          <select value={tipoSelecionado} onChange={(event) => setTipoSelecionado(event.target.value as ThemeType | 'todos')}>
            {tipos.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
          </select>
        </label>
        <label>
          <span>Modo</span>
          <select value={modoSelecionado} onChange={(event) => setModoSelecionado(event.target.value as ThemeMode | 'todos')}>
            {modos.map((modo) => <option key={modo.value} value={modo.value}>{modo.label}</option>)}
          </select>
        </label>
      </div>

      {temasRecomendados.length > 0 && (
        <section className="theme-selector-secao" aria-labelledby="theme-selector-recomendados">
          <h3 id="theme-selector-recomendados">Temas Recomendados</h3>
          <div className="theme-selector-lista theme-selector-lista-recomendados">
            {temasRecomendados.map((theme) => renderTema(theme, true))}
          </div>
        </section>
      )}

      <section className="theme-selector-secao" aria-labelledby="theme-selector-todos">
        <h3 id="theme-selector-todos">Todos os Temas</h3>
        <div className="theme-selector-lista" aria-label="Todos os temas">
          {temasFiltrados.map((theme) => renderTema(theme))}
          {temasFiltrados.length === 0 && <p className="theme-selector-vazio">Nenhum tema corresponde aos filtros.</p>}
        </div>
      </section>
    </Dialog>
  );
}