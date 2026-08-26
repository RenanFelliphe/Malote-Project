/**
 * Lógica central de restauração de campos protegidos por `backup_dados`
 * (`EdicaoIndividualdeRegistro.md`, seções 3 e 5). Centralizada aqui para
 * que o caminho "1 campo, sem modal" (Etapa 6) e a confirmação do modal de
 * conflito (Etapa 7) apliquem exatamente a mesma regra, em vez de cada um
 * reimplementar a assimetria entre campos de forma divergente.
 */
import type { EmailRecord } from '../../types/email';

/** Campos que podem ser restaurados a partir de `backup_dados` (seção 3) — inclui `status`, ao contrário de `TCampoEditavel` (`EmailTable.tsx`), que cobre só a edição inline de `nome`/`email`. */
export type TCampoRestauravel = 'nome' | 'email' | 'status';

/**
 * Restaura, num único registro, os campos escolhidos em `camposEscolhidos`
 * que de fato estiverem presentes em `backup_dados` — os demais são um
 * no-op silencioso (seção 5, tabela de exemplo com 7 registros), o que
 * permite usar a mesma função tanto no caminho direto (1 campo) quanto na
 * confirmação do modal (2+ campos, individual ou em massa, Etapa 7), sem
 * que o chamador precise filtrar antes quais campos cada registro
 * realmente tem protegidos.
 *
 * Aplica a regra assimétrica da seção 3:
 * - **`nome` / `email`:** o valor capturado em `backup_dados[campo]` é
 *   escrito de volta no campo, literalmente, e a chave é removida.
 * - **`status`:** **não** escreve nenhum valor de volta em `status` — só
 *   remove a chave `backup_dados.status`. O valor de status em si nunca é
 *   armazenado em `backup_dados` (só a marcação `true`), e o status
 *   correto pode ter mudado desde a alteração manual (ex.: o grupo de
 *   duplicados daquele e-mail pode ter encolhido nesse meio tempo) — por
 *   isso o recálculo de fato é responsabilidade do chamador, via
 *   `recalcularStatusAutomatico` (`EmailStatus.ts`) sobre o conjunto
 *   completo de registros, depois de chamar esta função (que só opera
 *   sobre um registro isolado e não tem acesso aos demais para calcular
 *   duplicados). Uma vez que a chave é removida aqui, `recalcularStatusAutomatico`
 *   volta a processar o registro normalmente na próxima chamada do
 *   chamador — mesmo padrão já usado por `handleRestaurar` (`emails.tsx`)
 *   para a restauração em massa de status.
 *
 * Não muta `registro`. Quando nenhum dos campos escolhidos está de fato
 * presente em `backup_dados` (todos no-op), retorna a mesma referência
 * recebida, sem gravar `last_updated` — não houve alteração de fato.
 */
export function restaurarCampos(
  registro: EmailRecord,
  camposEscolhidos: TCampoRestauravel[]
): EmailRecord {
  if (!registro.backup_dados) return registro;

  const backupRestante = { ...registro.backup_dados };
  const camposAlterados: Partial<Pick<EmailRecord, 'nome' | 'email'>> = {};
  let houveAlteracao = false;

  for (const campo of camposEscolhidos) {
    if (backupRestante[campo] === undefined) continue;

    if (campo === 'nome' || campo === 'email') {
      camposAlterados[campo] = backupRestante[campo];
    }
    // `status`: nenhum valor literal é escrito de volta — só a remoção da
    // chave abaixo já basta para destravar o recálculo automático.

    delete backupRestante[campo];
    houveAlteracao = true;
  }

  if (!houveAlteracao) return registro;

  const restamChaves = Object.keys(backupRestante).length > 0;

  return {
    ...registro,
    ...camposAlterados,
    backup_dados: restamChaves ? backupRestante : undefined,
    last_updated: new Date().toISOString(),
  };
}
