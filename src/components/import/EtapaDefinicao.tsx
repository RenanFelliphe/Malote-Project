import type { EstadoImportacao } from './types';

interface Props {
  estado: EstadoImportacao;
  onEstadoChange: (novoEstado: Partial<EstadoImportacao>) => void;
}

/**
 * Etapa "Definição" do assistente de importação (Informações → Mapeamento →
 * Definição → Revisão), onde o título/corpo do e-mail podem ser preenchidos
 * opcionalmente já durante a importação (ver
 * REFATORACAO-EMAIL-TITULO-CONTEUDO.md, Etapa 4). Assim como o restante do
 * wizard nesta fase, não está conectada a uma importação real ainda — o
 * preenchimento definitivo pode ser feito depois pelo modal "Editar e-mail"
 * na tela principal.
 */
export function EtapaDefinicao({ estado, onEstadoChange }: Props) {
  return (
    <div className="etapa-importacao etapa-definicao">
      <p className="etapa-definicao-instrucao">
        Defina o título e o corpo do e-mail que será enviado aos registros desta planilha.{' '}
        <span className="badge-opcional">opcional</span> Pode ser preenchido agora ou depois, pelo item
        "Editar e-mail" no menu de configurações.
      </p>

      <div className="campo-formulario">
        <label htmlFor="import-email-titulo">Título</label>
        <input
          id="import-email-titulo"
          type="text"
          placeholder="Ex.: Convite para o evento"
          value={estado.titulo}
          onChange={(e) => onEstadoChange({ titulo: e.target.value })}
        />
      </div>

      <div className="campo-formulario">
        <label htmlFor="import-email-conteudo">Corpo</label>
        <textarea
          id="import-email-conteudo"
          placeholder="Ex.: Olá! Você está convidado(a) para..."
          value={estado.conteudo}
          onChange={(e) => onEstadoChange({ conteudo: e.target.value })}
          rows={10}
        />
      </div>
    </div>
  );
}
