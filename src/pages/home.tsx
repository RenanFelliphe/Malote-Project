import { Link } from 'react-router-dom';

import { ThemeToggle } from '../components/ThemeToggle';
import { IconeImportar, IconePlanilha } from '../components/Icons';

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
  return (
    <div className="home-page">
      <div className="home-page-header">
        <div className="home-page-header-titulo">
          <h1>Minhas planilhas</h1>
          <p className="home-page-header-subtitulo">
            Importe e acesse suas planilhas processadas.
          </p>
        </div>
        <ThemeToggle />
      </div>

      <div className="home-page-acoes">
        <button type="button" className="botao-importar-planilha">
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
    </div>
  );
}
