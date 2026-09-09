import { useState } from 'react';

import { Dialog } from './Dialog';
import { ConfirmDialog } from './ConfirmDialog';
import type { ProjetoDoManifesto } from '../types/pacoteProjetos';
import type { DecisaoConflitoPacote } from '../services/pacoteProjetosApi';

interface Props {
  /** Projeto do pacote que colide com um slug já ativo (seção 4 do planner). */
  projetoDoPacote: ProjetoDoManifesto;
  /**
   * Nome de exibição do projeto já ativo com o mesmo slug — vem de
   * `PROJETOS` (`pages/home.tsx`), repassado por `ImportarProjetosModal` já
   * que este componente não conhece a lista de projetos existentes por si
   * só. `undefined` só no caso defensivo (não deveria acontecer, já que
   * este modal só é aberto para slugs presentes em `resultado.conflitos`)
   * de o slug não ser encontrado — usa o próprio slug como rótulo.
   */
  nomeExistente: string | undefined;
  /** Posição 1-based deste conflito na fila, para o rótulo "Conflito X de N". */
  posicao: number;
  totalConflitos: number;
  /** Slugs, do pacote e já ativos, usados só para sugerir (nunca validar de verdade — isso é papel do servidor) um `novoSlug` sem colisão óbvia na opção "Importar como novo". */
  slugsParaEvitarNaSugestao: Iterable<string>;
  onResolver: (decisao: DecisaoConflitoPacote) => void;
  /** Cancela a importação inteira (não só este conflito) — mesmo botão do rodapé do resumo, repetido aqui para quem preferir desistir no meio da fila. */
  onCancelarImportacao: () => void;
}

type OpcaoConflito = 'manter' | 'substituir' | 'novoSlug';

/**
 * Sugestão inicial de `novoSlug` para a opção "Importar como novo" — só
 * conveniência de UX, sem garantia real (o servidor valida contra o disco
 * em `handleConfirmarImportacaoPacote`, `vite.config.ts`, seção 5 do
 * planner). Ajuste de rota registrado na Etapa 3: não usa `slugify.ts`
 * (Demanda 3) porque esse arquivo não veio no ZIP desta demanda.
 */
function sugerirNovoSlug(slugOriginal: string, slugsAEvitar: Set<string>): string {
  const base = `${slugOriginal}-importado`;
  if (!slugsAEvitar.has(base)) return base;

  let contador = 2;
  while (slugsAEvitar.has(`${base}-${contador}`)) {
    contador += 1;
  }
  return `${base}-${contador}`;
}

/**
 * Checagem client-side de slug seguro — mesmo critério mínimo de
 * `slugEhSeguro`/`slugSeguro` (`vite.config.ts`/`scripts/utils/pacoteProjetos.ts`),
 * duplicado aqui como conveniência de UX (evita um round-trip só para
 * rejeitar algo obviamente inválido); a garantia real continua sendo a
 * checagem do servidor contra o disco.
 */
function slugPareceSeguro(slug: string): boolean {
  return slug.length > 0 && !slug.includes('/') && !slug.includes('\\') && slug !== '.' && slug !== '..';
}

/**
 * Modal de conflito de slug/nome na importação de um pacote de projetos
 * (Demanda 11 — `ExportacaoImportacaoDeProjetos.md`, Etapa 6, seção 4).
 * Reaproveita o casco visual do `Dialog`/`ConfirmDialog` já usados no
 * resto do sistema — `ConflitoRestauracaoModal.tsx` (Demanda 3, citado na
 * seção 4 como referência mais próxima) não veio no ZIP desta demanda, por
 * isso este componente segue só a composição genérica de `Dialog` em vez
 * de reaproveitar classes específicas daquele modal.
 *
 * Exibido em cascata, um projeto conflitante por vez — quem controla a
 * fila (`posicao`/`totalConflitos`, qual `projetoDoPacote` está em tela) é
 * `ImportarProjetosModal.tsx`; este componente só resolve o conflito
 * corrente e devolve a decisão via `onResolver`, sem saber nada sobre os
 * demais conflitos do pacote.
 */
