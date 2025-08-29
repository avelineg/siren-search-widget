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

/* ========= Helpers ========= */
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
    const wrapper = document.createElement('span')
    wrapper.innerHTML = html.replace(re, '<mark>$&</mark>')
    parent.replaceChild(wrapper, t)
    while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper)
    parent.removeChild(wrapper)
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

  // States données
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

  // Scrollspy + recherche
  const articleRefs = useRef<Record<string, HTMLElement | null>>({})
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [pdfFiltered, setPdfFiltered] = useState(false)

  /* ------------ Fetch ------------ */
  useEffect(() => {
    let cancelled = false
    setIdccApi(null); setIdccApiLoaded(false); setIdccApiError(null)
    setApeCandidates([]); setApeLoaded(false); setApeError(null)
    setIdccUsed(null); setIdccHtml(null); setIdccHtmlError(null); setIdccHtmlLoading(false)
    setQ(''); setHits([]); setSearching(false); setSearchError(null)

    const fetchIdccBySiret = async () => {
      if (!siret) { setIdccApiLoaded(true); tryApeFallback(); return }
      const siretKey = String(siret).padStart(14, '0')
      const url = `${BACKEND_BASE}/api/idcc/${encodeURIComponent(siretKey)}`
      try {
        const res = await fetch(url)
        if (!res.ok) { setIdccApiLoaded(true); setIdccApiError(`HTTP ${res.status} sur ${url}`); tryApeFallback(); return }
        const json: IdccResponse = await res.json()
        if (cancelled) return
        setIdccApi(json); setIdccApiLoaded(true)
        const idcc = json?.items?.[0]?.idcc
        if (idcc) { setIdccUsed(String(idcc)); fetchLegifranceHtml(String(idcc)) }
        else { tryApeFallback() }
      } catch (e: any) {
        setIdccApiLoaded(true); setIdccApiError(e?.message || 'Erreur réseau'); tryApeFallback()
      }
    }

    const tryApeFallback = async () => {
      if (!ape) { setApeLoaded(true); return }
      const url = `${BACKEND_BASE}/api/idcc/by-ape/${encodeURIComponent(ape)}`
      try {
        const res = await fetch(url)
        if (!res.ok) { setApeLoaded(true); setApeError(`HTTP ${res.status} sur ${url}`); return }
        const json: ApeIdccResponse = await res.json()
        if (cancelled) return
        setApeCandidates(json.items || []); setApeLoaded(true)
        const first = json.items?.[0]?.idcc
        if (!idccUsed && first) { setIdccUsed(String(first)); fetchLegifranceHtml(String(first)) }
      } catch (e: any) {
        setApeLoaded(true); setApeError(e?.message || 'Erreur réseau (APE)')
      }
    }

    const fetchLegifranceHtml = async (idcc: string) => {
      const idccClean = String(idcc).replace(/^0+/, '')
      if (!/^\d+$/.test(idccClean)) return
      const url = `${BACKEND_BASE}/legifrance/convention/html/${idccClean}`
      setIdccHtmlLoading(true); setIdccHtml(null); setIdccHtmlError(null)
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`)
        const d = await res.json()
        if (cancelled) return
        setIdccHtml(d); setIdccHtmlLoading(false)
      } catch (e: any) {
        setIdccHtmlError(e?.message || 'Erreur lors du détail Légifrance')
        setIdccHtmlLoading(false); setIdccHtml(null)
      }
    }

    fetchIdccBySiret()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siret, ape])

  /* ------------ Recherche ------------ */
  const idccForUrl = idccUsed ? String(idccUsed).replace(/^0+/, '') : null

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
  function onSubmitSearch(e: React.FormEvent) {
    e.preventDefault()
    const term = q.trim()
    if (!term) return
    runSearch(term)
  }
  function openHit(hit: SearchHit) {
    let targetEl: HTMLElement | null = null
    if (hit.articleId) targetEl = document.getElementById(`article-${hit.articleId}`) as HTMLElement | null
    if (!targetEl && hit.articleNum) {
      targetEl = document.querySelector(`[data-article-num="${CSS.escape(hit.articleNum)}"]`) as HTMLElement | null
    }
    if (!targetEl && hit.articleTitre) {
      const all = Array.from(document.querySelectorAll('details[data-collapsible] summary')) as HTMLElement[]
      targetEl = (all.find(s => s.textContent?.toLowerCase().includes(String(hit.articleTitre).toLowerCase())) || null)?.closest('details') as HTMLElement | null
    }
    if (targetEl) {
      const body = targetEl.querySelector('div')
      if (body) {
        body.querySelectorAll('mark').forEach(m => m.replaceWith(document.createTextNode(m.textContent || '')))
        highlightInElement(body as HTMLElement, q)
      }
    }
    scrollToAndFlash(targetEl)
    if (targetEl && !targetEl.hasAttribute('open')) targetEl.setAttribute('open','true')
  }

  /* ------------ Sommaire & spy ------------ */
  const anchors = useMemo(() => {
    const out: { id: string; label: string }[] = []
    if (!idccHtml?.conventions) return out
    idccHtml.conventions.forEach((conv: any, ci: number) => {
      ;(conv.articles || []).forEach((a: any, ai: number) => {
        const id = `c${ci}-a${ai}`
        const label = a.num ? `Article ${a.num}` : a.title || `Article ${ai + 1}`
        out.push({ id, label })
      })
    })
    return out
  }, [idccHtml])

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a,b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveAnchor(visible[0].target.id)
      },
      { rootMargin: '0px 0px -70% 0px' }
    )
    anchors.forEach(a => { const el = articleRefs.current[a.id]; if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, [anchors])

  const scrollTo = (id: string) => {
    const el = articleRefs.current[id]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const expandAll   = () => document.querySelectorAll('[data-collapsible]').forEach(el => el.setAttribute('open','true'))
  const collapseAll = () => { document.querySelectorAll('[data-collapsible]').forEach(el => el.removeAttribute('open')); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  /* ------------ URLs PDF ------------ */
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
  const pdfUrlToUse = pdfFiltered ? pdfUrlFiltered : pdfUrlFull

  /* ------------ Méta ------------ */
  const mainLibelle = idccHtml?.conventions?.[0]?.titre || idccApi?.items?.[0]?.libelle || ''
  const meta = idccApi?.items?.[0]
  const moisRef = meta?.periode || undefined
  const majSource = meta?.source_updated_at || undefined

  /* ------------ Rendu ------------ */
  return (
    <div className="space-y-6">
      {/* === Labels & divers (rétablis) === */}
      <div className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-2 text-indigo-900">Labels & certifications</h3>
        {labels.length ? labels.map((l: any, i: number) => <p key={i}>{l}</p>) : <p>Aucun label.</p>}
      </div>
      <div className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-2 text-indigo-900">Divers</h3>
        {divers.length ? divers.map((d: any, i: number) => <p key={i}>{d}</p>) : <p>Rien à afficher.</p>}
      </div>

      {/* === Convention collective (complet) === */}
      <div className="bg-white p-0 rounded shadow border border-indigo-100 overflow-hidden">
        {/* En-tête */}
        <div className="px-6 pt-5 pb-3 border-b">
          <h3 className="font-bold text-2xl text-indigo-900 flex items-center gap-2">
            Convention collective
            {mainLibelle && <span className="text-indigo-700">« {mainLibelle} »</span>}
          </h3>

          <div className="mt-2 text-[15px] text-gray-800 flex flex-wrap gap-x-6 gap-y-2">
            {idccApiLoaded && idccApi?.count! > 0 && (
              <>
                <div><b>IDCC :</b> {idccApi!.items[0].idcc}</div>
                {moisRef && <div><b>Mois référence :</b> {moisRef}</div>}
                {majSource && <div><b>Date MAJ (source) :</b> {new Date(majSource).toLocaleDateString('fr-FR')}</div>}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700" onClick={expandAll}>Tout déplier</button>
            <button className="px-3 py-1.5 bg-gray-100 text-gray-900 rounded hover:bg-gray-200" onClick={collapseAll}>Tout replier</button>
            {idccForUrl && (
              <>
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
              </>
            )}
          </div>

          {/* Barre de recherche */}
          <form className="mt-3 flex gap-2" onSubmit={onSubmitSearch}>
            <input
              type="search"
              placeholder="Rechercher dans la convention (ex: licenciement, durée du travail)…"
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

        {/* Corps : 2 colonnes */}
        <div className="grid grid-cols-12 gap-6 p-6">
          {/* Sommaire + résultats */}
          <aside className="col-span-12 lg:col-span-3 space-y-6">
            <div className="sticky top-4 max-h-[80vh] overflow-auto border rounded-lg p-3">
              <div className="font-semibold mb-2">Sommaire</div>
              {anchors.length === 0 && <div className="text-sm text-gray-500">—</div>}
              <ul className="space-y-1">
                {anchors.map(a => (
                  <li key={a.id}>
                    <button
                      onClick={() => scrollTo(a.id)}
                      className={`text-left text-sm underline-offset-2 hover:underline ${
                        activeAnchor === a.id ? 'text-indigo-700 font-semibold' : 'text-indigo-600'
                      }`}
                    >
                      {a.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {!!q.trim() && (
              <div className="border rounded-lg p-3">
                <div className="font-semibold mb-2">Résultats pour « {q} »</div>
                {!searching && hits.length === 0 && <div className="text-sm text-gray-500">Aucun résultat</div>}
                {searching && <div className="text-sm text-gray-500">Recherche…</div>}
                <ul className="space-y-3">
                  {hits.slice(0, 100).map((h, i) => (
                    <li key={i} className="text-sm">
                      <button
                        className="text-indigo-700 hover:underline font-medium"
                        onClick={() => openHit(h)}
                        title={h.articleTitre || ''}
                      >
                        {h.articleNum ? `Article ${h.articleNum}` : 'Article'}{h.articleTitre ? ` — ${h.articleTitre}` : ''}
                      </button>
                      <div
                        className="text-[13px] text-gray-700 mt-1"
                        dangerouslySetInnerHTML={{ __html: highlightSnippet(h.snippet, q) }}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Fallback APE si pas d’IDCC via SIRET */}
            {idccApiLoaded && (!idccApi || idccApi.count === 0) && (
              <div className="border rounded-lg p-3">
                <div className="font-semibold mb-1">Pas d’IDCC via SIRET</div>
                {ape && <div className="text-sm mb-2">Suggestions basées sur l’APE <b>{ape}</b> :</div>}
                {!apeLoaded && <div className="text-sm text-gray-500">Recherche…</div>}
                {apeError && <div className="text-sm text-red-700">{apeError}</div>}
                {apeLoaded && !apeCandidates.length && !apeError && (
                  <div className="text-sm text-gray-500">Aucune suggestion APE.</div>
                )}
                <ul className="space-y-2">
                  {apeCandidates.map(c => (
                    <li key={`${c.idcc}-${c.match}`} className="text-sm">
                      <div className="font-medium">{c.idcc} {c.libelle ? `— ${c.libelle}` : ''}</div>
                      <button
                        className="mt-1 px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                        onClick={() => {
                          setIdccUsed(c.idcc)
                          fetch(`${BACKEND_BASE}/legifrance/convention/html/${c.idcc.replace(/^0+/, '')}`)
                            .then(r => r.json()).then(setIdccHtml).catch(()=>{})
                        }}
                      >
                        Voir le détail
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>

          {/* Contenu principal */}
          <main className="col-span-12 lg:col-span-9">
            {(!idccApiLoaded || idccHtmlLoading) && <p>Chargement…</p>}
            {idccApiError && <p className="text-red-700 mb-3">Erreur IDCC : {idccApiError}</p>}
            {idccHtmlError && <p className="text-red-700 mb-3">{idccHtmlError}</p>}

            {idccHtml?.conventions?.length > 0 ? (
              (idccHtml.conventions || []).map((conv: any, ci: number) => (
                <div key={conv.id || ci} className="mb-10">
                  <h2 className="text-2xl font-extrabold text-[#002752] text-center mb-6 border-b-4 border-[#b50910] pb-2">
                    {conv.titre || ''}
                  </h2>
                  {conv.descriptionFusionHtml && (
                    <div
                      className="text-[18px] text-[#222] mb-4"
                      dangerouslySetInnerHTML={{ __html: conv.descriptionFusionHtml }}
                    />
                  )}
                  {(conv.articles || []).map((a: any, ai: number) => {
                    const articleAnchor = (a.id || a.num || `c${ci}-a${ai}`).toString()
                    return (
                      <details
                        key={`c${ci}-a${ai}`}
                        id={`c${ci}-a${ai}`}
                        ref={(el) => (articleRefs.current[`c${ci}-a${ai}`] = el)}
                        data-collapsible
                        className="mb-6 bg-[#fafafc] border border-[#e1e1ea] rounded-lg"
                        open
                        {...(a.num ? { 'data-article-num': a.num } : {})}
                      >
                        {/* ancre exacte pour les liens de recherche */}
                        <span id={`article-${articleAnchor}`} style={{ position:'relative', top:'-90px' }} />
                        <summary className="cursor-pointer px-4 py-3 text-[17px] font-semibold text-[#0b2353]">
                          {a.num ? `Article ${a.num}` : 'Article'} {a.title ? `: ${a.title}` : ''}
                        </summary>
                        <div
                          className="px-5 pb-5 text-[16px] leading-7 text-[#222]"
                          dangerouslySetInnerHTML={{ __html: a.content || a.texteHtml || '' }}
                        />
                      </details>
                    )
                  })}
                </div>
              ))
            ) : (
              idccApiLoaded && (!idccApi || idccApi.count === 0) && !apeCandidates.length && !idccApiError && (
                <p className="text-gray-600">
                  Aucune information sur la convention collective n’est disponible pour cet établissement.
                </p>
              )
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
