import { useEditorState, type Editor } from '@tiptap/react';
// Duplicar célula (RefatoracaoTabela.md — Etapa 7): não há comando nativo da
// extensão de tabela para "copiar conteúdo desta célula para a vizinha" —
// `isInTable`/`selectedRect` são os mesmos utilitários de baixo nível que os
// comandos nativos (`mergeCells`, `deleteRow` etc.) usam internamente para
// resolver a célula/seleção atual dentro da tabela, reaproveitados aqui para
// montar a transação diretamente em vez de encadear comandos prontos que não
// existem para este caso.
import { isInTable, selectedRect } from '@tiptap/pm/tables';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { HsvColorPicker, type HsvColor } from 'react-colorful';

import { ToolbarPopover } from './editor/ToolbarPopover';
import {
  IconeAlinharCentro,
  IconeAlinharDireita,
  IconeAlinharEsquerda,
  IconeAlinharJustificado,
  IconeAlternarColunaCabecalho,
  IconeAlternarLinhaCabecalho,
  IconeBordaTabela,
  IconeBotaoEmail,
  IconeCorCelula,
  IconeCorTexto,
  IconeDividirCelula,
  IconeDuplicarParaBaixo,
  IconeDuplicarParaDireita,
  IconeExcluirColuna,
  IconeExcluirLinha,
  IconeExcluirTabela,
  IconeFonteAumentar,
  IconeFonteDiminuir,
  IconeInserirColunaDireita,
  IconeInserirColunaEsquerda,
  IconeInserirLinhaAbaixo,
  IconeInserirLinhaAcima,
  IconeItalico,
  IconeLarguraTotalTabela,
  IconeLink,
  IconeLinhaHorizontal,
  IconeListaNaoOrdenada,
  IconeListaOrdenada,
  IconeMesclarCelulas,
  IconeNegrito,
  IconeRealce,
  IconeRecuoDireita,
  IconeRecuoEsquerda,
  IconeRestaurar,
  IconeSublinhado,
  IconeTabela,
  IconeTachado,
  IconeVerMais,
} from './Icons';

interface Props {
  /**
   * Instância do editor exposta pelo `EmailEditorRico` via `onEditorPronto`.
   * `null` enquanto o editor ainda não foi criado (primeiro render) — os
   * botões ficam desabilitados nesse intervalo.
   */
  editor: Editor | null;
}

/**
 * Identificador de cada botão individual da toolbar (RefatoracaoToolbarEmail.md
 * — Etapa 1). Substitui as antigas seções fixas (`ORDEM_COLAPSO`, seção da
 * revisão anterior) — não há mais agrupamento funcional, cada botão colapsa
 * (Etapa 2) de forma independente.
 */
const ITEM_IDS = [
  'negrito',
  'italico',
  'sublinhado',
  'tachado',
  'tamanhoFonte',
  'cor',
  'realce',
  'link',
  'botao',
  'linhaHorizontal',
  'tabela',
  'lista',
  'alinhamento',
  'recuo',
  'limparFormatacao',
] as const;
type ItemId = (typeof ITEM_IDS)[number];

/**
 * Agrupamento puramente visual (separadores decorativos entre clusters) —
 * não tem efeito nenhum sobre a decisão de "Ver Mais" (Etapa 2), que opera
 * por botão individual. Um separador só é desenhado quando há pelo menos um
 * botão visível de cada lado (ver `nosFaixa`, na montagem da faixa, abaixo),
 * para não deixar um separador "órfão" quando um cluster inteiro fica
 * oculto.
 */
const CLUSTERS: ItemId[][] = [
  ['negrito', 'italico', 'sublinhado', 'tachado'],
  ['tamanhoFonte', 'cor', 'realce', 'link', 'botao', 'linhaHorizontal', 'tabela'],
  ['lista'],
  ['alinhamento', 'recuo'],
  ['limparFormatacao'],
];

/**
 * Ordem de ocultação (Etapa 2, ajustada nas Etapas 2–3 de
 * `RefatoracaoFonteGruposCores.md`) quando a toolbar não cabe na largura
 * disponível — do primeiro botão a migrar para "Ver Mais" até o último.
 *
 * Segue o mesmo espírito de prioridade por grupo da revisão anterior
 * (`ORDEM_COLAPSO`: listas → alinhamento → extras → funções básicas, essa
 * última praticamente nunca escondendo), só que agora fim a fim, botão a
 * botão, com um critério dentro de cada cluster:
 * - "Limpar formatação" esconde primeiro de todos — é ação avulsa, não
 *   ocupa nenhum grupo colapsável na revisão anterior, e continua sendo o
 *   candidato mais barato de sacrificar (ação pontual, não algo que se
 *   precise ver o tempo todo).
 * - Lista: a partir de `RefatoracaoFonteGruposCores.md` — Etapa 3, os 2
 *   botões antigos (`listaNaoOrdenada`/`listaOrdenada`) viraram um único
 *   trigger `lista` — ocupa a mesma posição relativa (primeiro grupo a
 *   esconder depois de "limpar formatação") que os 2 antigos ocupavam.
 * - Alinhamento: a partir de `RefatoracaoFonteGruposCores.md` — Etapa 2, os
 *   4 botões antigos (justificado/direita/centro/esquerda) viraram um
 *   único trigger `alinhamento` (ícone dinâmico refletindo o alinhamento
 *   ativo) — ocupa a mesma posição relativa que os 4 antigos ocupavam
 *   nesta lista (mais barato de esconder que "recuo", mesmo raciocínio de
 *   antes: um único trigger de alinhamento é menos crítico de continuar
 *   visível do que o trigger de recuo, que representa uma ação já
 *   aplicada e potencialmente precisando ser desfeita). Recuo (Etapa 3
 *   desta revisão, antigos `recuoAumentar`/`recuoDiminuir` da revisão
 *   anterior) vira um único trigger `recuo` que some antes de alinhamento
 *   — mesma posição relativa que os 2 antigos ocupavam, mesmo raciocínio
 *   de "ação já aplicada, potencialmente precisando ser desfeita" que
 *   justificava recuo ficar visível mais tempo que os 2 botões de lista.
 * - Extras: tabela → linha horizontal → tamanho da fonte → botão-e-mail →
 *   link → realce escondem antes de cor do texto (cor é o mais usado desse
 *   grupo). Tabela (Etapa 7) é a primeira de todas por ser puro placeholder
 *   sem função nesta revisão — nada se perde escondendo o item mais barato
 *   possível de sacrificar. Linha horizontal (Etapa 6) vem logo depois pelo
 *   mesmo raciocínio de "item novo sem histórico de uso" já aplicado a
 *   tamanho da fonte na Etapa 4 (que continua tendo prioridade um degrau
 *   acima, por já ser usado desde a etapa anterior).
 * - Funções básicas: tachado → sublinhado → itálico escondem antes de
 *   negrito (negrito é o mais usado de todos, some por último).
 */
const ORDEM_OCULTACAO: ItemId[] = [
  'limparFormatacao',
  'lista',
  'recuo',
  'alinhamento',
  'tabela',
  'linhaHorizontal',
  'tamanhoFonte',
  'botao',
  'link',
  'realce',
  'cor',
  'tachado',
  'sublinhado',
  'italico',
  'negrito',
];

// Checagem só em desenvolvimento: `ORDEM_OCULTACAO` é escrita à mão (para
// permitir a ordem de prioridade da Etapa 3), então não há garantia estática
// do TypeScript de que ela cobre exatamente os mesmos itens de `ITEM_IDS` —
// útil para não passar batido se uma etapa futura adicionar um botão novo em
// `ITEM_IDS` sem lembrar de incluí-lo aqui também.
if (import.meta.env.DEV) {
  const faltando = ITEM_IDS.filter((id) => !ORDEM_OCULTACAO.includes(id));
  const emDobro = ORDEM_OCULTACAO.length !== new Set(ORDEM_OCULTACAO).size;
  if (faltando.length > 0 || emDobro || ORDEM_OCULTACAO.length !== ITEM_IDS.length) {
    console.error(
      'EmailEditorToolbar: ORDEM_OCULTACAO está dessincronizada de ITEM_IDS.',
      { faltando, emDobro }
    );
  }
}

/** Largura de cada separador vertical entre clusters — mesma constante da
 * revisão anterior (`1px` mais `0.25rem` de margem de cada lado). */
const LARGURA_SEPARADOR_PX = 9;

/**
 * Conversão HSL → hex (RefatoracaoFonteGruposCores.md — Etapa 4, seção 2):
 * usada só para gerar `PALETA_CORES_TONALIDADES` programaticamente a partir
 * de matiz/saturação/luminosidade — não há biblioteca de cor nesta etapa
 * (isso só chega na Etapa 5, com `react-colorful`), então a fórmula padrão
 * HSL→RGB é reimplementada aqui, pequena o bastante para não justificar uma
 * dependência nova só para isto.
 */
function hslParaHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const f = (n: number) => lNorm - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const paraDoisDigitos = (n: number) =>
    Math.round(f(n) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${paraDoisDigitos(0)}${paraDoisDigitos(8)}${paraDoisDigitos(4)}`;
}

/**
 * Conversões hex↔RGB↔HSV (RefatoracaoFonteGruposCores.md — Etapa 5), usadas
 * só pelo modal "Personalizar" (`ModalPersonalizarCor`, abaixo) para manter
 * o `HsvColorPicker` (`react-colorful`) e os inputs RGB sincronizados com a
 * mesma cor em tempo real. Escritas à mão pelo mesmo motivo de
 * `hslParaHex` na Etapa 4: a biblioteca não expõe essas conversões no seu
 * export público (só os componentes de picker prontos), então reimplementar
 * as fórmulas padrão é mais simples e previsível do que depender de um
 * caminho de import não documentado.
 */
function hexParaRgb(hex: string): { r: number; g: number; b: number } | null {
  const semHash = hex.replace('#', '');
  const seisDigitos = semHash.length === 3 ? semHash.split('').map((c) => c + c).join('') : semHash;
  if (!/^[0-9a-fA-F]{6}$/.test(seisDigitos)) return null;
  return {
    r: parseInt(seisDigitos.slice(0, 2), 16),
    g: parseInt(seisDigitos.slice(2, 4), 16),
    b: parseInt(seisDigitos.slice(4, 6), 16),
  };
}

function rgbParaHex(r: number, g: number, b: number): string {
  const paraDoisDigitos = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, '0');
  return `#${paraDoisDigitos(r)}${paraDoisDigitos(g)}${paraDoisDigitos(b)}`;
}

function rgbParaHsv(r: number, g: number, b: number): HsvColor {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rNorm) h = 60 * (((gNorm - bNorm) / delta) % 6);
    else if (max === gNorm) h = 60 * ((bNorm - rNorm) / delta + 2);
    else h = 60 * ((rNorm - gNorm) / delta + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : delta / max;
  return { h, s: s * 100, v: max * 100 };
}

function hsvParaRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const sNorm = s / 100;
  const vNorm = v / 100;
  const c = vNorm * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vNorm - c;
  let rP = 0;
  let gP = 0;
  let bP = 0;
  if (h < 60) [rP, gP, bP] = [c, x, 0];
  else if (h < 120) [rP, gP, bP] = [x, c, 0];
  else if (h < 180) [rP, gP, bP] = [0, c, x];
  else if (h < 240) [rP, gP, bP] = [0, x, c];
  else if (h < 300) [rP, gP, bP] = [x, 0, c];
  else[rP, gP, bP] = [c, 0, x];
  return { r: (rP + m) * 255, g: (gP + m) * 255, b: (bP + m) * 255 };
}

/** Luminosidades (claro → escuro) usadas nas 8 colunas cromáticas — mesma
 * escala de 5 tons para todos os matizes, só a saturação/matiz muda por
 * cor (`CORES_BASE_CROMATICAS`, abaixo). */
const TONS_CROMATICOS = [80, 65, 50, 35, 20];

/** Matiz/saturação-base das 8 colunas cromáticas da grade (seção 2 do
 * plano). "Marrom" reaproveita o matiz da laranja com saturação bem mais
 * baixa — não existe um "matiz do marrom" isolado em HSL puro, é
 * essencialmente laranja pouco saturado. */
const CORES_BASE_CROMATICAS: { nome: string; h: number; s: number }[] = [
  { nome: 'Vermelho', h: 0, s: 70 },
  { nome: 'Rosa', h: 330, s: 65 },
  { nome: 'Laranja', h: 25, s: 85 },
  { nome: 'Amarelo', h: 45, s: 85 },
  { nome: 'Verde', h: 145, s: 55 },
  { nome: 'Azul', h: 215, s: 65 },
  { nome: 'Roxo', h: 265, s: 55 },
  { nome: 'Marrom', h: 25, s: 45 },
];

/** Branco e Preto não têm matiz próprio — cada um usa sua própria escala de
 * cinza (seção 2: "variação de luminosidade a partir do matiz-base", que
 * para essas duas colunas não existe, então vira só `l` variando com `s: 0`)
 * em vez de repetir a mesma escala nas duas colunas: Branco cobre a ponta
 * clara (100→68), Preto a ponta escura (32→0), juntas cobrindo o intervalo
 * inteiro sem amostra duplicada entre as duas colunas. */
const TONS_BRANCO = [100, 92, 84, 76, 68];
const TONS_PRETO = [32, 24, 16, 8, 0];

/**
 * Paleta única de cor (RefatoracaoFonteGruposCores.md — Etapa 4, seção 2):
 * 10 colunas (Branco, Preto + 8 matizes cromáticos) × 5 tonalidades = 50
 * amostras, geradas programaticamente via HSL — não 50 códigos hex escritos
 * à mão. Substitui `PALETA_COR_TEXTO`/`PALETA_REALCE` (revisão anterior):
 * os três contextos que usavam paleta fixa (cor de texto, realce, cor de
 * botão) passam a compartilhar esta mesma lista, via `SeletorCor` abaixo —
 * não há mais uma paleta "de cor de texto" e outra "de realce" com tons
 * diferentes. A lista é achatada em ordem "linha a linha" (uma tonalidade
 * de cada uma das 10 colunas por vez, da mais clara à mais escura) para
 * renderizar como grade 10×5 via `grid-template-columns: repeat(10, 1fr)`
 * preenchendo por linha (comportamento padrão do CSS Grid) — isso mantém
 * cada matiz na sua própria coluna visualmente, tonalidade ficando por
 * linha.
 */
const PALETA_CORES_TONALIDADES: { nome: string; valor: string }[] = (() => {
  const colunas: { nome: string; tons: string[] }[] = [
    { nome: 'Branco', tons: TONS_BRANCO.map((l) => hslParaHex(0, 0, l)) },
    { nome: 'Preto', tons: TONS_PRETO.map((l) => hslParaHex(0, 0, l)) },
    ...CORES_BASE_CROMATICAS.map(({ nome, h, s }) => ({
      nome,
      tons: TONS_CROMATICOS.map((l) => hslParaHex(h, s, l)),
    })),
  ];
  const amostras: { nome: string; valor: string }[] = [];
  for (let linha = 0; linha < TONS_CROMATICOS.length; linha += 1) {
    for (const coluna of colunas) amostras.push({ nome: coluna.nome, valor: coluna.tons[linha] });
  }
  return amostras;
})();

