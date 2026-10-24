
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiRequest } from '../lib/api'
import './ReturnsPage.css'

type VariantInfo = {
  id?: string
  name?: string
  product?: { name?: string }
}

type TransactionItem = {
  id: string
  variantId?: string
  quantity: number
  unitCostPaise?: number | null
  unitSellingPricePaise?: number
  lineTotalPaise?: number
  variant?: VariantInfo
}

type Transaction = {
  id: string
  saleNumber?: string
  purchaseNumber?: string
  soldAt?: string
  purchasedAt?: string
  status?: string
  totalPaise: number
  items: TransactionItem[]
}

type ReturnItem = {
  id: string
  saleItemId?: string
  originalPurchaseItemId?: string | null
  variantId?: string
  quantity: number
  lineTotalPaise: number
  variant?: VariantInfo
}

type ReturnRecord = {
  id: string
  returnNumber: string
  returnedAt: string
  status: string
  totalPaise: number
  reason?: string | null
  sale?: { id: string; saleNumber?: string; soldAt?: string }
  purchase?: { id: string; purchaseNumber?: string; purchasedAt?: string }
  items: ReturnItem[]
}

type StockItem = {
  variantId: string
  stockQuantity: number
}

type ApiEnvelope<T> = {
  success: boolean
  data: T
  message?: string
}

type Tab = 'sales' | 'purchases' | 'history'

