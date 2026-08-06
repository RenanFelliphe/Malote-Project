import { useMemo, useState } from 'react';

import type { EmailsData } from '../types/email';
import { PROJETOS } from '../data/projetos';
import { renomearProjeto, restaurarProjetos } from '../services/lixeiraApi';
import { slugify, slugifyDigitando } from './utils/slugify';
import { ConflictDialog } from './ConflictDialog';

interface ConflitoRestauracaoModalProps {
  /**
   * Slug que colidiu — hoje o mesmo valor nos dois lados do conflito (é
   * literalmente o que causou a colisão em `POST /api/lixeira/restaurar`,
   * Etapa 8).
   */
  slugConflito: string;
  /** Dados completos do projeto já ativo, dono atual do slug. */
  projetoAtivo: EmailsData;
  /** Dados completos do projeto na lixeira tentando restaurar. */
  projetoLixeira: EmailsData;
  /**
   * Slugs dos demais itens na lixeira (excluindo o próprio `slugConflito`)
   * — um dos "três conjuntos" de validação descritos na seção 2 do plano.
   * Vem de `LixeiraSidebar`, que já mantém essa lista carregada.
   */
  outrosSlugsLixeira: string[];
  onCancelar: () => void;
  /** Chamado só após renomear e restaurar com sucesso. */
  onResolvido: () => void;
}

/**
 * Modal de resolução de conflito de restauração (Etapa 9 de
 * implementacaoDelecao.md), construído sobre `ConflictDialog` (já existente
 * — reservado a conflitos reais). Mostra os dois projetos em disputa lado a
 * lado — o já ativo e o que está voltando da lixeira — cada um com um campo
 * de "Nome do arquivo" editável, mesmo conceito de slug já usado no wizard
 * de importação.
 *
 * Validação em tempo real (reaproveitando `slugify.ts`, mesma dupla de
 * variantes do wizard: `slugifyDigitando` ao digitar, `slugify` para o
 * valor final normalizado) contra os três conjuntos da seção 2 do plano: os
 * slugs de projetos ativos (`PROJETOS`, `src/data/projetos.ts`), os demais
 * slugs na lixeira (`outrosSlugsLixeira`, prop) e o valor do outro campo
 * deste mesmo modal. Confirmar só habilita quando os dois valores finais são
 * não vazios, distintos entre si e sem colisão externa.
 *
 * Ao confirmar: renomeia (via `renomearProjeto`, `PATCH /api/projetos/:slug`)
 * apenas o(s) lado(s) cujo valor final mudou em relação a `slugConflito` —
 * o usuário pode resolver o conflito mudando só um dos dois campos, não
 * precisa dos dois — e então chama `restaurarProjetos` de novo com o slug
 * final do lado da lixeira, reaproveitando o caminho feliz da Etapa 8 (agora
 * sem conflito, já que o slug do lado ativo mudou, ou o próprio slug da
 * lixeira mudou para um valor livre).
 */
