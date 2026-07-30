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
 * **Botão — exportação bulletproof (refatoracaoEmailFormatado.md, revisão —
 * Etapa 8):** o tratamento anterior (só inlinar `style` num `<div>`) resolve
 * a maioria dos clientes de e-mail baseados em WebKit/Blink/Gecko (Gmail,
 * Apple Mail, Yahoo, clientes móveis), mas não o Outlook Desktop
 * (Windows) — o motor de renderização dele não é um navegador, é o Word, que
 * ignora `background-color`, `border-radius` e `padding` em `<div>`/`<span>`
 * e simplesmente descarta o `<a>` como link real na maior parte das
 * versões. Por isso, a partir desta etapa, o `<div data-tipo="botao-email">`
 * do editor não sai mais como `<div>` no HTML copiado — vira uma estrutura
 * de "botão bulletproof" com três camadas, cada uma alvo de um motor
 * diferente:
 * 1. `<table><tr><td style="background-color:...; border-radius:...">`: cor
 *    de fundo e arredondamento aplicados a `<td>`, não a `<div>` — é a
 *    combinação de tag que o motor do Word aceita para essas duas
 *    propriedades (mesma técnica usada por qualquer builder de e-mail
 *    "bulletproof" — Litmus, Campaign Monitor etc.).
 * 2. Dentro do `<td>`, um `<a href="...">` real, envolvendo o conteúdo do
 *    botão (os parágrafos originais, com suas próprias marcas) — é o que
 *    garante que o botão seja de fato clicável nos clientes que respeitam a
 *    camada 1 (Gmail, Apple Mail, Outlook.com/web, clientes móveis).
 * 3. Um bloco VML (`<v:roundrect>`) só visível para o Outlook Desktop, via
 *    comentários condicionais `<!--[if mso]>...<![endif]-->` — é a única
 *    forma de o Word desenhar um retângulo com cantos arredondados
 *    (`arcsize`) de verdade; sem essa camada, o Outlook Desktop mostraria a
 *    caixa com cantos retos, mesmo já corrigido o `<td>`. O `<a>` da camada 2
 *    fica dentro de um `<!--[if !mso]><!-->...<!--<![endif]-->`, para que o
 *    Outlook Desktop não renderize as duas versões (VML + `<a>`) empilhadas —
 *    só a VML aparece nele; nos demais clientes, o `<!--[if mso]>` inteiro é
 *    um comentário HTML comum (invisível), então só o `<a>` aparece.
 *
 * Cor (`data-cor`) e link (`data-href`) do botão passam a ser lidos do
 * próprio nó (Etapa 6/7, revisão), em vez da cor fixa `COR_ACENTO` e sem link
 * nenhum de antes — essa parte da função nunca tinha sido atualizada depois
 * que esses atributos passaram a existir no schema. Alinhamento também deixa
 * de ser fixo em `text-align: center`: passa a ler o `style` que a extensão
 * `TextAlign` já grava no próprio `<div>` (Etapa 8), o mesmo valor que o CSS
 * do app usa (ver `.email-botao[style*='text-align: ...']` em `index.css`).
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
 * Escapa um valor para uso seguro dentro de um atributo HTML de aspas
 * duplas. Necessário aqui (e só aqui, no arquivo) porque o botão bulletproof
 * é montado por concatenação de string (`outerHTML`/`insertAdjacentHTML`,
 * ver `montarBotaoBulletproof` abaixo) em vez de `setAttribute` — o resto do
 * arquivo usa `mesclarEstiloInline`/`setAttribute`, que já escapam sozinhos,
 * então não precisa disso.
 */
