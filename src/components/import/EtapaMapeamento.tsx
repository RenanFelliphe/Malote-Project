import { useMemo } from 'react';

import { ColunaSeletora } from './ColunaSeletora';
import { validarColunaId } from './utils/validarColunaId';
import type { LinhaPlanilha } from './utils/parseSheetBrowser';
import type { EstadoImportacao } from './types';

interface Props {
  estado: EstadoImportacao;
  onEstadoChange: (novoEstado: Partial<EstadoImportacao>) => void;
  headers: string[];
  /**
   * Linhas já parseadas da planilha (Demanda 7 — Mapeamento de ID
   * Personalizado, Etapa 5) — necessárias para rodar `validarColunaId`
   * contra os valores reais da coluna escolhida como ID, não só os
   * cabeçalhos. Antes desta etapa este componente só precisava de
   * `headers`.
   */
  linhas: LinhaPlanilha[];
}

/**
 * Os 3 atributos que passam a competir por colunas da planilha a partir da
 * Demanda 7 (Mapeamento de ID Personalizado) — antes desta demanda, só
 * nome/e-mail existiam aqui.
 */
type AtributoColuna = 'id' | 'nome' | 'email';

/** Adiciona (ao final, ou seja, com menor prioridade) ou remove uma coluna de uma lista de seleção. */
function alternarColuna(atual: string[], coluna: string): string[] {
  return atual.includes(coluna) ? atual.filter((c) => c !== coluna) : [...atual, coluna];
}

export function EtapaMapeamento({ estado, onEstadoChange, headers, linhas }: Props) {
  /**
   * Estado compartilhado de "colunas em uso" (Demanda 7 — Mapeamento de ID
   * Personalizado, Etapa 4) — subido para este componente pai, forma
   * `Record<'id'|'nome'|'email', string[]>` (sugestão da seção 3 do
   * planner). A partir desta etapa (5), `id` deixa de ser placeholder vazio
   * e passa a refletir `estado.colunaId` de verdade.
   */
  const colunasEmUso = useMemo<Record<AtributoColuna, string[]>>(
    () => ({
      id: estado.colunaId ? [estado.colunaId] : [],
      nome: estado.colunasNome,
      email: estado.colunasEmail,
    }),
    [estado.colunaId, estado.colunasNome, estado.colunasEmail]
  );

  /**
   * Para cada atributo, as colunas já em uso pelos outros dois — repassada
   * como prop de exclusão para os 2 `ColunaSeletora` (nome/e-mail, Etapa 6)
   * e já usada para filtrar as opções do `<select>` de ID (Etapa 5).
   */
  const colunasExcluidas = useMemo<Record<AtributoColuna, string[]>>(
    () => ({
      id: [...colunasEmUso.nome, ...colunasEmUso.email],
      nome: [...colunasEmUso.id, ...colunasEmUso.email],
      email: [...colunasEmUso.id, ...colunasEmUso.nome],
    }),
    [colunasEmUso]
  );

  /** Colunas oferecidas no seletor de ID: todos os headers, exceto os já usados por nome/e-mail. */
  const opcoesColunaId = useMemo(
    () => headers.filter((coluna) => !colunasExcluidas.id.includes(coluna)),
    [headers, colunasExcluidas.id]
  );

  /**
   * Validação bloqueante (vazio/duplicado/não numérico) da coluna
   * escolhida como ID, reaproveitando o mesmo módulo que `construirRegistros.ts`
   * usa na Etapa 2 (`validarColunaId`, seção 3 do planner) — evita duplicar a
   * checagem em dois lugares. `estado.colunaId` ausente/`null` ("Gerar
   * Automaticamente") é sempre válido.
   */
  const validacaoColunaId = useMemo(
    () => validarColunaId(linhas, estado.colunaId ?? null),
    [linhas, estado.colunaId]
  );

  function handleColunaIdChange(valor: string) {
    onEstadoChange({ colunaId: valor === '' ? null : valor });
  }

  return (
    <div className="etapa-importacao etapa-mapeamento">
      <p className="etapa-mapeamento-instrucao">
        Selecione quais colunas da planilha representam o nome e o e-mail de cada registro. Se
        desejar, escolha também qual coluna deve ser usada como identificador (ID) de cada
        registro.
      </p>

      <div className="etapa-mapeamento-secoes">
        <div className="etapa-mapeamento-secao">
          <ColunaSeletora
            titulo="Colunas de Nome"
            headers={headers}
            selecionadas={estado.colunasNome}
            busca={estado.buscaColunasNome}
            onBuscaChange={(valor) => onEstadoChange({ buscaColunasNome: valor })}
            onAlternarColuna={(coluna) =>
              onEstadoChange({ colunasNome: alternarColuna(estado.colunasNome, coluna) })
            }
            onReordenar={(nova) => onEstadoChange({ colunasNome: nova })}
            idPrefix="col-nome"
            colunasExcluidas={colunasExcluidas.nome}
          />
        </div>

        <div className="etapa-mapeamento-secao">
          <ColunaSeletora
            titulo="Colunas de E-mail"
            headers={headers}
            selecionadas={estado.colunasEmail}
            busca={estado.buscaColunasEmail}
            onBuscaChange={(valor) => onEstadoChange({ buscaColunasEmail: valor })}
            onAlternarColuna={(coluna) =>
              onEstadoChange({ colunasEmail: alternarColuna(estado.colunasEmail, coluna) })
            }
            onReordenar={(nova) => onEstadoChange({ colunasEmail: nova })}
            idPrefix="col-email"
            colunasExcluidas={colunasExcluidas.email}
          />
        </div>

        <div className="etapa-mapeamento-secao etapa-mapeamento-secao-id">
          <h3>Coluna de ID</h3>
          <p className="etapa-mapeamento-secao-id-descricao">
            Opcional. Define qual coluna identifica cada registro nesta e nas próximas
            importações/atualizações. Se não escolher nenhuma, o ID é a ordem da linha na
            planilha.
          </p>

          <select
            id="etapa-mapeamento-select-id"
            aria-label="Coluna de ID"
            value={estado.colunaId ?? ''}
            onChange={(e) => handleColunaIdChange(e.target.value)}
            aria-invalid={!validacaoColunaId.valido}
            aria-describedby={!validacaoColunaId.valido ? 'etapa-mapeamento-erro-coluna-id' : undefined}
          >
            <option value="">Gerar Automaticamente</option>
            {opcoesColunaId.map((coluna) => (
              <option key={coluna} value={coluna}>
                {coluna}
              </option>
            ))}
          </select>

          {!validacaoColunaId.valido && (
            <p id="etapa-mapeamento-erro-coluna-id" className="etapa-mapeamento-erro-bloqueante" role="alert">
              {validacaoColunaId.erro}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
