import { useState } from 'react';

interface Props {
  valor: number;
  onChange: (valor: number) => void;
  /** Menor valor aceito (números naturais começam em 1). */
  min?: number;
}

/**
 * Input de "quantidade de registros exibidos" (substitui o campo homônimo
 * que existia dentro do modal "Listar E-mails", agora removido — fica ao
 * lado da barra de busca, seção 7).
 *
 * Aceita apenas números naturais (dígitos, sem sinal nem decimais) e conta
 * com duas setas ao lado para incrementar/decrementar por clique. Não usa
 * `type="number"` nativo porque isso traria as setas padrão do navegador,
 * inconsistentes entre navegadores e sem controle de estilo; em vez disso,
 * o campo é `text` com filtragem manual de dígitos e as setas são botões
 * próprios.
 *
 * Mantém um texto local para permitir digitação fluida (inclusive campo
 * temporariamente vazio enquanto o usuário apaga e redigita); o valor só é
 * de fato confirmado — e corrigido para o mínimo, se necessário — ao perder
 * o foco ou pressionar Enter.
 */
export function QuantidadeInput({ valor, onChange, min = 1 }: Props) {
  const [texto, setTexto] = useState(String(valor));

  // Mantém o campo sincronizado quando o valor muda por fora (setas, ou
  // qualquer outra alteração externa de `valor`). Ajuste feito durante a
  // própria renderização (React recomenda isso em vez de um efeito, o que
  // evita uma renderização extra em cascata só para refletir a prop nova —
  // ver https://react.dev/learn/you-might-not-need-an-effect).
  const [valorSincronizado, setValorSincronizado] = useState(valor);
  if (valor !== valorSincronizado) {
    setValorSincronizado(valor);
    setTexto(String(valor));
  }

  function confirmar() {
    const numero = Number.parseInt(texto, 10);
    const valido = texto !== '' && Number.isFinite(numero) && numero >= min;
    const valorFinal = valido ? numero : min;
    setTexto(String(valorFinal));
    if (valorFinal !== valor) onChange(valorFinal);
  }

  function incrementar() {
    onChange(valor + 1);
  }

  function decrementar() {
    onChange(Math.max(min, valor - 1));
  }

  return (
    <div className="quantidade-input">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className="quantidade-input-campo"
        value={texto}
        onChange={(e) => setTexto(e.target.value.replace(/\D/g, ''))}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        aria-label="Quantidade de registros exibidos"
      />
      <div className="quantidade-setas">
        <button
          type="button"
          className="quantidade-seta quantidade-seta-cima"
          onClick={incrementar}
          aria-label="Aumentar quantidade"
        />
        <button
          type="button"
          className="quantidade-seta quantidade-seta-baixo"
          onClick={decrementar}
          disabled={valor <= min}
          aria-label="Diminuir quantidade"
        />
      </div>
    </div>
  );
}