export function ConflitoRestauracaoModal({
  slugConflito,
  projetoAtivo,
  projetoLixeira,
  outrosSlugsLixeira,
  onCancelar,
  onResolvido,
}: ConflitoRestauracaoModalProps) {
  const [inputAtivo, setInputAtivo] = useState(slugConflito);
  const [inputLixeira, setInputLixeira] = useState(slugConflito);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Slugs de todos os demais projetos ativos, excluindo o próprio
  // `slugConflito` (dono atual do slug, um dos dois lados deste mesmo
  // conflito — não faz sentido colidir "com ele mesmo"). Vem de `PROJETOS`
  // (import.meta.glob resolvido uma vez no carregamento do módulo — mesma
  // limitação já documentada na Etapa 5: só reflete criações/exclusões após
  // um reload, aceitável aqui como conveniência de UX, já que o servidor
  // valida contra o disco de qualquer forma).
  const outrosSlugsAtivos = useMemo(
    () => PROJETOS.map((projeto) => projeto.slug).filter((slug) => slug !== slugConflito),
    [slugConflito],
  );

  const finalAtivo = slugify(inputAtivo);
  const finalLixeira = slugify(inputLixeira);

  function colideExternamente(valorFinal: string): boolean {
    return outrosSlugsAtivos.includes(valorFinal) || outrosSlugsLixeira.includes(valorFinal);
  }

  const ativoValido = finalAtivo !== '' && finalAtivo !== finalLixeira && !colideExternamente(finalAtivo);
  const lixeiraValido = finalLixeira !== '' && finalLixeira !== finalAtivo && !colideExternamente(finalLixeira);
  const podeConfirmar = ativoValido && lixeiraValido && !enviando;

  function motivoDesabilitado(): string | undefined {
    if (enviando) return undefined;
    if (finalAtivo === '' || finalLixeira === '') {
      return 'Informe um nome de arquivo para os dois projetos.';
    }
    if (finalAtivo === finalLixeira) {
      return 'Os dois nomes de arquivo precisam ser diferentes entre si.';
    }
    if (colideExternamente(finalAtivo) || colideExternamente(finalLixeira)) {
      return 'Esse nome de arquivo já está em uso por outra planilha.';
    }
    return undefined;
  }

  /**
   * Renomeia só o(s) lado(s) que de fato mudaram e então tenta restaurar de
   * novo — mesmo padrão em duas etapas descrito no plano (Etapa 9): o
   * renomeio resolve a colisão, a restauração de fato reaproveita a lógica
   * "sem conflito" já implementada na Etapa 8 (`restaurarProjetos`).
   */
  async function handleConfirmar() {
    if (!podeConfirmar) return;

    setEnviando(true);
    setErro(null);

    try {
      if (finalAtivo !== slugConflito) {
        await renomearProjeto(slugConflito, finalAtivo, 'ativo');
      }
      if (finalLixeira !== slugConflito) {
        await renomearProjeto(slugConflito, finalLixeira, 'lixeira');
      }

      const [resultado] = await restaurarProjetos([finalLixeira]);

      if (!resultado?.ok) {
        throw new Error(
          resultado?.conflito
            ? 'Ainda existe um conflito de nomes — tente outro nome de arquivo.'
            : resultado?.error ?? 'Não foi possível concluir a restauração.'
        );
      }

      onResolvido();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível resolver o conflito.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ConflictDialog
      title="Conflito ao restaurar planilha"
      description="Já existe uma planilha ativa com o mesmo nome de arquivo da que está sendo restaurada. Escolha um nome diferente para um dos dois lados para continuar."
      onCancel={onCancelar}
      onConfirm={() => void handleConfirmar()}
      confirmLabel={enviando ? 'Restaurando...' : 'Restaurar'}
      confirmDisabled={!podeConfirmar}
      disabledHint={motivoDesabilitado()}
      className="conflito-restauracao-dialog"
    >
      <div className="conflito-restauracao-colunas">
        <div className="conflito-restauracao-coluna">
          <span className="conflito-restauracao-rotulo">Planilha ativa</span>
          <span className="conflito-restauracao-nome">{projetoAtivo.projeto}</span>
          <label className="conflito-restauracao-campo">
            Nome do arquivo
            <input
              type="text"
              value={inputAtivo}
              onChange={(evento) => setInputAtivo(slugifyDigitando(evento.target.value))}
              disabled={enviando}
              aria-invalid={!ativoValido}
            />
          </label>
          {!ativoValido && (
            <span className="conflito-restauracao-campo-erro">
              {finalAtivo === ''
                ? 'Obrigatório.'
                : finalAtivo === finalLixeira
                  ? 'Igual ao outro campo.'
                  : 'Nome já em uso.'}
            </span>
          )}
        </div>

        <span className="conflito-restauracao-versus" aria-hidden="true">×</span>

        <div className="conflito-restauracao-coluna">
          <span className="conflito-restauracao-rotulo">Planilha na lixeira</span>
          <span className="conflito-restauracao-nome">{projetoLixeira.projeto}</span>
          <label className="conflito-restauracao-campo">
            Nome do arquivo
            <input
              type="text"
              value={inputLixeira}
              onChange={(evento) => setInputLixeira(slugifyDigitando(evento.target.value))}
              disabled={enviando}
              aria-invalid={!lixeiraValido}
            />
          </label>
          {!lixeiraValido && (
            <span className="conflito-restauracao-campo-erro">
              {finalLixeira === ''
                ? 'Obrigatório.'
                : finalLixeira === finalAtivo
                  ? 'Igual ao outro campo.'
                  : 'Nome já em uso.'}
            </span>
          )}
        </div>
      </div>

      {erro && <p className="erro-salvamento conflito-restauracao-erro">{erro}</p>}
    </ConflictDialog>
  );
}
