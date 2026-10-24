

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {

  Activity,

  ArrowDownLeft,

  ArrowDownRight,

  ArrowRight,

  ArrowUpRight,

  BarChart3,

  // Bell,

  Boxes,

  BriefcaseBusiness,


  // ChevronLeft,

  ChevronRight,

  CircleHelp,

  Command,

  // CreditCard,

  Database,

  FileBarChart,

  LayoutDashboard,

  // LifeBuoy,

  Menu,

  Package,

  PackagePlus,

  PanelLeftClose,

  PanelLeftOpen,

  Plus,

  Search,

  Settings,

  ShieldCheck,

  ShoppingBag,

  ShoppingCart,

  Tags,

  Truck,

  Undo2,

  Warehouse,

  X,
  RefreshCw,

  type LucideIcon,

} from 'lucide-react'

import {

  Link,

  NavLink,

  // Navigate,

  Route,

  Routes,

  useLocation,

} from 'react-router-dom'

import { apiRequest } from './lib/api'

import ProductsPage from './pages/ProductsPage'

import ProductsFormPage from './pages/ProductsFormPage'

import InventoryPage from './pages/InventoryPage'

import SalesPage from './pages/SalesPage'

import PurchasesPage from './pages/PurchasesPage'

import EditProductPage from './pages/EditProductPage'

import EditVariantPage from './pages/EditVariantPage'

import ReturnsPage from './pages/ReturnsPage'

import CategoriesPage from './pages/CategoriesPage'

import StockHistoryPage from './pages/StockHistoryPage'

import SettingsPage from './pages/SettingsPage'

import BackupPage from './pages/BackupPage'
import HelpPage from './pages/HelpPage'

import {

  ReportsOverviewPage,

  StockReportPage,

  SalesReportPage,

  PurchasesReportPage,

  ProfitReportPage,

} from './pages/ReportsPages'

import './App.css'

type NavItem = {

  label: string

  path: string

  icon: LucideIcon

}

type NavGroup = {

  label: string

  items: NavItem[]

}

const navigation: NavGroup[] = [

  {

    label: 'OVERVIEW',

    items: [

      { label: 'Dashboard', path: '/', icon: LayoutDashboard },

    ],

  },

  {

    label: 'CATALOG',

    items: [

      { label: 'Products', path: '/products', icon: Package },

      { label: 'Categories', path: '/categories', icon: Tags },

    ],

  },
  {

    label: 'INSIGHTS',

    items: [

      { label: 'Reports', path: '/reports', icon: FileBarChart },

      { label: 'Profit report', path: '/reports/profit', icon: BarChart3 },

    ],

  },



  {

    label: 'TRANSACTIONS',

    items: [

      { label: 'Purchases', path: '/purchases', icon: ShoppingCart },

      { label: 'Sales', path: '/sales', icon: ShoppingBag },

      { label: 'Returns', path: '/returns', icon: Undo2 },

    ],

  },
  {

    label: 'INVENTORY',

    items: [

      { label: 'Inventory', path: '/inventory', icon: Warehouse },

      { label: 'Stock history', path: '/stock-history', icon: Activity },

    ],

  },



]

const moduleDescriptions: Record<string, string> = {

  '/products': 'Manage your products, variants and custom attributes.',

  '/categories': 'Organize your catalog into categories that work for your shop.',

  '/inventory': 'Monitor available quantities and manage stock levels.',

  '/stock-history': 'Review stock movements, adjustments and transaction history.',

  '/purchases': 'Record incoming stock and track purchase costs.',

  '/sales': 'Manage sales and access the billing workflow.',

  '/returns': 'Process customer returns and supplier returns.',

  '/reports': 'Review stock, sales, purchases and business performance.',

  '/reports/profit': 'Review gross profit and identify incomplete cost information.',

  '/settings': 'Manage application preferences and local data.',

  '/backup': 'Protect your local inventory database.',

}

