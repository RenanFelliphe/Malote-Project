import { Link } from 'react-router-dom';

import {
  IconeCheck,
  IconeConfirmarEnvio,
  IconeEditarEmail,
  IconeExportar,
  IconeLixeira,
  IconeLogs,
  IconePlanilha,
} from '../components/Icons';
import { Header } from '../components/Header';

/**
 * Landing page do projeto Malote — página de apresentação pública,
 * independente da Home operacional (`/`, que já assume um usuário
 * trabalhando com planilhas). Serve como porta de entrada para quem
 * ainda não conhece o sistema, explicando o que ele faz antes de
 * direcionar para `/login` ou `/registro`.
 *
 * Posicionamento central (corrigido após revisão): o Malote não é só
 * um organizador de listas de e-mail — o diferencial é o envio
 * automático, feito em intervalos definidos ao longo do tempo, para
 * reduzir o risco de bloqueio/spam por parte dos provedores.
 * Organização de status, edição de conteúdo, lixeira, exportação e
 * logs são a base que sustenta esse envio, não o produto em si.
 *
 * Link para esta página fica no rodapé (`Footer.tsx`, `app-footer-links`).
 */

/** Ícone local de "envio programado" (relógio + seta de envio) — não
 * existe em `Icons.tsx`, então é definido aqui, seguindo o mesmo padrão
 * já usado em `pages/home.tsx` para ícones exclusivos de uma página
 * (ver `IconeInformacao` em `home.tsx`). */
function IconeEnvioProgramado() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <circle cx="7" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 6.2V9l2.1 1.3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.8 1.6h4.6v4.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.4 1.6 9.7 5.9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Ícone local de "escudo/reputação" para a seção que explica por que
 * enviar em intervalos importa (proteção contra bloqueio por spam). */
function IconeEscudo() {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
      <path
        d="M8 1.5 13.5 3.4V7.6C13.5 11 11.1 13.6 8 14.5 4.9 13.6 2.5 11 2.5 7.6V3.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M5.6 8.1 7.3 9.8 10.5 6.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const RECURSOS = [
  {
    icone: IconeEnvioProgramado,
    titulo: 'Envio automático e programado',
    descricao:
      'Configure o intervalo entre disparos e deixe o Malote enviar sozinho, em lotes espaçados ao longo do tempo — sem clicar registro por registro.',
    destaque: true,
  },
  {
    icone: IconeEscudo,
    titulo: 'Feito para preservar sua reputação',
    descricao:
      'O espaçamento entre envios existe para reduzir o risco de bloqueio e marcação como spam pelos provedores — não é só uma opção, é o motivo do produto existir.',
    destaque: true,
  },
  {
    icone: IconePlanilha,
    titulo: 'Vários projetos, uma tela só',
    descricao:
      'Cada planilha de e-mails vira um projeto com sua própria página, descoberta automaticamente — sem configuração manual por turma ou campanha.',
  },
  {
    icone: IconeCheck,
    titulo: 'Status sempre confiável',
    descricao:
      'Válido, inválido, duplicado ou enviado: cada registro tem um status calculado com prioridade clara, sem retrabalho manual de conferência.',
  },
  {
    icone: IconeEditarEmail,
    titulo: 'Editor de e-mail completo',
    descricao:
      'Texto formatado, cores, links e botões de ação — escreva o conteúdo do disparo com um editor rico, pronto para ir para a fila de envio.',
  },
  {
    icone: IconeLixeira,
    titulo: 'Exclusão sem medo',
    descricao:
      'Projetos deletados vão para uma lixeira reversível por 30 dias, em vez de sumirem para sempre com um clique errado.',
  },
  {
    icone: IconeExportar,
    titulo: 'Exportação em lote',
    descricao:
      'Baixe uma ou várias planilhas de uma vez, em CSV, XLSX ou PDF — com várias planilhas, tudo sai organizado em um único .zip.',
  },
  {
    icone: IconeLogs,
    titulo: 'Histórico de alterações',
    descricao:
      'Toda mudança relevante fica registrada e consultável, com filtros e exportação — sem depender da memória de quem mexeu em quê.',
  },
];

const PORQUE_INTERVALOS = [
  {
    titulo: 'Provedores vigiam o ritmo',
    descricao:
      'Uma rajada de e-mails saindo de uma vez é o principal gatilho de filtros antispam — não importa o quão legítimo seja o conteúdo.',
  },
  {
    titulo: 'Intervalo é proteção, não enrolação',
    descricao:
      'Espaçar os disparos ao longo do tempo imita um padrão de envio humano e reduz a chance de a sua conta ou domínio ser sinalizado.',
  },
  {
    titulo: 'Você define o ritmo',
    descricao:
      'O tamanho do lote e o tempo entre eles ficam sob seu controle — o Malote só garante que o ritmo combinado seja respeitado do início ao fim.',
  },
];

