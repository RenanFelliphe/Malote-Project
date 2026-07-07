import { Routes, Route } from 'react-router-dom';
import { ThemeToggle } from './components/ThemeToggle';
import { Emails } from './pages/emails';

export default function App() {
  return (
    <>
      <header className="app-shell-header">
        <div />
        <ThemeToggle />
      </header>
      <Routes>
        <Route path="/" element={<Emails />} />
        <Route path="*" element={<Emails />} />
      </Routes>
    </>
  );
}
