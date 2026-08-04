import { useEditorState, type Editor } from '@tiptap/react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { HsvColorPicker, type HsvColor } from 'react-colorful';

import { ToolbarPopover } from './editor/ToolbarPopover';
import { useToolbarOverflow } from './editor/useToolbarOverflow';
import {
  IconeAlinharCentro,
  IconeAlinharDireita,
  IconeAlinharEsquerda,
  IconeAlinharJustificado,
  IconeBotaoEmail,
  IconeCorTexto,
  IconeFonteAumentar,
  IconeFonteDiminuir,
  IconeItalico,
  IconeLink,
  IconeLinhaHorizontal,
  IconeListaNaoOrdenada,
  IconeListaOrdenada,
  IconeNegrito,
  IconeRealce,
  IconeRecuoDireita,
  IconeRecuoEsquerda,
  IconeRestaurar,
  IconeSublinhado,
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
  ['tamanhoFonte', 'cor', 'realce', 'link', 'botao', 'linhaHorizontal'],
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
 *
 * `perigo` (RefatoracaoTabelaToolbar.md — Etapa 1): flag opcional por opção
 * para ações destrutivas dentro de um grupo (ex.: "Excluir tabela" dentro do
 * grupo "Excluir" da barra contextual de tabela) — aplica a mesma cor de
 * perigo já usada em `.email-editor-toolbar-popover-remover:hover` no
 * hover/foco da opção, sem exigir um componente à parte só para essa opção.
 */
function PainelGrupoOpcoes({
  opcoes,
}: {
  opcoes: {
    id: string;
    label: string;
    icone: ReactNode;
    ativo?: boolean;
    perigo?: boolean;
    onClick: () => void;
  }[];
}) {
  return (
    <div className="email-editor-toolbar-popover-grupo">
      {opcoes.map((opcao) => (
        <button
          key={opcao.id}
          type="button"
          className={`email-editor-toolbar-botao ${opcao.ativo ? 'ativo' : ''} ${opcao.perigo ? 'perigo' : ''}`}
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
  const refLista = useRef<HTMLButtonElement>(null);
  const refAlinhamento = useRef<HTMLButtonElement>(null);
  const refRecuo = useRef<HTMLButtonElement>(null);
  const refLimparFormatacao = useRef<HTMLButtonElement>(null);
  const refVerMais = useRef<HTMLButtonElement>(null);

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
  // Algoritmo extraído para `useToolbarOverflow` (RefatoracaoTabelaToolbar.md
  // — Etapa 1) para ser reaproveitado pela barra contextual de tabela, mais
  // abaixo — nenhuma mudança de comportamento aqui, só a mesma lógica
  // chamada como hook em vez de inline.

  const toolbarRef = useRef<HTMLDivElement>(null);

  const { ocultos } = useToolbarOverflow({
    itemIds: ITEM_IDS,
    ordemOcultacao: ORDEM_OCULTACAO,
    quantidadeClusters: CLUSTERS.length,
    refs: REFS,
    containerRef: toolbarRef,
    larguraSeparadorPx: LARGURA_SEPARADOR_PX,
  });

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
  );
}