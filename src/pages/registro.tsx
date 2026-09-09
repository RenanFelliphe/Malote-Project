import { FiArrowRight, FiLock, FiMail, FiUser } from 'react-icons/fi';
import { Link } from 'react-router-dom';

import { Header } from '../components/Header';

export function Registro() {
  return (
    <>
      <Header />
      <main className="auth-page">
        <section className="auth-showcase" aria-label="Sobre o Malote">
          <span className="auth-eyebrow">Comece agora</span>
          <h1>Um espaço simples para organizar o trabalho.</h1>
          <p>
            Crie seu acesso e prepare uma rotina mais clara para suas planilhas e projetos.
          </p>
          <div className="auth-showcase-linha" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>

        <section className="auth-card" aria-labelledby="registro-titulo">
          <div className="auth-card-cabecalho">
            <span className="auth-card-kicker">Novo espaço de trabalho</span>
            <h2 id="registro-titulo">Criar sua conta</h2>
            <p>Preencha seus dados para começar a usar o Malote.</p>
          </div>

          <form className="auth-form" onSubmit={(evento) => evento.preventDefault()}>
            <label className="auth-campo">
              <span>Nome completo</span>
              <span className="auth-input-wrapper">
                <FiUser aria-hidden="true" />
                <input type="text" placeholder="Seu nome" autoComplete="name" />
              </span>
            </label>

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
                <input type="password" placeholder="Crie uma senha" autoComplete="new-password" />
              </span>
            </label>

            <button type="submit" className="auth-botao-principal">
              Criar conta
              <FiArrowRight aria-hidden="true" />
            </button>
          </form>

          <p className="auth-troca-pagina">
            Já tem uma conta? <Link to="/login">Entrar</Link>
          </p>
        </section>
      </main>
    </>
  );
}