import { useEffect, useRef, useState } from 'react';

interface Props {
  valor: number;
  onChange: (valor: number) => void;
  /** Menor valor aceito (números naturais começam em 1). */
  min?: number;
  /** Maior valor aceito (ex.: quantidade total de registros existentes). */
  max?: number;
}

/** Atraso antes de começar a repetir, e intervalo entre repetições (ms). */
const ATRASO_INICIAL_REPETICAO = 400;
const INTERVALO_REPETICAO = 20;

/**
 * Input de "quantidade de registros exibidos" (substitui o campo homônimo
 * que existia dentro do modal "Listar E-mails", agora removido — fica ao
 * lado da barra de busca, seção 7).
 *
 * Aceita apenas números naturais (dígitos, sem sinal nem decimais) e conta
 * com duas setas ao lado para incrementar/decrementar por clique (ou
 * pressionamento contínuo, repetindo o incremento). Não usa `type="number"`
 * nativo porque isso traria as setas padrão do navegador, inconsistentes
 * entre navegadores e sem controle de estilo; em vez disso, o campo é
 * `text` com filtragem manual de dígitos e as setas são botões próprios.
 *
 * Mantém um texto local para permitir digitação fluida (inclusive campo
 * temporariamente vazio enquanto o usuário apaga e redigita); o valor só é
 * de fato confirmado — e corrigido para os limites `min`/`max`, se
 * necessário — ao perder o foco ou pressionar Enter.
 */
export function QuantidadeInput({ valor, onChange, min = 1, max }: Props) {
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

  // Ref com o valor mais recente, usada pelo long-press das setas (evita
  // closures presas ao valor do momento em que o intervalo foi criado).
  const valorRef = useRef(valor);
  valorRef.current = valor;

  const inputRef = useRef<HTMLInputElement>(null);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function limitar(numero: number) {
    let resultado = Math.max(min, numero);
    if (max !== undefined) resultado = Math.min(max, resultado);
    return resultado;
  }

  function confirmar() {
    const numero = Number.parseInt(texto, 10);
    const valido = texto !== '' && Number.isFinite(numero);
    const valorFinal = valido ? limitar(numero) : min;
    setTexto(String(valorFinal));
    if (valorFinal !== valor) onChange(valorFinal);
  }

  function incrementar() {
    onChange(limitar(valorRef.current + 1));
  }

  function decrementar() {
    onChange(limitar(valorRef.current - 1));
  }

  function pararRepeticao() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervaloRef.current) clearInterval(intervaloRef.current);
    timeoutRef.current = null;
    intervaloRef.current = null;
  }

  function iniciarRepeticao(acao: () => void) {
    acao();
    timeoutRef.current = setTimeout(() => {
      intervaloRef.current = setInterval(acao, INTERVALO_REPETICAO);
    }, ATRASO_INICIAL_REPETICAO);
  }

  // Garante que nenhum intervalo fique "vazando" se o componente for
  // desmontado com o botão ainda pressionado.
  useEffect(() => pararRepeticao, []);

  const podeIncrementar = max === undefined || valor < max;
  const podeDecrementar = valor > min;

  return (
    <div className="quantidade-input">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        ref={inputRef}
        className="quantidade-input-campo"
        value={texto}
        onChange={(e) => {
          const apenasDigitos = e.target.value.replace(/\D/g, '');
          // Normaliza zeros à esquerda durante a digitação (ex.: "007" -> "7"),
          // preservando um único "0" caso seja o único dígito presente.
          const semZerosAEsquerda = apenasDigitos.replace(/^0+(?=\d)/, '');
          setTexto(semZerosAEsquerda);
        }}
        onFocus={(e) => e.target.select()}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        role="spinbutton"
        aria-valuenow={valor}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label="Quantidade de registros exibidos"
      />
      <div className="quantidade-setas">
        <button
          type="button"
          className="quantidade-seta quantidade-seta-cima"
          onMouseDown={() => iniciarRepeticao(incrementar)}
          onMouseUp={pararRepeticao}
          onMouseLeave={pararRepeticao}
          onTouchStart={() => iniciarRepeticao(incrementar)}
          onTouchEnd={pararRepeticao}
          disabled={!podeIncrementar}
          aria-label="Aumentar quantidade"
        />
        <button
          type="button"
          className="quantidade-seta quantidade-seta-baixo"
          onMouseDown={() => iniciarRepeticao(decrementar)}
          onMouseUp={pararRepeticao}
          onMouseLeave={pararRepeticao}
          onTouchStart={() => iniciarRepeticao(decrementar)}
          onTouchEnd={pararRepeticao}
          disabled={!podeDecrementar}
          aria-label="Diminuir quantidade"
        />
      </div>
    </div>
  );
}