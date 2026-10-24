import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  Boxes,
  CircleAlert,
  FileBarChart,
  Package,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import './ReportsPages.css'

type ApiResult<T> = { success: boolean; data: T }
type DateFilters = { from: string; to: string }
type ReportSummary = Record<string, number | boolean | null | undefined>

type StockItem = {
  variantId: string
  productId: string
  productName: string
  productSku?: string | null
  category?: string | null
  variantName?: string | null
  sku?: string | null
  unit?: string | null
  attributes?: Record<string, unknown> | unknown[] | null
  stockQuantity: number
  lowStockThreshold?: number | null
  isLowStock?: boolean
  purchasePricePaise?: number | null
  sellingPricePaise?: number | null
  averageCostPaise?: number | null
  averageCostKnown?: boolean
  stockValueAtAverageCostPaise?: number | null
  isActive?: boolean
}

type TransactionItem = {
  id?: string
  productName?: string
  variantName?: string
  sku?: string
  quantity?: number
  unitPricePaise?: number | null
  sellingPricePaise?: number | null
  purchasePricePaise?: number | null
  lineTotalPaise?: number | null
  totalPaise?: number | null
  costTotalPaise?: number | null
  unitCostPaise?: number | null
  [key: string]: unknown
}

type SaleRow = {
  id: string
  saleNumber: string
  soldAt: string
  totalPaise: number
  returnedPaise?: number
  items?: TransactionItem[]
}
type PurchaseRow = {
  id: string
  purchaseNumber: string
  purchasedAt: string
  supplier?: { name?: string | null } | string | null
  totalPaise: number
  returnedPaise?: number
  items?: TransactionItem[]
}
type StockReport = { summary: ReportSummary; items: StockItem[] }
type SalesReport = { filters?: { from?: string | null; to?: string | null }; summary: ReportSummary; sales: SaleRow[] }
type PurchasesReport = { filters?: { from?: string | null; to?: string | null }; summary: ReportSummary; purchases: PurchaseRow[] }
type ProfitReport = { filters?: { from?: string | null; to?: string | null }; summary: ReportSummary }

const money = (paise: unknown) => {
  if (typeof paise !== 'number' || !Number.isFinite(paise)) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100)
}

const number = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-IN').format(value)
    : '—'

const dateTime = (value: unknown) => {
  if (typeof value !== 'string' || !value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}


function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong while loading the report.'
}

function useReport<T>(path: string, filters?: DateFilters) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const query = filters
    ? new URLSearchParams({
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
      }).toString()
    : ''

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await apiRequest<ApiResult<T>>(`${path}${query ? `?${query}` : ''}`)
      setData(result.data)
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [path, query])

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, error, reload: load }
}

function ReportPageHeader({
  eyebrow = 'REPORTS',
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="report-page-header">
      <div>
        <div className="report-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="report-header-actions">{actions}</div>}
    </div>
  )
}


function BackToReports() {
  return (
    <Link to="/reports" className="report-back-link">
      <ArrowRight size={16} className="report-back-arrow" />
      Back to Reports
    </Link>
  )
}

function ReportState({
  loading,
  error,
  onRetry,
}: {
  loading: boolean
  error: string
  onRetry: () => void
}) {
  if (loading) {
    return (
      <div className="report-state" role="status">
        <RefreshCw size={20} className="report-spin" />
        <span>Loading report…</span>
      </div>
    )
  }
  if (error) {
    return (
      <div className="report-state report-state-error" role="alert">
        <CircleAlert size={20} />
        <div>
          <strong>Could not load this report</strong>
          <p>{error}</p>
          <button className="report-button report-button-secondary" onClick={onRetry}>
            <RefreshCw size={15} /> Try again
          </button>
        </div>
      </div>
    )
  }
  return null
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: string
  detail?: string
  icon: typeof Boxes
  tone?: 'default' | 'positive' | 'warning'
}) {
  return (
    <article className={`report-metric report-metric-${tone}`}>
      <div className="report-metric-top">
        <span>{label}</span>
        <span className="report-metric-icon"><Icon size={18} /></span>
      </div>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  )
}

function DateFilter({
  filters,
  onChange,
  onClear,
}: {
  filters: DateFilters
  onChange: (next: DateFilters) => void
  onClear: () => void
}) {
  return (
    <div className="report-date-filter">
      <label>
        <span>From</span>
        <input
          type="date"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(event) => onChange({ ...filters, from: event.target.value })}
        />
      </label>
      <label>
        <span>To</span>
        <input
          type="date"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(event) => onChange({ ...filters, to: event.target.value })}
        />
      </label>
      <button className="report-button report-button-secondary" onClick={onClear} type="button">
        Clear dates
      </button>
    </div>
  )
}

