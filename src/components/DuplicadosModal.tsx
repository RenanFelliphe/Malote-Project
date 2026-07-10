import type { EmailRecord } from '../types/email';
import { Dialog } from './Dialog';

interface Props {
  /** Registros que compartilham o mesmo e-mail (grupo de duplicados). */
  registros: EmailRecord[];
  onFechar: () => void;
}

/**
 * Modal exibido ao clicar no status "duplicado" de um registro na tabela
 * principal (melhoria de estilização — facilita identificar rapidamente
 * quais registros compartilham o mesmo e-mail, seção 5.4: "duplicado
 * quando existir mais de um registro com o mesmo endereço de e-mail,
 * independentemente do nome").
 *
 * Mostra todos os registros do grupo, mesmo que algum deles tenha sido
 * manualmente alterado para outro status (seção 5.3) — o objetivo aqui é
 * dar contexto completo sobre o e-mail em questão, não apenas os que ainda
 * estão com status "duplicado".
 */
export function DuplicadosModal({ registros, onFechar }: Props) {
  const email = registros[0]?.email ?? '';

  return (
    <Dialog
      isOpen
      onClose={onFechar}
      title="Registros com o mesmo e-mail"
      className="modal-duplicados"
    >
      <p className="duplicados-email">{email}</p>

      <table className="duplicados-tabela">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nome</th>
            <th>E-mail</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {registros.map((registro) => (
            <tr key={registro.id}>
              <td>{registro.id}</td>
              <td>{registro.nome}</td>
              <td>{registro.email}</td>
              <td>
                <span className={`status-badge status-${registro.status}`}>
                  {registro.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}
