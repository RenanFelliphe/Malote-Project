import { FiArrowRight, FiLock, FiMail } from 'react-icons/fi';
import { Link } from 'react-router-dom';

import { Header } from '../components/Header';

export function Login() {
  return (
    <>
      <Header />
      <main className="auth-page">
        <section className="auth-showcase" aria-label="Sobre o Malote">
          <span className="auth-eyebrow">Área segura</span>
          <h1>Suas planilhas, no lugar certo.</h1>
          <p>
            Organize projetos, acompanhe registros e mantenha suas informações prontas para o próximo envio.
          </p>
          <div className="auth-showcase-linha" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>

        <section className="auth-card" aria-labelledby="login-titulo">
          <div className="auth-card-cabecalho">
            <span className="auth-card-kicker">Bem-vindo de volta</span>
            <h2 id="login-titulo">Entrar no Malote</h2>
            <p>Acesse sua área de trabalho para continuar.</p>
          </div>

          <form className="auth-form" onSubmit={(evento) => evento.preventDefault()}>
            <label className="auth-campo">
              <span>E-mail</span>
              <span className="auth-input-wrapper">
                <FiMail aria-hidden="true" />
                <input type="email" placeholder="voce@empresa.com" autoComplete="email" />
              </span>
            </label>

            <label className="auth-campo">
              <span>Senha</span>
              <span className="auth-input-wrapper">
                <FiLock aria-hidden="true" />
                <input type="password" placeholder="Digite sua senha" autoComplete="current-password" />
              </span>
            </label>

            <button type="submit" className="auth-botao-principal">
              Entrar
              <FiArrowRight aria-hidden="true" />
            </button>
          </form>

          <p className="auth-troca-pagina">
            Ainda não tem uma conta? <Link to="/registro">Criar conta</Link>
          </p>
        </section>
      </main>
    </>
  );
}