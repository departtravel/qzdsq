// Visuel de couverture d'un produit.
// - Si une URL d'image est fournie → vraie photo.
// - Sinon → scène vectorielle premium choisie selon le thème (pas d'emoji).

type Scene = 'desert' | 'sea' | 'medina' | 'oasis'

const PALETTES: Record<Scene, { sky: [string, string]; sun: string; land: string[] }> = {
  desert: { sky: ['#ffd7a1', '#f8853c'], sun: '#fff2d6', land: ['#e6480c', '#bf340c', '#7a2612'] },
  sea:    { sky: ['#bfe9ff', '#3aa8e0'], sun: '#fffbe6', land: ['#0d9488', '#0f766e', '#115e59'] },
  medina: { sky: ['#f3e2ff', '#9b6dd6'], sun: '#fff0f6', land: ['#7c4dbf', '#5b3a94', '#3d2765'] },
  oasis:  { sky: ['#e8f6c8', '#8fce4b'], sun: '#fffbe0', land: ['#4d9e3a', '#2f7d2a', '#1f5a20'] },
}

function pickScene(seed: string, categorie?: string | null): Scene {
  const s = `${categorie ?? ''} ${seed}`.toLowerCase()
  if (/mer|plage|sea|beach|île|djerba|kerkennah/.test(s)) return 'sea'
  if (/médina|medina|kairouan|culture|ville|city|carthage|tunis/.test(s)) return 'medina'
  if (/oasis|tozeur|chebika|palm|montagne|gorge/.test(s)) return 'oasis'
  if (/désert|desert|sahara|dune|ksar|douz|4x4|chameau|camel/.test(s)) return 'desert'
  // Répartition stable par hash pour varier les cartes sans photo.
  const h = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % 4
  return (['desert', 'sea', 'medina', 'oasis'] as Scene[])[h]
}

export function Cover({
  imageUrl, seed, categorie, className = '', rounded = 'rounded-none',
}: {
  imageUrl?: string | null
  seed: string
  categorie?: string | null
  className?: string
  rounded?: string
}) {
  if (imageUrl)
    return (
      <div className={`relative overflow-hidden ${rounded} ${className}`}>
        <img src={imageUrl} alt={seed} loading="lazy" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/25 to-transparent" />
      </div>
    )

  const scene = pickScene(seed, categorie)
  const p = PALETTES[scene]
  const gid = `sky-${scene}-${Math.abs([...seed].reduce((a, c) => a + c.charCodeAt(0), 0))}`
  return (
    <div className={`relative overflow-hidden ${rounded} ${className}`}>
      <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.sky[0]} />
            <stop offset="100%" stopColor={p.sky[1]} />
          </linearGradient>
        </defs>
        <rect width="400" height="260" fill={`url(#${gid})`} />
        <circle cx="310" cy="70" r="34" fill={p.sun} opacity="0.9" />

        {scene === 'desert' && <>
          <path d="M0 200 Q100 150 200 185 T400 175 V260 H0 Z" fill={p.land[0]} />
          <path d="M0 225 Q120 180 240 215 T400 205 V260 H0 Z" fill={p.land[1]} />
          <path d="M0 250 Q140 225 280 245 T400 240 V260 H0 Z" fill={p.land[2]} />
        </>}
        {scene === 'sea' && <>
          <path d="M0 190 Q100 175 200 190 T400 190 V260 H0 Z" fill={p.land[0]} opacity="0.55" />
          <path d="M0 215 Q100 200 200 215 T400 215 V260 H0 Z" fill={p.land[1]} opacity="0.7" />
          <path d="M0 240 Q100 228 200 240 T400 240 V260 H0 Z" fill={p.land[2]} />
        </>}
        {scene === 'medina' && <>
          <g fill={p.land[0]}>
            <rect x="40" y="150" width="60" height="110" /><rect x="120" y="130" width="70" height="130" />
            <rect x="210" y="160" width="55" height="100" /><rect x="285" y="140" width="75" height="120" />
          </g>
          <g fill={p.land[1]}>
            <path d="M120 130 q35 -45 70 0 Z" /><path d="M285 140 q37 -42 75 0 Z" />
            <circle cx="70" cy="150" r="30" /><circle cx="237" cy="160" r="28" />
          </g>
          <rect x="0" y="248" width="400" height="12" fill={p.land[2]} />
        </>}
        {scene === 'oasis' && <>
          <path d="M0 210 Q100 195 200 210 T400 210 V260 H0 Z" fill={p.land[1]} />
          <g stroke={p.land[2]} strokeWidth="6" fill="none">
            <path d="M90 210 V150" /><path d="M250 210 V145" />
          </g>
          <g fill={p.land[0]}>
            <ellipse cx="90" cy="145" rx="34" ry="12" /><ellipse cx="250" cy="140" rx="38" ry="13" />
          </g>
          <rect x="0" y="245" width="400" height="15" fill={p.land[2]} />
        </>}
      </svg>
    </div>
  )
}
