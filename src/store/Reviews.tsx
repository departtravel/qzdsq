import { useEffect, useState } from 'react'
import { fetchReviews, createReview, type Review } from './data'
import { Stars } from './HomePage'

export function ReviewsSection({ excursionId }: { excursionId: string }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => { fetchReviews(excursionId).then(setReviews) }, [excursionId])

  const moyenne = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.note, 0) / reviews.length) * 10) / 10
    : null

  return (
    <section className="mt-8 border-t border-ink-100 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-extrabold text-ink-900">
          Avis clients {reviews.length > 0 && <span className="text-ink-700/50">({reviews.length})</span>}
        </h2>
        <button onClick={() => setOpen(true)} className="btn-ghost !px-4 !py-2 text-sm">Laisser un avis</button>
      </div>

      {moyenne != null && (
        <div className="mb-4 flex items-center gap-2"><Stars note={moyenne} avis={reviews.length} /></div>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-ink-700/60">Soyez le premier à partager votre expérience.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {reviews.map((r) => (
            <div key={r.id} className="card p-4">
              <Stars note={r.note} />
              {r.commentaire && <p className="mt-2 text-sm text-ink-700/80">“{r.commentaire}”</p>}
              <div className="mt-2 text-sm font-semibold text-ink-900">
                {r.client_nom}{r.pays && <span className="font-normal text-ink-700/60"> · {r.pays}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && <ReviewForm excursionId={excursionId} onClose={() => setOpen(false)} />}
    </section>
  )
}

function ReviewForm({ excursionId, onClose }: { excursionId: string; onClose: () => void }) {
  const [nom, setNom] = useState('')
  const [pays, setPays] = useState('')
  const [note, setNote] = useState(5)
  const [commentaire, setCommentaire] = useState('')
  const [state, setState] = useState<'form' | 'sending' | 'done'>('form')
  const [err, setErr] = useState('')

  const submit = async () => {
    if (!nom) { setErr('Votre nom est requis.'); return }
    setState('sending'); setErr('')
    const res = await createReview({ excursion_id: excursionId, client_nom: nom, pays: pays || null, note, commentaire: commentaire || null })
    if ('error' in res) { setErr(res.error); setState('form') }
    else setState('done')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lift" onClick={(e) => e.stopPropagation()}>
        {state === 'done' ? (
          <div className="text-center">
            <div className="text-4xl">🙏</div>
            <h3 className="mt-2 font-display text-lg font-bold">Merci pour votre avis !</h3>
            <p className="mt-1 text-sm text-ink-700/60">Il sera publié après validation par notre équipe.</p>
            <button onClick={onClose} className="btn-primary mt-4">Fermer</button>
          </div>
        ) : (
          <>
            <h3 className="font-display text-lg font-bold text-ink-900">Votre avis</h3>
            <div className="mt-3 flex gap-1 text-2xl">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setNote(n)} className={n <= note ? 'text-gold' : 'text-ink-100'}>★</button>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              <input className={inp} placeholder="Votre nom *" value={nom} onChange={(e) => setNom(e.target.value)} />
              <input className={inp} placeholder="Pays (optionnel)" value={pays} onChange={(e) => setPays(e.target.value)} />
              <textarea className={inp} rows={3} placeholder="Votre expérience…" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
            </div>
            {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={onClose} className="btn-ghost flex-1 !py-2">Annuler</button>
              <button onClick={submit} disabled={state === 'sending'} className="btn-primary flex-[2] !py-2">
                {state === 'sending' ? 'Envoi…' : 'Publier mon avis'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const inp = 'w-full rounded-lg border border-ink-100 px-3 py-2 text-sm'
