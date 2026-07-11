import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { setSeo } from './seo'

export function PaymentOk() {
  useEffect(() => { setSeo({ title: 'Paiement confirmé — Depart Travel Services' }) }, [])
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <div className="text-6xl">🎉</div>
      <h1 className="mt-4 font-display text-3xl font-extrabold text-ink-900">Paiement confirmé !</h1>
      <p className="mt-3 text-ink-700/70">
        Merci, votre réservation est confirmée. Vous recevez un email récapitulatif.
        Notre équipe vous contacte pour les derniers détails.
      </p>
      <Link to="/" className="btn-primary mt-6">Retour à l'accueil</Link>
    </div>
  )
}

export function PaymentCancel() {
  useEffect(() => { setSeo({ title: 'Paiement annulé — Depart Travel Services' }) }, [])
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <div className="text-6xl">🙁</div>
      <h1 className="mt-4 font-display text-3xl font-extrabold text-ink-900">Paiement annulé</h1>
      <p className="mt-3 text-ink-700/70">
        Aucun montant n'a été débité. Votre réservation reste enregistrée : vous pouvez
        payer plus tard ou nous contacter.
      </p>
      <Link to="/" className="btn-primary mt-6">Retour à l'accueil</Link>
    </div>
  )
}