function escaparAtributo(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Lê o alinhamento gravado pela extensão `TextAlign` (Etapa 8) diretamente
 * do `style` inline do próprio nó `noBotao` — mesma leitura textual que
 * `.email-botao[style*='text-align: ...']` faz em `index.css` (ver
 * `EmailEditorRico.tsx`: `TextAlign` está configurada para os tipos
 * `paragraph` e `noBotao`, então o `style` cai também no `<div>` do botão,
 * não só no parágrafo interno). Sem nenhum `text-align` no `style` (caso
 * "esquerda", o `defaultAlignment` da extensão — que não emite `style`
 * nenhum quando o valor já é o default), cai no `left` abaixo.
 */
function lerAlinhamentoBotao(botao: HTMLElement): 'left' | 'center' | 'right' | 'justify' {
  const style = botao.getAttribute('style') ?? '';
  if (style.includes('text-align: center')) return 'center';
  if (style.includes('text-align: right')) return 'right';
  if (style.includes('text-align: justify')) return 'justify';
  return 'left';
}

/**
 * Monta a estrutura "bulletproof" do botão (Etapa 8, revisão — ver docblock
 * do arquivo para a explicação de cada uma das três camadas). Recebe o
 * `<div data-tipo="botao-email">` original (já com os parágrafos internos
 * estilizados por `mesclarEstiloInline`, feito antes de chamar esta função)
 * e devolve a string HTML que deve substituí-lo.
 */
function montarBotaoBulletproof(botao: HTMLElement): string {
  const cor = escaparAtributo(botao.getAttribute('data-cor') || COR_ACENTO);
  const href = botao.getAttribute('data-href');
  const alinhamento = lerAlinhamentoBotao(botao);
  const conteudoInterno = botao.innerHTML;

  // Mesma lógica de margem condicional ao alinhamento que `index.css` já
  // aplica ao `<div>` dentro do editor (Etapa 7, revisão) — replicada aqui
  // porque o HTML copiado não carrega `index.css` junto, então precisa estar
  // inline. "Esquerda" é a base (`margin-right: auto` empurra a caixa para a
  // esquerda); "centro" e "direita" só trocam qual dos dois lados leva
  // `auto`; "justificado" ocupa a largura toda, sem margem lateral nenhuma.
  const margemTabela =
    alinhamento === 'center'
      ? '0.6em auto'
      : alinhamento === 'right'
        ? '0.6em 0 0.6em auto'
        : alinhamento === 'justify'
          ? '0.6em 0'
          : '0.6em auto 0.6em 0';
  const larguraTabela = alinhamento === 'justify' ? 'width: 100%;' : '';
  // `align` (atributo HTML, não CSS) é redundância deliberada para clientes
  // de e-mail antigos/quebrados que ignoram `margin: auto` em `<table>` —
  // mesma ideia de "cinturão e suspensório" já usada em `sanitizarHtml.ts`.
  const alignTabela = alinhamento === 'right' ? 'right' : alinhamento === 'center' ? 'center' : 'left';

  // Camada 2 (ver docblock): o link real, visível para todo mundo, MENOS o
  // Outlook Desktop (escondido dentro do `[if !mso]`, para não duplicar com
  // a VML da camada 3). Sem `href` (botão sem link, Etapa 6 — `href: null`
  // é um estado válido), não há por que ter um `<a>`: o conteúdo fica direto
  // no `<td>`, sem elemento de link nenhum, preservando o comportamento
  // "sem link" de antes.
  const conteudoClicavel = href
    ? `<a href="${escaparAtributo(href)}" target="_blank" rel="noopener noreferrer" style="display: block; padding: 0.7em 1.4em; text-decoration: none;">${conteudoInterno}</a>`
    : `<div style="padding: 0.7em 1.4em;">${conteudoInterno}</div>`;

  // Camada 3 (ver docblock): só o Outlook Desktop enxerga isto — os demais
  // clientes veem `<!--[if mso]>` como um comentário HTML comum (opaco,
  // sem conteúdo renderizado). `arcsize="10%"` aproxima visualmente o
  // `border-radius: 6px` do `<td>` (não há conversão exata entre os dois
  // sistemas de arredondamento, mas a técnica bulletproof é sempre uma
  // aproximação, não um espelho 1:1). Sem `href`, a VML sai sem o atributo
  // `href` do `<v:roundrect>` — mesmo raciocínio do `<a>` acima: sem link,
  // sem elemento clicável, em nenhuma das duas camadas.
  const vmlHref = href ? ` href="${escaparAtributo(href)}"` : '';
  const vmlAnchorlock = href ? '<w:anchorlock/>' : '';

  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${alignTabela}" ` +
    `style="border-collapse: collapse; margin: ${margemTabela}; ${larguraTabela}"><tr>` +
    `<td align="center" bgcolor="${cor}" style="background-color: ${cor}; border-radius: 6px; ${larguraTabela}">` +
    `<!--[if mso]>` +
    `<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"${vmlHref} ` +
    `style="height: auto; v-text-anchor: middle; width: auto;" arcsize="10%" strokecolor="${cor}" fillcolor="${cor}">` +
    `${vmlAnchorlock}<center style="color: ${COR_BOTAO_TEXTO}; padding: 0.7em 1.4em;">${conteudoInterno}</center>` +
    `</v:roundrect>` +
    `<![endif]-->` +
    `<!--[if !mso]><!-->` +
    `${conteudoClicavel}` +
    `<!--<![endif]-->` +
    `</td></tr></table>`
  );
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

    // Cor do texto interno (branco) continua indo inline nos próprios `<p>`,
    // antes de montar o bulletproof: `montarBotaoBulletproof` reaproveita
    // esse `innerHTML` já estilizado dentro do `<a>`/`<div>` da camada 2 (ver
    // docblock do arquivo) — sem isso, o texto sairia com a cor padrão do
    // cliente de e-mail em vez de branco sobre o fundo colorido do botão.
    botaoElemento.querySelectorAll('p').forEach((paragrafo) => {
      mesclarEstiloInline(paragrafo as HTMLElement, { margin: '0', color: COR_BOTAO_TEXTO });
    });

    // Substitui o `<div data-tipo="botao-email">` original pela estrutura
    // "bulletproof" (table/td + fallback VML) — troca de tag, não apenas de
    // `style`, por isso não passa por `mesclarEstiloInline` como os outros
    // casos acima (link, listas): ver docblock do arquivo, Etapa 8.
    botaoElemento.outerHTML = montarBotaoBulletproof(botaoElemento);
  });

  return raiz.innerHTML;
}

export default converterParaHtmlEmailSeguro;