export function ConflitoImportacaoProjetoModal({
  projetoDoPacote,
  nomeExistente,
  posicao,
  totalConflitos,
  slugsParaEvitarNaSugestao,
  onResolver,
  onCancelarImportacao,
}: Props) {
  const [opcao, setOpcao] = useState<OpcaoConflito>('manter');
  const [novoSlug, setNovoSlug] = useState(() =>
    sugerirNovoSlug(projetoDoPacote.slug, new Set(slugsParaEvitarNaSugestao))
  );
  const [erroNovoSlug, setErroNovoSlug] = useState<string | null>(null);
  // Segunda confirmação da opção destrutiva "Substituir pelo do pacote"
  // (seção 4 do planner) — só chega em `onResolver` depois de confirmada
  // aqui, nunca direto do clique em "Aplicar".
  const [confirmandoSubstituicao, setConfirmandoSubstituicao] = useState(false);

  function handleAplicar() {
    if (opcao === 'manter') {
      onResolver({ slug: projetoDoPacote.slug, acao: 'manter' });
      return;
    }
    if (opcao === 'substituir') {
      setConfirmandoSubstituicao(true);
      return;
    }
    // opcao === 'novoSlug'
    const valor = novoSlug.trim();
    if (!slugPareceSeguro(valor)) {
      setErroNovoSlug('Informe um slug válido (sem "/", "\\", "." ou "..").');
      return;
    }
    setErroNovoSlug(null);
    onResolver({ slug: projetoDoPacote.slug, acao: 'novoSlug', novoSlug: valor });
  }

  return (
    <Dialog
      isOpen
      onClose={onCancelarImportacao}
      title={
        totalConflitos > 1
          ? `Conflito de projeto (${posicao} de ${totalConflitos})`
          : 'Conflito de projeto'
      }
      className="modal-conflito-importacao-projeto"
      footer={
        <div className="exportar-rodape">
          <button type="button" className="dialog-botao-cancelar" onClick={onCancelarImportacao}>
            Cancelar importação
          </button>
          <button type="button" className="dialog-botao-copiar" onClick={handleAplicar}>
            Aplicar
          </button>
        </div>
      }
    >
      <p className="modal-campo-label">
        Já existe um projeto ativo com o slug <strong>{projetoDoPacote.slug}</strong>. Escolha o que fazer com o
        projeto do pacote:
      </p>

      <div className="conflito-importacao-comparacao">
        <div className="conflito-importacao-lado">
          <span className="modal-campo-label">Projeto existente</span>
          <p>{nomeExistente ?? projetoDoPacote.slug}</p>
        </div>
        <div className="conflito-importacao-lado">
          <span className="modal-campo-label">Projeto do pacote</span>
          <p>{projetoDoPacote.nome}</p>
          <p className="importar-projetos-item-registros">{projetoDoPacote.totalRegistros} registro(s)</p>
        </div>
      </div>

      <div className="conflito-importacao-opcoes" role="radiogroup" aria-label="Como resolver este conflito">
        <label className="conflito-importacao-opcao">
          <input
            type="radio"
            name={`conflito-${projetoDoPacote.slug}`}
            checked={opcao === 'manter'}
            onChange={() => setOpcao('manter')}
          />
          <span>
            <strong>Manter o atual</strong> — ignora o projeto do pacote; o existente não é alterado.
          </span>
        </label>

        <label className="conflito-importacao-opcao">
          <input
            type="radio"
            name={`conflito-${projetoDoPacote.slug}`}
            checked={opcao === 'substituir'}
            onChange={() => setOpcao('substituir')}
          />
          <span>
            <strong>Substituir pelo do pacote</strong> — sobrescreve o projeto existente com o conteúdo do
            pacote. Pede confirmação extra antes de aplicar.
          </span>
        </label>

        <label className="conflito-importacao-opcao">
          <input
            type="radio"
            name={`conflito-${projetoDoPacote.slug}`}
            checked={opcao === 'novoSlug'}
            onChange={() => setOpcao('novoSlug')}
          />
          <span>
            <strong>Importar como novo</strong> — grava o projeto do pacote com um slug novo, mantendo os dois
            lado a lado.
          </span>
        </label>

        {opcao === 'novoSlug' && (
          <div className="conflito-importacao-novo-slug">
            <label htmlFor={`novo-slug-${projetoDoPacote.slug}`} className="modal-campo-label">
              Novo slug
            </label>
            <input
              id={`novo-slug-${projetoDoPacote.slug}`}
              type="text"
              value={novoSlug}
              onChange={(evento) => {
                setNovoSlug(evento.target.value);
                setErroNovoSlug(null);
              }}
            />
            {erroNovoSlug && <p className="erro-salvamento">{erroNovoSlug}</p>}
          </div>
        )}
      </div>

      {confirmandoSubstituicao && (
        <ConfirmDialog
          ariaLabel="Confirmar substituição do projeto existente"
          titulo="Substituir o projeto existente?"
          descricao={
            <>
              O projeto <strong>{nomeExistente ?? projetoDoPacote.slug}</strong> será sobrescrito pelo conteúdo do
              pacote. Essa ação não pode ser desfeita.
            </>
          }
          rotuloCancelar="Voltar"
          rotuloConfirmar="Substituir"
          onCancelar={() => setConfirmandoSubstituicao(false)}
          onConfirmar={() => {
            setConfirmandoSubstituicao(false);
            onResolver({ slug: projetoDoPacote.slug, acao: 'substituir' });
          }}
        />
      )}
    </Dialog>
  );
}