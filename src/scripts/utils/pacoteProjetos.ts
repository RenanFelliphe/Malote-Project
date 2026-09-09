/**
 * Empacotamento e desempacotamento do pacote de portabilidade de projetos
 * (Demanda 11, Etapa 1 — `DEMANDAS.md`). Será usado pelos endpoints de
 * exportação (Etapa 2, `GET /api/projetos/pacote`) e importação (Etapa 3,
 * `POST /api/projetos/pacote/preview` e `/confirmar`) em `vite.config.ts` —
 * este módulo não conhece HTTP, só lê/monta o `.zip` e lê `data/active/`.
 *
 * *(renomeado de `backup.ts` nesta etapa — o nome antigo refletia o escopo
 * anterior de disaster recovery do sistema inteiro, substituído pela
 * portabilidade de projetos; ver `DEMANDAS.md`, seção da Demanda 11, e
 * `ExportacaoImportacaoDeProjetos.md`, nota de nomenclatura.)*
 */
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import type { EmailsData } from '../../types/email';
import {
  VERSAO_PACOTE_PROJETOS,
  ehManifestoPacoteProjetosValido,
  type ManifestoPacoteProjetos,
} from '../../types/pacoteProjetos';

/**
 * Erro de pacote malformado/inválido (manifest ausente/corrompido, projeto
 * pedido inexistente, slug inseguro etc.) — distinto de um erro de I/O
 * genérico, para quem chama (o endpoint, na Etapa 2/3) devolver 400 em vez
 * de 500. Mesmo espírito de `ApiError` em `vite.config.ts`, mas sem
 * depender dele: este módulo não conhece HTTP.
 */
export class PacoteInvalidoError extends Error {}

/**
 * Nome do `.zip` de exportação, com timestamp (seção 3 do planner:
 * `pacote-projetos-<timestamp>.zip`). `:` e `.` do ISO puro são inválidos
 * em nome de arquivo no Windows, por isso substituídos por `-` — mesma
 * preocupação, formato diferente, de `nomeArquivo`/`nomeArquivoZip` em
 * `exportarPlanilha.ts` (que usam só a data, sem hora).
 */
export function nomeArquivoPacote(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `pacote-projetos-${timestamp}.zip`;
}

/**
 * Localiza `sheet.<ext>` já persistido num diretório de projeto — mesmo
 * critério de `encontrarArquivoSheetExistente` (`vite.config.ts`),
 * duplicado aqui porque não existe hoje um módulo compartilhado entre o
 * servidor de dev e os scripts para essa checagem (mesmo padrão de
 * pequenas validações já repetidas em outros pontos do projeto).
 */
function encontrarArquivoSheet(diretorioProjeto: string): string | null {
  const entradas = fs.readdirSync(diretorioProjeto, { withFileTypes: true });
  const encontrado = entradas.find((entrada) => entrada.isFile() && /^sheet\.[^.]+$/.test(entrada.name));
  return encontrado ? path.resolve(diretorioProjeto, encontrado.name) : null;
}

/**
 * Checagem de slug seguro contra path traversal — mesmo critério de
 * `slugEhSeguro` (`vite.config.ts`), duplicado aqui pelo mesmo motivo
 * acima.
 */
function slugSeguro(slug: string): boolean {
  return slug.length > 0 && !slug.includes('/') && !slug.includes('\\') && slug !== '.' && slug !== '..';
}

/**
 * Lê `emails.json` + `sheet.<ext>` de um projeto ativo, prontos para entrar
 * no `.zip` — usado por `empacotarProjetos`, uma vez por slug pedido. Lança
 * `PacoteInvalidoError` se o slug for inseguro ou o projeto não existir/
 * estiver incompleto: diferente de `handleListarLixeira`
 * (`vite.config.ts`), que pula silenciosamente pastas corrompidas numa
 * listagem, aqui vira erro porque o slug foi pedido explicitamente pelo
 * usuário (selecionou esse projeto pra exportar).
 */
