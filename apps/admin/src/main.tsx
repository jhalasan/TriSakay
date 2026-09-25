import React from 'react';
import ReactDOM from 'react-dom/client';
import { APIProvider } from '@vis.gl/react-google-maps';
// Must run before `./App` — App's subgraph (Login/AppShell) reaches
// useSessionStore.ts, which calls getSupabaseClient() synchronously at
// module-eval time. If that runs before initSupabase() below, it throws
// "Supabase client not initialized" and the app never renders.
import './lib/supabase';
import App from './App';
import './styles/globals.css';

// G2 (Google Maps): one APIProvider for the whole app, not one per map
// component — @vis.gl/react-google-maps' own docs warn against loading the
// Maps JS script more than once. LiveMap and AlertLocationMap both read this
// shared context. The key is restricted (HTTP referrer = this domain) in
// Google Cloud, so shipping it in the client bundle is expected, not a leak
// — see docs/UAT_PANELIST_REVIEW_ADRALES.md, "## G2: full Google stack".
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_WEB_API_KEY ?? ''}>
      <App />
    </APIProvider>
  </React.StrictMode>,
);
