/**
 * Descoberta dinâmica de projetos — Etapa 3 do plano de refatoração
 * multi-página (refatoracaoMultiPaginas-v2.md, seção 3.2 / Etapa 3).
 *
 * Mesmo padrão já validado em produção no Multiverso
 * (`multiverso.riopombavalley`, `src/data/index.ts`): usa
 * `import.meta.glob` com `eager: true` para descobrir, em tempo de build,
 * todos os projetos existentes em `data/*\/emails.json`, sem precisar de
 * registro manual em código.
 *
 * Diferença em relação ao Multiverso (ver seção 2.7 do plano): lá o slug
 * é recalculado em runtime a partir do campo `titulo` de cada módulo. Aqui
 * o slug **é** o nome da pasta do projeto dentro de `data/` — decidido uma
 * única vez no wizard de importação (campo "Nome do Arquivo") e gravado
 * como estrutura de diretório, não recalculado a partir de `projeto`.
 */

import type { EmailsData } from '../types/email';

/** Um projeto descoberto: seu slug (nome da pasta) e os dados já resolvidos do `emails.json`. */
export interface Projeto {
  slug: string;
  dados: EmailsData;
}

/**
 * Módulos descobertos em `data/*\/emails.json`. Cada chave é o caminho do
 * arquivo (ex.: `../../data/projeto-teste/emails.json`); `eager: true` faz
 * com que os dados já venham resolvidos (sem import dinâmico assíncrono).
 */
const modulos = import.meta.glob<EmailsData>('../../data/*/emails.json', {
  eager: true,
  import: 'default',
});

/**
 * Extrai o slug do projeto a partir do nome da pasta no path do glob —
 * não do campo `dados.projeto`, que é só o nome de exibição (seção 3.2).
 * Ex.: `../../data/projeto-teste/emails.json` → `projeto-teste`.
 */
function extrairSlug(caminho: string): string {
  const partes = caminho.split('/');
  return partes[partes.length - 2];
}

/** Lista de todos os projetos descobertos, um por pasta em `data/`. */
export const PROJETOS: Projeto[] = Object.entries(modulos).map(([caminho, dados]) => ({
  slug: extrairSlug(caminho),
  dados,
}));