function lerProjetoParaPacote(
  activeDirectory: string,
  slug: string
): { nome: string; totalRegistros: number; emailsJson: Buffer; sheetNomeArquivo: string; sheetConteudo: Buffer } {
  if (!slugSeguro(slug)) {
    throw new PacoteInvalidoError(`Slug inválido: "${slug}".`);
  }
  const diretorioProjeto = path.resolve(activeDirectory, slug);
  const caminhoRelativo = path.relative(activeDirectory, diretorioProjeto);
  if (caminhoRelativo.startsWith('..') || path.isAbsolute(caminhoRelativo)) {
    throw new PacoteInvalidoError(`Slug inválido: "${slug}".`);
  }

  const emailsJsonPath = path.resolve(diretorioProjeto, 'emails.json');
  if (!fs.statSync(emailsJsonPath, { throwIfNoEntry: false })?.isFile()) {
    throw new PacoteInvalidoError(`Projeto "${slug}" não encontrado.`);
  }
  const caminhoSheet = encontrarArquivoSheet(diretorioProjeto);
  if (!caminhoSheet) {
    throw new PacoteInvalidoError(`Projeto "${slug}" está sem planilha bruta ("sheet.<ext>").`);
  }

  const emailsJson = fs.readFileSync(emailsJsonPath);
  const dados = JSON.parse(emailsJson.toString('utf-8')) as EmailsData;

  return {
    nome: dados.projeto,
    totalRegistros: dados.registros.length,
    emailsJson,
    sheetNomeArquivo: path.basename(caminhoSheet),
    sheetConteudo: fs.readFileSync(caminhoSheet),
  };
}

/**
 * Empacota 1+ projetos ativos num único `.zip` (seção 3 do planner):
 * `manifest.json` na raiz + `projetos/<slug>/{emails.json,sheet.<ext>}` por
 * projeto. Usado pelo endpoint de exportação (Etapa 2) — não escreve nada
 * em disco além de ler `data/active/`, o download em si é responsabilidade
 * de quem chama.
 */