function useDateFilters() {
  const [filters, setFilters] = useState<DateFilters>({ from: '', to: '' })
  const clear = () => setFilters({ from: '', to: '' })
  return { filters, setFilters, clear }
}

export function ReportsOverviewPage() {
  const cards = [
    {
      title: 'Stock report',
      description: 'Review current quantities, low-stock items, and stock valuation.',
      path: '/reports/stock',
      icon: Boxes,
      label: 'Inventory',
    },
    {
      title: 'Sales report',
      description: 'See completed sales, sales totals, and customer returns.',
      path: '/reports/sales',
      icon: ShoppingBag,
      label: 'Revenue',
    },
    {
      title: 'Purchases report',
      description: 'Review incoming stock, supplier purchases, and purchase returns.',
      path: '/reports/purchases',
      icon: ShoppingCart,
      label: 'Stock costs',
    },
    {
      title: 'Profit report',
      description: 'Compare sales revenue against recorded cost of goods sold.',
      path: '/reports/profit',
      icon: BarChart3,
      label: 'Performance',
    },
  ]

  return (
    <div className="reports-page">
      <ReportPageHeader
        title="Reports"
        description="A clear view of your stock, transactions, and business performance."
      />
      <div className="report-overview-grid">
        {cards.map(({ title, description, path, icon: Icon, label }) => (
          <Link to={path} className="report-link-card" key={path}>
            <div className="report-link-card-top">
              <span className="report-link-icon"><Icon size={21} /></span>
              <span className="report-card-label">{label}</span>
            </div>
            <h2>{title}</h2>
            <p>{description}</p>
            <span className="report-card-link">Open report <ArrowRight size={16} /></span>
          </Link>
        ))}
      </div>
      <div className="report-note">
        <FileBarChart size={19} />
        <div>
          <strong>About these reports</strong>
          <p>Reports use recorded transactions. Profit is only shown as complete when the required sale costs are available.</p>
        </div>
      </div>
    </div>
  )
}

export function StockReportPage() {
  const { data, loading, error, reload } = useReport<StockReport>('/reports/stock')
  const items = data?.items ?? []
  const summary = data?.summary ?? {}
  const lowStock = items.filter((item) => item.isLowStock)

  return (
    <div className="reports-page">
      <BackToReports />
      <ReportPageHeader
        title="Stock report"
        description="Current stock levels and recorded inventory valuation."
        actions={<button className="report-button report-button-secondary" onClick={() => void reload()}><RefreshCw size={15} /> Refresh</button>}
      />
      <ReportState loading={loading} error={error} onRetry={() => void reload()} />
      {!loading && !error && (
        <>
          <div className="report-metrics-grid">
            <MetricCard label="Variants tracked" value={number(summary.totalVariants)} icon={Package} />
            <MetricCard label="Units in stock" value={number(summary.totalStockUnits)} icon={Boxes} />
            <MetricCard label="Low-stock variants" value={number(summary.lowStockVariants)} detail="At or below configured threshold" icon={CircleAlert} tone={lowStock.length ? 'warning' : 'default'} />
          </div>
          {lowStock.length > 0 && (
            <div className="report-warning"><CircleAlert size={18} /><span><strong>{number(lowStock.length)} variants need attention.</strong> Review the low-stock rows below.</span></div>
          )}
          <section className="report-panel">
            <div className="report-panel-heading">
              <div><h2>Stock by variant</h2><p>{number(items.length)} active variants</p></div>
            </div>
            <div className="report-table-wrap">
              <table className="report-table">
                <thead><tr><th>Product / variant</th><th>SKU</th><th>Category</th><th className="numeric">In stock</th><th className="numeric">Low-stock at</th><th className="numeric">Buying price</th><th className="numeric">Selling price</th><th className="numeric">Stock value</th><th>Status</th></tr></thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.variantId}>
                      <td><strong>{item.productName}</strong><small>{item.variantName || 'Default variant'}</small></td>
                      <td>{item.sku || item.productSku || '—'}</td>
                      <td>{item.category || '—'}</td>
                      <td className="numeric">{number(item.stockQuantity)} {item.unit || ''}</td>
                      <td className="numeric">{number(item.lowStockThreshold)}</td>
                      <td className="numeric">{money(item.purchasePricePaise)}</td>
                      <td className="numeric">{money(item.sellingPricePaise)}</td>
                      <td className="numeric">{item.stockValueAtAverageCostPaise == null ? <span className="muted">Unknown</span> : money(item.stockValueAtAverageCostPaise)}</td>
                      <td><span className={`report-status ${item.isLowStock ? 'report-status-warning' : 'report-status-ok'}`}>{item.isLowStock ? 'Low stock' : 'In stock'}</span></td>
                    </tr>
                  ))}
                  {items.length === 0 && <tr><td colSpan={9} className="report-empty">No stock report rows found.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="report-footnote">Stock value uses the backend’s average-cost calculation. “Unknown” means a reliable average cost is not available; it is not treated as ₹0.</p>
          </section>
        </>
      )}
    </div>
  )
}

