import { useState } from 'react';

import { EmailEditorRico } from '../EmailEditorRico';
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
 *
 * Etapa 14 (refatoracaoEmailFormatado.md): o `<textarea>` de texto puro do
 * corpo deu lugar ao mesmo editor de formatação rica usado no modal "Editar
 * e-mail" (`EmailEditorRico`, ver `EmailConteudoModal.tsx`) — `estado.conteudo`
 * passa a guardar HTML em vez de texto puro, e o contador de caracteres
 * reflete o texto visível (`onContagemChange`), não o tamanho da string
 * HTML. `titulo` continua um input de texto simples, sem alteração.
 */
export function EtapaDefinicao({ estado, onEstadoChange }: Props) {
  // Local, assim como em `EmailConteudoModal`: é só um auxiliar de exibição
  // para o contador, não faz parte do estado persistido do wizard
  // (`EstadoImportacao`). Reinicializado a partir de `estado.conteudo` só
  // como placeholder até o editor montar e reportar a contagem real via
  // `onContagemChange` (`onCreate` do Tiptap já dispara isso no mount).
  const [contagemCaracteres, setContagemCaracteres] = useState(estado.conteudo.length);

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
        <EmailEditorRico
          id="import-email-conteudo"
          value={estado.conteudo}
          onChange={(html) => onEstadoChange({ conteudo: html })}
          onContagemChange={setContagemCaracteres}
          placeholder="Ex.: Olá! Você está convidado(a) para..."
        />
        <span className="modal-campo-contador">{contagemCaracteres} caracteres</span>
      </div>
    </div>
  );
}
