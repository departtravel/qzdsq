import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom'
import AdminApp from './App'
import { Storefront } from './store/Storefront'
import './index.css'

// En mode aperçu (build single-page), on route par hash pour fonctionner
// sans serveur (fichier HTML autonome). Sinon BrowserRouter (URLs propres).
const Router = import.meta.env.VITE_PREVIEW ? HashRouter : BrowserRouter

// `/admin/*` → ERP interne (DTS Operation, derrière login)
// tout le reste → vitrine publique Depart Travel Services
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/*" element={<Storefront />} />
      </Routes>
    </Router>
  </React.StrictMode>,
)