function getPageTitle(pathname: string) {

  if (pathname === '/reports/stock') return 'Stock report'

  if (pathname === '/reports/sales') return 'Sales report'

  if (pathname === '/reports/purchases') return 'Purchases report'

  if (pathname === '/') return 'Dashboard'

  if (pathname === '/reports/profit') return 'Profit report'

  if (pathname.startsWith('/products/')) return 'Product details'

  if (pathname === '/products/new') return 'Add product'

  if (pathname.startsWith('/inventory/')) return 'Stock history'

  const item = navigation

    .flatMap((group) => group.items)

    .find((entry) => entry.path === pathname)

  return item?.label ?? 'Inventory Manager'

}

function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onClose,
  shopName,
}: {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onClose: () => void
  shopName: string
}) {

  return (

    <>

      {mobileOpen && (

        <button

          className="mobile-overlay"

          aria-label="Close navigation"

          onClick={onClose}

        />

      )}

      <aside

        className={[

          'sidebar',

          collapsed ? 'sidebar-collapsed' : '',

          mobileOpen ? 'sidebar-mobile-open' : '',

        ].join(' ')}

        aria-label="Main navigation"

      >

        <Link to="/" className="brand" onClick={onClose}>

          <span className="brand-mark" aria-hidden="true">

            <Boxes size={23} strokeWidth={2.1} />

          </span>

          {!collapsed && (

            <span className="brand-copy">

              <span className="brand-name">{shopName}</span>

              <span className="brand-subtitle">Inventory Manager</span>

            </span>

          )}

        </Link>

        <nav className="sidebar-navigation">

          {navigation.map((group) => (

            <section className="nav-group" key={group.label}>

              {!collapsed && (

                <h2 className="nav-group-label">{group.label}</h2>

              )}

              {group.items.map(({ label, path, icon: Icon }) => (

                <NavLink

                  key={path}

                  to={path}

                  end={path === '/'}

                  title={collapsed ? label : undefined}

                  aria-label={label}

                  onClick={onClose}

                  className={({ isActive }) =>

                    `nav-link ${isActive ? 'nav-link-active' : ''}`

                  }

                >

                  <Icon size={19} strokeWidth={1.8} />

                  {!collapsed && <span>{label}</span>}

                  {!collapsed && path === '/inventory' && (

                    <span className="nav-count" aria-label="Stock overview">

                      <Boxes size={13} />

                    </span>

                  )}

                </NavLink>

              ))}

            </section>

          ))}

        </nav>

        <div className="sidebar-bottom">

          <div className="sidebar-utility">

            <Link to="/backup" className="nav-link" onClick={onClose}>

              <Database size={19} strokeWidth={1.8} />

              {!collapsed && <span>Backup & restore</span>}

            </Link>

            <Link to="/settings" className="nav-link" onClick={onClose}>

              <Settings size={19} strokeWidth={1.8} />

              {!collapsed && <span>Settings</span>}

            </Link>

            <button

              type="button"

              className="nav-link sidebar-collapse"

              onClick={onToggle}

              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}

            >

              {collapsed ? (

                <PanelLeftOpen size={19} />

              ) : (

                <PanelLeftClose size={19} />

              )}

              {!collapsed && <span>Collapse sidebar</span>}

            </button>

          </div>

          <div className="sidebar-footer">

            <span>v0.1.0</span>

          </div>

        </div>

      </aside>

    </>

  )

}

