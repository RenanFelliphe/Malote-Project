import { FaGithub, FaInstagram, FaLinkedinIn } from 'react-icons/fa';
import { FiGlobe } from 'react-icons/fi';
import { Link } from 'react-router-dom';

export function Footer() {
    return (
        <footer className="app-footer">
            <div className="app-footer-conteudo">
                <div className="app-footer-principal">
                    <Link to="/" className="app-footer-marca">
                        <span className="app-footer-marca-ponto" aria-hidden="true" />
                        Malote
                    </Link>

                    <nav className="app-footer-links" aria-label="Navegação do rodapé">
                        <Link to="/">Início</Link>
                        <Link to="/sobre">Sobre o Malote</Link>
                        <Link to="/logs">Logs</Link>
                        <Link to="/login">Entrar</Link>
                        <Link to="/registro">Criar conta</Link>
                    </nav>

                    <nav className="app-footer-redes" aria-label="Redes e portfólio do desenvolvedor">
                        <Link to="https://www.linkedin.com/" target="_blank" rel="noreferrer" aria-label="LinkedIn" title="LinkedIn">
                            <FaLinkedinIn aria-hidden="true" />
                        </Link>
                        <Link to="/instagram" target="_blank" rel="noreferrer" aria-label="Instagram" title="Instagram">
                            <FaInstagram aria-hidden="true" />
                        </Link>
                        <Link to="/portfolio" aria-label="Portfólio" title="Portfólio">
                            <FiGlobe aria-hidden="true" />
                        </Link>
                        <Link to="/github" target="_blank" rel="noreferrer" aria-label="GitHub" title="GitHub">
                            <FaGithub aria-hidden="true" />
                        </Link>
                    </nav>
                </div>

                <div className="app-footer-base">
                    <span className="app-footer-desenvolvido">
                        Desenvolvido por <strong>Renan Felliphe de Moura Diogo Silva</strong>
                    </span>
                    <span className="app-footer-copyright">© {new Date().getFullYear()} Malote</span>
                </div>
            </div>
        </footer>
    );
}