import { Routes, Route } from 'react-router-dom';
import { Home } from './pages/home';
import { Emails } from './pages/emails';
import { NotFound } from './pages/notFound';
import { Logs } from './pages/logs';
import { Login } from './pages/login';
import { PROJETOS } from './data/projetos';
import { Registro } from './pages/registro';

/**
 * Rotas geradas dinamicamente, uma por projeto descoberto em `PROJETOS`
 * (Etapa 3), no mesmo padrão do `CURSOS.flatMap(...)` do Multiverso (ver
 * refatoracaoMultiPaginas-v2.md, seção 3.2 / Etapa 4) — adaptado para um
 * único nível (projeto), sem a rota de redirecionamento que o Multiverso
 * precisa para o segundo nível (módulo).
 *
 * A rota fallback "*" cobre automaticamente qualquer slug que não bata com
 * nenhuma das rotas geradas acima (comportamento padrão do React Router),
 * sem precisar de lógica manual de "achei/não achei".
 *
 * Cada `<Route>` já resolve `slug` e `dados` a partir de `PROJETOS` e os
 * repassa como props para `Emails` (Etapa 5), que deixou de importar dado
 * fixo — mesmo papel que `App.tsx` + `CourseLesson` cumprem no Multiverso.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      {/*
       * Rota da tela de logs (Demanda 9 — LogsDeAlteracoes.md, Etapa 6):
       * fixa, fora do `PROJETOS.map` abaixo, já que não é uma página de
       * projeto — mesmo raciocínio de `path="/"` (Home) acima.
       */}
      <Route path="/logs" element={<Logs />} />
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      {PROJETOS.map((projeto) => (
        <Route
          key={projeto.slug}
          path={`/${projeto.slug}`}
          element={<Emails slug={projeto.slug} dados={projeto.dados} />}
        />
      ))}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}