/**
 * Limites de segurança do stepper de tamanho de fonte
 * (RefatoracaoFonteGruposCores.md — Etapa 1, seção 2: sem teto/piso
 * indicado no pedido, esta revisão define 8–96px, mesma ordem de grandeza
 * da lista curada anterior — que ia de 12 a 32 — com folga maior nas
 * pontas para cobrir título/destaque sem deixar o texto fugir da largura
 * útil do e-mail em telas estreitas). Fora deste intervalo o botão
 * +/− correspondente fica `disabled`; um valor digitado fora do
 * intervalo é ajustado (clamp) só ao perder o foco ou apertar Enter, não
 * a cada tecla.
 */
const TAMANHO_FONTE_MIN = 8;
const TAMANHO_FONTE_MAX = 96;

/**
 * Valor mostrado no campo quando a seleção não tem `fontSize` explícito
 * gravado na mark `textStyle` (nenhum texto ali passou pelo stepper
 * ainda) — aproxima o "tamanho herdado do bloco" sem precisar ler
 * `computedStyle` do DOM; a leitura de onde vem o valor continua sendo a
 * mesma que `estado.fontSizeAtiva` já fazia antes desta revisão (só o
 * atributo explícito da mark), este é apenas o fallback de exibição
 * quando esse atributo não existe.
 */
const TAMANHO_FONTE_PADRAO = 16;

/**
 * Lista de atalho aberta ao clicar no campo do stepper (seção 2) — mesma
 * lista de valores comuns do pedido original. O campo continua aceitando
 * qualquer valor digitado livremente independente desta lista.
 */
const TAMANHOS_FONTE_COMUNS = [8, 10, 12, 14, 16, 20, 24, 28, 36, 48, 72];

/**
 * Limites dos campos "linhas"/"colunas" do popover de inserir tabela
 * (RefatoracaoTabela.md — Etapa 2). O plano não define um teto explícito;
 * 20 é uma folga generosa para o caso de uso de e-mail (tabela de
 * preço/comparativo) sem permitir que um valor digitado por engano (ex.:
 * "500") gere uma tabela inutilizável. Mesmo padrão de clamp silencioso já
 * usado pelo stepper de tamanho de fonte (`TAMANHO_FONTE_MIN`/`_MAX`,
 * acima).
 */
const TABELA_DIMENSAO_MIN = 1;
const TABELA_DIMENSAO_MAX = 20;

/** Dimensões pré-preenchidas ao abrir o popover de inserir tabela — 3×3 é o
 * ponto de partida mais comum (nem uma linha só, nem uma grade grande
 * demais para ajustar depois via barra contextual). */
const TABELA_LINHAS_PADRAO = 3;
const TABELA_COLUNAS_PADRAO = 3;

/**
 * Limites do campo "Altura" da barra contextual de tabela
 * (RefatoracaoTabela.md — Etapa 5). O plano não define um teto explícito;
 * mesmo raciocínio de clamp silencioso já usado pelas outras dimensões
 * numéricas desta toolbar (`TABELA_DIMENSAO_MIN`/`_MAX`,
 * `TAMANHO_FONTE_MIN`/`_MAX`, acima) — evita uma linha com altura
 * zero/negativa ou um valor absurdamente grande digitado por engano.
 */
const ALTURA_LINHA_MIN = 10;
const ALTURA_LINHA_MAX = 500;

/**
 * Limites do campo "Espessura" (borda da tabela, RefatoracaoTabela.md —
 * Etapa 6) — mesmo raciocínio de clamp silencioso das outras dimensões
 * numéricas desta toolbar, acima. Teto baixo (`10`) de propósito: espessura
 * de borda de tabela de e-mail é um detalhe fino, não uma moldura grossa —
 * um valor maior que isso quase certamente foi engano de digitação.
 */
const ESPESSURA_BORDA_MIN = 1;
const ESPESSURA_BORDA_MAX = 10;

/**
 * Limites do campo "Largura" (largura fixa da tabela, mesma Etapa 6) — teto
 * generoso (`1200`) cobre confortavelmente o corpo de um e-mail largo sem
 * permitir um valor fora de qualquer proporção razoável digitado por
 * engano. Sem piso alto (`LARGURA_TABELA_FIXA_MIN`): uma tabela mais
 * estreita que isso ainda é um caso de uso válido (ex.: só duas colunas de
 * preço lado a lado).
 */
const LARGURA_TABELA_FIXA_MIN = 50;
const LARGURA_TABELA_FIXA_MAX = 1200;

/**
 * Modal "Personalizar" (RefatoracaoFonteGruposCores.md — Etapa 5): color
 * picker completo aberto pelo botão "Personalizar" de `SeletorCor`
 * (placeholder até esta etapa). Renderizado via `createPortal` para
 * `document.body`, por cima do popover que o abriu — mesmo espírito de
 * "modal sobre popover" do padrão `ConfirmDialog`/`Dialog` já usado no
 * projeto, mas implementado de forma independente aqui: `Dialog.tsx` não
 * fez parte dos arquivos compartilhados nesta revisão, então este modal não
 * o reaproveita (não há como confirmar se a API dele bate com o uso feito
 * aqui) — é um overlay + caixa centralizada autocontidos, fechando por
 * clique no overlay, no botão "Cancelar" ou Esc, mesmos gatilhos de
 * fechamento que `ToolbarPopover` já usa em outros lugares da toolbar.
 *
 * SV picker + matiz vêm prontos de `HsvColorPicker` (`react-colorful`,
 * dependência nova desta etapa — sinalizada no plano, `package.json` não
 * fez parte dos arquivos compartilhados). Preview e inputs RGB são
 * construídos à mão ao redor dele, como o plano antecipa (a biblioteca não
 * inclui inputs numéricos prontos). Uma única fonte de verdade (`hsv`, o
 * estado do próprio `HsvColorPicker`) alimenta tanto o preview quanto os
 * três campos RGB — arrastar no SV/matiz atualiza `hsv` diretamente;
 * digitar num campo RGB primeiro deriva o RGB atual a partir de `hsv`
 * (`hsvParaRgb`), aplica o dígito alterado, e converte de volta para HSV
 * (`rgbParaHsv`) — assim os três campos e o picker sempre refletem a mesma
 * cor, qualquer que seja o controle usado por último.
 */
