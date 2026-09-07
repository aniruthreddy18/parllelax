import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ParallaxPage } from './pages/Parallax/ParallaxPage';

/**
 * Parallax is a single-purpose app: a landing hero over a rotating globe that
 * scrolls into the fire-detection view. There is no app chrome — the page owns
 * its own header — and every other path redirects home.
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ParallaxPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
