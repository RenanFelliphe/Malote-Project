import type { EmailConteudo, EmailRecord } from '../types/email';
import { arquivoParaBase64 } from './projetosApi';

type DadosEditaveis = {
  email: EmailConteudo;
  registros: EmailRecord[];
  /**
   * Nome de exibição do projeto (opcional) — Etapa 3 de
   * AtualizacaoDaPlanilhaViaUI.md: `PUT /api/emails/:slug` passou a
   * aceitar este campo, usado pela seção "Projeto" do fluxo "Atualizar
   * Dados" (Etapa 7) para persistir uma mudança de nome de exibição sem
   * precisar de um endpoint dedicado. Omitido, o servidor preserva o
   * nome atual — nenhum chamador anterior a esta etapa precisa mudar.
   */
  projeto?: string;
  /**
   * Nome da coluna da planilha usada como origem do `id` dos registros
   * deste projeto — Demanda 7 (Mapeamento de ID Personalizado), Etapa 8:
   * `PUT /api/emails/:slug` passou a aceitar este campo (ver
   * `vite.config.ts`, `emailsApiPlugin`) para regravar `EmailsData.colunaId`
   * a partir da seção "Colunas" do fluxo "Atualizar Dados"
   * (`AtualizarDadosModal.tsx`). Omitido (`undefined`), o servidor preserva
   * o valor já persistido — mesma semântica de "omitir = não mexer" já
   * usada por `projeto?` acima. Enviado como `string` (coluna escolhida)
   * ou `null` ("Gerar Automaticamente"); o servidor remove o campo do
   * `EmailsData` persistido ao receber `null`/string vazia, e grava a
   * string quando não vazia.
   */
  colunaId?: string | null;
};

/**
 * Persiste `{ email, registros, projeto?, colunaId? }` no projeto
 * indicado, via o middleware configurado em vite.config.ts (seção 2.2 —
 * toda alteração deve ser gravada imediatamente, sem botão Salvar). O
 * middleware preserva os metadados do projeto no arquivo existente,
 * exceto `projeto`, quando enviado (Etapa 3), e `colunaId`, quando
 * enviado (Demanda 7, Etapa 8).
 *
 */
export async function salvarEmails(slug: string, dados: DadosEditaveis): Promise<void> {
  const resposta = await fetch(`/api/emails/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });

  if (!resposta.ok) {
    throw new Error('Falha ao salvar alterações em emails.json');
  }
}

/**
 * Sobrescreve `sheet.<ext>` do projeto via `POST /api/emails/:slug/sheet`
 * (novo, Etapa 1 de AtualizacaoDaPlanilhaViaUI.md). Usado pelo fluxo
 * "Atualizar Registros" (Etapa 5) ao confirmar a reimportação.
 */
export async function enviarSheet(slug: string, arquivo: File): Promise<void> {
  const conteudoBase64 = await arquivoParaBase64(arquivo);
  const resposta = await fetch(`/api/emails/${encodeURIComponent(slug)}/sheet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nomeArquivo: arquivo.name, conteudoBase64 }),
  });

  if (!resposta.ok) {
    throw new Error('Falha ao salvar a planilha bruta do projeto.');
  }
}

/**
 * Busca a planilha bruta já persistida via `GET /api/emails/:slug/sheet`
 * (novo, Etapa 1). Usado pelo fluxo "Atualizar Dados > Colunas" (Etapa 7)
 * para reparsear sem exigir novo upload. Devolve um `File` (nome extraído
 * do header `Content-Disposition`), para que `parseSheetBrowser.ts`
 * (`detectarFormato`) reconheça a extensão sem nenhuma mudança nele.
 */
export async function obterSheet(slug: string): Promise<File> {
  const resposta = await fetch(`/api/emails/${encodeURIComponent(slug)}/sheet`);

  if (!resposta.ok) {
    throw new Error('Falha ao buscar a planilha bruta do projeto.');
  }

  const disposition = resposta.headers.get('Content-Disposition') ?? '';
  const nomeCapturado = /filename="([^"]+)"/.exec(disposition)?.[1];
  const blob = await resposta.blob();
  return new File([blob], nomeCapturado ?? `sheet-${slug}`, { type: blob.type });
}