function Header({

  title,

  onMenu,

}: {

  title: string

  onMenu: () => void

}) {

  const [searchOpen, setSearchOpen] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate();

  const location = useLocation()

  const searchItems = useMemo(

    () => navigation.flatMap((group) => group.items),

    [],

  )

  const results = searchItems.filter((item) =>

    item.label.toLowerCase().includes(searchQuery.trim().toLowerCase()),

  )

  useEffect(() => {

    setSearchOpen(false)

    setSearchQuery('')

  }, [location.pathname])

  useEffect(() => {

    function handleKeyDown(event: KeyboardEvent) {

      if (

        (event.ctrlKey || event.metaKey) &&

        event.key.toLowerCase() === 'k'

      ) {

        event.preventDefault()

        setSearchOpen(true)

      }

      if (event.key === 'Escape') {

        setSearchOpen(false)

        setSearchQuery('')

      }

    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)

  }, [])

  return (

    <>

      <header className="topbar">

        <div className="topbar-left">

          <button

            type="button"

            className="icon-button mobile-menu-button"

            aria-label="Open navigation"

            onClick={onMenu}

          >

            <Menu size={20} />

          </button>

          <div className="breadcrumb">

            <span className="breadcrumb-root">Workspace</span>

            <ChevronRight size={15} />

            <span className="breadcrumb-current">{title}</span>

          </div>

        </div>

        <div className="topbar-actions">

          <button

            type="button"

            className="global-search"

            onClick={() => setSearchOpen(true)}

            aria-label="Search pages. Shortcut Control K"

          >

            <Search size={17} />

            <span>Search pages...</span>

            <kbd><Command size={11} /> K</kbd>

          </button>

          <div

            className="connection-indicator"

            title="The application is designed for local use. Actual database status will be connected in a later step."

          >

            <span className="status-dot" />

            <span>Local app</span>

          </div>

          <button
            type="button"
            className="icon-button help-button"
            aria-label="Help"
            title="Help"
            onClick={() => navigate('/help')}
          >
            <CircleHelp size={19} />
          </button>

        </div>

      </header>

      {searchOpen && (

        <div

          className="search-overlay"

          role="presentation"

          onMouseDown={(event) => {

            if (event.target === event.currentTarget) {

              setSearchOpen(false)

            }

          }}

        >

          <section

            className="search-dialog"

            role="dialog"

            aria-modal="true"

            aria-labelledby="search-title"

          >

            <h2 id="search-title" className="visually-hidden">

              Search application pages

            </h2>

            <div className="search-dialog-input">

              <Search size={20} />

              <input

                autoFocus

                value={searchQuery}

                onChange={(event) => setSearchQuery(event.target.value)}

                placeholder="Search pages..."

                aria-label="Search pages"

              />

              <button

                className="icon-button"

                onClick={() => setSearchOpen(false)}

                aria-label="Close search"

              >

                <X size={18} />

              </button>

            </div>

            <p className="search-section-label">NAVIGATION</p>

            <div className="search-results">

              {results.map(({ label, path, icon: Icon }) => (

                <Link

                  key={path}

                  to={path}

                  className="search-result"

                  onClick={() => setSearchOpen(false)}

                >

                  <Icon size={18} />

                  <span>{label}</span>

                  <ArrowRight size={15} className="search-result-arrow" />

                </Link>

              ))}

              {results.length === 0 && (

                <p className="search-empty">No matching pages found.</p>

              )}

            </div>

            <footer className="search-dialog-footer">

              <span><kbd>Esc</kbd> to close</span>

              <span>{results.length} pages</span>

            </footer>

          </section>

        </div>

      )}

    </>

  )

}

function PageHeading({

  eyebrow,

  title,

  description,

  action,

}: {

  eyebrow?: string

  title: string

  description: string

  action?: React.ReactNode

}) {

  return (

    <div className="page-heading">

      <div>

        {eyebrow && <p className="eyebrow">{eyebrow}</p>}

        <h1>{title}</h1>

        <p className="page-description">{description}</p>

      </div>

      {action && <div className="page-heading-action">{action}</div>}

    </div>

  )

}

// function MetricCard({

//   title,

//   icon: Icon,

//   description,

//   accent,

// }: {

//   title: string

//   icon: LucideIcon

//   description: string

//   accent: string

// }) {

//   return (

//     <article className="metric-card">

//       <div className="metric-card-top">

//         <span>{title}</span>

