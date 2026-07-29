import type { ReactNode } from 'react';

interface Props {
  /**
   * Nome da seção — vira `aria-label` do agrupamento para leitores de tela.
   * Os botões dentro dela já têm seu próprio `aria-label` individual; este
   * rótulo só identifica a categoria como um todo (ex.: "Extras"), do jeito
   * que um `<fieldset>`/`<legend>` identificaria um grupo de campos.
   */
  titulo: string;
  children: ReactNode;
}

/**
 * Seção fixa da toolbar do editor de e-mail
 * (refatoracaoEmailFormatado.md, revisão — Etapa 4). As cinco seções —
 * Funções Básicas, Extras, Listas, Alinhamento, Limpar Formatação — são
 * montadas em `EmailEditorToolbar.tsx` com este mesmo componente, cada uma
 * com seu próprio `titulo`.
 *
 * Por ora `ToolbarGrupo` só agrupa visual e semanticamente os botões de uma
 * categoria (`role="group"` + `aria-label`) — o comportamento visual do
 * toolbar não muda em relação ao que já existia, só a estrutura por trás
 * dele. Quem decide, por seção e reagindo à largura disponível, se os
 * botões continuam expandidos (como agora) ou colapsam atrás de um gatilho
 * com painel-dropdown (mesmo padrão de `OrdenacaoPrioridade.tsx`/
 * `PainelCores`, em `EmailEditorToolbar.tsx`) é a Etapa 5 (checkpoint) —
 * que volta a alterar este arquivo para isso. Esta etapa só cria a "caixa"
 * onde cada categoria já vive, para a Etapa 5 não precisar reestruturar
 * `EmailEditorToolbar.tsx` de novo, só este componente.
 */
export function ToolbarGrupo({ titulo, children }: Props) {
  return (
    <div className="email-editor-toolbar-grupo-secao" role="group" aria-label={titulo}>
      {children}
    </div>
  );
}

export default ToolbarGrupo;
