import { Routes, Route } from 'react-router-dom';
import { Emails } from './pages/emails';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Emails />} />
      <Route path="*" element={<Emails />} />
    </Routes>
  );
}
