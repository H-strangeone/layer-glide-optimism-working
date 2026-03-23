import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initLenis } from './lib/lenis'

// Boot smooth scroll
initLenis();

createRoot(document.getElementById("root")!).render(<App />);