function ModalPersonalizarCor({
  hexInicial,
  onConfirmar,
  onFechar,
}: {
  hexInicial: string;
  onConfirmar: (hex: string) => void;
  onFechar: () => void;
}) {
  const rgbInicial = hexParaRgb(hexInicial) ?? { r: 0, g: 0, b: 0 };
  const [hsv, setHsv] = useState<HsvColor>(() => rgbParaHsv(rgbInicial.r, rgbInicial.g, rgbInicial.b));

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar();
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const rgbAtual = hsvParaRgb(hsv.h, hsv.s, hsv.v);
  const hexAtual = rgbParaHex(rgbAtual.r, rgbAtual.g, rgbAtual.b);

  function onAlterarCanalRgb(canal: 'r' | 'g' | 'b', valorDigitado: number) {
    const valor = Math.max(0, Math.min(255, Number.isFinite(valorDigitado) ? valorDigitado : 0));
    const novoRgb = { ...rgbAtual, [canal]: valor };
    setHsv(rgbParaHsv(novoRgb.r, novoRgb.g, novoRgb.b));
  }

  return createPortal(
    <div className="email-editor-modal-personalizar-overlay" onClick={onFechar}>
      <div
        className="email-editor-modal-personalizar"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Personalizar cor"
      >
        <HsvColorPicker color={hsv} onChange={setHsv} />

        <div className="email-editor-modal-personalizar-linha">
          <span
            className="email-editor-toolbar-popover-hex-preview"
            style={{ backgroundColor: hexAtual }}
            aria-hidden="true"
          />
          <span className="email-editor-modal-personalizar-hex">{hexAtual}</span>
        </div>

        <div className="email-editor-modal-personalizar-rgb">
          <label>
            R
            <input
              type="number"
              min={0}
              max={255}
              value={Math.round(rgbAtual.r)}
              onChange={(e) => onAlterarCanalRgb('r', e.target.valueAsNumber)}
            />
          </label>
          <label>
            G
            <input
              type="number"
              min={0}
              max={255}
              value={Math.round(rgbAtual.g)}
              onChange={(e) => onAlterarCanalRgb('g', e.target.valueAsNumber)}
            />
          </label>
          <label>
            B
            <input
              type="number"
              min={0}
              max={255}
              value={Math.round(rgbAtual.b)}
              onChange={(e) => onAlterarCanalRgb('b', e.target.valueAsNumber)}
            />
          </label>
        </div>

        <div className="email-editor-toolbar-popover-acoes">
          <button
            type="button"
            className="email-editor-toolbar-popover-botao-aplicar"
            onClick={() => onConfirmar(hexAtual)}
          >
            Aplicar
          </button>
          <button type="button" className="email-editor-toolbar-popover-remover" onClick={onFechar}>
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Preenche um trecho hex parcial (1–5 dígitos) repetindo os dígitos já
 * digitados até completar 6 caracteres — interpretação adotada para o
 * preview ao vivo do campo hex de `SeletorCor` (RefatoracaoFonteGruposCores.md
 * — Etapa 4, seção 2: "mostra a última interpretação válida dos caracteres
 * digitados até agora, sem esperar 6 dígitos completos"). Alimenta só o
 * quadrado de preview local — a aplicação de fato ao editor exige um hex de
 * 3 ou 6 dígitos exato (ver `onAlterarCampoHex`, dentro de `SeletorCor`).
 */
function tonalidadeParcial(digitos: string): string {
  let resultado = digitos;
  while (resultado.length < 6) resultado += digitos;
  return resultado.slice(0, 6);
}

/**
 * Seletor de cor livre (RefatoracaoFonteGruposCores.md — Etapa 4),
 * substituindo `PainelCores`/paletas fixas. Reaproveitado pelos três
 * contextos que hoje escolhem cor (cor de texto, realce, cor de botão — este
 * último dentro do popover maior de "Botão", Etapa 8 da revisão anterior),
 * por isso, como `PainelCores` antes dele, não desenha o wrapper
 * `.email-editor-toolbar-popover` (responsabilidade de `ToolbarPopover`) —
 * só compõe o conteúdo interno: (1) grade 10×5 de `PALETA_CORES_TONALIDADES`
 * com a amostra ativa destacada quando bate com `corAtiva`; (2) campo
 * hexadecimal + quadrado de preview, inicializados com `corAtiva` (fallback
 * `#000000` quando o atributo não está definido, seção 2); (3) botão
 * "Personalizar", que abre `ModalPersonalizarCor` (Etapa 5) por cima do
 * popover — confirmar no modal escreve o hex de volta neste mesmo campo e
 * aplica ao editor pelo mesmo caminho que digitar um hex válido já usa; (4)
 * botão de remover, mesmo texto configurável de antes.
 *
 * `onEscolherAmostra` e `onAplicarHex` são callbacks separados porque o
 * comportamento de fechar o popover ao aplicar é decisão de cada chamador,
 * não deste componente: cor de texto/realce fecham ao clicar numa amostra
 * (mesmo padrão "clicar e sair" de antes) mas NÃO devem fechar a cada tecla
 * válida digitada no campo hex (fechar no meio da digitação impediria
 * completar um hex de 6 dígitos após já passar por um estado intermediário
 * de 3 dígitos válido) — por isso cada contexto passa uma função diferente
 * para cada prop (ver `EmailEditorToolbar`, itens `cor`/`realce`/`botao`,
 * abaixo); o popover de "Botão" já não fechava em nenhum dos dois casos
 * antes desta etapa, então ali as duas props apontam para a mesma função.
 */
function SeletorCor({
  corAtiva,
  rotuloRemover,
  onEscolherAmostra,
  onAplicarHex,
  onRemover,
}: {
  corAtiva?: string;
  rotuloRemover: string;
  onEscolherAmostra: (cor: string) => void;
  onAplicarHex: (cor: string) => void;
  onRemover: () => void;
}) {
  const valorInicial = corAtiva ?? '#000000';
  const [campoHex, setCampoHex] = useState(valorInicial);
  const [previewHex, setPreviewHex] = useState(valorInicial);
  const [personalizarAberto, setPersonalizarAberto] = useState(false);
  const corAtivaMinuscula = corAtiva?.toLowerCase();

  /**
   * A cada tecla: atualiza sempre o texto do campo e o preview local (via
   * `tonalidadeParcial`, mesmo com hex incompleto); só aplica de fato ao
   * editor (`onAplicarHex`) quando os dígitos digitados formam um hex válido
   * de exatamente 3 ou 6 caracteres — hex inválido/incompleto nunca chega a
   * `onAplicarHex` (seção 2 do plano).
   */
  function onAlterarCampoHex(valorDigitado: string) {
    setCampoHex(valorDigitado);
    const digitos = valorDigitado
      .replace('#', '')
      .replace(/[^0-9a-fA-F]/g, '')
      .slice(0, 6);
    if (digitos.length > 0) {
      setPreviewHex(`#${tonalidadeParcial(digitos)}`);
    }
    if (digitos.length === 3 || digitos.length === 6) {
      onAplicarHex(`#${digitos.toLowerCase()}`);
    }
  }

  return (
    <>
      <div className="email-editor-toolbar-popover-grade email-editor-toolbar-popover-grade-cores">
        {PALETA_CORES_TONALIDADES.map((cor, indice) => (
          <button
            key={`${cor.valor}-${indice}`}
            type="button"
            className={`email-editor-toolbar-amostra ${corAtivaMinuscula === cor.valor ? 'ativa' : ''}`}
            style={{ backgroundColor: cor.valor }}
            onClick={() => onEscolherAmostra(cor.valor)}
            title={cor.nome}
            aria-label={cor.nome}
            aria-pressed={corAtivaMinuscula === cor.valor}
          />
        ))}
      </div>
      <div className="email-editor-toolbar-popover-hex">
        <span
          className="email-editor-toolbar-popover-hex-preview"
          style={{ backgroundColor: previewHex }}
          aria-hidden="true"
        />
        <input
          type="text"
          value={campoHex}
          onChange={(e) => onAlterarCampoHex(e.target.value)}
          placeholder="#RRGGBB"
          className="email-editor-toolbar-popover-input email-editor-toolbar-popover-input-hex"
          aria-label="Cor em hexadecimal"
          spellCheck={false}
        />
      </div>
      <button
        type="button"
        className="email-editor-toolbar-popover-personalizar"
        onClick={() => setPersonalizarAberto(true)}
      >
        Personalizar…
      </button>
      {personalizarAberto && (
        <ModalPersonalizarCor
          hexInicial={previewHex}
          onFechar={() => setPersonalizarAberto(false)}
          onConfirmar={(hex) => {
            setCampoHex(hex);
            setPreviewHex(hex);
            onAplicarHex(hex);
            setPersonalizarAberto(false);
          }}
        />
      )}
      <button type="button" className="email-editor-toolbar-popover-remover" onClick={onRemover}>
        {rotuloRemover}
      </button>
    </>
  );
}

/**
 * Lista de valores comuns de tamanho de fonte (RefatoracaoFonteGruposCores.md
 * — Etapa 1), aberta ao clicar no campo do stepper — mesmo espírito do
 * `PainelCores` acima (opção ativa destacada), mas sem ação de "remover":
 * o stepper não tem mais um estado "sem tamanho definido" que faça
 * sentido oferecer como opção separada, já que o campo sempre mostra um
 * valor numérico (explícito ou o padrão herdado). O preview de cada
 * opção usa um teto de 20px (`Math.min`) para não deixar o popover
 * gigante quando o valor da lista é grande (ex.: 72px) — só o rótulo
 * textual reflete o valor real que será aplicado.
 */
function PainelValoresFonteComuns({
  valorAtivo,
  onEscolher,
}: {
  valorAtivo: number;
  onEscolher: (valor: number) => void;
}) {
  return (
    <div className="email-editor-toolbar-popover-lista">
      {TAMANHOS_FONTE_COMUNS.map((valor) => (
        <button
          key={valor}
          type="button"
          className={`email-editor-toolbar-popover-opcao ${valorAtivo === valor ? 'ativa' : ''}`}
          style={{ fontSize: `${Math.min(valor, 20)}px` }}
          onClick={() => onEscolher(valor)}
        >
          {valor}px
        </button>
      ))}
    </div>
  );
}

/**
 * Padrão genérico de "grupo com popover" (RefatoracaoFonteGruposCores.md —
 * Etapa 2): grade horizontal dos botões que hoje ficam soltos na faixa
 * principal, reaproveitando a mesma classe `.email-editor-toolbar-botao` de
 * qualquer botão simples da toolbar (só o wrapper do popover muda,
 * `.email-editor-toolbar-popover-grupo`, definido em `index.css`). Nasceu
 * aplicado a Alinhamento na Etapa 2; a Etapa 3 reaproveita o mesmo
 * componente, sem alteração nele, para Recuo e Lista — Lista fecha o
 * popover ao escolher (`onClick` chama `setPainelAberto(null)`, mesmo
 * padrão de "clicar e sair" do alinhamento); Recuo não fecha (`onClick` das
 * duas opções não mexe em `painelAberto`, deixando o popover aberto para
 * cliques sucessivos — fecha só por clique-fora/Esc, já suportado por
 * `ToolbarPopover` sem mudança nele).
 */
function PainelGrupoOpcoes({
  opcoes,
}: {
  opcoes: {
    id: string;
    label: string;
    icone: ReactNode;
    ativo?: boolean;
    onClick: () => void;
  }[];
}) {
  return (
    <div className="email-editor-toolbar-popover-grupo">
      {opcoes.map((opcao) => (
        <button
          key={opcao.id}
          type="button"
          className={`email-editor-toolbar-botao ${opcao.ativo ? 'ativo' : ''}`}
          onClick={opcao.onClick}
          title={opcao.label}
          aria-label={opcao.label}
          aria-pressed={opcao.ativo}
        >
          {opcao.icone}
        </button>
      ))}
    </div>
  );
}

/**
 * Estado "tudo desligado" usado tanto para o primeiro render (editor ainda
 * `null`, ver `Props`) quanto como fallback de `useEditorState` — a
 * sobrecarga do Tiptap para `editor: Editor | null` sempre tipa o retorno
 * como `TSelectorResult | null`, mesmo quando o seletor abaixo já trata o
 * caso `null` e nunca retorna `null` de fato em tempo de execução.
 */
const ESTADO_EDITOR_INDISPONIVEL = {
  negrito: false,
  italico: false,
  sublinhado: false,
  tachado: false,
  fontSizeAtiva: undefined as string | undefined,
  corAtiva: undefined as string | undefined,
  realceAtivo: false,
  realceCorAtiva: undefined as string | undefined,
  linkAtivo: false,
  linkHref: '',
  listaNaoOrdenadaAtiva: false,
  listaOrdenadaAtiva: false,
  noBotaoAtivo: false,
  noBotaoCorAtiva: undefined as string | undefined,
  noBotaoHrefAtiva: '',
  alinhamentoCentro: false,
  alinhamentoDireita: false,
  alinhamentoJustificado: false,
  tabelaAtiva: false,
  celulaCabecalhoAtiva: false,
  corCelulaAtiva: undefined as string | undefined,
  alturaLinhaAtiva: undefined as number | undefined,
  corBordaAtiva: undefined as string | undefined,
  espessuraBordaAtiva: undefined as number | undefined,
  larguraTabelaAtiva: undefined as string | undefined,
};

/**
 * Barra de ferramentas do corpo do e-mail — reconstruída do zero em
 * `RefatoracaoToolbarEmail.md` (Etapa 1, estrutura; Etapa 2, "Ver Mais").
 *
 * A revisão anterior (`refatoracaoEmailFormatado.md`) organizava os botões
 * em cinco seções fixas (`ToolbarGrupo.tsx`) que colapsavam como grupo
 * atrás de um gatilho quando faltava espaço. Isso foi descontinuado
 * (diagnóstico da Etapa 0): a toolbar precisava de `overflow: hidden` para
 * impedir que os botões soltos quebrassem para uma segunda linha, mas isso
 * também cortava e deslocava os popovers de cada botão (que nasciam como
 * filhos posicionados dentro dessa mesma área cortada).
 *
 * A partir desta revisão:
 * - A toolbar é uma única faixa de botões individuais (`ITEM_IDS`), sem
 *   agrupamento funcional — `CLUSTERS` só decide onde desenhar separadores
 *   decorativos, não influencia o que colapsa.
 * - Todo popover (cor, realce, link, botão, e o próprio painel de "Ver
 *   Mais") é renderizado via `ToolbarPopover`, que usa `createPortal` para
 *   `document.body` e calcula sua posição a partir do botão-gatilho — nunca
 *   mais como filho de um elemento com `overflow` cortado.
 * - Responsividade por botão individual (Etapa 2, "Ver Mais"): a toolbar
 *   nunca quebra linha (`flex-wrap: nowrap`); cada botão que não couber na
 *   largura disponível migra para uma lista oculta, acessível pelo gatilho
 *   de "3 pontos" fixo na ponta direita (só existe no DOM quando há pelo
 *   menos um botão oculto). Ver `ocultos` e `ORDEM_OCULTACAO`, abaixo.
 *
 * Cada botão de marca simples liga diretamente a um comando do Tiptap
 * (`editor.chain().focus().toggleX().run()`); o estado ativo/inativo vem de
 * `useEditorState`, que reage a toda transação do editor sem precisar de
 * listeners manuais.
 *
 * Tamanho da fonte (RefatoracaoFonteGruposCores.md — Etapa 1): stepper
 * numérico no padrão Word (`[ − ] N [ + ]`) em vez do painel de lista
 * curada anterior — os botões +/− incrementam/decrementam 1px (limitados
 * por `TAMANHO_FONTE_MIN`/`TAMANHO_FONTE_MAX`), o campo central aceita
 * qualquer valor digitado livremente (aplicado com clamp só ao perder o
 * foco ou apertar Enter, ver `confirmarCampoTamanhoFonte`), e clicar no
 * campo (não nos botões +/−) abre um popover de atalho
 * (`PainelValoresFonteComuns`) sem impedir a edição livre depois. O
 * comando (`setFontSize`) vem da extensão `FontSize`
 * (`editor/extensoes/FontSize.ts`, sem alteração nesta revisão), que
 * estende a mark `textStyle` já usada pelo `Color` (cor de texto) — o
 * mesmo mecanismo de round-trip via `style` inline, só que para
 * `font-size` em vez de `color`.
 *
 * Cor de texto, realce e cor de botão abrem um painel próprio (`SeletorCor`,
 * RefatoracaoFonteGruposCores.md — Etapa 4) com a grade única de tonalidades
 * (`PALETA_CORES_TONALIDADES`) + campo hexadecimal livre + botão
 * "Personalizar" (sem modal ainda — chega na Etapa 5) — substitui as duas
 * paletas fixas (`PALETA_COR_TEXTO`/`PALETA_REALCE`) da revisão anterior,
 * que não existem mais. Link abre
 * um popover com um campo de URL; reaproveita
 * `editor.getAttributes('link').href` para pré-preencher o campo quando o
 * cursor já está sobre um link existente (edição), e
 * `extendMarkRange('link')` para que a marca inteira seja substituída, não
 * só o trecho selecionado no momento do clique.
 *
 * Os popovers (cor, realce, link, botão) são independentes — só um fica
 * aberto por vez (`painelAberto`, abrindo um fecha os outros). O painel de
 * "Ver Mais" (`verMaisAberto`) é um estado à parte, propositalmente: um
 * botão escondido dentro de "Ver Mais" (ex.: "cor") ainda precisa abrir seu
 * próprio popover por cima do painel de "Ver Mais" sem fechá-lo — os dois
 * nunca disputam a mesma variável de estado.
 *
 * Listas: dois botões de toggle simples, sem UI própria —
 * `toggleBulletList`/`toggleOrderedList` já vêm prontos do
 * `BulletList`/`OrderedList`/`ListItem` do StarterKit. Por decisão de
 * escopo não há numeração aninhada tipo "2.1." — o estilo de cada nível
 * (disc/circle/decimal) é só CSS, em `index.css`.
 *
 * Botão estilizado (Etapa 8): não há mais um botão de toggle textual
 * separado dentro do popover — o clique no ícone da toolbar já abre
 * diretamente o seletor de cor (`SeletorCor`, Etapa 4) e o campo de link.
 * `toggleNoBotao()` (comando exposto pela extensão de nó customizado
 * `NoBotao`, ver `editor/extensoes/NoBotao.ts`) só é chamado internamente,
 * pelas próprias funções de aplicar cor/link (`aplicarCorBotao`/
 * `aplicarHrefBotao`, abaixo), e só quando a seleção ainda não é um
 * `noBotao` — escolher uma cor ou aplicar um link já envolve o(s)
 * parágrafo(s) selecionado(s) no nó, sem exigir um clique extra antes.
 * "Remover cor"/"Remover link" (já existentes nos outros popovers) seguem
 * disponíveis para desfazer cada atributo — não há um botão dedicado para
 * desfazer o nó inteiro.
 *
 * Alinhamento (RefatoracaoFonteGruposCores.md — Etapa 2): um único item de
 * faixa (`alinhamento`) reaproveitando o padrão "grupo com popover" definido
 * nesta etapa (`PainelGrupoOpcoes`, abaixo) — os 4 antigos botões soltos
 * (esquerda/centro/direita/justificado) agora vivem dentro do popover do
 * trigger, cujo ícone reflete dinamicamente o alinhamento ativo no momento
 * (`IconeAlinhamentoAtivo`, calculado a partir do mesmo `estado` de antes).
 * Escolher uma opção no popover chama `setTextAlign(...)` e fecha o popover
 * (`aplicarAlinhamento`) — são escolhas exclusivas (um valor ativo por vez),
 * mesmo padrão de "clicar e sair" do menu "Ver Mais". Não usa `toggleX()`
 * como as marcas simples porque `TextAlign` não expõe um comando de toggle
 * — cada opção define o alinhamento diretamente. O estado ativo de cada
 * opção dentro do popover vem de `ed.isActive({ textAlign: <valor> })`;
 * "esquerda" é o único calculado por exclusão (nenhum dos outros três
 * ativo), já que `defaultAlignment: 'left'` (configurado em
 * `EmailEditorRico.tsx`) não deixa o schema gravar `text-align: left`
 * explicitamente no HTML — mesma leitura de antes, só que agora também
 * decide qual dos 4 ícones aparece no trigger.
 *
 * Lista (RefatoracaoFonteGruposCores.md — Etapa 3): mesmo padrão de
 * "grupo com popover" da Etapa 2, aplicado aos 2 antigos botões soltos
 * (`listaNaoOrdenada`/`listaOrdenada`), que agora vivem dentro do popover
 * de um único trigger `lista`. Escolher uma opção chama `aplicarLista(...)`
 * e fecha o popover — escolha exclusiva, mesmo padrão de "clicar e sair" do
 * alinhamento. O ícone do trigger reflete o tipo de lista ativo no momento
 * (`IconeListaAtiva`, abaixo); quando nenhuma lista está ativa, mostra o
 * último tipo tocado nesta sessão do componente (`ultimoTipoLista`,
 * atualizado dentro de `aplicarLista`), com lista não ordenada como
 * fallback inicial (mesmo raciocínio de "opção mais comum como padrão" já
 * usado para "esquerda" no alinhamento) — não há um ícone "neutro"
 * dedicado: com só duas opções, reaproveitar os dois ícones já existentes
 * (`IconeListaNaoOrdenada`/`IconeListaOrdenada`) cobre os dois estados sem
 * precisar de um terceiro ícone em `Icons.tsx`.
 *
 * Recuo (RefatoracaoFonteGruposCores.md — Etapa 3): mesmo padrão de "grupo
 * com popover", aplicado aos 2 antigos botões soltos (`recuoEsquerda`/
 * `recuoDireita`), que agora vivem dentro do popover de um único trigger
 * `recuo`. Ao contrário de alinhamento/lista, as duas opções (aumentar/
 * diminuir) são ações relativas repetíveis, não uma escolha exclusiva — o
 * popover permanece aberto após cada clique (`aumentarRecuo`/
 * `diminuirRecuo` não mexem em `painelAberto`), fechando só por
 * clique-fora/Esc (comportamento já suportado por `ToolbarPopover`, sem
 * mudança nele). Sem estado ativo/inativo para refletir, o ícone do
 * trigger é fixo (`IconeRecuoDireita`, a ação mais usada das duas — mesmo
 * raciocínio que já priorizava "aumentar" sobre "diminuir" na ordem de
 * ocultação da revisão anterior) — `increaseIndent()`/`decreaseIndent()`,
 * comandos expostos pela extensão `Indentacao`
 * (`editor/extensoes/Indentacao.ts`), que soma/subtrai um nível de recuo a
 * cada nó de bloco (parágrafo/item de lista) tocado pela seleção atual.
 * Diminuir recuo abaixo do mínimo (zero) não tem efeito — a própria
 * extensão já trata isso, nenhum tratamento extra é necessário aqui.
 *
 * Linha horizontal (Etapa 6): botão de ação simples (sem estado
 * ativo/inativo, mesmo padrão de "Limpar formatação" e recuo, acima) —
 * chama `setHorizontalRule()`, comando já disponível via `StarterKit`
 * (reabilitado em `EmailEditorRico.tsx`, ver comentário lá; vinha desligado
 * nesta configuração, ao contrário do que o plano presumia). Nenhuma
 * extensão nova foi instalada.
 *
 * Tabela (Etapa 7): botão placeholder, sem nenhum comando associado — o
 * clique não faz nada de propósito; o título ("Tabela (em breve)") já
 * comunica que a função ainda não existe. A extensão de tabela de fato
 * (schema + exportação bulletproof para e-mail) fica para uma revisão
 * futura, fora deste plano.
 *
 * Limpar formatação: botão de ação simples (não tem estado ativo/inativo),
 * chamando `unsetAllMarks().clearNodes().run()` — comportamento padrão do
 * Tiptap/ProseMirror já restringe o efeito à seleção atual. `clearNodes()`
 * também remove o envolvimento do nó de botão e o alinhamento quando a
 * seleção estiver dentro deles, já que ambos contam como "nó" para esse
 * comando, não como marca.
 */
export function EmailEditorToolbar({ editor }: Props) {
  const [painelAberto, setPainelAberto] = useState<
    | 'tamanhoFonte'
    | 'cor'
    | 'realce'
    | 'link'
    | 'botao'
    | 'alinhamento'
    | 'lista'
    | 'recuo'
    | 'tabela'
    | 'corCelula'
    | 'corBorda'
    | null
  >(null);
  // Ver Mais (Etapa 2) é um estado à parte de `painelAberto` — ver JSDoc do
  // componente, acima.
  const [verMaisAberto, setVerMaisAberto] = useState(false);

  // Último tipo de lista escolhido nesta sessão do componente
  // (RefatoracaoFonteGruposCores.md — Etapa 3) — usado só como fallback do
  // ícone do trigger `lista` quando nenhuma lista está ativa na seleção
  // atual (ver `IconeListaAtiva`, abaixo). Não persiste entre remontagens
  // do componente nem afeta o documento — é puramente cosmético.
  const [ultimoTipoLista, setUltimoTipoLista] = useState<'naoOrdenada' | 'ordenada'>('naoOrdenada');

  const [linkValorInput, setLinkValorInput] = useState('');
  // Campo de URL próprio do popover de "Botão" — separado de
  // `linkValorInput` (popover de Link, marca de texto) porque são dois
  // popovers independentes que podem, em tese, ter sido abertos e
  // preenchidos em momentos diferentes; compartilhar o mesmo state faria um
  // vazar valor pro outro.
  const [botaoHrefInput, setBotaoHrefInput] = useState('');

  const linkInputRef = useRef<HTMLInputElement>(null);
  const botaoHrefInputRef = useRef<HTMLInputElement>(null);

  // Campos "linhas"/"colunas" do popover de inserir tabela
  // (RefatoracaoTabela.md — Etapa 2) — texto livre (não número puro) pelo
  // mesmo motivo do campo de tamanho de fonte: aceita digitação livre,
  // validada/ajustada (clamp) só ao inserir, não a cada tecla.
  const [tabelaLinhasInput, setTabelaLinhasInput] = useState(String(TABELA_LINHAS_PADRAO));
  const [tabelaColunasInput, setTabelaColunasInput] = useState(String(TABELA_COLUNAS_PADRAO));
  const tabelaLinhasInputRef = useRef<HTMLInputElement>(null);

  // Buffer local do campo "Altura" da barra contextual de tabela
  // (RefatoracaoTabela.md — Etapa 5) — mesmo padrão do campo de tamanho de
  // fonte (`campoTamanhoFonte`, abaixo): aceita digitação livre, confirmada
  // só no blur/Enter (`confirmarAlturaLinha`), sincronizado a partir do
  // editor sempre que o campo não está focado (ver efeito logo abaixo de
  // `estado`). Vazio quando a linha atual não tem altura customizada
  // (`estado.alturaLinhaAtiva` indefinido) — o campo mostra o placeholder
  // "Auto", não um valor numérico.
  const [campoAlturaLinha, setCampoAlturaLinha] = useState('');
  const campoAlturaLinhaFocadoRef = useRef(false);

  // Buffers dos campos "Espessura" (borda) e "Largura" (fixa, em px) da
  // barra contextual de tabela (RefatoracaoTabela.md — Etapa 6) — mesmo
  // padrão de `campoAlturaLinha`, acima: digitação livre, confirmada só no
  // blur/Enter (`confirmarEspessuraBorda`/`confirmarLarguraFixa`),
  // sincronizada a partir do editor sempre que o campo correspondente não
  // está focado (ver efeitos logo abaixo de `estado`). `campoLarguraFixa`
  // fica vazio tanto quando a tabela não tem largura customizada quanto
  // quando ela está em "largura total" (`largura === '100%'`) — nos dois
  // casos não há um valor fixo em px para mostrar no campo.
  const [campoEspessuraBorda, setCampoEspessuraBorda] = useState('');
  const campoEspessuraBordaFocadoRef = useRef(false);
  const [campoLarguraFixa, setCampoLarguraFixa] = useState('');
  const campoLarguraFixaFocadoRef = useRef(false);

  // Buffer local do campo do stepper de tamanho de fonte
  // (RefatoracaoFonteGruposCores.md — Etapa 1) — precisa de um estado à
  // parte (não deriva direto de `estado.fontSizeAtiva` a cada render)
  // porque o campo aceita digitação livre que só é validada/aplicada ao
  // editor no blur/Enter (`confirmarCampoTamanhoFonte`), não a cada tecla;
  // até lá o que aparece no campo é só o que o usuário está digitando.
  // Sincronizado a partir do editor sempre que o campo NÃO está focado (ver
  // efeito logo abaixo de `estado`) — enquanto o usuário digita, mudanças
  // externas de seleção não devem sobrescrever o que ele está escrevendo.
  const [campoTamanhoFonte, setCampoTamanhoFonte] = useState(String(TAMANHO_FONTE_PADRAO));
  const campoTamanhoFonteFocadoRef = useRef(false);

  // Refs dos botões-gatilho, um por item (Etapa 1) — servem tanto de âncora
  // para `ToolbarPopover` (cor/realce/link/botao) quanto de alvo de medição
  // de largura (Etapa 2, abaixo). Nomeados individualmente (em vez de um
  // mapa) para que cada um possa ser passado como `RefObject` direto a
  // `ToolbarPopover`.
  const refNegrito = useRef<HTMLButtonElement>(null);
  const refItalico = useRef<HTMLButtonElement>(null);
  const refSublinhado = useRef<HTMLButtonElement>(null);
  const refTachado = useRef<HTMLButtonElement>(null);
  // O item de tamanho de fonte passa a ter 3 sub-elementos (botão −, campo,
  // botão +) em vez de um único botão — `refTamanhoFonte` aponta para o
  // campo (é ele quem ancora o popover de valores comuns, mesmo papel que
  // o botão único tinha antes), enquanto `refTamanhoFonteItem` aponta para
  // o div que envolve os três, usado só para a medição de largura do
  // "Ver Mais" (Etapa 2), que precisa do espaço total ocupado pelo grupo,
  // não apenas por um dos três elementos.
  const refTamanhoFonte = useRef<HTMLInputElement>(null);
  const refTamanhoFonteItem = useRef<HTMLDivElement>(null);
  const refCor = useRef<HTMLButtonElement>(null);
  const refRealce = useRef<HTMLButtonElement>(null);
  const refLink = useRef<HTMLButtonElement>(null);
  const refBotao = useRef<HTMLButtonElement>(null);
  const refLinhaHorizontal = useRef<HTMLButtonElement>(null);
  const refTabela = useRef<HTMLButtonElement>(null);
  const refLista = useRef<HTMLButtonElement>(null);
  const refAlinhamento = useRef<HTMLButtonElement>(null);
  const refRecuo = useRef<HTMLButtonElement>(null);
  const refLimparFormatacao = useRef<HTMLButtonElement>(null);
  const refVerMais = useRef<HTMLButtonElement>(null);
  // Barra contextual de tabela — cor de célula (RefatoracaoTabela.md — Etapa
  // 4): não entra em `REFS`/`ITEM_IDS` (a barra contextual não participa do
  // mecanismo de "Ver Mais"), só precisa de âncora própria para o popover de
  // `SeletorCor`, mesmo papel que `refCor`/`refRealce` cumprem na faixa
  // principal.
  const refCorCelula = useRef<HTMLButtonElement>(null);
  // Barra contextual de tabela — cor da borda (RefatoracaoTabela.md — Etapa
  // 6): mesmo papel de `refCorCelula`, acima, para o popover de `SeletorCor`
  // do controle de borda.
  const refCorBorda = useRef<HTMLButtonElement>(null);

  // `HTMLElement` (não `HTMLButtonElement`) porque `tamanhoFonte` agora
  // referencia o div-wrapper do stepper, não um único botão — só
  // `getBoundingClientRect().width` é usado sobre estes refs (ver medição
  // abaixo), que existe em qualquer `HTMLElement`.
  const REFS: Record<ItemId, RefObject<HTMLElement | null>> = useMemo(
    () => ({
      negrito: refNegrito,
      italico: refItalico,
      sublinhado: refSublinhado,
      tachado: refTachado,
      tamanhoFonte: refTamanhoFonteItem,
      cor: refCor,
      realce: refRealce,
      link: refLink,
      botao: refBotao,
      linhaHorizontal: refLinhaHorizontal,
      tabela: refTabela,
      lista: refLista,
      alinhamento: refAlinhamento,
      recuo: refRecuo,
      limparFormatacao: refLimparFormatacao,
    }),
    // Refs nunca mudam de identidade entre renders — a lista de dependências
    // vazia é segura na prática, o objeto só precisa ser montado uma vez.
    []
  );

  // --- Etapa 2: "Ver Mais" — botões individuais ocultos por largura -------

  const toolbarRef = useRef<HTMLDivElement>(null);
  const [larguraDisponivel, setLarguraDisponivel] = useState<number | null>(null);
  const [larguraGapPx, setLarguraGapPx] = useState(0);
  // Largura "natural" de cada botão (todos usam a classe
  // `.email-editor-toolbar-botao`, então na prática têm o mesmo tamanho —
  // mas a medição é feita por item, via `getBoundingClientRect`, em vez de
  // uma constante fixa, para não depender de um número "mágico" que
  // desalinha se o CSS mudar). `undefined` = ainda não medido.
  const [larguras, setLarguras] = useState<Partial<Record<ItemId, number>>>({});
  const medicaoFeitaRef = useRef(false);

  // Observa a largura de conteúdo (content-box) disponível para os botões +
  // separadores + gatilho de "Ver Mais".
  useEffect(() => {
    const elemento = toolbarRef.current;
    if (!elemento) return;

    const observer = new ResizeObserver((entradas) => {
      const largura = entradas[0]?.contentRect.width;
      if (largura !== undefined) setLarguraDisponivel(largura);
    });
    observer.observe(elemento);
    return () => observer.disconnect();
  }, []);

  // Lê o `gap` de fato aplicado pelo CSS (`.email-editor-toolbar { gap:
  // 0.2rem }`) uma única vez, em vez de repetir o valor como constante —
  // evita os dois lugares (CSS e cálculo de largura) desalinharem se um
  // mudar sem o outro.
  useLayoutEffect(() => {
    const elemento = toolbarRef.current;
    if (!elemento) return;
    const estilo = getComputedStyle(elemento);
    const gap = parseFloat(estilo.columnGap || estilo.gap || '0');
    setLarguraGapPx(Number.isNaN(gap) ? 0 : gap);
  }, []);

  // Mede a largura natural de cada botão uma única vez, na primeira vez em
  // que todos aparecem visíveis (antes de qualquer ocultação ter sido
  // decidida — `ocultos` começa vazio enquanto `larguraDisponivel` é
  // `null`, então todos os 15 botões já estão montados quando este efeito
  // roda). `useLayoutEffect` para medir antes da pintura, mesmo espírito da
  // medição de grupos da revisão anterior.
  useLayoutEffect(() => {
    if (medicaoFeitaRef.current) return;

    // A leitura em si (`getBoundingClientRect`) já acontece antes da pintura
    // (é por isso que este é um `useLayoutEffect`); só a atualização de
    // estado é adiada para dentro de um callback (mesmo espírito do
    // `ResizeObserver` acima) em vez de ficar direto no corpo do efeito.
    const frame = requestAnimationFrame(() => {
      if (medicaoFeitaRef.current) return;

      const novo: Partial<Record<ItemId, number>> = {};
      for (const id of ITEM_IDS) {
        const elemento = REFS[id].current;
        if (!elemento) return; // ainda não montaram todos; tenta de novo no próximo commit
        novo[id] = elemento.getBoundingClientRect().width;
      }
      medicaoFeitaRef.current = true;
      setLarguras(novo);
    });

    return () => cancelAnimationFrame(frame);
  }, [REFS]);

  const larguraMedida = ITEM_IDS.every((id) => larguras[id] !== undefined);

  const ocultos = useMemo(() => {
    const resultado = new Set<ItemId>();
    // Enquanto a medição não terminou, ou a largura disponível ainda não
    // foi observada, nada esconde — todos os botões ficam visíveis, o que é
    // justamente o que permite medi-los (ver efeito acima).
    if (!larguraMedida || larguraDisponivel === null) return resultado;

    // Todo botão usa a mesma classe `.email-editor-toolbar-botao`, então o
    // gatilho de "Ver Mais" (que reaproveita essa classe) tem
    // aproximadamente a mesma largura de qualquer botão simples já medido.
    const larguraGatilhoVerMais = larguras.negrito as number;

    function larguraTotalAtual(candidato: Set<ItemId>): number {
      const visiveis = ITEM_IDS.filter((id) => !candidato.has(id));

      let total = visiveis.reduce((soma, id) => soma + (larguras[id] as number), 0);
      total += (CLUSTERS.length - 1) * LARGURA_SEPARADOR_PX;

      let quantidadeFilhos = visiveis.length + (CLUSTERS.length - 1);
      if (candidato.size > 0) {
        total += larguraGatilhoVerMais;
        quantidadeFilhos += 1;
      }
      total += Math.max(0, quantidadeFilhos - 1) * larguraGapPx;

      return total;
    }

    for (const id of ORDEM_OCULTACAO) {
      if (larguraTotalAtual(resultado) <= larguraDisponivel) break;
      resultado.add(id);
    }

    return resultado;
  }, [larguraMedida, larguraDisponivel, larguras, larguraGapPx]);

  // Se a toolbar deixar de ter botões ocultos (ficou larga o suficiente de
  // novo), fecha o painel de "Ver Mais" que porventura estivesse aberto —
  // ele não tem mais razão de existir (nenhum botão para mostrar). Ajustado
  // durante a própria renderização (padrão documentado do React para
  // "resetar estado quando algo muda"), mesmo mecanismo já usado pelo
  // extinto `ToolbarGrupo.tsx` para o par colapsado/aberto — não um
  // `useEffect`, para não disparar um re-render em cascata extra.
  const [ocultosTamanhoAnterior, setOcultosTamanhoAnterior] = useState(ocultos.size);
  if (ocultos.size !== ocultosTamanhoAnterior) {
    setOcultosTamanhoAnterior(ocultos.size);
    if (ocultos.size === 0) setVerMaisAberto(false);
  }

  const estado = useEditorState({
    editor,
    selector: (contexto) => {
      const ed = contexto.editor;
      if (!ed) {
        return ESTADO_EDITOR_INDISPONIVEL;
      }
      return {
        negrito: ed.isActive('bold'),
        italico: ed.isActive('italic'),
        sublinhado: ed.isActive('underline'),
        tachado: ed.isActive('strike'),
        fontSizeAtiva: ed.getAttributes('textStyle').fontSize as string | undefined,
        corAtiva: ed.getAttributes('textStyle').color as string | undefined,
        realceAtivo: ed.isActive('highlight'),
        realceCorAtiva: ed.getAttributes('highlight').color as string | undefined,
        linkAtivo: ed.isActive('link'),
        linkHref: (ed.getAttributes('link').href as string | undefined) ?? '',
        listaNaoOrdenadaAtiva: ed.isActive('bulletList'),
        listaOrdenadaAtiva: ed.isActive('orderedList'),
        noBotaoAtivo: ed.isActive('noBotao'),
        // Atributos próprios do nó, gravados por `NoBotao.ts`. Só fazem
        // sentido quando `noBotaoAtivo` — fora de um botão,
        // `getAttributes('noBotao')` devolve os defaults do schema
        // (`null`/`null`), nunca resíduo de um botão diferente que o cursor
        // já tenha visitado antes.
        noBotaoCorAtiva: ed.getAttributes('noBotao').cor as string | undefined,
        noBotaoHrefAtiva: (ed.getAttributes('noBotao').href as string | undefined) ?? '',
        alinhamentoCentro: ed.isActive({ textAlign: 'center' }),
        alinhamentoDireita: ed.isActive({ textAlign: 'right' }),
        alinhamentoJustificado: ed.isActive({ textAlign: 'justify' }),
        // Barra contextual de tabela (RefatoracaoTabela.md — Etapa 2): só
        // aparece com o cursor dentro de uma célula, checado do mesmo jeito
        // que qualquer outro estado "ativo" desta toolbar.
        tabelaAtiva: ed.isActive('table'),
        // Estado "ativo" dos toggles de cabeçalho (Etapa 3): `tableHeader`
        // é o mesmo tipo de nó usado tanto para célula de linha de
        // cabeçalho quanto de coluna de cabeçalho (a extensão não distingue
        // as duas — ver seção 2 do plano), então uma única flag basta para
        // destacar os dois botões quando o cursor está numa célula já
        // convertida em cabeçalho, seja por `toggleHeaderRow` ou por
        // `toggleHeaderColumn`.
        celulaCabecalhoAtiva: ed.isActive('tableHeader'),
        // Cor de fundo da célula atual (Etapa 4): lê o atributo `corFundo`
        // do tipo de nó ativo sob o cursor — `tableHeader` quando a célula
        // já é de cabeçalho, `tableCell` caso contrário. Fora de uma tabela
        // os dois `getAttributes` devolvem o default do schema (`null`),
        // então `corCelulaAtiva` simplesmente fica `undefined`.
        corCelulaAtiva: (ed.isActive('tableHeader')
          ? ed.getAttributes('tableHeader').corFundo
          : ed.getAttributes('tableCell').corFundo) as string | undefined,
        // Altura customizada da linha atual (Etapa 5): lê o atributo
        // `altura` do nó `tableRow` mais próximo da seleção
        // (`TableRowComAltura`, `editor/extensoes/AlturaLinha.ts`). Fora de
        // uma tabela, `getAttributes('tableRow')` devolve o default do
        // schema (`null`), normalizado aqui para `undefined` pelo mesmo
        // motivo de `noBotaoHrefAtiva` mais acima: mantém o tipo do campo
        // consistente com "sem valor definido" em vez de propagar `null`.
        alturaLinhaAtiva: (ed.getAttributes('tableRow').altura ?? undefined) as number | undefined,
        // Borda e largura da tabela (Etapa 6): lê os atributos do nó
        // `table` mais próximo da seleção (`TableComBordaLargura`,
        // `editor/extensoes/BordaLarguraTabela.ts`). Fora de uma tabela,
        // `getAttributes('table')` devolve os defaults do schema (`null`),
        // normalizados aqui para `undefined` pelo mesmo motivo de
        // `alturaLinhaAtiva`, acima.
        corBordaAtiva: (ed.getAttributes('table').corBorda ?? undefined) as string | undefined,
        espessuraBordaAtiva: (ed.getAttributes('table').espessuraBorda ?? undefined) as number | undefined,
        larguraTabelaAtiva: (ed.getAttributes('table').largura ?? undefined) as string | undefined,
      };
    },
  }) ?? ESTADO_EDITOR_INDISPONIVEL;

  // Valor numérico "vigente" do tamanho de fonte (Etapa 1): lê
  // `estado.fontSizeAtiva` (mesma leitura que já existia antes desta
  // revisão) e cai para `TAMANHO_FONTE_PADRAO` quando a seleção não tem
  // `fontSize` explícito — é o valor que os botões +/− somam/subtraem e
  // para o qual o campo é resincronizado sempre que não está sendo editado.
  const valorTamanhoFonteAtivo = useMemo(() => {
    const numero = estado.fontSizeAtiva ? Number.parseFloat(estado.fontSizeAtiva) : TAMANHO_FONTE_PADRAO;
    return Number.isFinite(numero) ? numero : TAMANHO_FONTE_PADRAO;
  }, [estado.fontSizeAtiva]);

  // Resincroniza o campo do stepper com o valor vigente do editor (troca de
  // seleção, undo/redo, etc.) — mas só enquanto o campo não está focado;
  // como o campo aceita digitação livre confirmada só no blur/Enter (ver
  // `confirmarCampoTamanhoFonte`), sobrescrever aqui no meio da digitação
  // apagaria o que o usuário está escrevendo a cada transação do editor.
  useEffect(() => {
    if (campoTamanhoFonteFocadoRef.current) return;
    setCampoTamanhoFonte(String(valorTamanhoFonteAtivo));
  }, [valorTamanhoFonteAtivo]);

  // Foca (e seleciona) o campo de URL ao abrir o popover de link. Só DOM,
  // sem setState — o pré-preenchimento do valor acontece em `alternarPainel`,
  // no clique que abre o painel, não aqui.
  useEffect(() => {
    if (painelAberto !== 'link') return;
    linkInputRef.current?.focus();
    linkInputRef.current?.select();
  }, [painelAberto]);

  // Mesmo padrão do efeito acima, para o campo de URL do popover de "Botão"
  // — a partir da Etapa 8 o campo sempre aparece ao abrir o popover (não só
  // quando o nó já existe), então o foco não depende mais de
  // `estado.noBotaoAtivo`.
  useEffect(() => {
    if (painelAberto !== 'botao') return;
    botaoHrefInputRef.current?.focus();
    botaoHrefInputRef.current?.select();
  }, [painelAberto]);

  // Mesmo padrão dos dois efeitos acima, para o popover de inserir tabela
  // (Etapa 2) — foca o campo "linhas" ao abrir.
  useEffect(() => {
    if (painelAberto !== 'tabela') return;
    tabelaLinhasInputRef.current?.focus();
    tabelaLinhasInputRef.current?.select();
  }, [painelAberto]);

  // Resincroniza o campo "Altura" com o valor vigente do editor (troca de
  // célula/linha, undo/redo etc.) — mesmo padrão do campo de tamanho de
  // fonte: só enquanto o campo não está focado, para não sobrescrever
  // digitação em andamento a cada transação do editor.
  useEffect(() => {
    if (campoAlturaLinhaFocadoRef.current) return;
    setCampoAlturaLinha(estado.alturaLinhaAtiva != null ? String(estado.alturaLinhaAtiva) : '');
  }, [estado.alturaLinhaAtiva]);

  useEffect(() => {
    if (campoEspessuraBordaFocadoRef.current) return;
    setCampoEspessuraBorda(estado.espessuraBordaAtiva != null ? String(estado.espessuraBordaAtiva) : '');
  }, [estado.espessuraBordaAtiva]);

  useEffect(() => {
    if (campoLarguraFixaFocadoRef.current) return;
    setCampoLarguraFixa(
      estado.larguraTabelaAtiva && estado.larguraTabelaAtiva !== '100%'
        ? String(Number.parseFloat(estado.larguraTabelaAtiva))
        : ''
    );
  }, [estado.larguraTabelaAtiva]);

  const alternarPainel = useCallback(
    (
      painel:
        | 'tamanhoFonte'
        | 'cor'
        | 'realce'
        | 'link'
        | 'botao'
        | 'alinhamento'
        | 'lista'
        | 'recuo'
        | 'tabela'
        | 'corCelula'
        | 'corBorda'
    ) => {
      const abrindo = painelAberto !== painel;
      setPainelAberto(abrindo ? painel : null);
      // Pré-preenche com a URL do link atual (se o cursor estiver sobre um)
      // ao abrir o painel de link — feito aqui, no clique, não num efeito.
      if (abrindo && painel === 'link') {
        setLinkValorInput(estado.linkHref);
      }
      // Mesma ideia para o destino do botão.
      if (abrindo && painel === 'botao') {
        setBotaoHrefInput(estado.noBotaoHrefAtiva);
      }
      // Reseta os campos de inserir tabela (Etapa 2) para os padrões a cada
      // abertura — o popover de inserção não tem "estado atual" para
      // pré-preencher (ao contrário de link/botão, que refletem uma marca
      // já existente sob o cursor).
      if (abrindo && painel === 'tabela') {
        setTabelaLinhasInput(String(TABELA_LINHAS_PADRAO));
        setTabelaColunasInput(String(TABELA_COLUNAS_PADRAO));
      }
    },
    [painelAberto, estado.linkHref, estado.noBotaoHrefAtiva]
  );

  /**
   * Aplica um tamanho de fonte já validado (px, número inteiro) — usada
   * tanto pelos botões +/− quanto pela confirmação do campo (blur/Enter) e
   * pela escolha de um valor comum no popover (`PainelValoresFonteComuns`).
   * Faz o clamp para `TAMANHO_FONTE_MIN`/`TAMANHO_FONTE_MAX` aqui, em um só
   * lugar, para as três formas de entrada nunca aplicarem um valor fora do
   * intervalo de segurança (seção 2 do plano).
   */
  function aplicarTamanhoFonte(tamanho: number) {
    const tamanhoClampado = Math.min(TAMANHO_FONTE_MAX, Math.max(TAMANHO_FONTE_MIN, Math.round(tamanho)));
    editor?.chain().focus().setFontSize(`${tamanhoClampado}px`).run();
    setCampoTamanhoFonte(String(tamanhoClampado));
  }

  /** Botão `[+]`/`[−]` do stepper — ação direta de 1px, sem abrir popover. */
  function incrementarTamanhoFonte() {
    aplicarTamanhoFonte(valorTamanhoFonteAtivo + 1);
  }

  function decrementarTamanhoFonte() {
    aplicarTamanhoFonte(valorTamanhoFonteAtivo - 1);
  }

  /**
   * Escolha de um valor comum no popover do campo (seção 2: "clicar no
   * número abre uma lista") — aplica e fecha o popover, sem impedir que o
   * campo continue editável livremente depois (o popover é só um atalho).
   */
  function escolherTamanhoFonteComum(valor: number) {
    aplicarTamanhoFonte(valor);
    setPainelAberto(null);
  }

  /**
   * Confirma o valor digitado livremente no campo — chamada ao perder o
   * foco ou apertar Enter (nunca a tecla a tecla, seção 2). Um valor não
   * numérico reverte o campo para o último valor válido em vez de aplicar
   * qualquer coisa ao editor.
   */
  function confirmarCampoTamanhoFonte() {
    const numero = Number.parseFloat(campoTamanhoFonte.replace(',', '.'));
    if (!Number.isFinite(numero)) {
      setCampoTamanhoFonte(String(valorTamanhoFonteAtivo));
      return;
    }
    aplicarTamanhoFonte(numero);
  }

  function aplicarCorTexto(cor: string) {
    editor?.chain().focus().setColor(cor).run();
    setPainelAberto(null);
  }

  /**
   * Mesmo comando de `aplicarCorTexto`, sem fechar o popover — usada pelo
   * campo hex de `SeletorCor` (Etapa 4), que aplica a cada tecla válida
   * digitada; fechar o popover no meio da digitação impediria completar um
   * hex de 6 dígitos depois de já passar por um estado intermediário válido
   * de 3. `setColor` não é um toggle (só `Color`/`unsetColor`), então
   * reaplicar o mesmo comando repetidamente por tecla não tem efeito
   * colateral de "desligar" a cor, ao contrário do realce logo abaixo.
   */
  function aplicarCorTextoLivre(cor: string) {
    editor?.chain().focus().setColor(cor).run();
  }

  function removerCorTexto() {
    editor?.chain().focus().unsetColor().run();
    setPainelAberto(null);
  }

  function aplicarRealce(cor: string) {
    editor?.chain().focus().toggleHighlight({ color: cor }).run();
    setPainelAberto(null);
  }

  /**
   * Variante sem fechar popover para o campo hex (mesmo raciocínio de
   * `aplicarCorTextoLivre`, acima). Usa `setHighlight` em vez de
   * `toggleHighlight`: o toggle desliga o realce quando a cor aplicada já
   * bate com a cor ativa no momento (comparação por atributo, não só
   * presença da marca) — comportamento desejado para o clique na amostra
   * (Etapa 4 anterior a esta), mas indesejado aqui, onde cada tecla válida
   * digitada poderia coincidir por acaso com a cor já ativa e desligar o
   * realce no meio da digitação.
   */
  function aplicarRealceLivre(cor: string) {
    editor?.chain().focus().setHighlight({ color: cor }).run();
  }

  function removerRealce() {
    editor?.chain().focus().unsetHighlight().run();
    setPainelAberto(null);
  }

  function aplicarLink() {
    const url = linkValorInput.trim();
    if (!url) {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setPainelAberto(null);
  }

  function removerLink() {
    editor?.chain().focus().extendMarkRange('link').unsetLink().run();
    setPainelAberto(null);
  }

  /**
   * Aplica um alinhamento e fecha o popover do trigger (Etapa 2 —
   * RefatoracaoFonteGruposCores.md, seção 2: escolha exclusiva, mesmo
   * padrão de "clicar e sair" de `escolherTamanhoFonteComum`).
   */
  function aplicarAlinhamento(valor: 'left' | 'center' | 'right' | 'justify') {
    editor?.chain().focus().setTextAlign(valor).run();
    setPainelAberto(null);
  }

  /**
   * Aplica um tipo de lista e fecha o popover do trigger (Etapa 3 —
   * RefatoracaoFonteGruposCores.md, seção 2: escolha exclusiva, mesmo
   * padrão de "clicar e sair" de `aplicarAlinhamento`). `toggleBulletList`/
   * `toggleOrderedList` continuam sendo toggles de verdade (clicar no tipo
   * já ativo desliga a lista) — só o comando muda conforme o tipo
   * escolhido. `ultimoTipoLista` é atualizado independente de estar
   * ligando ou desligando, para o ícone do trigger continuar refletindo o
   * último tipo tocado mesmo depois de a lista ser desligada.
   */
  function aplicarLista(tipo: 'naoOrdenada' | 'ordenada') {
    if (tipo === 'naoOrdenada') {
      editor?.chain().focus().toggleBulletList().run();
    } else {
      editor?.chain().focus().toggleOrderedList().run();
    }
    setUltimoTipoLista(tipo);
    setPainelAberto(null);
  }

  /**
   * Ações do trigger de recuo (Etapa 3) — ao contrário de
   * `aplicarAlinhamento`/`aplicarLista`, não fecham o popover (seção 2:
   * ação relativa repetível, não escolha exclusiva) — `painelAberto`
   * permanece intocado, deixando `ToolbarPopover` aberto para cliques
   * sucessivos até um clique-fora ou Esc.
   */
  function aumentarRecuo() {
    editor?.chain().focus().increaseIndent().run();
  }

  function diminuirRecuo() {
    editor?.chain().focus().decreaseIndent().run();
  }

  /** Cor de fundo do botão — mesmo comando genérico do Tiptap para
   * atualizar atributos de um nó, aplicado a `noBotao` em vez de a uma
   * mark. A partir da Etapa 8, o popover não tem mais um botão de toggle
   * textual separado: escolher uma cor a partir de uma seleção que ainda
   * não é um `noBotao` aplica o nó automaticamente (`toggleNoBotao()`)
   * antes de gravar o atributo. */
  function aplicarCorBotao(cor: string) {
    const chain = editor?.chain().focus();
    if (!chain) return;
    if (!estado.noBotaoAtivo) chain.toggleNoBotao();
    chain.updateAttributes('noBotao', { cor }).run();
  }

  /** `null` volta o botão à cor padrão do CSS (`.email-botao`, ver
   * `NoBotao.ts`: `renderHTML` de `cor` devolve `{}` quando o atributo é
   * `null`, então nenhum `style` extra sai no HTML). Não aplica o nó — só
   * faz sentido remover a cor de um botão que já existe. */
  function removerCorBotao() {
    editor?.chain().focus().updateAttributes('noBotao', { cor: null }).run();
  }

  /** Mesma lógica de auto-aplicação de `aplicarCorBotao`, acima, para o
   * link do botão. Campo vazio sem um `noBotao` já ativo não faz nada — o
   * nó não deve nascer sem destino só por um clique em "Aplicar link" com
   * o campo em branco; com o botão já existente, campo vazio continua
   * limpando o `href` (mesmo comportamento de antes da Etapa 8). */
  function aplicarHrefBotao() {
    const url = botaoHrefInput.trim();
    if (!url && !estado.noBotaoAtivo) return;
    const chain = editor?.chain().focus();
    if (!chain) return;
    if (!estado.noBotaoAtivo) chain.toggleNoBotao();
    chain.updateAttributes('noBotao', { href: url || null }).run();
  }

  function removerHrefBotao() {
    setBotaoHrefInput('');
    editor?.chain().focus().updateAttributes('noBotao', { href: null }).run();
  }

  /**
   * Limpar formatação. Restrito à seleção atual por padrão do próprio
   * Tiptap (ver JSDoc do componente, acima) — não precisa de nenhum recorte
   * manual de range aqui.
   */
  function limparFormatacao() {
    editor?.chain().focus().unsetAllMarks().clearNodes().run();
  }

  /**
   * Lê um campo de dimensão da tabela (linhas/colunas), com clamp para
   * `TABELA_DIMENSAO_MIN`/`_MAX` — mesmo padrão de `confirmarCampoTamanhoFonte`,
   * mas resolvido de uma vez no momento de inserir (o popover de tabela não
   * tem stepper +/− nem confirmação por blur; um valor digitado errado só é
   * corrigido ao clicar "Inserir").
   */
  function dimensaoTabelaClampada(valorDigitado: string, padrao: number): number {
    const numero = Number.parseInt(valorDigitado, 10);
    if (!Number.isFinite(numero)) return padrao;
    return Math.min(TABELA_DIMENSAO_MAX, Math.max(TABELA_DIMENSAO_MIN, numero));
  }

  /**
   * Insere a tabela na posição do cursor com as dimensões do popover
   * (RefatoracaoTabela.md — Etapa 2) — `withHeaderRow: false` porque o
   * toggle de linha/coluna de cabeçalho só ganha controle próprio na Etapa
   * 3; a tabela nasce como uma grade simples, sem distinção de cabeçalho.
   */
  function inserirTabela() {
    const linhas = dimensaoTabelaClampada(tabelaLinhasInput, TABELA_LINHAS_PADRAO);
    const colunas = dimensaoTabelaClampada(tabelaColunasInput, TABELA_COLUNAS_PADRAO);
    editor?.chain().focus().insertTable({ rows: linhas, cols: colunas, withHeaderRow: false }).run();
    setPainelAberto(null);
  }

  /**
   * Controles da barra contextual de tabela (RefatoracaoTabela.md — Etapa
   * 2) — cada um só liga diretamente ao comando nativo correspondente da
   * extensão; nenhum trata posição de linha/coluna manualmente (a própria
   * extensão resolve isso a partir da seleção/cursor atual). A barra em si
   * só é renderizada quando `estado.tabelaAtiva`, então estes handlers só
   * são de fato alcançáveis com o cursor dentro de uma tabela.
   */
  function inserirLinhaAcima() {
    editor?.chain().focus().addRowBefore().run();
  }

  function inserirLinhaAbaixo() {
    editor?.chain().focus().addRowAfter().run();
  }

  function excluirLinha() {
    editor?.chain().focus().deleteRow().run();
  }

  function inserirColunaEsquerda() {
    editor?.chain().focus().addColumnBefore().run();
  }

  function inserirColunaDireita() {
    editor?.chain().focus().addColumnAfter().run();
  }

  function excluirColuna() {
    editor?.chain().focus().deleteColumn().run();
  }

  function excluirTabela() {
    editor?.chain().focus().deleteTable().run();
  }

  /**
   * Mesclar/dividir célula e toggles de cabeçalho (RefatoracaoTabela.md —
   * Etapa 3) — mesmo padrão dos handlers da Etapa 2, acima: cada um liga
   * direto ao comando nativo correspondente, sem cálculo manual de posição.
   * `mergeCells`/`splitCell` simplesmente não fazem nada quando a seleção
   * atual não é mesclável/divisível (ex.: uma única célula selecionada, ou
   * célula sem mesclagem prévia) — mesmo comportamento de no-op silencioso
   * que os comandos da Etapa 2 já têm fora de contexto válido, então não há
   * gating adicional (`can()`) além de `disabled={!editor}`, já usado em
   * todos os outros botões desta barra.
   */
  function mesclarCelulas() {
    editor?.chain().focus().mergeCells().run();
  }

  function dividirCelula() {
    editor?.chain().focus().splitCell().run();
  }

  function alternarLinhaCabecalho() {
    editor?.chain().focus().toggleHeaderRow().run();
  }

  function alternarColunaCabecalho() {
    editor?.chain().focus().toggleHeaderColumn().run();
  }

  /**
   * Cor de fundo da célula atual (RefatoracaoTabela.md — Etapa 4) —
   * `setCellAttribute`, comando nativo da extensão de tabela que já resolve
   * sozinho a seleção atual (célula única ou intervalo, mesmo mesclando
   * célula comum e de cabeçalho — ver `editor/extensoes/CorCelula.ts` para
   * o porquê de o atributo `corFundo` existir nos dois tipos de nó).
   */
  function aplicarCorCelula(cor: string) {
    editor?.chain().focus().setCellAttribute('corFundo', cor).run();
    setPainelAberto(null);
  }

  /** Mesmo comando de `aplicarCorCelula`, sem fechar o popover — usada pelo
   * campo hex de `SeletorCor`, que aplica a cada tecla válida digitada
   * (mesmo raciocínio de `aplicarCorTextoLivre`, acima). */
  function aplicarCorCelulaLivre(cor: string) {
    editor?.chain().focus().setCellAttribute('corFundo', cor).run();
  }

  function removerCorCelula() {
    editor?.chain().focus().setCellAttribute('corFundo', null).run();
    setPainelAberto(null);
  }

  /**
   * Altura da linha atual (RefatoracaoTabela.md — Etapa 5) — grava/atualiza
   * o atributo `altura` do nó `tableRow` mais próximo da seleção
   * (`updateAttributes`, mesmo comando genérico já usado por
   * `aplicarCorBotao` para o nó `noBotao`, acima; `TableRowComAltura` é
   * quem declara o atributo, em `editor/extensoes/AlturaLinha.ts`). Campo
   * vazio remove a altura customizada (`altura: null`), voltando a linha à
   * altura automática do conteúdo — mesmo raciocínio de "campo vazio limpa
   * o atributo" já usado por `aplicarLink`. Um valor não numérico ou
   * menor/igual a zero reverte o campo para o último valor válido, sem
   * aplicar nada ao editor — mesmo padrão de `confirmarCampoTamanhoFonte`.
   */
  function confirmarAlturaLinha() {
    const texto = campoAlturaLinha.trim();
    if (!texto) {
      editor?.chain().focus().updateAttributes('tableRow', { altura: null }).run();
      return;
    }
    const numero = Number.parseFloat(texto.replace(',', '.'));
    if (!Number.isFinite(numero) || numero <= 0) {
      setCampoAlturaLinha(estado.alturaLinhaAtiva != null ? String(estado.alturaLinhaAtiva) : '');
      return;
    }
    const alturaClampada = Math.min(ALTURA_LINHA_MAX, Math.max(ALTURA_LINHA_MIN, Math.round(numero)));
    editor?.chain().focus().updateAttributes('tableRow', { altura: alturaClampada }).run();
    setCampoAlturaLinha(String(alturaClampada));
  }

  /**
   * Cor da borda da tabela (RefatoracaoTabela.md — Etapa 6) — mesmo padrão
   * de `aplicarCorCelula`, mas via `updateAttributes('table', ...)` em vez
   * de `setCellAttribute` (específico de célula): `table` é o nó ancestral
   * mais próximo da seleção quando o cursor está em qualquer célula/linha
   * da tabela, mesma resolução que `updateAttributes('tableRow', ...)` já
   * usa para altura (Etapa 5, acima).
   */
  function aplicarCorBorda(cor: string) {
    editor?.chain().focus().updateAttributes('table', { corBorda: cor }).run();
    setPainelAberto(null);
  }

  /** Mesmo comando de `aplicarCorBorda`, sem fechar o popover — usada pelo
   * campo hex de `SeletorCor`, mesmo raciocínio de `aplicarCorCelulaLivre`. */
  function aplicarCorBordaLivre(cor: string) {
    editor?.chain().focus().updateAttributes('table', { corBorda: cor }).run();
  }

  function removerCorBorda() {
    editor?.chain().focus().updateAttributes('table', { corBorda: null }).run();
    setPainelAberto(null);
  }

  /**
   * Espessura da borda da tabela (mesma Etapa 6) — mesmo padrão de
   * `confirmarAlturaLinha`: campo vazio remove a espessura customizada, um
   * valor não numérico ou ≤ 0 reverte o campo sem aplicar nada, e um valor
   * válido é clampado (`ESPESSURA_BORDA_MIN`/`_MAX`) antes de aplicado.
   */
  function confirmarEspessuraBorda() {
    const texto = campoEspessuraBorda.trim();
    if (!texto) {
      editor?.chain().focus().updateAttributes('table', { espessuraBorda: null }).run();
      return;
    }
    const numero = Number.parseFloat(texto.replace(',', '.'));
    if (!Number.isFinite(numero) || numero <= 0) {
      setCampoEspessuraBorda(estado.espessuraBordaAtiva != null ? String(estado.espessuraBordaAtiva) : '');
      return;
    }
    const espessuraClampada = Math.min(ESPESSURA_BORDA_MAX, Math.max(ESPESSURA_BORDA_MIN, Math.round(numero)));
    editor?.chain().focus().updateAttributes('table', { espessuraBorda: espessuraClampada }).run();
    setCampoEspessuraBorda(String(espessuraClampada));
  }

  /**
   * Largura da tabela (mesma Etapa 6) — toggle "largura total" (100%) e
   * campo de largura fixa em px escrevem no mesmo atributo `largura`
   * (`editor/extensoes/BordaLarguraTabela.ts`), nunca os dois de uma vez:
   * ativar "largura total" substitui qualquer valor fixo já definido, e
   * confirmar um valor no campo de largura fixa desliga "largura total"
   * automaticamente (o atributo passa a guardar `'<n>px'`, não mais
   * `'100%'`) — refletido sozinho no toggle porque os dois lêem o mesmo
   * `estado.larguraTabelaAtiva`.
   */
  function alternarLarguraTotal() {
    const novaLargura = estado.larguraTabelaAtiva === '100%' ? null : '100%';
    editor?.chain().focus().updateAttributes('table', { largura: novaLargura }).run();
  }

  function confirmarLarguraFixa() {
    const texto = campoLarguraFixa.trim();
    if (!texto) {
      editor?.chain().focus().updateAttributes('table', { largura: null }).run();
      return;
    }
    const numero = Number.parseFloat(texto.replace(',', '.'));
    if (!Number.isFinite(numero) || numero <= 0) {
      setCampoLarguraFixa(
        estado.larguraTabelaAtiva && estado.larguraTabelaAtiva !== '100%'
          ? String(Number.parseFloat(estado.larguraTabelaAtiva))
          : ''
      );
      return;
    }
    const larguraClampada = Math.min(LARGURA_TABELA_FIXA_MAX, Math.max(LARGURA_TABELA_FIXA_MIN, Math.round(numero)));
    editor?.chain().focus().updateAttributes('table', { largura: `${larguraClampada}px` }).run();
    setCampoLarguraFixa(String(larguraClampada));
  }

  /**
   * Duplicar célula (RefatoracaoTabela.md — Etapa 7) — copia conteúdo +
   * `corFundo` da célula onde o cursor está para a célula vizinha na direção
   * escolhida, como uma única transação (um só passo de undo). Não há
   * comando nativo para isso, então a operação é montada diretamente com
   * `selectedRect`/`TableMap` (mesmo utilitário de baixo nível que os
   * comandos nativos de linha/coluna já usam por baixo dos panos) em vez de
   * uma sequência de comandos do Tiptap encadeados.
   *
   * `direita`: célula vizinha na mesma linha, coluna imediatamente depois da
   * atual (`rect.right`, já considerando eventual colspan da célula de
   * origem). `baixo`: célula vizinha na linha imediatamente depois
   * (`rect.bottom`, considerando eventual rowspan). Fora da última
   * coluna/linha da tabela — ou quando a célula "vizinha" na verdade é a
   * mesma célula mesclada cobrindo as duas posições — não há para onde
   * duplicar; a função não faz nada, mesmo no-op silencioso que
   * `mesclarCelulas`/`dividirCelula` (Etapa 3) já têm fora de contexto
   * válido.
   */
  function duplicarCelula(direcao: 'direita' | 'baixo') {
    editor
      ?.chain()
      .focus()
      .command(({ tr, state }) => {
        if (!isInTable(state)) return false;

        const rect = selectedRect(state);
        const { map, table, tableStart } = rect;
        const colunaDestino = direcao === 'direita' ? rect.right : rect.left;
        const linhaDestino = direcao === 'baixo' ? rect.bottom : rect.top;
        if (colunaDestino >= map.width || linhaDestino >= map.height) return false;

        const origemPos = map.map[rect.top * map.width + rect.left];
        const destinoPos = map.map[linhaDestino * map.width + colunaDestino];
        if (origemPos === destinoPos) return false;

        const celulaOrigem = table.nodeAt(origemPos);
        const celulaDestino = table.nodeAt(destinoPos);
        if (!celulaOrigem || !celulaDestino) return false;

        const corFundo = (celulaOrigem.attrs as { corFundo?: string | null }).corFundo ?? null;
        tr.setNodeMarkup(tableStart + destinoPos, null, { ...celulaDestino.attrs, corFundo });

        const destinoInicio = tableStart + destinoPos + 1;
        const destinoFim = destinoInicio + celulaDestino.content.size;
        tr.replaceWith(destinoInicio, destinoFim, celulaOrigem.content);

        return true;
      })
      .run();
  }

  // --- Botões individuais (Etapa 1) ----------------------------------------
  // Cada entrada é o botão (e, quando aplicável, seu popover companheiro).
  // A mesma árvore React é usada tanto na faixa principal quanto dentro do
  // painel de "Ver Mais" — é o próprio `EmailEditorToolbar` quem decide
  // ONDE desenhar cada item (ver montagem da faixa, abaixo), então nenhum
  // estado se perde ao um botão migrar de um lugar para o outro (não há
  // componente próprio por item cujo desmonte/remonte apagaria estado
  // interno).

  // Trigger de alinhamento (Etapa 2): "esquerda" calculada por exclusão,
  // mesma leitura que os 4 botões antigos já faziam individualmente (ver
  // JSDoc do componente) — usada tanto para destacar a opção ativa dentro
  // do popover quanto para decidir qual dos 4 ícones aparece no trigger.
  const alinhamentoEsquerdaAtivo =
    !estado.alinhamentoCentro && !estado.alinhamentoDireita && !estado.alinhamentoJustificado;
  const IconeAlinhamentoAtivo = estado.alinhamentoJustificado ? (
    <IconeAlinharJustificado />
  ) : estado.alinhamentoDireita ? (
    <IconeAlinharDireita />
  ) : estado.alinhamentoCentro ? (
    <IconeAlinharCentro />
  ) : (
    <IconeAlinharEsquerda />
  );

  // Trigger de lista (Etapa 3): ícone reflete o tipo ativo na seleção
  // atual; sem lista ativa, cai para `ultimoTipoLista` (ver JSDoc do
  // componente e da declaração do state, acima).
  const tipoListaExibido = estado.listaOrdenadaAtiva
    ? 'ordenada'
    : estado.listaNaoOrdenadaAtiva
      ? 'naoOrdenada'
      : ultimoTipoLista;
  const IconeListaAtiva = tipoListaExibido === 'ordenada' ? <IconeListaOrdenada /> : <IconeListaNaoOrdenada />;

  const itens: Record<ItemId, ReactNode> = {
    negrito: (
      <button
        key="negrito"
        ref={refNegrito}
        type="button"
        className={`email-editor-toolbar-botao ${estado.negrito ? 'ativo' : ''}`}
        onClick={() => editor?.chain().focus().toggleBold().run()}
        disabled={!editor}
        title="Negrito"
        aria-label="Negrito"
        aria-pressed={estado.negrito}
      >
        <IconeNegrito />
      </button>
    ),
    italico: (
      <button
        key="italico"
        ref={refItalico}
        type="button"
        className={`email-editor-toolbar-botao ${estado.italico ? 'ativo' : ''}`}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
        disabled={!editor}
        title="Itálico"
        aria-label="Itálico"
        aria-pressed={estado.italico}
      >
        <IconeItalico />
      </button>
    ),
    sublinhado: (
      <button
        key="sublinhado"
        ref={refSublinhado}
        type="button"
        className={`email-editor-toolbar-botao ${estado.sublinhado ? 'ativo' : ''}`}
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
        disabled={!editor}
        title="Sublinhado"
        aria-label="Sublinhado"
        aria-pressed={estado.sublinhado}
      >
        <IconeSublinhado />
      </button>
    ),
    tachado: (
      <button
        key="tachado"
        ref={refTachado}
        type="button"
        className={`email-editor-toolbar-botao ${estado.tachado ? 'ativo' : ''}`}
        onClick={() => editor?.chain().focus().toggleStrike().run()}
        disabled={!editor}
        title="Tachado"
        aria-label="Tachado"
        aria-pressed={estado.tachado}
      >
        <IconeTachado />
      </button>
    ),
    tamanhoFonte: (
      <div key="tamanhoFonte" ref={refTamanhoFonteItem} className="email-editor-toolbar-item email-editor-toolbar-stepper-fonte">
        <button
          type="button"
          className="email-editor-toolbar-stepper-botao"
          onClick={decrementarTamanhoFonte}
          disabled={!editor || valorTamanhoFonteAtivo <= TAMANHO_FONTE_MIN}
          title="Diminuir tamanho da fonte"
          aria-label="Diminuir tamanho da fonte"
        >
          <IconeFonteDiminuir />
        </button>
        <input
          ref={refTamanhoFonte}
          type="text"
          inputMode="numeric"
          className="email-editor-toolbar-stepper-campo"
          value={campoTamanhoFonte}
          disabled={!editor}
          title="Tamanho da fonte"
          aria-label="Tamanho da fonte"
          aria-haspopup="true"
          aria-expanded={painelAberto === 'tamanhoFonte'}
          onFocus={() => {
            campoTamanhoFonteFocadoRef.current = true;
            setPainelAberto('tamanhoFonte');
          }}
          onChange={(e) => setCampoTamanhoFonte(e.target.value)}
          onBlur={() => {
            campoTamanhoFonteFocadoRef.current = false;
            confirmarCampoTamanhoFonte();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              // Reverte o que estava sendo digitado, sem aplicar — mesmo
              // espírito do Esc que já fecha qualquer outro popover da
              // toolbar (`ToolbarPopover`), só que aqui também descarta a
              // edição em vez de só fechar a lista de atalho.
              setCampoTamanhoFonte(String(valorTamanhoFonteAtivo));
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <button
          type="button"
          className="email-editor-toolbar-stepper-botao"
          onClick={incrementarTamanhoFonte}
          disabled={!editor || valorTamanhoFonteAtivo >= TAMANHO_FONTE_MAX}
          title="Aumentar tamanho da fonte"
          aria-label="Aumentar tamanho da fonte"
        >
          <IconeFonteAumentar />
        </button>
        {painelAberto === 'tamanhoFonte' && (
          <ToolbarPopover
            anchorRef={refTamanhoFonte}
            onClose={() => setPainelAberto(null)}
            className="email-editor-toolbar-popover-tamanhos"
          >
            <PainelValoresFonteComuns valorAtivo={valorTamanhoFonteAtivo} onEscolher={escolherTamanhoFonteComum} />
          </ToolbarPopover>
        )}
      </div>
    ),
    cor: (
      <div key="cor" className="email-editor-toolbar-item">
        <button
          ref={refCor}
          type="button"
          className={`email-editor-toolbar-botao ${estado.corAtiva ? 'ativo' : ''}`}
          onClick={() => alternarPainel('cor')}
          disabled={!editor}
          title="Cor do texto"
          aria-label="Cor do texto"
          aria-haspopup="true"
          aria-expanded={painelAberto === 'cor'}
        >
          <IconeCorTexto />
          {estado.corAtiva && (
            <span className="email-editor-toolbar-indicador" style={{ backgroundColor: estado.corAtiva }} />
          )}
        </button>
        {painelAberto === 'cor' && (
          <ToolbarPopover
            anchorRef={refCor}
            onClose={() => setPainelAberto(null)}
            className="email-editor-toolbar-popover-cores"
          >
            <SeletorCor
              corAtiva={estado.corAtiva}
              rotuloRemover="Remover cor"
              onEscolherAmostra={aplicarCorTexto}
              onAplicarHex={aplicarCorTextoLivre}
              onRemover={removerCorTexto}
            />
          </ToolbarPopover>
        )}
      </div>
    ),
    realce: (
      <div key="realce" className="email-editor-toolbar-item">
        <button
          ref={refRealce}
          type="button"
          className={`email-editor-toolbar-botao ${estado.realceAtivo ? 'ativo' : ''}`}
          onClick={() => alternarPainel('realce')}
          disabled={!editor}
          title="Realce (cor de fundo)"
          aria-label="Realce"
          aria-haspopup="true"
          aria-expanded={painelAberto === 'realce'}
        >
          <IconeRealce />
          {estado.realceCorAtiva && (
            <span className="email-editor-toolbar-indicador" style={{ backgroundColor: estado.realceCorAtiva }} />
          )}
        </button>
        {painelAberto === 'realce' && (
          <ToolbarPopover
            anchorRef={refRealce}
            onClose={() => setPainelAberto(null)}
            className="email-editor-toolbar-popover-cores"
          >
            <SeletorCor
              corAtiva={estado.realceCorAtiva}
              rotuloRemover="Remover realce"
              onEscolherAmostra={aplicarRealce}
              onAplicarHex={aplicarRealceLivre}
              onRemover={removerRealce}
            />
          </ToolbarPopover>
        )}
      </div>
    ),
    link: (
      <div key="link" className="email-editor-toolbar-item">
        <button
          ref={refLink}
          type="button"
          className={`email-editor-toolbar-botao ${estado.linkAtivo ? 'ativo' : ''}`}
          onClick={() => alternarPainel('link')}
          disabled={!editor}
          title="Link"
          aria-label="Link"
          aria-haspopup="true"
          aria-expanded={painelAberto === 'link'}
        >
          <IconeLink />
        </button>
        {painelAberto === 'link' && (
          <ToolbarPopover
            anchorRef={refLink}
            onClose={() => setPainelAberto(null)}
            className="email-editor-toolbar-popover-link"
          >
            <input
              ref={linkInputRef}
              type="text"
              value={linkValorInput}
              onChange={(e) => setLinkValorInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  aplicarLink();
                }
              }}
              placeholder="https://exemplo.com"
              className="email-editor-toolbar-popover-input"
              aria-label="Endereço do link"
            />
            <div className="email-editor-toolbar-popover-acoes">
              <button type="button" className="email-editor-toolbar-popover-botao-aplicar" onClick={aplicarLink}>
                Aplicar
              </button>
              {estado.linkAtivo && (
                <button type="button" className="email-editor-toolbar-popover-remover" onClick={removerLink}>
                  Remover link
                </button>
              )}
            </div>
          </ToolbarPopover>
        )}
      </div>
    ),
    botao: (
      <div key="botao" className="email-editor-toolbar-item">
        <button
          ref={refBotao}
          type="button"
          className={`email-editor-toolbar-botao ${estado.noBotaoAtivo ? 'ativo' : ''}`}
          onClick={() => alternarPainel('botao')}
          disabled={!editor}
          title="Botão"
          aria-label="Botão"
          aria-haspopup="true"
          aria-expanded={painelAberto === 'botao'}
        >
          <IconeBotaoEmail />
          {estado.noBotaoCorAtiva && (
            <span className="email-editor-toolbar-indicador" style={{ backgroundColor: estado.noBotaoCorAtiva }} />
          )}
        </button>
        {painelAberto === 'botao' && (
          <ToolbarPopover
            anchorRef={refBotao}
            onClose={() => setPainelAberto(null)}
            className="email-editor-toolbar-popover-botao"
          >
            <SeletorCor
              corAtiva={estado.noBotaoCorAtiva}
              rotuloRemover="Cor padrão"
              onEscolherAmostra={aplicarCorBotao}
              onAplicarHex={aplicarCorBotao}
              onRemover={removerCorBotao}
            />

            <div className="email-editor-toolbar-popover-separador" />

            <input
              ref={botaoHrefInputRef}
              type="text"
              value={botaoHrefInput}
              onChange={(e) => setBotaoHrefInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  aplicarHrefBotao();
                }
              }}
              placeholder="https://exemplo.com"
              className="email-editor-toolbar-popover-input"
              aria-label="Destino do botão"
            />
            <div className="email-editor-toolbar-popover-acoes">
              <button type="button" className="email-editor-toolbar-popover-botao-aplicar" onClick={aplicarHrefBotao}>
                Aplicar link
              </button>
              {estado.noBotaoHrefAtiva && (
                <button type="button" className="email-editor-toolbar-popover-remover" onClick={removerHrefBotao}>
                  Remover link
                </button>
              )}
            </div>
          </ToolbarPopover>
        )}
      </div>
    ),
    linhaHorizontal: (
      <button
        key="linhaHorizontal"
        ref={refLinhaHorizontal}
        type="button"
        className="email-editor-toolbar-botao"
        onClick={() => editor?.chain().focus().setHorizontalRule().run()}
        disabled={!editor}
        title="Linha horizontal"
        aria-label="Linha horizontal"
      >
        <IconeLinhaHorizontal />
      </button>
    ),
    tabela: (
      <div key="tabela" className="email-editor-toolbar-item">
        <button
          ref={refTabela}
          type="button"
          className={`email-editor-toolbar-botao ${painelAberto === 'tabela' ? 'ativo' : ''}`}
          onClick={() => alternarPainel('tabela')}
          disabled={!editor}
          title="Tabela"
          aria-label="Tabela"
          aria-haspopup="true"
          aria-expanded={painelAberto === 'tabela'}
        >
          <IconeTabela />
        </button>
        {painelAberto === 'tabela' && (
          <ToolbarPopover
            anchorRef={refTabela}
            onClose={() => setPainelAberto(null)}
            className="email-editor-toolbar-popover-tabela-inserir"
          >
            <div className="email-editor-toolbar-popover-tabela-campos">
              <label className="email-editor-toolbar-popover-tabela-campo">
                <span>Linhas</span>
                <input
                  ref={tabelaLinhasInputRef}
                  type="text"
                  inputMode="numeric"
                  value={tabelaLinhasInput}
                  onChange={(e) => setTabelaLinhasInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      inserirTabela();
                    }
                  }}
                  className="email-editor-toolbar-popover-input"
                  aria-label="Número de linhas"
                />
              </label>
              <label className="email-editor-toolbar-popover-tabela-campo">
                <span>Colunas</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={tabelaColunasInput}
                  onChange={(e) => setTabelaColunasInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      inserirTabela();
                    }
                  }}
                  className="email-editor-toolbar-popover-input"
                  aria-label="Número de colunas"
                />
              </label>
            </div>
            <div className="email-editor-toolbar-popover-acoes">
              <button type="button" className="email-editor-toolbar-popover-botao-aplicar" onClick={inserirTabela}>
                Inserir
              </button>
            </div>
          </ToolbarPopover>
        )}
      </div>
    ),
    lista: (
      <div key="lista" className="email-editor-toolbar-item">
        <button
          ref={refLista}
          type="button"
          className={`email-editor-toolbar-botao ${painelAberto === 'lista' ? 'ativo' : ''}`}
          onClick={() => alternarPainel('lista')}
          disabled={!editor}
          title="Lista"
          aria-label="Lista"
          aria-haspopup="true"
          aria-expanded={painelAberto === 'lista'}
        >
          {IconeListaAtiva}
        </button>
        {painelAberto === 'lista' && (
          <ToolbarPopover
            anchorRef={refLista}
            onClose={() => setPainelAberto(null)}
            className="email-editor-toolbar-popover-grupo"
          >
            <PainelGrupoOpcoes
              opcoes={[
                {
                  id: 'naoOrdenada',
                  label: 'Lista não ordenada',
                  icone: <IconeListaNaoOrdenada />,
                  ativo: estado.listaNaoOrdenadaAtiva,
                  onClick: () => aplicarLista('naoOrdenada'),
                },
                {
                  id: 'ordenada',
                  label: 'Lista ordenada',
                  icone: <IconeListaOrdenada />,
                  ativo: estado.listaOrdenadaAtiva,
                  onClick: () => aplicarLista('ordenada'),
                },
              ]}
            />
          </ToolbarPopover>
        )}
      </div>
    ),
    alinhamento: (
      <div key="alinhamento" className="email-editor-toolbar-item">
        <button
          ref={refAlinhamento}
          type="button"
          className={`email-editor-toolbar-botao ${painelAberto === 'alinhamento' ? 'ativo' : ''}`}
          onClick={() => alternarPainel('alinhamento')}
          disabled={!editor}
          title="Alinhamento"
          aria-label="Alinhamento"
          aria-haspopup="true"
          aria-expanded={painelAberto === 'alinhamento'}
        >
          {IconeAlinhamentoAtivo}
        </button>
        {painelAberto === 'alinhamento' && (
          <ToolbarPopover
            anchorRef={refAlinhamento}
            onClose={() => setPainelAberto(null)}
            className="email-editor-toolbar-popover-grupo"
          >
            <PainelGrupoOpcoes
              opcoes={[
                {
                  id: 'esquerda',
                  label: 'Alinhar à esquerda',
                  icone: <IconeAlinharEsquerda />,
                  ativo: alinhamentoEsquerdaAtivo,
                  onClick: () => aplicarAlinhamento('left'),
                },
                {
                  id: 'centro',
                  label: 'Centralizar',
                  icone: <IconeAlinharCentro />,
                  ativo: estado.alinhamentoCentro,
                  onClick: () => aplicarAlinhamento('center'),
                },
                {
                  id: 'direita',
                  label: 'Alinhar à direita',
                  icone: <IconeAlinharDireita />,
                  ativo: estado.alinhamentoDireita,
                  onClick: () => aplicarAlinhamento('right'),
                },
                {
                  id: 'justificado',
                  label: 'Justificar',
                  icone: <IconeAlinharJustificado />,
                  ativo: estado.alinhamentoJustificado,
                  onClick: () => aplicarAlinhamento('justify'),
                },
              ]}
            />
          </ToolbarPopover>
        )}
      </div>
    ),
    recuo: (
      <div key="recuo" className="email-editor-toolbar-item">
        <button
          ref={refRecuo}
          type="button"
          className={`email-editor-toolbar-botao ${painelAberto === 'recuo' ? 'ativo' : ''}`}
          onClick={() => alternarPainel('recuo')}
          disabled={!editor}
          title="Recuo"
          aria-label="Recuo"
          aria-haspopup="true"
          aria-expanded={painelAberto === 'recuo'}
        >
          <IconeRecuoDireita />
        </button>
        {painelAberto === 'recuo' && (
          <ToolbarPopover
            anchorRef={refRecuo}
            onClose={() => setPainelAberto(null)}
            className="email-editor-toolbar-popover-grupo"
          >
            <PainelGrupoOpcoes
              opcoes={[
                {
                  id: 'diminuir',
                  label: 'Diminuir recuo',
                  icone: <IconeRecuoEsquerda />,
                  onClick: diminuirRecuo,
                },
                {
                  id: 'aumentar',
                  label: 'Aumentar recuo',
                  icone: <IconeRecuoDireita />,
                  onClick: aumentarRecuo,
                },
              ]}
            />
          </ToolbarPopover>
        )}
      </div>
    ),
    limparFormatacao: (
      <button
        key="limparFormatacao"
        ref={refLimparFormatacao}
        type="button"
        className="email-editor-toolbar-botao"
        onClick={limparFormatacao}
        disabled={!editor}
        title="Limpar formatação"
        aria-label="Limpar formatação"
      >
        <IconeRestaurar />
      </button>
    ),
  };

  // --- Montagem da faixa principal (Etapa 1/2) -----------------------------
  // Percorre `CLUSTERS` só para decidir onde entram os separadores
  // decorativos; a visibilidade de cada botão vem exclusivamente de
  // `ocultos`. Um separador só é desenhado entre dois clusters quando ambos
  // ainda têm pelo menos um botão visível — evita separador "sobrando" na
  // borda quando um cluster inteiro migrou para "Ver Mais".
  const nosFaixa: ReactNode[] = [];
  CLUSTERS.forEach((cluster, indice) => {
    const visiveisDoCluster = cluster.filter((id) => !ocultos.has(id));
    for (const id of visiveisDoCluster) nosFaixa.push(itens[id]);

    if (indice < CLUSTERS.length - 1) {
      const proximoClusterTemVisivel = CLUSTERS[indice + 1].some((id) => !ocultos.has(id));
      if (visiveisDoCluster.length > 0 && proximoClusterTemVisivel) {
        nosFaixa.push(<div key={`separador-${indice}`} className="email-editor-toolbar-separador" role="separator" />);
      }
    }
  });

  const nosOcultos = ITEM_IDS.filter((id) => ocultos.has(id)).map((id) => itens[id]);

  return (
    <>
      <div className="email-editor-toolbar" role="toolbar" aria-label="Formatação do corpo do e-mail" ref={toolbarRef}>
        {nosFaixa}

        {ocultos.size > 0 && (
          <div className="email-editor-toolbar-item email-editor-toolbar-item-vermais">
            <button
              ref={refVerMais}
              type="button"
              className={`email-editor-toolbar-botao ${verMaisAberto ? 'ativo' : ''}`}
              onClick={() => setVerMaisAberto((atual) => !atual)}
              title="Ver mais opções de formatação"
              aria-label="Ver mais opções de formatação"
              aria-haspopup="true"
              aria-expanded={verMaisAberto}
            >
              <IconeVerMais />
            </button>
            {verMaisAberto && (
              <ToolbarPopover
                anchorRef={refVerMais}
                onClose={() => setVerMaisAberto(false)}
                className="email-editor-toolbar-popover-vermais"
              >
                {nosOcultos}
              </ToolbarPopover>
            )}
          </div>
        )}
      </div>

      {/* Barra contextual de tabela (RefatoracaoTabela.md — Etapa 2): só
          existe no DOM com o cursor dentro de uma tabela (`estado.tabelaAtiva`,
          via `editor.isActive('table')`) — mesmo padrão de detecção de
          estado do resto da toolbar. Fica numa segunda faixa, abaixo da
          principal, no espírito de "painel condicional" descrito na seção 2
          do plano: não é mais um botão disputando espaço na faixa
          principal, então não participa de `ITEM_IDS`/"Ver Mais". Cada
          controle liga direto a um comando nativo da extensão de tabela
          (`addRowBefore/After`, `deleteRow`, `addColumnBefore/After`,
          `deleteColumn`, `deleteTable`, e desde a Etapa 3 também
          `mergeCells`, `splitCell`, `toggleHeaderRow`, `toggleHeaderColumn`)
          — nenhum deles calcula posição de linha/coluna manualmente, a
          própria extensão resolve isso a partir do cursor/seleção atual
          dentro da tabela. */}
      {estado.tabelaAtiva && (
        <div className="email-editor-toolbar-contextual" role="toolbar" aria-label="Formatação da tabela">
          <button
            type="button"
            className="email-editor-toolbar-botao"
            onClick={inserirLinhaAcima}
            disabled={!editor}
            title="Inserir linha acima"
            aria-label="Inserir linha acima"
          >
            <IconeInserirLinhaAcima />
          </button>
          <button
            type="button"
            className="email-editor-toolbar-botao"
            onClick={inserirLinhaAbaixo}
            disabled={!editor}
            title="Inserir linha abaixo"
            aria-label="Inserir linha abaixo"
          >
            <IconeInserirLinhaAbaixo />
          </button>
          <button
            type="button"
            className="email-editor-toolbar-botao"
            onClick={excluirLinha}
            disabled={!editor}
            title="Excluir linha"
            aria-label="Excluir linha"
          >
            <IconeExcluirLinha />
          </button>
          <div className="email-editor-toolbar-separador" role="separator" />
          <button
            type="button"
            className="email-editor-toolbar-botao"
            onClick={inserirColunaEsquerda}
            disabled={!editor}
            title="Inserir coluna à esquerda"
            aria-label="Inserir coluna à esquerda"
          >
            <IconeInserirColunaEsquerda />
          </button>
          <button
            type="button"
            className="email-editor-toolbar-botao"
            onClick={inserirColunaDireita}
            disabled={!editor}
            title="Inserir coluna à direita"
            aria-label="Inserir coluna à direita"
          >
            <IconeInserirColunaDireita />
          </button>
          <button
            type="button"
            className="email-editor-toolbar-botao"
            onClick={excluirColuna}
            disabled={!editor}
            title="Excluir coluna"
            aria-label="Excluir coluna"
          >
            <IconeExcluirColuna />
          </button>
          <div className="email-editor-toolbar-separador" role="separator" />
          {/* Mesclar/dividir e toggles de cabeçalho (RefatoracaoTabela.md —
              Etapa 3). */}
          <button
            type="button"
            className="email-editor-toolbar-botao"
            onClick={mesclarCelulas}
            disabled={!editor}
            title="Mesclar células"
            aria-label="Mesclar células"
          >
            <IconeMesclarCelulas />
          </button>
          <button
            type="button"
            className="email-editor-toolbar-botao"
            onClick={dividirCelula}
            disabled={!editor}
            title="Dividir célula"
            aria-label="Dividir célula"
          >
            <IconeDividirCelula />
          </button>
          <div className="email-editor-toolbar-separador" role="separator" />
          <button
            type="button"
            className={`email-editor-toolbar-botao ${estado.celulaCabecalhoAtiva ? 'ativo' : ''}`}
            onClick={alternarLinhaCabecalho}
            disabled={!editor}
            title="Linha de cabeçalho"
            aria-label="Alternar linha de cabeçalho"
            aria-pressed={estado.celulaCabecalhoAtiva}
          >
            <IconeAlternarLinhaCabecalho />
          </button>
          <button
            type="button"
            className={`email-editor-toolbar-botao ${estado.celulaCabecalhoAtiva ? 'ativo' : ''}`}
            onClick={alternarColunaCabecalho}
            disabled={!editor}
            title="Coluna de cabeçalho"
            aria-label="Alternar coluna de cabeçalho"
            aria-pressed={estado.celulaCabecalhoAtiva}
          >
            <IconeAlternarColunaCabecalho />
          </button>
          <div className="email-editor-toolbar-separador" role="separator" />
          {/* Cor da célula (RefatoracaoTabela.md — Etapa 4): mesmo padrão de
              "botão com popover de `SeletorCor`" já usado por cor do
              texto/realce na faixa principal, só que aplicando à seleção de
              células atual (`setCellAttribute`) em vez de a uma marca de
              texto — ver `aplicarCorCelula` e `editor/extensoes/CorCelula.ts`. */}
          <button
            type="button"
            ref={refCorCelula}
            className={`email-editor-toolbar-botao ${estado.corCelulaAtiva ? 'ativo' : ''}`}
            onClick={() => alternarPainel('corCelula')}
            disabled={!editor}
            title="Cor da célula"
            aria-label="Cor da célula"
            aria-haspopup="true"
            aria-expanded={painelAberto === 'corCelula'}
          >
            <IconeCorCelula />
            {estado.corCelulaAtiva && (
              <span className="email-editor-toolbar-indicador" style={{ backgroundColor: estado.corCelulaAtiva }} />
            )}
          </button>
          {painelAberto === 'corCelula' && (
            <ToolbarPopover
              anchorRef={refCorCelula}
              onClose={() => setPainelAberto(null)}
              className="email-editor-toolbar-popover-cores"
            >
              <SeletorCor
                corAtiva={estado.corCelulaAtiva}
                rotuloRemover="Remover cor"
                onEscolherAmostra={aplicarCorCelula}
                onAplicarHex={aplicarCorCelulaLivre}
                onRemover={removerCorCelula}
              />
            </ToolbarPopover>
          )}
          <div className="email-editor-toolbar-separador" role="separator" />
          {/* Altura da linha (RefatoracaoTabela.md — Etapa 5): campo direto
              na faixa, não atrás de um popover — o plano pede o campo
              "visível com o cursor em qualquer célula da linha", igual ao
              resto dos controles desta barra contextual. Largura de coluna
              (mesma etapa) não tem controle próprio aqui: já é nativa via
              `resizable: true` (arrastar a borda da coluna), confirmado
              visualmente ao concluir a etapa, sem UI adicional. */}
          <label className="email-editor-toolbar-contextual-campo-altura">
            <span>Altura</span>
            <input
              type="text"
              inputMode="numeric"
              value={campoAlturaLinha}
              onChange={(e) => setCampoAlturaLinha(e.target.value)}
              onFocus={() => {
                campoAlturaLinhaFocadoRef.current = true;
              }}
              onBlur={() => {
                campoAlturaLinhaFocadoRef.current = false;
                confirmarAlturaLinha();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              disabled={!editor}
              placeholder="Auto"
              aria-label="Altura da linha, em pixels"
            />
          </label>
          <div className="email-editor-toolbar-separador" role="separator" />
          {/* Borda da tabela (RefatoracaoTabela.md — Etapa 6): mesmo padrão
              de "botão com popover de `SeletorCor`" já usado por cor da
              célula, acima — ver `aplicarCorBorda` e
              `editor/extensoes/BordaLarguraTabela.ts`. */}
          <button
            type="button"
            ref={refCorBorda}
            className={`email-editor-toolbar-botao ${estado.corBordaAtiva ? 'ativo' : ''}`}
            onClick={() => alternarPainel('corBorda')}
            disabled={!editor}
            title="Cor da borda"
            aria-label="Cor da borda da tabela"
            aria-haspopup="true"
            aria-expanded={painelAberto === 'corBorda'}
          >
            <IconeBordaTabela />
            {estado.corBordaAtiva && (
              <span className="email-editor-toolbar-indicador" style={{ backgroundColor: estado.corBordaAtiva }} />
            )}
          </button>
          {painelAberto === 'corBorda' && (
            <ToolbarPopover
              anchorRef={refCorBorda}
              onClose={() => setPainelAberto(null)}
              className="email-editor-toolbar-popover-cores"
            >
              <SeletorCor
                corAtiva={estado.corBordaAtiva}
                rotuloRemover="Remover borda"
                onEscolherAmostra={aplicarCorBorda}
                onAplicarHex={aplicarCorBordaLivre}
                onRemover={removerCorBorda}
              />
            </ToolbarPopover>
          )}
          <label className="email-editor-toolbar-contextual-campo-altura">
            <span>Espessura</span>
            <input
              type="text"
              inputMode="numeric"
              value={campoEspessuraBorda}
              onChange={(e) => setCampoEspessuraBorda(e.target.value)}
              onFocus={() => {
                campoEspessuraBordaFocadoRef.current = true;
              }}
              onBlur={() => {
                campoEspessuraBordaFocadoRef.current = false;
                confirmarEspessuraBorda();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              disabled={!editor}
              placeholder="Auto"
              aria-label="Espessura da borda da tabela, em pixels"
            />
          </label>
          <div className="email-editor-toolbar-separador" role="separator" />
          {/* Largura da tabela (mesma Etapa 6): toggle "largura total"
              (100%) + campo de largura fixa em px — ver
              `alternarLarguraTotal`/`confirmarLarguraFixa`, acima. */}
          <button
            type="button"
            className={`email-editor-toolbar-botao ${estado.larguraTabelaAtiva === '100%' ? 'ativo' : ''}`}
            onClick={alternarLarguraTotal}
            disabled={!editor}
            title="Largura total"
            aria-label="Alternar largura total da tabela"
            aria-pressed={estado.larguraTabelaAtiva === '100%'}
          >
            <IconeLarguraTotalTabela />
          </button>
          <label className="email-editor-toolbar-contextual-campo-altura">
            <span>Largura</span>
            <input
              type="text"
              inputMode="numeric"
              value={campoLarguraFixa}
              onChange={(e) => setCampoLarguraFixa(e.target.value)}
              onFocus={() => {
                campoLarguraFixaFocadoRef.current = true;
              }}
              onBlur={() => {
                campoLarguraFixaFocadoRef.current = false;
                confirmarLarguraFixa();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              disabled={!editor}
              placeholder="Auto"
              aria-label="Largura fixa da tabela, em pixels"
            />
          </label>
          <div className="email-editor-toolbar-separador" role="separator" />
          {/* Duplicar célula (RefatoracaoTabela.md — Etapa 7): dois botões
              simples, sem popover — cada um lê conteúdo + `corFundo` da
              célula atual e escreve os dois na célula vizinha na direção
              escolhida, como uma transação única (ver `duplicarCelula`,
              acima). Sem alça de arraste estilo Excel, decisão já registrada
              na seção 2 do plano. */}
          <button
            type="button"
            className="email-editor-toolbar-botao"
            onClick={() => duplicarCelula('direita')}
            disabled={!editor}
            title="Duplicar célula para a direita"
            aria-label="Duplicar célula para a direita"
          >
            <IconeDuplicarParaDireita />
          </button>
          <button
            type="button"
            className="email-editor-toolbar-botao"
            onClick={() => duplicarCelula('baixo')}
            disabled={!editor}
            title="Duplicar célula para baixo"
            aria-label="Duplicar célula para baixo"
          >
            <IconeDuplicarParaBaixo />
          </button>
          <div className="email-editor-toolbar-separador" role="separator" />
          <button
            type="button"
            className="email-editor-toolbar-botao"
            onClick={excluirTabela}
            disabled={!editor}
            title="Excluir tabela"
            aria-label="Excluir tabela"
          >
            <IconeExcluirTabela />
          </button>
        </div>
      )}
    </>
  );
}