//         <span className={`metric-icon ${accent}`}>

//           <Icon size={19} strokeWidth={1.8} />

//         </span>

//       </div>

//       <div className="metric-value">—</div>

//       <p className="metric-description">{description}</p>

//     </article>

//   )

// }

function Dashboard() {

  type ApiResponse<T> = {

    success: boolean

    data: T

    message?: string

  }

  type StockItem = {

    variantId: string

    productName: string

    variantName: string

    stockQuantity: number

    isLowStock: boolean

    averageCostKnown: boolean

    stockValueAtAverageCostPaise: number | null

    averageCostPaise: number

    purchasePricePaise: number

  }

  type StockReport = {

    items: StockItem[]

    summary: {

      totalVariants: number

      totalStockUnits: number

      lowStockVariants: number

      unknownCostVariants: number

    }

  }

  type Transaction = {

    id: string

    saleNumber?: string

    purchaseNumber?: string

    soldAt?: string

    purchasedAt?: string

    totalPaise: number

    notes?: string | null

    items?: Array<{

      id: string

      quantity: number

      variant?: {

        name?: string

        product?: { name: string }

      }

    }>

  }

  type RecentTransaction = {

    id: string

    reference: string

    date: string

    totalPaise: number

    type: 'Sale' | 'Purchase'

    items: number

  }

  const [stock, setStock] = useState<StockReport | null>(null)

  const [sales, setSales] = useState<Transaction[]>([])

  const [purchases, setPurchases] = useState<Transaction[]>([])

  const [loading, setLoading] = useState(true)

  const [refreshing, setRefreshing] = useState(false)

  const [error, setError] = useState('')

  const money = (paise: number) =>

    new Intl.NumberFormat('en-IN', {

      style: 'currency',

      currency: 'INR',

      maximumFractionDigits: 2,

    }).format(paise / 100)

  const localDateKey = (value: string | Date) => {

    const date = new Date(value)

    const year = date.getFullYear()

    const month = String(date.getMonth() + 1).padStart(2, '0')

    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`

  }

  const today = localDateKey(new Date())

  async function loadDashboard(quiet = false) {

    if (quiet) setRefreshing(true)

    else setLoading(true)

    setError('')

    try {

      const [stockResponse, salesResponse, purchasesResponse] =

        await Promise.all([

          apiRequest<ApiResponse<StockReport>>('/reports/stock'),

          apiRequest<ApiResponse<Transaction[]>>('/sales'),

          apiRequest<ApiResponse<Transaction[]>>('/purchases'),

        ])

      if (

        !stockResponse.success ||

        !stockResponse.data ||

        !Array.isArray(stockResponse.data.items)

      ) {

        throw new Error('Could not load the stock report.')

      }

      if (!salesResponse.success || !Array.isArray(salesResponse.data)) {

        throw new Error('Could not load sales.')

      }

      if (

        !purchasesResponse.success ||

        !Array.isArray(purchasesResponse.data)

      ) {

        throw new Error('Could not load purchases.')

      }

      setStock(stockResponse.data)

      setSales(salesResponse.data)

      setPurchases(purchasesResponse.data)

    } catch (err) {

      setError(

        err instanceof Error

          ? err.message

          : 'Could not load dashboard data.',

      )

    } finally {

      setLoading(false)

      setRefreshing(false)

    }

  }

  useEffect(() => {

    void loadDashboard()

  }, [])

  const todaysSales = sales.filter(

    sale => sale.soldAt && localDateKey(sale.soldAt) === today,

  )

  const todaysPurchases = purchases.filter(

    purchase =>

      purchase.purchasedAt &&

      localDateKey(purchase.purchasedAt) === today,

  )

  const todaysSalesPaise = todaysSales.reduce(

    (sum, sale) => sum + sale.totalPaise,

    0,

  )

  const todaysPurchasesPaise = todaysPurchases.reduce(

    (sum, purchase) => sum + purchase.totalPaise,

    0,

  )

  const stockValuePaise = (stock?.items ?? []).reduce(

    (sum, item) => {

      const unitCost = item.averageCostKnown

        ? item.averageCostPaise

        : item.purchasePricePaise

      return sum + item.stockQuantity * unitCost

    },

    0,

  )

  const recentTransactions: RecentTransaction[] = [

    ...sales.map(sale => ({

      id: sale.id,

      reference: sale.saleNumber ?? sale.id.slice(0, 8),

      date: sale.soldAt ?? '',

      totalPaise: sale.totalPaise,

      type: 'Sale' as const,

      items: (sale.items ?? []).reduce(

        (sum, item) => sum + item.quantity,

        0,

      ),

    })),

    ...purchases.map(purchase => ({

      id: purchase.id,

      reference: purchase.purchaseNumber ?? purchase.id.slice(0, 8),

      date: purchase.purchasedAt ?? '',

      totalPaise: purchase.totalPaise,

      type: 'Purchase' as const,

      items: (purchase.items ?? []).reduce(

        (sum, item) => sum + item.quantity,

        0,

      ),

    })),

  ]

    .filter(item => item.date)

    .sort(

      (a, b) =>

        new Date(b.date).getTime() - new Date(a.date).getTime(),

    )

    .slice(0, 6)

  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {

    const date = new Date()

    date.setDate(date.getDate() - (6 - index))

    const key = localDateKey(date)

    const daySales = sales.filter(

      sale => sale.soldAt && localDateKey(sale.soldAt) === key,

    )

    return {

      key,

      label: date.toLocaleDateString('en-IN', { weekday: 'short' }),

      total: daySales.reduce((sum, sale) => sum + sale.totalPaise, 0),

    }

  })

  const maxDailySales = Math.max(

    ...lastSevenDays.map(day => day.total),

    1,

  )

  return (

    <div className="page-content">

      <PageHeading

        eyebrow="YOUR BUSINESS AT A GLANCE"

        title="Dashboard"

        description="Welcome back. Here's an overview of your shop."

        action={

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

            <Link to="/purchases/new" className="button button-primary">

              <Plus size={17} />

              New purchase

            </Link>

            <Link to="/sales/new" className="button button-primary">

              <Plus size={17} />

              New sale

            </Link>

            <button
              type="button"
              className="icon-button"
              onClick={() => void loadDashboard(true)}
              disabled={loading || refreshing}
              aria-label="Refresh dashboard"
              title={refreshing ? 'Refreshing dashboard…' : 'Refresh dashboard'}
            >
              <RefreshCw size={18} className={refreshing ? 'spin' : undefined} />
            </button>

          </div>

        }

      />

      {error && (

        <div className="inventory-alert" role="alert">

          <span>{error}</span>

          <button

            type="button"

            className="button button-secondary"

            onClick={() => void loadDashboard(true)}

          >

            Retry

          </button>

        </div>

      )}

      {/* <div className="dashboard-refresh-row">

        <span>

          {loading

            ? 'Loading your business data…'

            : `Updated from your local inventory records`}

        </span>

      </div> */}

      <section className="metrics-grid" aria-label="Business summary">

        <article className="metric-card">

          <div className="metric-card-top">

            <span>Today's sales</span>

            <span className="metric-icon metric-blue">

              <ArrowDownLeft size={19} />

            </span>

          </div>

          <div className="metric-value">

            {loading ? '—' : money(todaysSalesPaise)}

          </div>

          <p className="metric-description">

            {todaysSales.length} sale transaction

            {todaysSales.length === 1 ? '' : 's'} today

          </p>

        </article>

        <article className="metric-card">

          <div className="metric-card-top">

            <span>Today's purchases</span>

            <span className="metric-icon metric-violet">

              <Truck size={19} />

            </span>

          </div>

          <div className="metric-value">

            {loading ? '—' : money(todaysPurchasesPaise)}

          </div>

          <p className="metric-description">

            {todaysPurchases.length} purchase transaction

            {todaysPurchases.length === 1 ? '' : 's'} today

          </p>

        </article>

        <article className="metric-card">

          <div className="metric-card-top">

            <span>Stock value</span>

            <span className="metric-icon metric-green">

              <Warehouse size={19} />

            </span>

          </div>

          <div className="metric-value">

            {loading ? '—' : money(stockValuePaise)}

          </div>

          <p className="metric-description">

            Based on known average costs

            {stock?.summary.unknownCostVariants

              ? ` · ${stock.summary.unknownCostVariants} variants with unknown cost`

              : ''}

          </p>

        </article>

        <article className="metric-card">

          <div className="metric-card-top">

            <span>Low stock</span>

            <span className="metric-icon metric-amber">

              <ArrowDownRight size={19} />

            </span>

          </div>

          <div className="metric-value">

            {loading ? '—' : stock?.summary.lowStockVariants ?? 0}

          </div>

          <p className="metric-description">

            Variants at or below their configured threshold

          </p>

        </article>

      </section>

      <section className="dashboard-grid">

        <article className="panel sales-overview">

          <div className="panel-heading">

            <div>

              <h2>Sales overview</h2>

              <p>Daily sales totals for the last seven days</p>

            </div>

            <Link to="/reports/sales" className="text-link">

              View report <ArrowRight size={15} />

            </Link>

          </div>

          {loading ? (

            <div className="chart-placeholder">

              <p>Loading sales data…</p>

            </div>

          ) : (

            <div className="dashboard-chart">

              {lastSevenDays.map(day => (

                <div className="dashboard-chart-column" key={day.key}>

                  <span className="dashboard-chart-value">

                    {day.total > 0 ? money(day.total) : '—'}

                  </span>

                  <div className="dashboard-chart-track">

                    <div

                      className="dashboard-chart-bar"

                      style={{

                        height: `${day.total > 0

                          ? Math.max(5, (day.total / maxDailySales) * 100)

                          : 0}%`,

                      }}

                    />

                  </div>

                  <span className="dashboard-chart-label">{day.label}</span>

                </div>

              ))}

            </div>

          )}

        </article>

        <article className="panel low-stock-panel">

          <div className="panel-heading">

            <div>

              <h2>Stock alerts</h2>

              <p>Items that may need restocking</p>

            </div>

            <Link

              to="/inventory"

              className="icon-link"

              aria-label="View inventory"

            >

              <ArrowUpRight size={18} />

            </Link>

          </div>

          {loading ? (

            <div className="empty-state compact-empty">

              <p>Loading stock alerts…</p>

            </div>

          ) : (

            <>

              {(stock?.items ?? []).filter(item => item.isLowStock).length === 0 ? (

                <div className="empty-state compact-empty">

                  <span className="empty-state-icon">

                    <Package size={24} />

                  </span>

                  <h3>Everything looks stocked</h3>

                  <p>No variants are currently at or below their low-stock threshold.</p>

                </div>

              ) : (

                <div className="dashboard-stock-alerts">

                  {(stock?.items ?? [])

                    .filter(item => item.isLowStock)

                    .slice(0, 5)

                    .map(item => (

                      <div className="dashboard-stock-row" key={item.variantId}>

                        <span className="dashboard-stock-icon">

                          <Package size={17} />

                        </span>

                        <div className="dashboard-stock-name">

                          <strong>{item.productName}</strong>

                          <small>{item.variantName}</small>

                        </div>

                        <span className="dashboard-stock-quantity">

                          {item.stockQuantity} left

                        </span>

                      </div>

                    ))}

                  <Link to="/inventory" className="text-link">

                    View inventory <ArrowRight size={15} />

                  </Link>

                </div>

              )}

            </>

          )}

        </article>

      </section>

      <section className="dashboard-grid lower-grid">

        <article className="panel recent-panel">

          <div className="panel-heading">

            <div>

              <h2>Recent transactions</h2>

              <p>Your latest sales and purchases</p>

            </div>

            <Link to="/sales" className="text-link">

              View sales <ArrowRight size={15} />

            </Link>

          </div>

          {loading ? (

            <div className="transaction-placeholder">

              <p>Loading recent transactions…</p>

            </div>

          ) : recentTransactions.length === 0 ? (

            <div className="transaction-placeholder">

              <span className="transaction-placeholder-icon">

                <BriefcaseBusiness size={21} />

              </span>

              <div>

                <strong>No transactions yet</strong>

                <p>Your sales and purchases will appear here.</p>

              </div>

            </div>

          ) : (

            <div className="dashboard-recent-list">

              {recentTransactions.map(transaction => (

                <div

                  className="dashboard-recent-row"

                  key={`${transaction.type}-${transaction.id}`}

                >

                  <span

                    className={`dashboard-recent-icon ${transaction.type === 'Sale'

                      ? 'dashboard-recent-sale'

                      : 'dashboard-recent-purchase'

                      }`}

                  >

                    {transaction.type === 'Sale'

                      ? <ShoppingBag size={18} />

                      : <ShoppingCart size={18} />}

                  </span>

                  <div className="dashboard-recent-info">

                    <strong>{transaction.reference}</strong>

                    <small>

                      {transaction.type} · {transaction.items} units ·{' '}

                      {new Date(transaction.date).toLocaleDateString('en-IN')}

                    </small>

                  </div>

                  <strong className="dashboard-recent-amount">

                    {money(transaction.totalPaise)}

                  </strong>

                </div>

              ))}

            </div>

          )}

        </article>

        <article className="panel quick-actions-panel">

          <div className="panel-heading">

            <div>

              <h2>Quick actions</h2>

              <p>Common tasks, one click away</p>

            </div>

          </div>

          <div className="quick-actions-list">

            <Link to="/products/new" className="quick-action">

              <span className="quick-action-icon quick-blue">

                <PackagePlus size={19} />

              </span>

              <span>

                <strong>Add product</strong>

                <small>Create a product and its variants</small>

              </span>

              <ChevronRight size={17} />

            </Link>

            <Link to="/purchases/new" className="quick-action">

              <span className="quick-action-icon quick-green">

                <ShoppingCart size={19} />

              </span>

              <span>

                <strong>Record purchase</strong>

                <small>Add incoming stock</small>

              </span>

              <ChevronRight size={17} />

            </Link>

            <Link to="/inventory" className="quick-action">

              <span className="quick-action-icon quick-amber">

                <Boxes size={19} />

              </span>

              <span>

                <strong>Manage inventory</strong>

                <small>Review quantities and stock</small>

              </span>

              <ChevronRight size={17} />

            </Link>

          </div>

        </article>

      </section>

      <footer className="page-footer">

        <span>Inventory Manager</span>

        <span><ShieldCheck size={14} /> Local-first design</span>

      </footer>

    </div>

  )

}

function PlaceholderPage({ pathname }: { pathname: string }) {

  const title = getPageTitle(pathname)

  const description =

    moduleDescriptions[pathname] ??

    'This module will be implemented and connected to the backend in the next steps.'

  const isProduct = pathname === '/products'

  const isSales = pathname === '/sales'

  const isPurchases = pathname === '/purchases'

  let action: React.ReactNode

  if (isProduct) {

    action = (

      <Link to="/products/new" className="button button-primary">

        <Plus size={17} /> Add product

      </Link>

    )

  } else if (isSales) {

    action = (

      <Link to="/sales/new" className="button button-primary">

        <Plus size={17} /> New sale

      </Link>

    )

  } else if (isPurchases) {

    action = (

      <Link to="/purchases/new" className="button button-primary">

        <Plus size={17} /> New purchase

      </Link>

    )

  }

  return (

    <div className="page-content">

      <PageHeading

        eyebrow="WORKSPACE"

        title={title}

        description={description}

        action={action}

      />

      <section className="panel module-placeholder">

        <div className="module-placeholder-icon">

          <Package size={28} />

        </div>

        <h2>{title} module</h2>

        <p>

          This screen is reserved for the {title.toLowerCase()} workflow.

          The next implementation step will connect it to your existing

          local API.

        </p>

        <div className="module-placeholder-note">

          <ShieldCheck size={17} />

          <span>No sample business records are being displayed.</span>

        </div>

        <Link to="/" className="text-link">

          Back to dashboard <ArrowRight size={15} />

        </Link>

      </section>

    </div>

  )

}

function NotFound() {

  return (

    <section className="not-found">

      <h1>Page not found</h1>

      <p>The page you're looking for doesn't exist.</p>

      <Link to="/" className="button button-primary">

        Back to dashboard

      </Link>

    </section>

  )

}

function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [shopName, setShopName] = useState('My Shop')
  const location = useLocation()
  const title = getPageTitle(location.pathname)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Reload the saved shop name when navigating, so changes made in Settings
  // are reflected in the sidebar without changing the database or API.
  useEffect(() => {
    let cancelled = false

    async function loadShopName() {
      try {
        const response = await apiRequest<{
          success: boolean
          data?: Record<string, string>
        }>('/settings')

        if (!cancelled && response.success) {
          const savedName = response.data?.['shop.name']?.trim()
          setShopName(savedName || 'My Shop')
        }
      } catch {
        // Keep the fallback name if settings cannot be loaded.
      }
    }

    void loadShopName()

    return () => {
      cancelled = true
    }
  }, [location.pathname])

  return (

    <div className="app-shell">

      <a href="#main-content" className="skip-link">

        Skip to main content

      </a>

      <Sidebar
        collapsed={collapsed}

        onToggle={() => setCollapsed((value) => !value)}

        mobileOpen={mobileOpen}

        onClose={() => setMobileOpen(false)}

        shopName={shopName}
      />

      <div className="app-main">

        <Header title={title} onMenu={() => setMobileOpen(true)} />

        <main id="main-content" className="main-content" tabIndex={-1}>

          <Routes>

            <Route path="/" element={<Dashboard />} />

            <Route path="/products" element={<ProductsPage />} />

            <Route path="/products/:id/edit" element={<EditProductPage />} />

            <Route path="/products/new" element={<ProductsFormPage />} />

            <Route path="/products/:id" element={<PlaceholderPage pathname="/products/:id" />} />

            <Route path="/variants/:id/edit" element={<EditVariantPage />} />

            <Route path="/categories" element={<CategoriesPage />} />

            <Route path="/inventory" element={<InventoryPage />} />

            <Route path="/inventory/:variantId/history" element={<PlaceholderPage pathname="/stock-history" />} />

            <Route path="/stock-history" element={<StockHistoryPage />} />

            <Route path="/purchases" element={<PurchasesPage />} />

            <Route path="/purchases/new" element={<PurchasesPage />} />

            <Route path="/sales" element={<SalesPage />} />

            <Route path="/sales/new" element={<SalesPage />} />

            <Route path="/returns" element={<ReturnsPage />} />

            <Route path="/reports" element={<ReportsOverviewPage />} />

            <Route path="/reports/stock" element={<StockReportPage />} />

            <Route path="/reports/sales" element={<SalesReportPage />} />

            <Route path="/reports/purchases" element={<PurchasesReportPage />} />

            <Route path="/reports/profit" element={<ProfitReportPage />} />

            <Route path="/settings" element={<SettingsPage />} />

            <Route path="/backup" element={<BackupPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/settings/data" element={<PlaceholderPage pathname="/backup" />} />

            <Route path="*" element={<NotFound />} />

          </Routes>

        </main>

      </div>

    </div>

  )

}

export default App
