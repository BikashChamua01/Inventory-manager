import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import {
  Activity,
  AlertTriangle,
  Boxes,
  RefreshCw,
  Search,
  SlidersHorizontal,
  History,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import './InventoryPage.css'

type StockItem = {
  variantId: string
  productId: string
  productName: string
  productSku: string | null
  category: string | null
  variantName: string
  sku: string | null
  unit: string
  attributes: Array<{ name: string; value: string }>
  stockQuantity: number
  lowStockThreshold: number
  isLowStock: boolean
  purchasePricePaise: number
  sellingPricePaise: number
  averageCostPaise: number | null
  averageCostKnown: boolean
  stockValueAtAverageCostPaise: number | null
  isActive: boolean
}

type StockSummary = {
  totalVariants: number
  totalStockUnits: number
  lowStockVariants: number
  unknownCostVariants: number
}

type ApiResponse<T> = {
  success: boolean
  data: T
  message?: string
  error?: string
}

type StockReport = {
  items: StockItem[]
  summary?: StockSummary
}

type Movement = {
  id?: string
  movementType?: string
  quantityChange?: number
  unitCostPaise?: number | null
  referenceType?: string | null
  note?: string | null
  createdAt?: string
}

function money(paise: number | null | undefined) {
  if (paise == null || !Number.isFinite(paise)) return '—'

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100)
}
function getStockValue(item: StockItem): number | null {
  const unitCost = item.averageCostKnown
    ? item.averageCostPaise
    : item.purchasePricePaise

  if (unitCost == null || !Number.isFinite(unitCost)) {
    return null
  }

  return item.stockQuantity * unitCost
}

function dateTime(value?: string) {
  if (!value) return '—'

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function unwrapMovements(data: unknown): Movement[] {
  if (Array.isArray(data)) return data as Movement[]

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>

    for (const key of ['items', 'movements', 'history']) {
      if (Array.isArray(record[key])) return record[key] as Movement[]
    }
  }

  return []
}

