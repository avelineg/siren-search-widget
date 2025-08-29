import React, { useEffect, useMemo, useRef, useState } from 'react'

/* ========= Utils ========= */
function extractApeCode(rawApe: string | null): string {
  if (!rawApe) return ''
  return String(rawApe).trim().split(/[ (]/)[0].toUpperCase()
}
function normSiret(raw: any): string {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits.padStart(14, '0').slice(0, 14)
}
const isValidIdcc = (v: any) => /^\d+$/.test(String(v ?? '').trim())

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
type ApeIdccItem = { idcc: string; libelle?: string|null }
type ApeIdccResponse = { ape: string; count: number; items: { idcc: string|null; libelle?: string|null; autre?: boolean }[] }
type SearchHit = {
  conventionId: string
  conventionTitre: string
  articleId: string | null
  articleNum: string | null
  articleTitre: string | null
  snippet: string
}

/* ========= Helpers surlignage ========= */
function highlightSnippet(text: string, q: string) {
  if (!q) return text
  const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`(${safeQ})`, 'ig'), '<mark>$1</mark>')
}
function highlightInElement(el: HTMLElement, q: string) {
  if (!el || !q) return
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let n: Node | null
  while ((n = walk.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE && n.nodeValue && n.nodeValue.trim()) nodes.push(n as Text)
  }
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig')
  nodes.forEach(t => {
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
      { boxShadow: '0 0 0 0 rgba(34,197,94,0.0)' }
    ],
    { duration: 1200, easing: 'ease-out' }
  )
}

