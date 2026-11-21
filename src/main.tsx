import { applyStoredTheme } from './theme/themes';
import { initMicroInteractions } from './theme/micro';
import React from 'react';
import ReactDOM from 'react-dom/client';
// Fonts are bundled so the app looks right fully offline: Plus Jakarta Sans (interface), Hind Siliguri (Bangla),
// Newsreader italic (Latin remedy names) — the same three as the design canvas and the mobile app.
import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-800.css';
import '@fontsource/hind-siliguri/bengali-400.css';
import '@fontsource/hind-siliguri/bengali-500.css';
import '@fontsource/hind-siliguri/bengali-600.css';
import '@fontsource/hind-siliguri/bengali-700.css';
import '@fontsource/newsreader/latin-500-italic.css';
import '@fontsource/newsreader/latin-600-italic.css';
import App from './App';
import './index.css';

applyStoredTheme();                             // colours first, so the very first paint already has the chosen theme
initMicroInteractions();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
