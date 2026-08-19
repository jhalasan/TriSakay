import React from 'react';
import ReactDOM from 'react-dom/client';
// Must run before `./App` — App's subgraph (Login/AppShell) reaches
// useSessionStore.ts, which calls getSupabaseClient() synchronously at
// module-eval time. If that runs before initSupabase() below, it throws
// "Supabase client not initialized" and the app never renders.
import './lib/supabase';
import App from './App';
import 'leaflet/dist/leaflet.css';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
