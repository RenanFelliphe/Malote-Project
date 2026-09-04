export type ThemeId =
  | 'light'
  | 'dark'
  | 'amethyst'
  | 'cyberpunk'
  | 'emerald'
  | 'office'
  | 'gold'
  | 'magma'
  | 'midnight'
  | 'noir'
  | 'pearl'
  | 'ruby'
  | 'sapphire'
  | 'silver'
  | 'slate'
  | 'sweet'
  | 'space'
  | 'teal'
  | 'toxic'
  | 'vaporwave';

export type ThemeType = 'padrao' | 'neutro' | 'colorido' | 'intenso' | 'moderno';
export type ThemeMode = 'light' | 'dark';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  type: ThemeType;
  mode: ThemeMode;
  description: string;
  colors: readonly [string, string, string];
}

export const DEFAULT_THEME: ThemeId = 'light';

export const themes: readonly ThemeDefinition[] = [
  { id: 'light', name: 'Claro', type: 'padrao', mode: 'light', description: 'Claro e acolhedor, com tons terrosos.', colors: ['#F0E2CF', '#FBF5EC', '#C8754D'] },
  { id: 'dark', name: 'Escuro', type: 'padrao', mode: 'dark', description: 'Escuro e discreto, com acento terracota.', colors: ['#242424', '#2E2E2E', '#C8754D'] },
  { id: 'amethyst', name: 'Amethyst', type: 'colorido', mode: 'dark', description: 'Criativo e elegante, com tons ametistas.', colors: ['#18131F', '#2A2135', '#9B72D0'] },
  { id: 'cyberpunk', name: 'Cyberpunk', type: 'intenso', mode: 'dark', description: 'Neon vibrante com personalidade futurista.', colors: ['#080612', '#171127', '#00F5D4'] },
  { id: 'emerald', name: 'Emerald', type: 'colorido', mode: 'dark', description: 'Equilibrado e natural, com verde esmeralda.', colors: ['#151B17', '#243029', '#4FA878'] },
  { id: 'office', name: 'Office', type: 'moderno', mode: 'light', description: 'Corporativo e refinado, com azul clássico.', colors: ['#F2F4F7', '#FFFFFF', '#1F4E79'] },
  { id: 'gold', name: 'Gold', type: 'colorido', mode: 'dark', description: 'Luxuoso e quente, com dourado discreto.', colors: ['#1D170D', '#342A17', '#D39A32'] },
  { id: 'magma', name: 'Magma', type: 'intenso', mode: 'dark', description: 'Dramático e energético, em laranja incandescente.', colors: ['#120605', '#30100A', '#FF5A1F'] },
  { id: 'midnight', name: 'Midnight', type: 'moderno', mode: 'dark', description: 'Profundo e tecnológico, com azul noturno.', colors: ['#0D1624', '#19283B', '#5F8FC2'] },
  { id: 'noir', name: 'Noir', type: 'neutro', mode: 'dark', description: 'Minimalista e monocromático, com alto contraste.', colors: ['#111111', '#202020', '#E0E0E0'] },
  { id: 'pearl', name: 'Pearl', type: 'neutro', mode: 'light', description: 'Suave e refinado, com neutros claros.', colors: ['#F7F5F2', '#FFFFFF', '#7A746E'] },
  { id: 'ruby', name: 'Ruby', type: 'colorido', mode: 'dark', description: 'Elegante e marcante, em tons de rubi.', colors: ['#211719', '#302225', '#C6535F'] },
  { id: 'sapphire', name: 'Sapphire', type: 'moderno', mode: 'dark', description: 'Contemporâneo e profissional, em azul profundo.', colors: ['#161B22', '#242C36', '#4F8FCC'] },
  { id: 'silver', name: 'Silver', type: 'neutro', mode: 'light', description: 'Limpo e luminoso, com acabamento prateado.', colors: ['#E9EBED', '#FFFFFF', '#68727A'] },
  { id: 'slate', name: 'Slate', type: 'neutro', mode: 'dark', description: 'Sólido e funcional, em cinzas azulados.', colors: ['#161A1F', '#292F37', '#71808E'] },
  { id: 'space', name: 'Space', type: 'moderno', mode: 'dark', description: 'Imersivo e tecnológico, com acento menta.', colors: ['#080B12', '#151D28', '#73F2C5'] },
  { id: 'sweet', name: 'Sweet', type: 'colorido', mode: 'light', description: 'Leve e divertido, com rosa vibrante.', colors: ['#FFF1FA', '#FFFFFF', '#F05AA6'] },
  { id: 'teal', name: 'Teal', type: 'colorido', mode: 'dark', description: 'Calmo e expressivo, com verde azulado.', colors: ['#111D1E', '#203335', '#45B3AE'] },
  { id: 'toxic', name: 'Toxic', type: 'intenso', mode: 'dark', description: 'Impactante e elétrico, com verde neon.', colors: ['#090D08', '#182015', '#B6FF00'] },
  { id: 'vaporwave', name: 'Vaporwave', type: 'intenso', mode: 'dark', description: 'Expressivo e retrô, com neon rosa.', colors: ['#10091C', '#24143A', '#FF5CC8'] },
];

export const RECOMMENDED_THEME_IDS: readonly ThemeId[] = ['light', 'office', 'pearl', 'dark', 'noir', 'slate'];

export const themeById = new Map(themes.map((theme) => [theme.id, theme]));