export async function empacotarProjetos(activeDirectory: string, slugs: string[]): Promise<Buffer> {
  if (slugs.length === 0) {
    throw new PacoteInvalidoError('Nenhum projeto selecionado para exportação.');
  }

  const zip = new JSZip();
  const projetosDoManifesto: ManifestoPacoteProjetos['projetos'] = [];

  for (const slug of slugs) {
    const projeto = lerProjetoParaPacote(activeDirectory, slug);
    const pastaProjeto = zip.folder(`projetos/${slug}`);
    if (!pastaProjeto) {
      // JSZip só devolve null com nome de pasta vazio — não deveria
      // acontecer aqui, já que `slug` passou por `slugSeguro` em
      // `lerProjetoParaPacote` acima.
      throw new PacoteInvalidoError(`Não foi possível empacotar o projeto "${slug}".`);
    }
    pastaProjeto.file('emails.json', projeto.emailsJson);
    pastaProjeto.file(projeto.sheetNomeArquivo, projeto.sheetConteudo);
    projetosDoManifesto.push({ slug, nome: projeto.nome, totalRegistros: projeto.totalRegistros });
  }

  const manifest: ManifestoPacoteProjetos = {
    versao: VERSAO_PACOTE_PROJETOS,
    geradoEm: new Date().toISOString(),
    projetos: projetosDoManifesto,
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  return zip.generateAsync({ type: 'nodebuffer' });
}

/**
 * Um projeto já extraído do pacote, pronto para ser gravado em
 * `data/active/` (Etapa 3, fase de confirmação) ou descartado (opção
 * "Manter o atual" do modal de conflito, seção 4 do planner).
 */
export interface ProjetoExtraidoDoPacote {
  slug: string;
  nome: string;
  totalRegistros: number;
  emailsJson: Buffer;
  sheetNomeArquivo: string;
  sheetConteudo: Buffer;
}

/** Resultado de `desempacotarProjetos`: o manifesto lido + o conteúdo de cada projeto, na ordem em que aparecem no manifesto. */
export interface PacoteDesempacotado {
  manifest: ManifestoPacoteProjetos;
  projetos: ProjetoExtraidoDoPacote[];
}

/**
 * Lê e valida um `.zip` de portabilidade recebido do usuário — sem
 * escrever nada em disco. A decisão de gravar em `data/active/` (incluindo
 * o diretório temporário citado na Etapa 3 do planner, para a fase de
 * preview) é do endpoint de importação, não desta função: aqui só se
 * garante que o pacote é estruturalmente válido antes de qualquer escrita.
 * Lança `PacoteInvalidoError` em qualquer inconsistência entre o
 * `manifest.json` e o conteúdo real do `.zip` — o chamador decide o status
 * HTTP (Etapa 3 mapeia para 400).
 */
export async function desempacotarProjetos(
  bufferZip: Buffer | ArrayBuffer | Uint8Array
): Promise<PacoteDesempacotado> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bufferZip);
  } catch {
    throw new PacoteInvalidoError('Arquivo enviado não é um .zip válido.');
  }

  const manifestArquivo = zip.file('manifest.json');
  if (!manifestArquivo) {
    throw new PacoteInvalidoError('Pacote inválido: "manifest.json" não encontrado.');
  }

  let manifestBruto: unknown;
  try {
    manifestBruto = JSON.parse(await manifestArquivo.async('string'));
  } catch {
    throw new PacoteInvalidoError('Pacote inválido: "manifest.json" não é um JSON válido.');
  }

  if (!ehManifestoPacoteProjetosValido(manifestBruto)) {
    throw new PacoteInvalidoError('Pacote inválido: "manifest.json" não tem o formato esperado.');
  }
  const manifest = manifestBruto;

  if (manifest.projetos.length === 0) {
    throw new PacoteInvalidoError('Pacote inválido: nenhum projeto listado no manifesto.');
  }

  const projetos: ProjetoExtraidoDoPacote[] = [];
  for (const { slug, nome, totalRegistros } of manifest.projetos) {
    if (!slugSeguro(slug)) {
      throw new PacoteInvalidoError(`Pacote inválido: slug "${slug}" do manifesto é inválido.`);
    }
    const prefixoPasta = `projetos/${slug}/`;
    const arquivosDaPasta = zip.file(new RegExp(`^${prefixoPasta}[^/]+$`));
    const emailsJsonArquivo = arquivosDaPasta.find((arquivo) => arquivo.name === `${prefixoPasta}emails.json`);
    const sheetArquivo = arquivosDaPasta.find((arquivo) =>
      /^sheet\.[^./]+$/.test(arquivo.name.slice(prefixoPasta.length))
    );

    if (!emailsJsonArquivo) {
      throw new PacoteInvalidoError(`Pacote inválido: "${prefixoPasta}emails.json" não encontrado.`);
    }
    if (!sheetArquivo) {
      throw new PacoteInvalidoError(`Pacote inválido: planilha bruta ("sheet.<ext>") de "${slug}" não encontrada.`);
    }

    projetos.push({
      slug,
      nome,
      totalRegistros,
      emailsJson: await emailsJsonArquivo.async('nodebuffer'),
      sheetNomeArquivo: sheetArquivo.name.slice(prefixoPasta.length),
      sheetConteudo: await sheetArquivo.async('nodebuffer'),
    });
  }

  return { manifest, projetos };
}

/**
 * Slugs do manifesto que já existem em `data/active/` — usado pelo
 * endpoint de preview (Etapa 3) pra decidir, por projeto, se ele cai direto
 * no caminho aditivo ou abre o modal de conflito (seção 4 do planner). Não
 * recebe `activeDirectory` diretamente: quem chama já sabe os slugs
 * existentes (ex. de um `fs.readdirSync` anterior), evitando I/O duplicado
 * quando o preview já precisou listar `data/active/` por outro motivo.
 */
export function detectarConflitos(manifest: ManifestoPacoteProjetos, slugsExistentes: Iterable<string>): string[] {
  const existentes = new Set(slugsExistentes);
  return manifest.projetos.filter((projeto) => existentes.has(projeto.slug)).map((projeto) => projeto.slug);
}