export default function InventoryPage() {
  const [items, setItems] = useState<StockItem[]>([])
  const [summary, setSummary] = useState<StockSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'zero'>('all')

  const [adjustItem, setAdjustItem] = useState<StockItem | null>(null)
  const [quantityChange, setQuantityChange] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const [historyItem, setHistoryItem] = useState<StockItem | null>(null)
  const [history, setHistory] = useState<Movement[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')

  const loadStock = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)

    setError('')

    try {
      const response = await apiRequest<ApiResponse<StockReport>>('/reports/stock')

      if (
        !response.success ||
        !response.data ||
        !Array.isArray(response.data.items)
      ) {
        throw new Error(
          response.message || 'The stock report returned an unexpected response.',
        )
      }

      setItems(response.data.items)
      setSummary(response.data.summary ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load inventory.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadStock()
  }, [loadStock])

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return items.filter((item) => {
      const values = [
        item.productName,
        item.productSku,
        item.variantName,
        item.sku,
        item.category,
        ...(item.attributes ?? []).flatMap((attribute) => [
          attribute.name,
          attribute.value,
        ]),
      ]

      const matchesQuery =
        !needle ||
        values.some((value) => value?.toLowerCase().includes(needle))

      const matchesFilter =
        stockFilter === 'all' ||
        (stockFilter === 'low' && item.isLowStock) ||
        (stockFilter === 'zero' && item.stockQuantity === 0)

      return matchesQuery && matchesFilter
    })
  }, [items, query, stockFilter])

  async function submitAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!adjustItem) return

    const amount = Number(quantityChange)
    const reason = note.trim()

    if (!Number.isInteger(amount) || amount === 0) {
      setError('Enter a non-zero whole number. Use a positive number to add stock and a negative number to remove stock.')
      return
    }

    if (!reason) {
      setError('Please enter a reason for this stock adjustment.')
      return
    }

    if (adjustItem.stockQuantity + amount < 0) {
      setError(
        `Cannot remove ${Math.abs(amount)} ${adjustItem.unit}(s): only ${adjustItem.stockQuantity} currently available.`,
      )
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await apiRequest<ApiResponse<unknown>>(
        `/stock/variants/${encodeURIComponent(adjustItem.variantId)}/adjust`,
        {
          method: 'POST',
          body: JSON.stringify({
            quantityChange: amount,
            note: reason,
          }),
        },
      )

      if (!response.success) {
        throw new Error(response.message || 'Stock adjustment failed.')
      }

      setAdjustItem(null)
      setQuantityChange('')
      setNote('')
      await loadStock(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stock adjustment failed.')
    } finally {
      setSaving(false)
    }
  }

  async function openHistory(item: StockItem) {
    setHistoryItem(item)
    setHistory([])
    setHistoryError('')
    setHistoryLoading(true)

    try {
      const response = await apiRequest<ApiResponse<unknown>>(
        `/stock/variants/${encodeURIComponent(item.variantId)}/history`,
      )

      if (!response.success) {
        throw new Error(response.message || 'Could not load stock history.')
      }

      setHistory(unwrapMovements(response.data))
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : 'Could not load stock history.',
      )
    } finally {
      setHistoryLoading(false)
    }
  }

  return (
    <div className="page-content inventory-page">
      <header className="inventory-heading">
        <div>
          <p className="eyebrow">INVENTORY CONTROL</p>
          <h1>Inventory</h1>
          <p className="page-description">
            Monitor quantities across products and variants, adjust stock, and
            review movement history.
          </p>
        </div>

        <button
          type="button"
          className="button button-secondary"
          onClick={() => void loadStock(true)}
          disabled={loading || refreshing}
        >
          <RefreshCw
            size={16}
            className={refreshing ? 'inventory-spinning' : ''}
          />
          {refreshing ? 'Refreshing…' : 'Refresh stock'}
        </button>
      </header>

      {error && (
        <div className="inventory-alert" role="alert">
          <AlertTriangle size={17} />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}


      <section className="inventory-metrics" aria-label="Inventory summary">
        <article className="inventory-metric">
          <span>Variants</span>
          <strong>
            {summary?.totalVariants ?? (loading ? '…' : items.length)}
          </strong>
          <small>Stock records</small>
        </article>

        <article className="inventory-metric">
          <span>Total units</span>
          <strong>
            {(
              summary?.totalStockUnits ??
              items.reduce((total, item) => total + item.stockQuantity, 0)
            ).toLocaleString('en-IN')}
          </strong>
          <small>Across listed variants</small>
        </article>

        <article className="inventory-metric">
          <span>Estimated stock value</span>
          <strong>
            {money(
              items.reduce(
                (total, item) => total + (getStockValue(item) ?? 0),
                0,
              ),
            )}
          </strong>
          <small>Based on average cost or purchase price</small>
        </article>

        <article className="inventory-metric inventory-metric-warning">
          <span>Low stock</span>
          <strong>
            {summary?.lowStockVariants ??
              items.filter(item => item.isLowStock).length}
          </strong>
          <small>At configured threshold</small>
        </article>

        {/* <article className="inventory-metric">
          <span>Unknown cost</span>
          <strong>
            {summary?.unknownCostVariants ??
              items.filter(item => !item.averageCostKnown).length}
          </strong>
          <small>Cost not yet reliable</small>
        </article> */}
      </section>


      <section className="inventory-panel">
        <div className="inventory-toolbar">
          <div className="inventory-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search product, variant, SKU, attribute…"
              aria-label="Search inventory"
            />
          </div>

          <div className="inventory-filter">
            <SlidersHorizontal size={16} />
            <select
              value={stockFilter}
              onChange={(event) =>
                setStockFilter(event.target.value as typeof stockFilter)
              }
              aria-label="Filter inventory"
            >
              <option value="all">All stock</option>
              <option value="low">Low stock</option>
              <option value="zero">Out of stock</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="inventory-empty">
            <RefreshCw className="inventory-spinning" size={22} />
            <p>Loading inventory…</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="inventory-empty">
            <Boxes size={26} />
            <h3>
              {items.length ? 'No matching variants' : 'No inventory records yet'}
            </h3>
            <p>
              {items.length
                ? 'Try changing the search or stock filter.'
                : 'Create a product and variant first, then its stock will appear here.'}
            </p>
            {!items.length && (
              <Link to="/products/new" className="button button-primary">
                Add product
              </Link>
            )}
          </div>
        ) : (
          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Product / variant</th>
                  <th>Category</th>
                  <th>Attributes</th>
                  <th>Purchase</th>
                  <th>Selling</th>
                  <th>Available</th>
                  <th>Stock value</th>
                  <th>Status</th>
                  <th>
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.variantId}>
                    <td>
                      <strong>{item.productName}</strong>
                      <span className="inventory-subline">
                        {item.variantName}
                      </span>
                      <span className="inventory-sku">
                        {item.sku || item.productSku || 'No SKU'}
                      </span>
                    </td>
                    <td>{item.category || '—'}</td>
                    <td>
                      <div className="inventory-attributes">
                        {item.attributes?.length ? (
                          item.attributes.map((attribute, index) => (
                            <span key={`${attribute.name}-${index}`}>
                              <b>{attribute.name}:</b> {attribute.value}
                            </span>
                          ))
                        ) : (
                          <span className="inventory-muted">—</span>
                        )}
                      </div>
                    </td>
                    <td>{money(item.purchasePricePaise)}</td>
                    <td>{money(item.sellingPricePaise)}</td>
                    <td>
                      <strong
                        className={
                          item.stockQuantity === 0
                            ? 'inventory-quantity-zero'
                            : ''
                        }
                      >
                        {item.stockQuantity.toLocaleString('en-IN')}
                      </strong>
                      <span className="inventory-unit">{item.unit}</span>
                    </td>
                    <td>
                      <span
                        className={`inventory-status ${item.isLowStock
                          ? 'is-low'
                          : item.stockQuantity === 0
                            ? 'is-zero'
                            : 'is-okay'
                          }`}
                      >
                        {item.isLowStock
                          ? 'Low stock'
                          : item.stockQuantity === 0
                            ? 'Out of stock'
                            : 'In stock'}
                      </span>
                    </td>
                    <td>{money(getStockValue(item))}</td>
                    <td>
                      <div className="inventory-row-actions">
                        <button
                          type="button"
                          className="inventory-action-button"
                          onClick={() => {
                            setAdjustItem(item)
                            setQuantityChange('')
                            setNote('')
                            setError('')
                          }}
                        >
                          Adjust stock
                        </button>

                        <button
                          type="button"
                          className="inventory-history-button"
                          onClick={() => void openHistory(item)}
                          title="View stock history"
                          aria-label={`View stock history for ${item.productName}, ${item.variantName}`}
                        >
                          <History size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="inventory-table-footer">
              Showing {filteredItems.length} of {items.length} variants
            </div>
          </div>
        )}
      </section>

      {adjustItem && (
        <div
          className="inventory-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setAdjustItem(null)
            }
          }}
        >
          <section
            className="inventory-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="adjust-title"
          >
            <div className="inventory-modal-heading">
              <div>
                <p className="eyebrow">STOCK CONTROL</p>
                <h2 id="adjust-title">Adjust stock</h2>
                <p>
                  {adjustItem.productName} · {adjustItem.variantName}
                </p>
              </div>
              <button
                type="button"
                className="inventory-close"
                onClick={() => setAdjustItem(null)}
                disabled={saving}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            <div className="inventory-current-stock">
              <span>Current quantity</span>
              <strong>
                {adjustItem.stockQuantity} {adjustItem.unit}
              </strong>
            </div>

            <form onSubmit={submitAdjustment} className="inventory-adjust-form">
              <label>
                Stock change
                <small>
                  Enter a positive quantity to add or a negative quantity to
                  remove.
                </small>
                <input
                  autoFocus
                  type="number"
                  step="1"
                  required
                  value={quantityChange}
                  onChange={(event) => setQuantityChange(event.target.value)}
                  placeholder="Enter quantity, e.g. 5 or -2"
                />
              </label>

              <label>
                Reason for adjustment
                <small>
                  Required — explain why the stock quantity is changing.
                </small>
                <textarea
                  required
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. Damaged goods, opening stock, or stock count correction"
                />
              </label>

              {quantityChange &&
                Number.isInteger(Number(quantityChange)) &&
                Number(quantityChange) !== 0 && (
                  <p className="inventory-projected-stock">
                    New quantity:{' '}
                    <strong>
                      {adjustItem.stockQuantity + Number(quantityChange)}{' '}
                      {adjustItem.unit}
                    </strong>
                  </p>
                )}

              <div className="inventory-modal-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setAdjustItem(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save adjustment'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {historyItem && (
        <div
          className="inventory-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setHistoryItem(null)
          }}
        >
          <section
            className="inventory-modal inventory-history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-title"
          >
            <div className="inventory-modal-heading">
              <div>
                <p className="eyebrow">MOVEMENT LEDGER</p>
                <h2 id="history-title">Stock history</h2>
                <p>
                  {historyItem.productName} · {historyItem.variantName}
                </p>
              </div>
              <button
                type="button"
                className="inventory-close"
                onClick={() => setHistoryItem(null)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            <div className="inventory-current-stock">
              <span>Current quantity from stock report</span>
              <strong>
                {historyItem.stockQuantity} {historyItem.unit}
              </strong>
            </div>

            {historyLoading ? (
              <div className="inventory-empty">
                <RefreshCw className="inventory-spinning" size={22} />
                <p>Loading movement history…</p>
              </div>
            ) : historyError ? (
              <div className="inventory-alert" role="alert">
                <AlertTriangle size={17} />
                {historyError}
              </div>
            ) : history.length === 0 ? (
              <div className="inventory-empty">
                <Activity size={24} />
                <h3>No movement records returned</h3>
                <p>
                  The history endpoint did not return any movements for this
                  variant.
                </p>
              </div>
            ) : (
              <div className="inventory-history-list">
                {history.map((movement, index) => (
                  <article
                    className="inventory-movement"
                    key={
                      movement.id ??
                      `${movement.createdAt}-${index}`
                    }
                  >
                    <span
                      className={`inventory-movement-quantity ${(movement.quantityChange ?? 0) >= 0
                        ? 'positive'
                        : 'negative'
                        }`}
                    >
                      {(movement.quantityChange ?? 0) > 0 ? '+' : ''}
                      {movement.quantityChange ?? '—'}
                    </span>
                    <div className="inventory-movement-main">
                      <strong>
                        {(movement.movementType ?? 'Movement').replace(/_/g, ' ')}
                      </strong>
                      <span>
                        {movement.note ||
                          movement.referenceType ||
                          'No note recorded'}
                      </span>
                      <small>{dateTime(movement.createdAt)}</small>
                    </div>
                    {movement.unitCostPaise != null && (
                      <span className="inventory-movement-cost">
                        {money(movement.unitCostPaise)}/unit
                      </span>
                    )}
                  </article>
                ))}
              </div>
            )}

            <div className="inventory-modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setHistoryItem(null)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
