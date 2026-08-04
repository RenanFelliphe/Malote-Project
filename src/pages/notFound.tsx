import { Link } from 'react-router-dom';

import { Header } from '../components/Header';

/**
 * Página exibida quando a URL não corresponde a nenhum projeto conhecido.
 *
 * É o destino da rota fallback "*" em `App.tsx` (Etapa 4 do plano de
 * refatoração multi-página): como as rotas de projeto são geradas
 * dinamicamente a partir de `PROJETOS` (uma por slug encontrado em
 * `data/`), qualquer slug que não bata com nenhuma delas cai aqui — sem
 * precisar de lógica manual de "achei/não achei" (comportamento padrão do
 * React Router quando nenhuma rota gerada corresponde à URL).
 *
 * Inspirada no `NotFoundCourse.tsx` do Multiverso (ver
 * refatoracaoMultiPaginas-v2.md, seção 2.7 e Etapa 6): mensagem simples +
 * link de volta para a Home.
 */
export function NotFound() {
  return (
    <>
      <Header />
      <div className="home-page">
        <div className="home-page-header">
          <div className="home-page-header-titulo">
            <h1>Projeto não encontrado</h1>
            <p className="home-page-header-subtitulo">
              Não encontramos nenhum projeto com esse endereço.
            </p>
          </div>
        </div>

        <div className="home-page-acoes">
          <Link to="/" className="botao-importar-planilha">
            Voltar para a Home
          </Link>
        </div>
      </div>
    </>
  );
}
