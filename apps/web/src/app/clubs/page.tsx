import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { ChevronDown, List, Map as MapIcon, Search } from 'lucide-react'
import { t } from '@/i18n/t'
import { getDirectory, queryDirectory, type DirectoryQuery } from '@/lib/data'
import { STRANDS, STRAND_LETTER, type Strand } from '@/lib/types'
import { first, withParams, type Params } from '@/lib/url'
import { ClubRow } from '@/components/cards'
import { Button, EndOfList, Empty, PageHeader, Todo } from '@/components/ui'
import { Swap } from '@/components/Swap'

export const metadata: Metadata = { title: t('directory')('title') }

type SP = Promise<Record<string, string | string[] | undefined>>

// The directory (PRD §5 route 2; docs/03 §5): a list with search, filters and sorts; the map is a toggle.
// Only listed clubs reach this page: getDirectory applies the listing rule (the signature move, PRD §4).
export default function ClubsPage({ searchParams }: { searchParams: SP }) {
  const d = t('directory')
  return (
    <div className="container page">
      <PageHeader title={d('title')} lead={d('intro')} />
      {/* Without JavaScript or before the query streams, the unfiltered list shows (it's in the static shell). */}
      <Suspense fallback={<Directory params={{}} />}>
        <DirectoryFromUrl searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function DirectoryFromUrl({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const params: Params = {
    q: first(sp.q), strand: first(sp.strand), country: first(sp.country), language: first(sp.language),
    sort: first(sp.sort), view: first(sp.view), page: first(sp.page),
  }
  return <Directory params={params} />
}

async function Directory({ params }: { params: Params }) {
  const d = t('directory')
  const s = t('strands')
  const ui = t('ui')
  const dir = await getDirectory()
  const strand = STRANDS.includes(params.strand as Strand) ? (params.strand as Strand) : undefined
  const sort = (['recent', 'newest', 'az'] as const).find((x) => x === params.sort) ?? 'recent'
  const query: DirectoryQuery = { q: params.q, strand, country: params.country, language: params.language, sort, page: Number(params.page) || 1 }
  const res = queryDirectory(dir.clubs, query)
  const view = params.view === 'map' ? 'map' : 'list'
  const href = (patch: Params) => withParams('/clubs', params, { page: undefined, ...patch })
  const filtered = !!(params.q || strand || params.country || params.language)
  const countryName = dir.countries.find((c) => c.code === params.country)?.name

  return (
    <div className="directory">
      <form action="/clubs" role="search" className="field-search">
        <Search size={20} strokeWidth={2} aria-hidden="true" />
        <label htmlFor="dir-q" className="visually-hidden">{t('nav')('searchPlaceholder')}</label>
        <input id="dir-q" name="q" type="search" defaultValue={params.q} placeholder={t('nav')('searchPlaceholder')} />
        {strand ? <input type="hidden" name="strand" value={strand} /> : null}
        {params.country ? <input type="hidden" name="country" value={params.country} /> : null}
        {params.language ? <input type="hidden" name="language" value={params.language} /> : null}
        {params.sort ? <input type="hidden" name="sort" value={params.sort} /> : null}
        <button type="submit" className="btn btn-primary btn-sm">{t('nav')('findClub')}</button>
      </form>

      <div className="controls">
        <div className="filter-row">
          <Filter id="f-strand" label={d('strand')} value={strand ? s(strand) : undefined}
            options={STRANDS.map((x) => ({ label: `${STRAND_LETTER[x]} · ${s(x)}`, href: href({ strand: x }), current: strand === x }))} />
          <Filter id="f-country" label={d('country')} value={countryName}
            options={dir.countries.map((c) => ({ label: c.name, href: href({ country: c.code }), current: params.country === c.code }))} />
          <Filter id="f-language" label={d('language')} value={params.language}
            options={dir.languages.map((x) => ({ label: x, href: href({ language: x }), current: params.language === x }))} />
          {filtered ? <Link href="/clubs" className="btn btn-quiet btn-sm">{d('clear')}</Link> : null}
        </div>
        <div className="filter-row">
          <nav aria-label={d('sort')}>
            <div className="segmented">
              {([['recent', d('sortRecent')], ['newest', d('sortNewest')], ['az', d('sortAz')]] as const).map(([k, label]) => (
                <Link key={k} href={href({ sort: k === 'recent' ? undefined : k })} aria-current={sort === k ? 'true' : undefined} scroll={false}>{label}</Link>
              ))}
            </div>
          </nav>
          <nav aria-label={`${d('list')} / ${d('map')}`}>
            <div className="segmented">
              <Link href={href({ view: undefined })} aria-current={view === 'list' ? 'true' : undefined} scroll={false}><List size={20} aria-hidden="true" /> {d('list')}</Link>
              <Link href={href({ view: 'map' })} aria-current={view === 'map' ? 'true' : undefined} scroll={false}><MapIcon size={20} aria-hidden="true" /> {d('map')}</Link>
            </div>
          </nav>
        </div>
      </div>

      <Swap k={JSON.stringify({ ...query, page: undefined, view })} name="directory-results">
      <div className="directory-results">
      {view === 'map' ? (
        <div className="map-panel card">
          <p><Todo>{ui('mapTodo')}</Todo></p>
          <p className="t-meta">{d('mapNote')}</p>
        </div>
      ) : null}

      {res.total === 0 ? (
        <Empty text={d('empty')} action={<Button href="/start">{d('emptyAction')}</Button>} />
      ) : (
        <>
          <ul className="club-list" aria-label={d('title')}>
            {res.shown.map((c) => <ClubRow key={c.id} club={c} level={2} />)}
          </ul>
          {res.hasMore ? (
            <div className="end-of-list"><Link href={withParams('/clubs', params, { page: String(res.page + 1) })} className="btn btn-secondary" scroll={false}>{ui('next20')}</Link></div>
          ) : (
            <EndOfList text={d('end')} action={<Button href="/start" variant="secondary">{d('emptyAction')}</Button>} />
          )}
        </>
      )}
      </div>
      </Swap>
    </div>
  )
}

function Filter({ id, label, value, options }: { id: string; label: string; value?: string; options: { label: string; href: string; current: boolean }[] }) {
  return (
    <>
      <button type="button" className="pill" popoverTarget={id} data-active={value ? 'true' : undefined}>
        {value ? `${label}: ${value}` : label}
        <ChevronDown size={20} strokeWidth={2} aria-hidden="true" />
      </button>
      <div id={id} popover="auto" className="popover">
        {options.map((o) => (
          <Link key={o.href} href={o.href} aria-current={o.current ? 'true' : undefined} scroll={false}>{o.label}</Link>
        ))}
      </div>
    </>
  )
}