export function SalesReportPage() {
  const { filters, setFilters, clear } = useDateFilters()
  const { data, loading, error, reload } = useReport<SalesReport>('/reports/sales', filters)
  const summary = data?.summary ?? {}
  const sales = data?.sales ?? []

  return (
    <div className="reports-page">
      <BackToReports />
      <ReportPageHeader title="Sales report" description="Completed sales, returned amounts, and net sales." actions={<button className="report-button report-button-secondary" onClick={() => void reload()}><RefreshCw size={15} /> Refresh</button>} />
      <DateFilter filters={filters} onChange={setFilters} onClear={clear} />
      <ReportState loading={loading} error={error} onRetry={() => void reload()} />
      {!loading && !error && (
        <>
          <div className="report-metrics-grid">
            <MetricCard label="Completed sales" value={number(summary.saleCount)} icon={ShoppingBag} />
            <MetricCard label="Units sold" value={number(summary.unitsSold)} icon={Boxes} />
            <MetricCard label="Gross sales" value={money(summary.grossSalesPaise)} icon={ArrowDownToLine} />
            <MetricCard label="Net sales" value={money(summary.netSalesPaise)} detail={`${money(summary.salesReturnsPaise)} returned`} icon={BarChart3} tone="positive" />
          </div>
          <section className="report-panel">
            <div className="report-panel-heading"><div><h2>Sales transactions</h2><p>{number(sales.length)} completed sales in this date range</p></div></div>
            <div className="report-table-wrap">
              <table className="report-table">
                <thead><tr><th>Sale</th><th>Date</th><th>Items</th><th className="numeric">Gross total</th><th className="numeric">Returned</th><th className="numeric">Net total</th></tr></thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id}>
                      <td><strong>{sale.saleNumber || sale.id}</strong></td>
                      <td>{dateTime(sale.soldAt)}</td>
                      <td>{number(sale.items?.reduce((sum, item) => sum + (item.quantity ?? 0), 0))} units</td>
                      <td className="numeric">{money(sale.totalPaise)}</td>
                      <td className="numeric">{money(sale.returnedPaise ?? 0)}</td>
                      <td className="numeric"><strong>{money(sale.totalPaise - (sale.returnedPaise ?? 0))}</strong></td>
                    </tr>
                  ))}
                  {sales.length === 0 && <tr><td colSpan={6} className="report-empty">No completed sales found for the selected dates.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export function PurchasesReportPage() {
  const { filters, setFilters, clear } = useDateFilters()
  const { data, loading, error, reload } = useReport<PurchasesReport>('/reports/purchases', filters)
  const summary = data?.summary ?? {}
  const purchases = data?.purchases ?? []

  return (
    <div className="reports-page">
      <BackToReports />
      <ReportPageHeader title="Purchases report" description="Completed purchases, supplier returns, and net purchase cost." actions={<button className="report-button report-button-secondary" onClick={() => void reload()}><RefreshCw size={15} /> Refresh</button>} />
      <DateFilter filters={filters} onChange={setFilters} onClear={clear} />
      <ReportState loading={loading} error={error} onRetry={() => void reload()} />
      {!loading && !error && (
        <>
          <div className="report-metrics-grid">
            <MetricCard label="Completed purchases" value={number(summary.purchaseCount)} icon={ShoppingCart} />
            <MetricCard label="Units purchased" value={number(summary.unitsPurchased)} icon={Boxes} />
            <MetricCard label="Gross purchases" value={money(summary.grossPurchasesPaise)} icon={ArrowDownToLine} />
            <MetricCard label="Net purchases" value={money(summary.netPurchasesPaise)} detail={`${money(summary.purchaseReturnsPaise)} returned`} icon={BarChart3} />
          </div>
          <section className="report-panel">
            <div className="report-panel-heading"><div><h2>Purchase transactions</h2><p>{number(purchases.length)} completed purchases in this date range</p></div></div>
            <div className="report-table-wrap">
              <table className="report-table">
                <thead><tr><th>Purchase</th><th>Date</th><th>Supplier</th><th>Items</th><th className="numeric">Gross total</th><th className="numeric">Returned</th><th className="numeric">Net total</th></tr></thead>
                <tbody>
                  {purchases.map((purchase) => {
                    const supplier = typeof purchase.supplier === 'string' ? purchase.supplier : purchase.supplier?.name
                    return (
                      <tr key={purchase.id}>
                        <td><strong>{purchase.purchaseNumber || purchase.id}</strong></td>
                        <td>{dateTime(purchase.purchasedAt)}</td>
                        <td>{supplier || '—'}</td>
                        <td>{number(purchase.items?.reduce((sum, item) => sum + (item.quantity ?? 0), 0))} units</td>
                        <td className="numeric">{money(purchase.totalPaise)}</td>
                        <td className="numeric">{money(purchase.returnedPaise ?? 0)}</td>
                        <td className="numeric"><strong>{money(purchase.totalPaise - (purchase.returnedPaise ?? 0))}</strong></td>
                      </tr>
                    )
                  })}
                  {purchases.length === 0 && <tr><td colSpan={7} className="report-empty">No completed purchases found for the selected dates.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export function ProfitReportPage() {
  const { filters, setFilters, clear } = useDateFilters()
  const { data, loading, error, reload } = useReport<ProfitReport>('/reports/profit', filters)
  const summary = data?.summary ?? {}
  const complete = summary.profitComplete === true
  const profit = typeof summary.grossProfitPaise === 'number' ? summary.grossProfitPaise : null
  const profitTone = profit == null ? 'default' : profit >= 0 ? 'positive' : 'warning'

  return (
    <div className="reports-page">
      <BackToReports />
      <ReportPageHeader title="Profit report" description="Gross profit based on completed sales, recorded costs, and sales returns." actions={<button className="report-button report-button-secondary" onClick={() => void reload()}><RefreshCw size={15} /> Refresh</button>} />
      <DateFilter filters={filters} onChange={setFilters} onClear={clear} />
      <ReportState loading={loading} error={error} onRetry={() => void reload()} />
      {!loading && !error && (
        <>
          {!complete && (
            <div className="report-warning report-warning-large">
              <CircleAlert size={20} />
              <div>
                <strong>Profit calculation is incomplete</strong>
                <p>{number(summary.unknownCostItems)} sale/return line(s) have missing cost information. Gross profit is intentionally not displayed as a number until all required costs are known.</p>
              </div>
            </div>
          )}
          <div className="report-metrics-grid">
            <MetricCard label="Sales revenue after returns" value={money(summary.salesRevenuePaise)} detail="Completed sales less completed sales returns" icon={ShoppingBag} />
            <MetricCard label="Cost of goods sold" value={money(summary.costOfGoodsSoldPaise)} detail="Based on recorded sale-item costs" icon={Boxes} />
            <MetricCard label="Gross profit" value={complete && profit != null ? money(profit) : 'Incomplete'} detail={complete ? 'Revenue minus cost of goods sold' : 'Missing costs prevent a reliable result'} icon={BarChart3} tone={profitTone} />
            <MetricCard label="Units returned" value={number(summary.returnedUnits)} detail={`Purchase returns: ${money(summary.purchaseReturnsPaise)}`} icon={RefreshCw} />
          </div>
          <section className="report-panel report-profit-explanation">
            <div className="report-panel-heading"><div><h2>How to read this report</h2><p>Values follow the backend report calculation.</p></div></div>
            <ul>
              <li><strong>Sales revenue</strong> includes completed sales and subtracts completed sales returns within the selected date range.</li>
              <li><strong>Cost of goods sold</strong> uses recorded sale-item costs. Unknown costs are not assumed to be zero.</li>
              <li><strong>Gross profit</strong> is shown only when the backend marks the calculation complete.</li>
              <li><strong>Purchase returns</strong> are shown separately; they are not subtracted again from sales revenue.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