/* ========= Component ========= */
export default function LabelsCertifications({ data }: { data: any }) {
  const labels = data.labels || []
  const divers = data.divers || []

  const siretRaw = data.siret || data.etablissements?.[0]?.siret || null
  const siret = siretRaw ? normSiret(siretRaw) : null

  const apeFull =
    data.code_ape || data.ape || data.naf || data.etablissements?.[0]?.ape || data.etablissements?.[0]?.naf || null
  const ape = extractApeCode(apeFull)

  // SIRET -> IDCC
  const [idccApi, setIdccApi] = useState<IdccResponse | null>(null)
  const [idccApiLoaded, setIdccApiLoaded] = useState(false)
  const [idccApiError, setIdccApiError] = useState<string | null>(null)

  // Fallback APE -> IDCC
  const [apeCandidates, setApeCandidates] = useState<ApeIdccItem[]>([])
  const [apeLoaded, setApeLoaded] = useState(false)
  const [apeError, setApeError] = useState<string | null>(null)

  // Légifrance
  const [idccUsed, setIdccUsed] = useState<string | null>(null)
  const [idccHtml, setIdccHtml] = useState<any>(null)
  const [idccHtmlLoading, setIdccHtmlLoading] = useState(false)
  const [idccHtmlError, setIdccHtmlError] = useState<string | null>(null)

  // Scrollspy
  const articleRefs = useRef<Record<string, HTMLElement | null>>({})
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null)

  // Search UI
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [pdfOnlySelection, setPdfOnlySelection] = useState(false)

  /* ------------ Chargeur central (option silencieuse) ------------ */
  const loadConventionForIdcc = async (idccStr: string, opts?: { silent?: boolean }): Promise<boolean> => {
    const id = String(idccStr).replace(/^0+/, '')
    setIdccUsed(id)
    setIdccHtmlLoading(true)
    if (!opts?.silent) { setIdccHtmlError(null); setIdccHtml(null) }
    try {
      const res = await fetch(`${BACKEND_BASE}/legifrance/convention/html/${encodeURIComponent(id)}`)
      if (res.status === 404) {
        if (!opts?.silent) { setIdccHtmlError('Aucune convention trouvée pour cet IDCC.') }
        return false
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      setIdccHtml(d)
      return true
    } catch (e: any) {
      if (!opts?.silent) setIdccHtmlError(e?.message || 'Erreur lors de la récupération du détail Légifrance')
      return false
    } finally {
      setIdccHtmlLoading(false)
    }
  }

  /* ------------ Essais séquentiels sur les candidats APE ------------ */
  const tryCandidatesSequentially = async (cands: ApeIdccItem[]) => {
    let tried = 0
    for (const c of cands) {
      tried++
      const ok = await loadConventionForIdcc(c.idcc, { silent: tried < cands.length })
      if (ok) return true
    }
    if (!cands.length) setIdccHtmlError('Aucune suggestion APE exploitable.')
    else setIdccHtmlError('Aucune convention trouvée parmi les suggestions APE.')
    return false
  }

  /* ------------ Orchestration données ------------ */
  useEffect(() => {
    let cancelled = false
    setIdccApi(null); setIdccApiLoaded(false); setIdccApiError(null)
    setApeCandidates([]); setApeLoaded(false); setApeError(null)
    setIdccUsed(null); setIdccHtml(null); setIdccHtmlError(null); setIdccHtmlLoading(false)
    setQ(''); setHits([]); setSearching(false); setSearchError(null)

    const fetchApeCandidates = async (): Promise<ApeIdccItem[]> => {
      if (!ape) { setApeLoaded(true); return [] }
      const url = `${BACKEND_BASE}/api/idcc/by-ape/${encodeURIComponent(ape)}`
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json: ApeIdccResponse = await res.json()
        if (cancelled) return []
        // ne garder que des IDCC numériques, unique, et "autre" exclu
        const seen = new Set<string>()
        const items: ApeIdccItem[] = []
        for (const it of (json.items || [])) {
          if (!isValidIdcc(it.idcc)) continue
          const id = String(it.idcc!).replace(/^0+/, '')
          if (seen.has(id)) continue
          seen.add(id)
          items.push({ idcc: id, libelle: it.libelle || null })
        }
        setApeCandidates(items)
        setApeLoaded(true)
        return items
      } catch (e: any) {
        setApeLoaded(true); setApeError(e?.message || 'Erreur réseau (APE)')
        return []
      }
    }

    const run = async () => {
      // 1) tentative via SIRET
      if (siret) {
        try {
          const url = `${BACKEND_BASE}/api/idcc/${encodeURIComponent(siret)}`
          const res = await fetch(url)
          if (!res.ok) {
            setIdccApiLoaded(true)
            setIdccApiError(`HTTP ${res.status} sur ${url}`)
          } else {
            const json: IdccResponse = await res.json()
            if (cancelled) return
            setIdccApi(json); setIdccApiLoaded(true)
            const idcc = json?.items?.[0]?.idcc
            if (isValidIdcc(idcc)) {
              const ok = await loadConventionForIdcc(String(idcc))
              if (ok) return
            }
          }
        } catch (e: any) {
          setIdccApiLoaded(true); setIdccApiError(e?.message || 'Erreur réseau')
        }
      } else {
        setIdccApiLoaded(true)
      }

      // 2) fallback APE
      const cands = await fetchApeCandidates()
      await tryCandidatesSequentially(cands)
    }

    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siret, ape])

  /* ------------ Recherche ------------ */
  const canSearch = !!idccUsed
  async function runSearch(term: string) {
    setSearchError(null)
    setSearching(true)
    setHits([])
    try {
      const url = `${BACKEND_BASE}/legifrance/convention/search/${String(idccUsed).replace(/^0+/, '')}?q=${encodeURIComponent(term)}`
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
    if (hit.articleNum) {
      targetEl = document.querySelector(`[data-article-num="${CSS.escape(hit.articleNum)}"]`) as HTMLElement | null
    }
    if (!targetEl && hit.articleId) {
      targetEl = document.querySelector(`#article-${CSS.escape(hit.articleId)}`) as HTMLElement | null
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

  /* ------------ Navigation ------------ */
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
    anchors.forEach(a => {
      const el = articleRefs.current[a.id]
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [anchors])

  const scrollTo = (id: string) => {
    const el = articleRefs.current[id]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const expandAll = () => { document.querySelectorAll('[data-collapsible]').forEach(el => el.setAttribute('open', 'true')) }
  const collapseAll = () => {
    document.querySelectorAll('[data-collapsible]').forEach(el => el.removeAttribute('open'))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /* ------------ Rendu conv ------------ */
  const renderConventions = () => (
    (idccHtml?.conventions || []).map((conv: any, ci: number) => (
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
        {(conv.articles || []).map((a: any, ai: number) =>
          <details
            key={`c${ci}-a${ai}`}
            id={`c${ci}-a${ai}`}
            ref={(el) => (articleRefs.current[`c${ci}-a${ai}`] = el)}
            data-collapsible
            className="mb-6 bg-[#fafafc] border border-[#e1e1ea] rounded-lg"
            open
            {...(a.num ? { 'data-article-num': a.num } : {})}
          >
            <summary className="cursor-pointer px-4 py-3 text-[17px] font-semibold text-[#0b2353]">
              {a.num ? `Article ${a.num}` : 'Article'} {a.title ? `: ${a.title}` : ''}
            </summary>
            <div
              className="px-5 pb-5 text-[16px] leading-7 text-[#222]"
              dangerouslySetInnerHTML={{ __html: a.content || a.texteHtml || '' }}
            />
          </details>
        )}
      </div>
    ))
  )

  /* ------------ Méta & PDF ------------ */
  const mainLibelle = idccHtml?.conventions?.[0]?.titre || idccApi?.items?.[0]?.libelle || ''
  const meta = idccApi?.items?.[0]
  const moisRef = meta?.periode || undefined
  const majSource = meta?.source_updated_at || undefined

  const pdfUrl = idccUsed && idccHtml?.conventions?.length
    ? `${BACKEND_BASE}/legifrance/convention/html/${String(idccUsed).replace(/^0+/, '')}/pdf${q.trim() ? `?q=${encodeURIComponent(q.trim())}${pdfOnlySelection ? '&sel=1' : ''}` : ''}`
    : null

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-2 text-indigo-900">Labels & certifications</h3>
        {labels.length ? labels.map((l: any, i: number) => <p key={i}>{l}</p>) : <p>Aucun label.</p>}
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-2 text-indigo-900">Divers</h3>
        {divers.length ? divers.map((d: any, i: number) => <p key={i}>{d}</p>) : <p>Rien à afficher.</p>}
      </div>

      <div className="bg-white p-0 rounded shadow border border-indigo-100 overflow-hidden">
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

          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <button className="px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700" onClick={expandAll}>Tout déplier</button>
            <button className="px-3 py-1.5 bg-gray-100 text-gray-900 rounded hover:bg-gray-200" onClick={collapseAll}>Tout replier</button>

            <label className="ml-2 inline-flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={pdfOnlySelection}
                onChange={(e)=>setPdfOnlySelection(e.target.checked)}
              />
              Limiter le PDF aux résultats de recherche
            </label>

            <button
              className="ml-2 px-3 py-1.5 bg-green-700 text-white rounded hover:bg-green-800 disabled:opacity-50"
              onClick={() => pdfUrl && window.open(pdfUrl, '_blank')}
              disabled={!pdfUrl}
            >
              Télécharger en PDF
            </button>
          </div>

          <form className="mt-3 flex gap-2" onSubmit={onSubmitSearch}>
            <input
              type="search"
              placeholder="Rechercher dans la convention (ex: licenciement, durée du travail)…"
              className="flex-1 border rounded px-3 py-2"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              disabled={!idccUsed}
            />
            <button
              type="submit"
              disabled={!idccUsed || !q.trim() || searching}
              className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
            >
              {searching ? 'Recherche…' : 'Rechercher'}
            </button>
          </form>
          {searchError && <div className="text-red-700 text-sm mt-2">{searchError}</div>}
          {idccHtmlError && <div className="text-red-700 text-sm mt-2">{idccHtmlError}</div>}
        </div>

        <div className="grid grid-cols-12 gap-6 p-6">
          <aside className="col-span-12 lg:col-span-3">
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

            {/* Fallback APE */}
            {idccApiLoaded && (!idccApi || idccApi.count === 0) && (
              <div className="mt-6 border rounded-lg p-3">
                <div className="font-semibold mb-1">Pas d’IDCC via SIRET</div>
                {ape && <div className="text-sm mb-2">Suggestions basées sur l’APE <b>{ape}</b> :</div>}
                {!apeLoaded && <div className="text-sm text-gray-500">Recherche…</div>}
                {apeError && <div className="text-sm text-red-700">{apeError}</div>}
                {apeLoaded && !apeCandidates.length && !apeError && (
                  <div className="text-sm text-gray-500">Aucune suggestion APE.</div>
                )}
                <ul className="space-y-2">
                  {apeCandidates.map(c => (
                    <li key={c.idcc} className="text-sm">
                      <div className="font-medium">
                        {`IDCC ${c.idcc}`} {c.libelle ? `— ${c.libelle}` : ''}
                      </div>
                      <button
                        className="mt-1 px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                        onClick={() => loadConventionForIdcc(c.idcc)}
                      >
                        Voir le détail
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>

          <main className="col-span-12 lg:col-span-9">
            {(!idccApiLoaded || idccHtmlLoading) && <p>Chargement…</p>}
            {idccApiError && <p className="text-red-700 mb-3">Erreur IDCC : {idccApiError}</p>}

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
                  {(conv.articles || []).map((a: any, ai: number) =>
                    <details
                      key={`c${ci}-a${ai}`}
                      id={`c${ci}-a${ai}`}
                      ref={(el) => (articleRefs.current[`c${ci}-a${ai}`] = el)}
                      data-collapsible
                      className="mb-6 bg-[#fafafc] border border-[#e1e1ea] rounded-lg"
                      open
                      {...(a.num ? { 'data-article-num': a.num } : {})}
                    >
                      <summary className="cursor-pointer px-4 py-3 text-[17px] font-semibold text-[#0b2353]">
                        {a.num ? `Article ${a.num}` : 'Article'} {a.title ? `: ${a.title}` : ''}
                      </summary>
                      <div
                        className="px-5 pb-5 text-[16px] leading-7 text-[#222]"
                        dangerouslySetInnerHTML={{ __html: a.content || a.texteHtml || '' }}
                      />
                    </details>
                  )}
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
