/**
 * Serialização "email-safe" do HTML do editor (refatoracaoEmailFormatado.md
 * — Etapa 12). Gmail e Outlook descartam `<style>` e, na maior parte dos
 * casos, o atributo `class` — então tudo que hoje só existe como regra em
 * `index.css` precisa virar `style` inline antes de ir para fora da
 * aplicação (Etapa 13 — copiar formatado).
 *
 * Cor de texto, highlight (`TextStyle`/`Color`/`Highlight`, Etapa 4) e
 * alinhamento (`TextAlign`, Etapa 8) **não** precisam de nenhum tratamento
 * aqui: essas três extensões já escrevem `style` inline por conta própria
 * (ver `EmailEditorRico.tsx`), então `editor.getHTML()` já sai correto
 * nesses pontos. Negrito/itálico/sublinhado/tachado (Etapa 3) também não
 * precisam — `strong`/`em`/`u`/`s` são renderizados nativamente por
 * qualquer cliente de e-mail, sem depender de CSS nenhum.
 *
 * O que falta, e é o que esta função resolve, olhando `index.css`:
 * - **Link** (Etapa 5): cor de acento e sublinhado (`.campo-corpo-email-editor a`).
 * - **Listas** (Etapa 6): margem/recuo e o marcador do segundo nível de
 *   lista não ordenada (`circle`) — o navegador já aplica `disc`/`decimal`
 *   por padrão, mas o círculo do segundo nível é decisão nossa, não do
 *   user-agent (`.campo-corpo-email-editor ul`/`ul ul`/`ol`).
 * - **"Transformar em botão"** (Etapa 7): todo o visual da caixa — cor de
 *   fundo, arredondamento, padding, margin, texto branco por dentro — vem
 *   inteiramente de `.email-botao`/`.email-botao p`. Sem inline, o botão
 *   chega ao Gmail/Outlook como uma `<div>` sem nenhum estilo.
 *
 * Fora do escopo desta etapa, por decisão registrada em
 * refatoracaoEmailFormatado.md (a etapa lista só negrito/cor/highlight/
 * link/botão/listas/alinhamento): a margem entre parágrafos
 * (`.campo-corpo-email-editor p`). Sem essa regra, cada `<p>` cai no
 * espaçamento padrão do cliente de e-mail — perceptível, ainda que não
 * idêntico ao 0.6em do editor, não fica sem nenhum espaçamento.
 *
 * As cores abaixo são os valores fixos do tema **claro** de
 * `--color-accent`/`--color-accent-contrast` (`index.css`), resolvidos à
 * mão: um e-mail já enviado não tem como saber se quem lê está com o app
 * local em modo escuro, e não faz sentido um botão/link mudarem de cor
 * sozinhos dentro da caixa de entrada — por isso o e-mail sempre sai com a
 * paleta clara, independente do tema em que foi escrito.
 */
const COR_ACENTO = '#3452e0';
const COR_BOTAO_TEXTO = '#ffffff';

/**
 * Funde um mapa de propriedades CSS no atributo `style` de um elemento,
 * sem sobrescrever nenhuma propriedade que já esteja lá — importante para o
 * nó do botão (Etapa 7), que pode já ter `text-align` inline escrito pela
 * própria extensão `TextAlign` (Etapa 8): o que o editor já colocou tem
 * prioridade sobre o que esta função adiciona por cima.
 */
function mesclarEstiloInline(elemento: HTMLElement, propriedades: Record<string, string>) {
  const existentes = new Map(
    (elemento.getAttribute('style') ?? '')
      .split(';')
      .map((declaracao) => declaracao.trim())
      .filter(Boolean)
      .map((declaracao) => {
        const [chave, ...resto] = declaracao.split(':');
        return [chave.trim(), resto.join(':').trim()] as [string, string];
      }),
  );

  for (const [chave, valor] of Object.entries(propriedades)) {
    if (!existentes.has(chave)) existentes.set(chave, valor);
  }

  const novoStyle = Array.from(existentes.entries())
    .map(([chave, valor]) => `${chave}: ${valor}`)
    .join('; ');
  if (novoStyle) elemento.setAttribute('style', novoStyle);
}

/**
 * Converte o HTML do editor (`editor.getHTML()`, já sanitizado por
 * `sanitizarHtml`) para uma versão "email-safe", com os estilos de
 * link/listas/botão inline em vez de dependerem de `index.css`. Usada pela
 * Etapa 13 (copiar formatado) antes de escrever o HTML na área de
 * transferência.
 */
export function converterParaHtmlEmailSeguro(html: string): string {
  const documento = new DOMParser().parseFromString(html, 'text/html');
  const raiz = documento.body;

  raiz.querySelectorAll('a').forEach((link) => {
    mesclarEstiloInline(link as HTMLElement, {
      color: COR_ACENTO,
      'text-decoration': 'underline',
      'text-underline-offset': '2px',
    });
  });

  raiz.querySelectorAll('ul, ol').forEach((lista) => {
    const listaElemento = lista as HTMLElement;
    mesclarEstiloInline(listaElemento, {
      margin: '0 0 0.6em',
      'padding-left': '1.4em',
    });

    if (listaElemento.tagName === 'UL') {
      // Mesma semântica do seletor `ul ul` em index.css: só o segundo nível
      // de lista NÃO ordenada (com ancestral `ul`, não `ol`) vira `circle`.
      const dentroDeOutraListaNaoOrdenada = listaElemento.parentElement?.closest('ul') != null;
      mesclarEstiloInline(listaElemento, {
        'list-style-type': dentroDeOutraListaNaoOrdenada ? 'circle' : 'disc',
      });
    } else {
      mesclarEstiloInline(listaElemento, { 'list-style-type': 'decimal' });
    }
  });

  raiz.querySelectorAll('div[data-tipo="botao-email"]').forEach((botao) => {
    const botaoElemento = botao as HTMLElement;
    mesclarEstiloInline(botaoElemento, {
      margin: '0.6em auto',
      padding: '0.7em 1.4em',
      'max-width': 'fit-content',
      'border-radius': '6px',
      'background-color': COR_ACENTO,
      'text-align': 'center',
    });

    botaoElemento.querySelectorAll('p').forEach((paragrafo) => {
      mesclarEstiloInline(paragrafo as HTMLElement, { margin: '0', color: COR_BOTAO_TEXTO });
    });
  });

  return raiz.innerHTML;
}

export default converterParaHtmlEmailSeguro;
