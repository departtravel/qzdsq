import { useState } from 'react'
import { createConversation } from './data'

// Widget de contact flottant présent sur toute la vitrine.
export function ContactWidget() {
  const [open, setOpen] = useState(false)
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [tel, setTel] = useState('')
  const [message, setMessage] = useState('')
  const [state, setState] = useState<'form' | 'sending' | 'done'>('form')
  const [err, setErr] = useState('')

  const submit = async () => {
    if (!nom || !email || !message) { setErr('Nom, email et message sont requis.'); return }
    setState('sending'); setErr('')
    const res = await createConversation({
      client_nom: nom, client_email: email, client_telephone: tel,
      sujet: 'Message depuis le site', excursion_id: null, message,
    })
    if ('error' in res) { setErr(res.error); setState('form') }
    else setState('done')
  }

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-2xl text-white shadow-lg hover:bg-amber-600"
        aria-label="Nous contacter"
      >
        {open ? '✕' : '💬'}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-40 w-[92vw] max-w-sm rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="rounded-t-xl bg-amber-500 px-4 py-3 text-white">
            <div className="font-semibold">Une question ?</div>
            <div className="text-xs text-white/90">On vous répond rapidement</div>
          </div>

          <div className="p-4">
            {state === 'done' ? (
              <div className="text-center">
                <div className="text-3xl">✅</div>
                <p className="mt-2 text-sm text-slate-600">
                  Merci ! Votre message est bien arrivé. Nous vous répondons par email très vite.
                </p>
                <button onClick={() => { setOpen(false); setState('form'); setMessage('') }}
                  className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white">Fermer</button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <input className={c} placeholder="Nom *" value={nom} onChange={(e) => setNom(e.target.value)} />
                  <input className={c} type="email" placeholder="Email *" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <input className={c} placeholder="Téléphone / WhatsApp" value={tel} onChange={(e) => setTel(e.target.value)} />
                  <textarea className={c} rows={3} placeholder="Votre message *" value={message} onChange={(e) => setMessage(e.target.value)} />
                </div>
                {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
                <button onClick={submit} disabled={state === 'sending'}
                  className="mt-3 w-full rounded-lg bg-amber-500 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
                  {state === 'sending' ? 'Envoi…' : 'Envoyer'}
                </button>
                <a href="https://wa.me/" target="_blank" rel="noreferrer"
                  className="mt-2 block text-center text-xs text-green-600">ou nous écrire sur WhatsApp →</a>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

const c = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm'