const ETAPAS = [
  {
    numero: '01',
    titulo: 'Importe sua planilha',
    descricao: 'Envie um CSV ou XLSX com os contatos — o Malote identifica as colunas e monta o projeto.',
  },
  {
    numero: '02',
    titulo: 'Revise e organize',
    descricao: 'Acompanhe status, resolva duplicados e edite registros direto na tela, sem sair do navegador.',
  },
  {
    numero: '03',
    titulo: 'Escreva e defina o intervalo',
    descricao: 'Monte o conteúdo no editor e escolha de quanto em quanto tempo os lotes devem sair.',
  },
  {
    numero: '04',
    titulo: 'O Malote envia por você',
    descricao: 'Os disparos acontecem sozinhos, no ritmo definido, enquanto você acompanha o progresso e o histórico.',
  },
];

const PERGUNTAS = [
  {
    pergunta: 'Preciso ficar com o computador aberto durante o envio?',
    resposta: 'Não. Uma vez configurado o intervalo, o Malote controla o andamento do disparo por conta própria.',
  },
  {
    pergunta: 'Posso pausar um envio em andamento?',
    resposta: 'Sim — você acompanha o progresso do lote e pode interromper a qualquer momento antes do próximo disparo.',
  },
  {
    pergunta: 'O que acontece com quem já recebeu o e-mail?',
    resposta:
      'Cada registro muda para o status "enviado" assim que é disparado, então reenvios acidentais não acontecem mesmo que você reabra o projeto depois.',
  },
];

export function Sobre() {
  return (
    <>
    <Header></Header>
    <div className="sobre-page">
      <section className="sobre-hero">
        <span className="sobre-hero-etiqueta">
          <IconeEnvioProgramado />
          Envio automático e escalonado
        </span>
        <h1>Envie seus e-mails aos poucos, no seu ritmo — sem virar spam.</h1>
        <p className="sobre-hero-subtitulo">
          O Malote organiza suas listas de e-mail e, principalmente, cuida do envio: dispara os e-mails
          automaticamente em intervalos definidos por você, protegendo sua reputação de remetente em vez de
          disparar tudo de uma vez.
        </p>
        <div className="sobre-hero-acoes">
          <Link to="/registro" className="sobre-botao sobre-botao-primario">
            Criar conta
          </Link>
          <Link to="/login" className="sobre-botao sobre-botao-secundario">
            Já tenho conta
          </Link>
        </div>
      </section>

      <section className="sobre-porque">
        <h2>Por que enviar em intervalos</h2>
        <p className="sobre-secao-subtitulo">
          Enviar rápido nem sempre significa enviar bem. É por isso que o Malote foi construído em torno do
          ritmo do envio, não só da organização da lista.
        </p>
        <div className="sobre-porque-grid">
          {PORQUE_INTERVALOS.map((item) => (
            <div className="sobre-porque-item" key={item.titulo}>
              <h3>{item.titulo}</h3>
              <p>{item.descricao}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="sobre-recursos">
        <h2>O que o Malote resolve</h2>
        <div className="sobre-recursos-grid">
          {RECURSOS.map((recurso) => {
            const Icone = recurso.icone;
            return (
              <div
                className={`sobre-recurso-card${recurso.destaque ? ' sobre-recurso-card-destaque' : ''}`}
                key={recurso.titulo}
              >
                <div className="sobre-recurso-icone">
                  <Icone />
                </div>
                <h3>{recurso.titulo}</h3>
                <p>{recurso.descricao}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="sobre-como-funciona">
        <h2>Como funciona</h2>
        <div className="sobre-etapas">
          {ETAPAS.map((etapa) => (
            <div className="sobre-etapa" key={etapa.numero}>
              <span className="sobre-etapa-numero">{etapa.numero}</span>
              <h3>{etapa.titulo}</h3>
              <p>{etapa.descricao}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="sobre-faq">
        <h2>Perguntas frequentes</h2>
        <div className="sobre-faq-lista">
          {PERGUNTAS.map((item) => (
            <div className="sobre-faq-item" key={item.pergunta}>
              <h3>{item.pergunta}</h3>
              <p>{item.resposta}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="sobre-cta-final">
        <IconeConfirmarEnvio />
        <h2>Pronto para enviar sem se preocupar em virar spam?</h2>
        <Link to="/registro" className="sobre-botao sobre-botao-primario">
          Começar agora
        </Link>
      </section>
    </div>
    </>
  );
}
