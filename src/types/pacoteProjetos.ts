/**
 * Tipos do pacote de portabilidade de projetos (Demanda 11 —
 * "Exportação/Importação de Projetos (Portabilidade)", `DEMANDAS.md`).
 *
 * Etapa 1: só o schema do pacote (`manifest.json`) e o type guard de
 * validação, usados por `scripts/utils/pacoteProjetos.ts` (empacotar/
 * desempacotar). Os tipos de requisição/resposta dos endpoints (Etapa 2 —
 * `GET /api/projetos/pacote` — e Etapa 3 — `POST
 * /api/projetos/pacote/preview` e `/confirmar`) e os das opções do modal de
 * conflito (Etapa 6, `ConflitoImportacaoProjetoModal.tsx`) chegam nas
 * próprias etapas correspondentes, não aqui.
 */

/**
 * Versão do formato do pacote — presente desde o início para permitir, no
 * futuro, mudar o schema sem quebrar a leitura de pacotes antigos (seção 3
 * de `ExportacaoImportacaoDeProjetos.md`), sem que isso precise ser
 * resolvido agora.
 */
export const VERSAO_PACOTE_PROJETOS = 1;

/** Metadados de um projeto dentro do `manifest.json` do pacote. */
export interface ProjetoDoManifesto {
  slug: string;
  nome: string;
  totalRegistros: number;
}

/**
 * Conteúdo de `manifest.json`, na raiz do `.zip` — necessário porque a
 * importação precisa detectar conflito de slug antes de extrair qualquer
 * coisa em `data/active/`, e para validar que o arquivo é de fato um
 * pacote deste sistema (seção 3 do planner).
 */
export interface ManifestoPacoteProjetos {
  versao: number;
  geradoEm: string;
  projetos: ProjetoDoManifesto[];
}

/**
 * Type guard de `manifest.json` — usado por `desempacotarProjetos` (Etapa
 * 1, `pacoteProjetos.ts`) antes de confiar em qualquer campo do arquivo
 * lido de um `.zip` enviado pelo usuário. Não valida `versao ===
 * VERSAO_PACOTE_PROJETOS` aqui (pacotes de versões futuras/antigas não são
 * necessariamente inválidos, só potencialmente incompatíveis — decisão de
 * quem chama) — só garante o formato mínimo do JSON.
 */
export function ehManifestoPacoteProjetosValido(valor: unknown): valor is ManifestoPacoteProjetos {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) return false;
  const candidato = valor as Record<string, unknown>;
  if (typeof candidato.versao !== 'number') return false;
  if (typeof candidato.geradoEm !== 'string') return false;
  if (!Array.isArray(candidato.projetos)) return false;
  return candidato.projetos.every(
    (projeto) =>
      projeto !== null &&
      typeof projeto === 'object' &&
      !Array.isArray(projeto) &&
      typeof (projeto as Record<string, unknown>).slug === 'string' &&
      typeof (projeto as Record<string, unknown>).nome === 'string' &&
      typeof (projeto as Record<string, unknown>).totalRegistros === 'number'
  );
}
