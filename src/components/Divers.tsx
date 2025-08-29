import React, { useEffect, useMemo, useRef, useState } from 'react'

/* ========= Utils ========= */
function extractApeCode(rawApe: string | null): string {
  if (!rawApe) return ''
  return String(rawApe).trim().split(/[ (]/)[0].toUpperCase()
}
const ENV_BASE = (((import.meta as any) ?? {}).env?.VITE_API_URL as string | undefined) || ''
const RUNTIME_FALLBACK =
  typeof window !== 'undefined' &&
  /siren-search-widget\.onrender\.com$/i.test(window.location.hostname)
    ? 'https://hubshare-cmexpert.fr'
    : ''
const BACKEND_BASE = (ENV_BASE || RUNTIME_FALLBACK).replace(/\/+$/, '')

/* ========= Types ========= */
type IdccItem = { siret: string; idcc: string; libelle?: string|null; periode?: string|null; source?: string|null; source_updated_at?: string|null }
type IdccResponse = { siret: string; count: number; items: IdccItem[] }
type ApeIdccItem = { idcc: string; libelle?: string|null; match?: string|null }
type ApeIdccResponse = { ape: string; count: number; items: ApeIdccItem[] }
type SearchHit = {
  conventionId: string
  conventionTitre: string
  articleId: string | null
  articleNum: string | null
  articleTitre: string | null
  snippet: string
}

/* ========= Helpers: highlight & scroll ========= */
function highlightSnippet(text: string, q: string) {
  if (!q) return text
  const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`(${safeQ})`, 'ig'), '<mark>$1</mark>')
}
function highlightInElement(el: HTMLElement, q: string) {
  if (!el || !q) return
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null)
  const texts: Text[] = []
  let n: Node | null
  while ((n = walk.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE && n.nodeValue && n.nodeValue.trim()) texts.push(n as Text)
  }
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig')
  texts.forEach(t => {
    const parent = t.parentElement
    if (!parent) return
    const html = t.nodeValue || ''
    if (!re.test(html)) return
    const frag = document.createElement('span')
    frag.innerHTML = html.replace(re, '<mark>$&</mark>')
    parent.replaceChild(frag, t)
    while (frag.firstChild) parent.insertBefore(frag.firstChild, frag)
    parent.removeChild(frag)
  })
}
function scrollToAndFlash(el: HTMLElement | null) {
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  el.animate(
    [
      { boxShadow: '0 0 0 0 rgba(34,197,94,0.0)' },
      { boxShadow: '0 0 0 6px rgba(34,197,94,0.35)' },
      { boxShadow: '0 0 0 0 rgba(34,197,94,0.0)' },
    ],
    { duration: 1200, easing: 'ease-out' }
  )
}

/* ========= Component ========= */
export default function LabelsCertifications({ data }: { data: any }) {
  const labels = data.labels || []
  const divers = data.divers || []
  const siret = data.siret || data.etablissements?.[0]?.siret || null
  const apeFull =
    data.code_ape || data.ape || data.naf || data.etablissements?.[0]?.ape || data.etablissements?.[0]?.naf || null
  const ape = extractApeCode(apeFull)

  // States...
  const [idccApi, setIdccApi] = useState<IdccResponse | null>(null)
  const [idccApiLoaded, setIdccApiLoaded] = useState(false)
  const [idccApiError, setIdccApiError] = useState<string | null>(null)
  const [apeCandidates, setApeCandidates] = useState<ApeIdccItem[]>([])
  const [apeLoaded, setApeLoaded] = useState(false)
  const [apeError, setApeError] = useState<string | null>(null)
  const [idccUsed, setIdccUsed] = useState<string | null>(null)
  const [idccHtml, setIdccHtml] = useState<any>(null)
  const [idccHtmlLoading, setIdccHtmlLoading] = useState(false)
  const [idccHtmlError, setIdccHtmlError] = useState<string | null>(null)
  const articleRefs = useRef<Record<string, HTMLElement | null>>({})
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [pdfFiltered, setPdfFiltered] = useState(false) // <<< case à cocher

  /* ------------ PDF URLs ------------ */
  const idccForUrl = idccUsed ? String(idccUsed).replace(/^0+/, '') : null
  const pdfUrlFull = idccForUrl ? `${BACKEND_BASE}/legifrance/convention/html/${idccForUrl}/pdf` : ''
  const pdfUrlFiltered = (() => {
    if (!idccForUrl) return ''
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    const ids = hits.map(h => h.articleId).filter(Boolean) as string[]
    if (ids.length) params.set('ids', ids.slice(0, 50).join(','))
    const qs = params.toString()
    return `${BACKEND_BASE}/legifrance/convention/html/${idccForUrl}/pdf${qs ? `?${qs}` : ''}`
  })()

  // Dans le bouton principal on choisit l’URL selon pdfFiltered
  const pdfUrlToUse = pdfFiltered ? pdfUrlFiltered : pdfUrlFull

  /* ------------ Barre de recherche + case à cocher ------------ */
  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    if (!term) return
    runSearch(term)
  }
  async function runSearch(term: string) {
    setSearchError(null); setSearching(true); setHits([])
    try {
      const url = `${BACKEND_BASE}/legifrance/convention/search/${idccForUrl}?q=${encodeURIComponent(term)}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setHits(data?.items || [])
    } catch (e: any) {
      setSearchError(e?.message || 'Erreur recherche')
    } finally {
      setSearching(false)
    }
  }

  /* ------------ rendu bouton PDF ------------ */
  const renderPdfButtons = () =>
    idccForUrl && (
      <div className="flex items-center gap-3 flex-wrap">
        <button
          className="px-3 py-1.5 bg-green-700 text-white rounded hover:bg-green-800"
          onClick={() => window.open(pdfUrlToUse, '_blank')}
        >
          Télécharger en PDF {pdfFiltered && '(filtré)'}
        </button>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={pdfFiltered}
            onChange={(e) => setPdfFiltered(e.target.checked)}
          />
          Limiter le PDF aux résultats de recherche
        </label>
      </div>
    )

  /* ------------ Render ------------ */
  return (
    <div className="space-y-6">
      {/* ... blocs labels & divers ... */}

      <div className="bg-white p-0 rounded shadow border border-indigo-100 overflow-hidden">
        <div className="px-6 pt-5 pb-3 border-b">
          {/* ... titre et infos ... */}
          <div className="mt-3 flex flex-wrap gap-2">
            {renderPdfButtons()}
          </div>
          <form className="mt-3 flex gap-2" onSubmit={onSubmitSearch}>
            <input
              type="search"
              placeholder="Rechercher dans la convention…"
              className="flex-1 border rounded px-3 py-2"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              disabled={!idccForUrl}
            />
            <button
              type="submit"
              disabled={!idccForUrl || !q.trim() || searching}
              className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
            >
              {searching ? 'Recherche…' : 'Rechercher'}
            </button>
          </form>
          {searchError && <div className="text-red-700 text-sm mt-2">{searchError}</div>}
        </div>
        {/* ... reste identique (sommaire, résultats, contenu) ... */}
      </div>
    </div>
  )
}
