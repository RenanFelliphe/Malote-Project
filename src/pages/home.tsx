import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Header } from '../components/Header';
import { OrdenacaoPrioridade } from '../components/OrdenacaoPrioridade';
import { IconeImportar, IconePlanilha } from '../components/Icons';
import { ImportWizardModal } from '../components/import/ImportWizardModal';
import { PROJETOS } from '../data/projetos';
import {
  CRITERIO_ORDENACAO_HOME_LABELS,
  ORDENACAO_HOME_PADRAO,
  ordenarProjetos,
  type TOrdenacaoHome,
} from './utils/HomeOrdenacao';

export function Home() {
  const inputArquivoRef = useRef<HTMLInputElement | null>(null);
  // Arquivo selecionado no explorador do SO — sua presença é o que
  // controla a exibição do assistente de importação (ImportWizardModal).
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  // Hierarquia de ordenação dos cards de projeto (Etapa 7, seção 3.5) —
  // padrão: alfabética primeiro, conforme ORDENACAO_HOME_PADRAO.
  const [ordenacao, setOrdenacao] = useState<TOrdenacaoHome>(ORDENACAO_HOME_PADRAO);

  const projetosOrdenados = ordenarProjetos(PROJETOS, ordenacao);

  function abrirSeletorDeArquivo() {
    inputArquivoRef.current?.click();
  }

  function handleArquivoEscolhido(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0] ?? null;
    setArquivoSelecionado(arquivo);
    // Permite selecionar o mesmo arquivo novamente em seguida (ex.: depois
    // de cancelar uma importação), já que o evento "change" só dispara de
    // novo se o valor do input for resetado.
    evento.target.value = '';
  }

  function fecharAssistenteImportacao() {
    setArquivoSelecionado(null);
  }

  return (
    <>
      <Header />

      <div className="home-page">
        <div className="home-page-header">
          <div className="home-page-header-titulo">
            <h1>Minhas planilhas</h1>
            <p className="home-page-header-subtitulo">
              Importe e acesse suas planilhas processadas.
            </p>
          </div>
        </div>

        <div className="home-page-acoes">
          <input
            ref={inputArquivoRef}
            type="file"
            accept=".csv,.xlsx"
            className="input-arquivo-escondido"
            onChange={handleArquivoEscolhido}
          />
          <button type="button" className="botao-importar-planilha" onClick={abrirSeletorDeArquivo}>
            <IconeImportar />
            Importar planilha
          </button>
        </div>

        {projetosOrdenados.length > 0 && (
          <div className="ordenacao">
            <span className="ordenacao-rotulo">Ordenar por:</span>
            <OrdenacaoPrioridade
              ordenacao={ordenacao}
              labels={CRITERIO_ORDENACAO_HOME_LABELS}
              onOrdenacaoChange={setOrdenacao}
            />
          </div>
        )}

        <div className="grid-cards-paginas">
          {projetosOrdenados.map((projeto) => (
            <Link key={projeto.slug} to={`/${projeto.slug}`} className="card-pagina">
              <span className="card-pagina-icone">
                <IconePlanilha />
              </span>
              <span className="card-pagina-titulo">{projeto.dados.projeto}</span>
            </Link>
          ))}
        </div>

        {arquivoSelecionado && (
          <ImportWizardModal arquivo={arquivoSelecionado} onFechar={fecharAssistenteImportacao} />
        )}
      </div>
    </>
  );
}