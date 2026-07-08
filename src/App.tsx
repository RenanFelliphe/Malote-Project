import { Routes, Route } from 'react-router-dom';
import { Home } from './pages/home';
import { Emails } from './pages/emails';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/emails" element={<Emails />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
