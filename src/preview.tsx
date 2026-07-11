import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { Storefront } from './store/Storefront'
import './index.css'

// Entrée « aperçu » : uniquement la vitrine publique, routage par hash,
// en mode démo (Supabase non configuré). Sert à générer un fichier autonome.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <Storefront />
    </HashRouter>
  </React.StrictMode>,
)
