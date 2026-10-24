
import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../lib/api'
import './StockHistoryPage.css'

type StockMovement = {
  id: string
  variantId: string
  movementType: string
  quantityChange: number
  unitCostPaise: number | null
  referenceType: string | null
  referenceId: string | null
  note: string | null
  createdAt: string
  variant: {
    id: string
    name: string
    sku: string | null
    unit: string
    product: {
      id: string
      name: string
      sku: string | null
    }
  }
}

type ApiResponse<T> = {
  success: boolean
  count?: number
  data: T
  message?: string
}

const MOVEMENT_TYPES = [
  'PURCHASE',
  'SALE',
  'ADJUSTMENT',
  'PURCHASE_RETURN',
  'SALE_RETURN',
]

function unwrap<T>(response: ApiResponse<T> | T): T {
  if (
    response &&
    typeof response === 'object' &&
    'success' in response &&
    'data' in response
  ) {
    const result = response as ApiResponse<T>

    if (!result.success) {
      throw new Error(result.message || 'Request failed.')
    }

    return result.data
  }

  return response as T
}

function formatMoney(paise: number | null | undefined) {
  if (paise == null) return '—'

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100)
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatMovementType(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export default function StockHistoryPage() {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [search, setSearch] = useState('')
  const [movementType, setMovementType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()

      if (search.trim()) params.set('search', search.trim())
      if (movementType) params.set('movementType', movementType)
      if (from) params.set('from', from)
      if (to) params.set('to', to)

      const query = params.toString()
      const endpoint = `/stock/history${query ? `?${query}` : ''}`

      const response =
        await apiRequest<ApiResponse<StockMovement[]>>(endpoint)

      setMovements(unwrap(response) ?? [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load stock history.',
      )
      setMovements([])
    } finally {
      setLoading(false)
    }
  }, [search, movementType, from, to, refreshKey])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const summary = useMemo(() => {
    const additions = movements
      .filter((item) => item.quantityChange > 0)
      .reduce((total, item) => total + item.quantityChange, 0)

    const reductions = movements
      .filter((item) => item.quantityChange < 0)
      .reduce((total, item) => total + Math.abs(item.quantityChange), 0)

    return {
      count: movements.length,
      additions,
      reductions,
    }
  }, [movements])

  function clearFilters() {
    setSearch('')
    setMovementType('')
    setFrom('')
    setTo('')
  }

  function handleDateChange(
    nextFrom: string,
    nextTo: string,
  ) {
    setFrom(nextFrom)
    setTo(nextTo)
  }

  return (
    <main className="stock-history-page">
      <header className="stock-history-header">
        <div>
          <div className="stock-history-eyebrow">INVENTORY</div>
          <h1>Stock History</h1>
          <p>
            Review recorded stock movements across your products and variants.
          </p>
        </div>

        <button
          type="button"
          className="stock-history-button stock-history-button-secondary"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <section className="stock-history-summary">
        <article className="stock-history-stat">
          <span>Matching movements</span>
          <strong>{summary.count}</strong>
        </article>

        <article className="stock-history-stat">
          <span>Units added</span>
          <strong className="stock-history-positive">
            +{summary.additions.toLocaleString('en-IN')}
          </strong>
        </article>

        <article className="stock-history-stat">
          <span>Units removed</span>
          <strong className="stock-history-negative">
            −{summary.reductions.toLocaleString('en-IN')}
          </strong>
        </article>
      </section>

      <section className="stock-history-panel">
        <div className="stock-history-panel-heading">
          <div>
            <h2>Movement records</h2>
            <p>Search and filter the stock movement audit trail.</p>
          </div>
        </div>

        <div className="stock-history-filters">
          <label className="stock-history-search">
            <span>Search</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Product, variant, or SKU"
            />
          </label>

          <label>
            <span>Movement type</span>
            <select
              value={movementType}
              onChange={(event) => setMovementType(event.target.value)}
            >
              <option value="">All movements</option>
              {MOVEMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatMovementType(type)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>From date</span>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => handleDateChange(event.target.value, to)}
            />
          </label>

          <label>
            <span>To date</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => handleDateChange(from, event.target.value)}
            />
          </label>

          <button
            type="button"
            className="stock-history-button stock-history-button-secondary"
            onClick={clearFilters}
            disabled={!search && !movementType && !from && !to}
          >
            Clear filters
          </button>
        </div>

        <div className="stock-history-results">
          {error && (
            <div className="stock-history-error" role="alert">
              <strong>Could not load stock history</strong>
              <p>{error}</p>
              <button
                type="button"
                className="stock-history-button stock-history-button-secondary"
                onClick={() => setRefreshKey((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          )}

          {loading ? (
            <div className="stock-history-empty">Loading stock history…</div>
          ) : !error && movements.length === 0 ? (
            <div className="stock-history-empty">
              <h3>No stock movements found</h3>
              <p>Try changing your search or clearing the filters.</p>
            </div>
          ) : !error ? (
            <div className="stock-history-table-wrap">
              <table className="stock-history-table">
                <thead>
                  <tr>
                    <th>Date and time</th>
                    <th>Product / Variant</th>
                    <th>Movement</th>
                    <th>Quantity change</th>
                    <th>Unit cost</th>
                    <th>Reference</th>
                    <th>Notes</th>
                  </tr>
                </thead>

                <tbody>
                  {movements.map((item) => (
                    <tr key={item.id}>
                      <td className="stock-history-date">
                        {formatDate(item.createdAt)}
                      </td>

                      <td>
                        <div className="stock-history-product">
                          <strong>{item.variant?.product?.name ?? 'Unknown product'}</strong>
                          <span>{item.variant?.name ?? 'Unknown variant'}</span>
                          <small>
                            {item.variant?.sku ||
                              item.variant?.product?.sku ||
                              'No SKU'}
                          </small>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`stock-history-type stock-history-type-${item.movementType.toLowerCase()}`}
                        >
                          {formatMovementType(item.movementType)}
                        </span>
                      </td>

                      <td>
                        <strong
                          className={
                            item.quantityChange > 0
                              ? 'stock-history-positive'
                              : item.quantityChange < 0
                                ? 'stock-history-negative'
                                : ''
                          }
                        >
                          {item.quantityChange > 0 ? '+' : ''}
                          {item.quantityChange.toLocaleString('en-IN')}{' '}
                          <span className="stock-history-unit">
                            {item.variant?.unit ?? ''}
                          </span>
                        </strong>
                      </td>

                      <td>{formatMoney(item.unitCostPaise)}</td>

                      <td>
                        <div className="stock-history-reference">
                          <span>
                            {item.referenceType
                              ? formatMovementType(item.referenceType)
                              : '—'}
                          </span>
                          {item.referenceId && (
                            <small title={item.referenceId}>
                              {item.referenceId}
                            </small>
                          )}
                        </div>
                      </td>

                      <td className="stock-history-note">
                        {item.note || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        {!loading && !error && movements.length > 0 && (
          <footer className="stock-history-footer">
            Showing {movements.length} matching movement
            {movements.length === 1 ? '' : 's'}.
          </footer>
        )}
      </section>
    </main>
  )
}
