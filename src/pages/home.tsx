import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Header } from '../components/Header';
import { IconeImportar, IconePlanilha } from '../components/Icons';
import { ImportWizardModal } from '../components/import/ImportWizardModal';

/**
 * Representa uma planilha já importada, renderizada como um card na Home.
 *
 * Por enquanto é uma lista estática com um único item apontando para o
 * componente de e-mails atual (`/emails`). Quando `email.tsx` virar um
 * template genérico, cada card passará a vir de dados reais (planilhas
 * importadas pelo usuário) e ganhará ações de editar/deletar/organizar.
 */
interface PlanilhaCard {
  id: string;
  titulo: string;
  descricao: string;
  rota: string;
}

const planilhas: PlanilhaCard[] = [
  {
    id: 'sistema-emails',
    titulo: 'Sistema de E-mails',
    descricao: 'Organize, valide e envie sua base de contatos.',
    rota: '/emails',
  },
];

export function Home() {
  const inputArquivoRef = useRef<HTMLInputElement | null>(null);
  // Arquivo selecionado no explorador do SO — sua presença é o que
  // controla a exibição do assistente de importação (ImportWizardModal).
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);

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

        <div className="grid-cards-paginas">
          {planilhas.map((planilha) => (
            <Link key={planilha.id} to={planilha.rota} className="card-pagina">
              <span className="card-pagina-icone">
                <IconePlanilha />
              </span>
              <span className="card-pagina-titulo">{planilha.titulo}</span>
              <span className="card-pagina-descricao">{planilha.descricao}</span>
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
