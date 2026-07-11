import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AdminApp from './App'
import { Storefront } from './store/Storefront'
import './index.css'

// `/admin/*` → ERP interne (DTS Operation, derrière login)
// tout le reste → vitrine publique Depart Travel Services
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/*" element={<Storefront />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
