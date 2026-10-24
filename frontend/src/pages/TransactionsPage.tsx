
import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest } from '../lib/api'
import './TransactionsPage.css'

type Variant = {
  variantId?: string
  id?: string
  productName?: string
  variantName?: string
  name?: string
  sku?: string
  stockQuantity?: number
  sellingPricePaise?: number
  purchasePricePaise?: number
}

type Transaction = {
  id: string
  saleNumber?: string
  purchaseNumber?: string
  soldAt?: string
  purchasedAt?: string
  totalPaise: number
  notes?: string | null
  status?: string
  cancellationEligible?: boolean
  cancellationBlockedReason?: string | null
  items?: Array<{
    id: string
    quantity: number
    variant?: {
      name?: string
      product?: { name: string }
    }
  }>
}

type Props = { mode: 'sales' | 'purchases' }

const money = (paise: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(paise / 100)

function unwrap<T>(result: any): T {
  return result?.data ?? result
}

export default function TransactionsPage({ mode }: Props) {
  const isSale = mode === 'sales'
  const endpoint = isSale ? '/sales' : '/purchases'

  const [variants, setVariants] = useState<Variant[]>([])
  const [history, setHistory] = useState<Transaction[]>([])
  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [cancelTarget, setCancelTarget] = useState<Transaction | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  async function refresh() {
    setLoading(true)
    setError('')

    try {
      const [stockResult, historyResult] = await Promise.all([
        apiRequest<any>('/reports/stock'),
        apiRequest<any>(endpoint),
      ])

      const stock = unwrap<any>(stockResult)
      const transactions = unwrap<any>(historyResult)

      setVariants(
        (stock?.items ?? []).filter(
          (v: Variant) => v.variantId || v.id,
        ),
      )

      setHistory(Array.isArray(transactions) ? transactions : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [endpoint])

  function chooseVariant(id: string) {
    setVariantId(id)

    const variant = variants.find(
      v => (v.variantId ?? v.id) === id,
    )

    const paise = isSale
      ? variant?.sellingPricePaise
      : variant?.purchasePricePaise

    setPrice(paise == null ? '' : (paise / 100).toFixed(2))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    const qty = Number(quantity)
    const amount = Number(price)

    if (
      !variantId ||
      !Number.isInteger(qty) ||
      qty < 1 ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      setError('Select a product and enter a valid quantity and price.')
      return
    }

    const selected = variants.find(
      v => (v.variantId ?? v.id) === variantId,
    )

    if (
      isSale &&
      selected?.stockQuantity != null &&
      qty > selected.stockQuantity
    ) {
      setError(
        `Only ${selected.stockQuantity} units are currently available.`,
      )
      return
    }

    setSaving(true)

    try {
      const item = isSale
        ? {
          variantId,
          quantity: qty,
          unitSellingPricePaise: Math.round(amount * 100),
        }
        : {
          variantId,
          quantity: qty,
          unitCostPaise: Math.round(amount * 100),
        }

      await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          items: [item],
          notes: notes.trim() || null,
        }),
      })

      setMessage(
        isSale
          ? 'Sale recorded.'
          : 'Purchase recorded. Stock updated.',
      )

      setVariantId('')
      setQuantity('1')
      setPrice('')
      setNotes('')

      await refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save transaction.',
      )
    } finally {
      setSaving(false)
    }
  }

  function openCancelDialog(transaction: Transaction) {
    if (
      transaction.status !== 'COMPLETED' ||
      transaction.cancellationEligible !== true
    ) {
      return
    }

    setError('')
    setMessage('')
    setCancelReason('')
    setCancelTarget(transaction)
  }

  function closeCancelDialog() {
    if (cancelling) return

    setCancelTarget(null)
    setCancelReason('')
  }

  async function confirmCancellation() {
    if (
      !cancelTarget ||
      cancelling ||
      cancelTarget.status !== 'COMPLETED' ||
      cancelTarget.cancellationEligible !== true
    ) {
      return
    }

    setError('')
    setMessage('')
    setCancelling(true)

    try {
      await apiRequest(
        `/purchases/${encodeURIComponent(cancelTarget.id)}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({
            reason: cancelReason.trim(),
          }),
        },
      )

      const cancelledReference =
        cancelTarget.purchaseNumber ?? cancelTarget.id.slice(0, 8)

      setCancelTarget(null)
      setCancelReason('')
      setMessage(
        `Purchase ${cancelledReference} cancelled successfully.`,
      )

      await refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to cancel this purchase.',
      )
    } finally {
      setCancelling(false)
    }
  }

  const filteredHistory = history.filter(transaction => {
    const rawDate = isSale
      ? transaction.soldAt
      : transaction.purchasedAt

    if (!rawDate) return !from && !to

    const date = new Date(rawDate).toISOString().slice(0, 10)

    return (!from || date >= from) && (!to || date <= to)
  })

  const total =
    Math.round(Number(price || 0) * 100) * Number(quantity || 0)

  return (
    <main className="tx-page">
      <header className="tx-header">
        <div>
          <p className="tx-eyebrow">INVENTORY MANAGEMENT</p>
          <h1>{isSale ? 'Sales' : 'Purchases'}</h1>
          <p>
            {isSale
              ? 'Record sales and review transaction history.'
              : 'Record incoming stock and review purchases.'}
          </p>
        </div>

        <button
          className="tx-secondary"
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      {error && (
        <div className="tx-error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="tx-success" role="status">
          {message}
        </div>
      )}

      <section className="tx-panel">
        <h2>{isSale ? 'Record a sale' : 'Record a purchase'}</h2>

        <form onSubmit={submit} className="tx-form">
          <label>
            Product / variant
            <select
              value={variantId}
              onChange={e => chooseVariant(e.target.value)}
              required
            >
              <option value="">Select a variant</option>

              {variants.map(v => {
                const id = v.variantId ?? v.id ?? ''

                return (
                  <option key={id} value={id}>
                    {v.productName ?? 'Product'}
                    {v.variantName || v.name
                      ? ` — ${v.variantName ?? v.name}`
                      : ''}
                    {v.sku ? ` (${v.sku})` : ''}
                    {` · Stock: ${v.stockQuantity ?? 0}`}
                  </option>
                )
              })}
            </select>
          </label>

          <div className="tx-fields">
            <label>
              Quantity
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                required
              />
            </label>

            <label>
              {isSale
                ? 'Selling price per unit (₹)'
                : 'Buying price per unit (₹)'}
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                required
              />
            </label>
          </div>

          <label>
            Notes (optional)
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional transaction note"
            />
          </label>

          <div className="tx-total">
            <span>Transaction total</span>
            <strong>{money(total)}</strong>
          </div>

          <button
            className="tx-primary"
            type="submit"
            disabled={saving || loading}
          >
            {saving
              ? 'Saving...'
              : isSale
                ? 'Save sale'
                : 'Save purchase'}
          </button>
        </form>
      </section>

      <section className="tx-panel">
        <h2>{isSale ? 'Sale history' : 'Purchase history'}</h2>

        <div className="tx-filters">
          <label>
            From
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
            />
          </label>

          <label>
            To
            <input
              type="date"
              min={from || undefined}
              value={to}
              onChange={e => setTo(e.target.value)}
            />
          </label>

          <button
            className="tx-secondary"
            type="button"
            onClick={() => {
              setFrom('')
              setTo('')
            }}
          >
            Clear dates
          </button>
        </div>

        {loading ? (
          <p>Loading history...</p>
        ) : filteredHistory.length === 0 ? (
          <p className="tx-empty">
            No transactions found for these dates.
          </p>
        ) : (
          <div className="tx-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Notes</th>
                  <th>Total</th>
                  {!isSale && <th>Status</th>}
                  {!isSale && <th>Actions</th>}
                </tr>
              </thead>

              <tbody>
                {filteredHistory.map(transaction => {
                  const date = isSale
                    ? transaction.soldAt
                    : transaction.purchasedAt

                  const reference = isSale
                    ? transaction.saleNumber
                    : transaction.purchaseNumber

                  const status = (
                    transaction.status ?? 'COMPLETED'
                  ).toUpperCase()

                  const cancellationAllowed =
                    status === 'COMPLETED' &&
                    transaction.cancellationEligible === true

                  const blockedReason =
                    transaction.cancellationBlockedReason ||
                    'Cancellation Unavailable'

                  return (
                    <tr key={transaction.id}>
                      <td>
                        {reference ?? transaction.id.slice(0, 8)}
                      </td>

                      <td>
                        {date
                          ? new Date(date).toLocaleDateString('en-IN')
                          : '—'}
                      </td>

                      <td>
                        {(transaction.items ?? []).map(item => (
                          <div key={item.id}>
                            {item.variant?.product?.name ?? 'Product'}
                            {item.variant?.name
                              ? ` — ${item.variant.name}`
                              : ''}
                            {' × '}
                            {item.quantity}
                          </div>
                        ))}
                      </td>

                      <td>{transaction.notes || '—'}</td>
                      <td>{money(transaction.totalPaise)}</td>

                      {!isSale && (
                        <td>
                          <span
                            className={`tx-status ${status === 'CANCELLED'
                              ? 'tx-status-cancelled'
                              : 'tx-status-completed'
                              }`}
                          >
                            {status}
                          </span>
                        </td>
                      )}

                      {!isSale && (
                        <td>
                          {status !== 'COMPLETED' ? (
                            <span className="tx-muted">
                              No actions
                            </span>
                          ) : (
                            <div className="tx-cancel-action">
                              <button
                                type="button"
                                className="tx-danger"
                                disabled={
                                  loading ||
                                  cancelling ||
                                  !cancellationAllowed
                                }
                                title={
                                  cancellationAllowed
                                    ? 'Cancel this purchase'
                                    : blockedReason
                                }
                                onClick={() =>
                                  openCancelDialog(transaction)
                                }
                              >
                                Cancel purchase
                              </button>

                              {!cancellationAllowed && (
                                <small className="tx-cancel-reason">
                                  {blockedReason}
                                </small>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {cancelTarget && (
        <div
          className="tx-dialog-backdrop"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              closeCancelDialog()
            }
          }}
        >
          <section
            className="tx-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tx-cancel-title"
          >
            <h2 id="tx-cancel-title">Cancel purchase?</h2>

            <p>
              You are about to cancel purchase{' '}
              <strong>
                {cancelTarget.purchaseNumber ??
                  cancelTarget.id.slice(0, 8)}
              </strong>{' '}
              totalling{' '}
              <strong>{money(cancelTarget.totalPaise)}</strong>.
            </p>

            <p>
              If accepted by the backend, the stock will be reversed
              and the purchase will remain in history as cancelled.
            </p>

            <label className="tx-dialog-label">
              Cancellation reason (optional)
              <textarea
                rows={3}
                value={cancelReason}
                onChange={event =>
                  setCancelReason(event.target.value)
                }
                placeholder="Enter the reason for cancellation"
                maxLength={500}
                disabled={cancelling}
              />
            </label>

            <div className="tx-dialog-actions">
              <button
                type="button"
                className="tx-secondary"
                onClick={closeCancelDialog}
                disabled={cancelling}
              >
                Keep purchase
              </button>

              <button
                type="button"
                className="tx-danger"
                onClick={() => void confirmCancellation()}
                disabled={cancelling}
              >
                {cancelling
                  ? 'Cancelling...'
                  : 'Confirm cancellation'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