const money = (paise: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(paise / 100)

function unwrap<T>(response: ApiEnvelope<T> | T): T {
  if (
    response &&
    typeof response === 'object' &&
    'success' in response &&
    'data' in response
  ) {
    const envelope = response as ApiEnvelope<T>
    if (!envelope.success) {
      throw new Error(envelope.message || 'Request failed.')
    }
    return envelope.data
  }
  return response as T
}

function itemName(item: TransactionItem | ReturnItem) {
  const product = item.variant?.product?.name ?? 'Product'
  const variant = item.variant?.name
  return variant ? `${product} — ${variant}` : product
}

function dateLabel(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN')
}

export default function ReturnsPage() {
  const [tab, setTab] = useState<Tab>('sales')
  const [sales, setSales] = useState<Transaction[]>([])
  const [purchases, setPurchases] = useState<Transaction[]>([])
  const [saleReturns, setSaleReturns] = useState<ReturnRecord[]>([])
  const [purchaseReturns, setPurchaseReturns] = useState<ReturnRecord[]>([])
  const [stock, setStock] = useState<StockItem[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function refresh() {
    setLoading(true)
    setError('')

    try {
      const [
        salesResponse,
        purchasesResponse,
        saleReturnsResponse,
        purchaseReturnsResponse,
        stockResponse,
      ] = await Promise.all([
        apiRequest<ApiEnvelope<Transaction[]>>('/sales'),
        apiRequest<ApiEnvelope<Transaction[]>>('/purchases'),
        apiRequest<ApiEnvelope<ReturnRecord[]>>('/returns/sales'),
        apiRequest<ApiEnvelope<ReturnRecord[]>>('/returns/purchases'),
        apiRequest<ApiEnvelope<{ items: StockItem[] }>>('/reports/stock'),
      ])

      setSales(unwrap(salesResponse) ?? [])
      setPurchases(unwrap(purchasesResponse) ?? [])
      setSaleReturns(unwrap(saleReturnsResponse) ?? [])
      setPurchaseReturns(unwrap(purchaseReturnsResponse) ?? [])
      setStock(unwrap(stockResponse)?.items ?? [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load returns data.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const isSale = tab === 'sales'
  const transactions = isSale ? sales : purchases
  const eligibleTransactions = transactions.filter(
    (transaction) => (transaction.status ?? 'COMPLETED') === 'COMPLETED',
  )
  const selected = eligibleTransactions.find((item) => item.id === selectedId)

  const returnsForTab = isSale ? saleReturns : purchaseReturns
  const stockByVariant = useMemo(
    () => new Map(stock.map((item) => [item.variantId, item.stockQuantity])),
    [stock],
  )

  function returnedQuantity(itemId: string) {
    return returnsForTab.reduce((sum, record) => {
      const matching = record.items.reduce((itemSum, item) => {
        const originalId = isSale ? item.saleItemId : item.originalPurchaseItemId
        return itemSum + (originalId === itemId ? item.quantity : 0)
      }, 0)
      return sum + matching
    }, 0)
  }

  function remainingQuantity(item: TransactionItem) {
    return Math.max(0, item.quantity - returnedQuantity(item.id))
  }

  function availableToReturn(item: TransactionItem) {
    const remaining = remainingQuantity(item)
    if (isSale) return remaining

    const currentStock =
      item.variantId != null ? stockByVariant.get(item.variantId) : undefined

    return Math.min(remaining, currentStock ?? 0)
  }

  function chooseTransaction(id: string) {
    setSelectedId(id)
    setQuantities({})
    setReason('')
    setError('')
    setMessage('')
  }

  function switchTab(next: Tab) {
    setTab(next)
    setSelectedId('')
    setQuantities({})
    setReason('')
    setError('')
    setMessage('')
  }

  const selectedItems = selected?.items ?? []
  const selectedQuantityTotal = selectedItems.reduce(
    (sum, item) => sum + Number(quantities[item.id] || 0),
    0,
  )

  async function submitReturn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!selected) {
      setError(`Select a ${isSale ? 'sale' : 'purchase'} first.`)
      return
    }

    const items = selectedItems
      .map((item) => ({
        item,
        quantity: Number(quantities[item.id] || 0),
      }))
      .filter(({ quantity }) => quantity > 0)

    if (items.length === 0) {
      setError('Enter a return quantity for at least one item.')
      return
    }

    for (const { item, quantity } of items) {
      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        setError('Return quantities must be positive whole numbers.')
        return
      }

      if (quantity > availableToReturn(item)) {
        setError(
          `${itemName(item)}: maximum quantity available to return is ${availableToReturn(item)}.`,
        )
        return
      }
    }

    setSaving(true)

    try {
      const payload = isSale
        ? {
            saleId: selected.id,
            reason: reason.trim() || null,
            items: items.map(({ item, quantity }) => ({
              saleItemId: item.id,
              quantity,
            })),
          }
        : {
            purchaseId: selected.id,
            reason: reason.trim() || null,
            items: items.map(({ item, quantity }) => ({
              originalPurchaseItemId: item.id,
              quantity,
            })),
          }

      const endpoint = isSale ? '/returns/sales' : '/returns/purchases'

      await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setMessage(
        isSale
          ? 'Sales return recorded. Returned items have been added back to stock.'
          : 'Purchase return recorded. Returned items have been deducted from stock.',
      )
      setSelectedId('')
      setQuantities({})
      setReason('')
      await refresh()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to record this return.',
      )
    } finally {
      setSaving(false)
    }
  }

  const history = [
    ...saleReturns.map((record) => ({
      ...record,
      kind: 'Sales return' as const,
      originalReference: record.sale?.saleNumber ?? record.sale?.id.slice(0, 8) ?? '—',
    })),
    ...purchaseReturns.map((record) => ({
      ...record,
      kind: 'Purchase return' as const,
      originalReference:
        record.purchase?.purchaseNumber ?? record.purchase?.id.slice(0, 8) ?? '—',
    })),
  ].sort(
    (a, b) =>
      new Date(b.returnedAt).getTime() - new Date(a.returnedAt).getTime(),
  )

  return (
    <div className="returns-page">
      <header className="returns-header">
        <div>
          <p className="returns-eyebrow">INVENTORY MANAGEMENT</p>
          <h1>Returns</h1>
          <p>Process customer returns and supplier returns, and review history.</p>
        </div>
        <button
          className="returns-button returns-button-secondary"
          type="button"
          onClick={() => void refresh()}
          disabled={loading || saving}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <div className="returns-tabs" role="tablist" aria-label="Return type">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sales'}
          className={tab === 'sales' ? 'active' : ''}
          onClick={() => switchTab('sales')}
        >
          Sales returns
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'purchases'}
          className={tab === 'purchases' ? 'active' : ''}
          onClick={() => switchTab('purchases')}
        >
          Purchase returns
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'history'}
          className={tab === 'history' ? 'active' : ''}
          onClick={() => switchTab('history')}
        >
          Return history
        </button>
      </div>

      {error && <div className="returns-alert returns-alert-error" role="alert">{error}</div>}
      {message && <div className="returns-alert returns-alert-success" role="status">{message}</div>}

      {loading ? (
        <section className="returns-panel"><p>Loading return data…</p></section>
      ) : tab === 'history' ? (
        <section className="returns-panel">
          <div className="returns-panel-heading">
            <div>
              <h2>Return history</h2>
              <p>{history.length} recorded return{history.length === 1 ? '' : 's'}</p>
            </div>
          </div>

          {history.length === 0 ? (
            <div className="returns-empty">
              <h3>No returns recorded yet</h3>
              <p>Completed sales and purchase returns will appear here.</p>
            </div>
          ) : (
            <div className="returns-table-wrap">
              <table className="returns-table">
                <thead>
                  <tr>
                    <th>Return reference</th>
                    <th>Type</th>
                    <th>Original transaction</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Reason</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => (
                    <tr key={`${record.kind}-${record.id}`}>
                      <td>{record.returnNumber}</td>
                      <td>{record.kind}</td>
                      <td>{record.originalReference}</td>
                      <td>{dateLabel(record.returnedAt)}</td>
                      <td>
                        {record.items.map((item) => (
                          <div key={item.id}>
                            {itemName(item)} × {item.quantity}
                          </div>
                        ))}
                      </td>
                      <td>{record.reason || '—'}</td>
                      <td>{money(record.totalPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="returns-panel">
            <div className="returns-panel-heading">
              <div>
                <h2>{isSale ? 'Record a sales return' : 'Record a purchase return'}</h2>
                <p>
                  {isSale
                    ? 'Choose the original sale and the items returned by the customer.'
                    : 'Choose the original purchase and the items being returned to the supplier.'}
                </p>
              </div>
            </div>

            <form className="returns-form" onSubmit={submitReturn}>
              <label>
                Original {isSale ? 'sale' : 'purchase'}
                <select
                  value={selectedId}
                  onChange={(event) => chooseTransaction(event.target.value)}
                  required
                >
                  <option value="">Select a transaction</option>
                  {eligibleTransactions.map((transaction) => {
                    const reference = isSale
                      ? transaction.saleNumber
                      : transaction.purchaseNumber
                    const date = isSale ? transaction.soldAt : transaction.purchasedAt

                    return (
                      <option key={transaction.id} value={transaction.id}>
                        {reference ?? transaction.id.slice(0, 8)} · {dateLabel(date)} · {money(transaction.totalPaise)}
                      </option>
                    )
                  })}
                </select>
              </label>

              {selected && (
                <>
                  <div className="returns-items-heading">
                    <h3>Items in this transaction</h3>
                    <span>Enter quantities to return</span>
                  </div>

                  <div className="returns-items">
                    {selectedItems.map((item) => {
                      const maximum = availableToReturn(item)
                      const alreadyReturned = returnedQuantity(item.id)

                      return (
                        <div className="returns-item-row" key={item.id}>
                          <div className="returns-item-info">
                            <strong>{itemName(item)}</strong>
                            <span>
                              Sold / purchased: {item.quantity} · Already returned: {alreadyReturned}
                            </span>
                            {!isSale && (
                              <span>
                                Current stock: {item.variantId ? stockByVariant.get(item.variantId) ?? 0 : 0}
                              </span>
                            )}
                          </div>
                          <div className="returns-item-quantity">
                            <label htmlFor={`return-qty-${item.id}`}>Return quantity</label>
                            <input
                              id={`return-qty-${item.id}`}
                              type="number"
                              min="0"
                              max={maximum}
                              step="1"
                              value={quantities[item.id] ?? ''}
                              placeholder="0"
                              onChange={(event) =>
                                setQuantities((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))
                              }
                              disabled={maximum === 0 || saving}
                            />
                            <small>Maximum: {maximum}</small>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <label>
                    Reason (optional)
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Enter the reason for this return"
                      disabled={saving}
                    />
                  </label>

                  <div className="returns-submit-row">
                    <span>
                      {selectedQuantityTotal} unit{selectedQuantityTotal === 1 ? '' : 's'} selected
                    </span>
                    <button
                      className="returns-button returns-button-primary"
                      type="submit"
                      disabled={saving || selectedQuantityTotal < 1}
                    >
                      {saving ? 'Processing…' : 'Process return'}
                    </button>
                  </div>
                </>
              )}

              {!selected && (
                <div className="returns-empty">
                  <h3>Select a transaction</h3>
                  <p>Choose a completed {isSale ? 'sale' : 'purchase'} above to view its items.</p>
                </div>
              )}
            </form>
          </section>

          <section className="returns-panel returns-guidance">
            <h2>Before processing</h2>
            <ul>
              <li>Only completed transactions can be returned.</li>
              <li>You cannot return more units than the original remaining quantity.</li>
              <li>
                {isSale
                  ? 'Sales returns add the returned quantity back to stock.'
                  : 'Purchase returns reduce stock, and the backend checks current availability.'}
              </li>
              <li>The return amount is calculated by the backend from the original transaction.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
