import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
     Archive,
     ArrowUpRight,
     Boxes,
     CheckCircle2,
     ChevronDown,
     ChevronRight,
     CircleAlert,
     Layers3,
     Package,
     PackagePlus,
     RefreshCw,
     Search,
     SlidersHorizontal,
     Warehouse,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import './ProductsPage.css'
import '../ProductsVariantEdit.css'

type Attribute = { id: string; name: string; value: string }
type Category = { id: string; name: string; isActive: boolean }
type Variant = {
     id: string
     name: string
     sku: string | null
     unit: string
     purchasePricePaise: number
     sellingPricePaise: number
     averageCostPaise: number | null
     averageCostKnown: boolean
     stockQuantity: number
     lowStockThreshold: number
     isActive: boolean
     attributes: Attribute[]
}
type Product = {
     id: string
     name: string
     sku: string | null
     description: string | null
     categoryId: string | null
     category: Category | null
     isActive: boolean
     attributes: Attribute[]
     variants: Variant[]
     createdAt: string
     updatedAt: string
}
type ApiResponse<T> = { success: boolean; data: T; count?: number; message?: string }

function money(paise: number | null | undefined) {
     if (paise == null) return '—'
     return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 2,
     }).format(paise / 100)
}

function getSearchText(product: Product) {
     return [
          product.name,
          product.sku ?? '',
          product.category?.name ?? '',
          product.description ?? '',
          ...product.attributes.flatMap((a) => [a.name, a.value]),
          ...product.variants.flatMap((v) => [
               v.name,
               v.sku ?? '',
               v.unit,
               ...v.attributes.flatMap((a) => [a.name, a.value]),
          ]),
     ].join(' ').toLowerCase()
}

export default function ProductsPage() {
     const [products, setProducts] = useState<Product[]>([])
     const [categories, setCategories] = useState<Category[]>([])
     const [search, setSearch] = useState('')
     const [categoryFilter, setCategoryFilter] = useState('all')
     const [statusFilter, setStatusFilter] = useState('active')
     const [expanded, setExpanded] = useState<string[]>([])
     const [loading, setLoading] = useState(true)
     const [error, setError] = useState('')

     async function loadData() {
          setLoading(true)
          setError('')
          try {
               const [productResponse, categoryResponse] = await Promise.all([
                    apiRequest<ApiResponse<Product[]>>('/products'),
                    apiRequest<ApiResponse<Category[]>>('/categories'),
               ])
               setProducts(productResponse.data ?? [])
               setCategories(categoryResponse.data ?? [])
          } catch (err) {
               setError(err instanceof Error ? err.message : 'Unable to load products.')
          } finally {
               setLoading(false)
          }
     }

     useEffect(() => {
          void loadData()
     }, [])

     const filteredProducts = useMemo(() => {
          const query = search.trim().toLowerCase()
          return products.filter((product) => {
               const matchesSearch = !query || getSearchText(product).includes(query)
               const matchesCategory = categoryFilter === 'all' || product.categoryId === categoryFilter
               const matchesStatus =
                    statusFilter === 'all' ||
                    (statusFilter === 'active' && product.isActive) ||
                    (statusFilter === 'archived' && !product.isActive)
               return matchesSearch && matchesCategory && matchesStatus
          })
     }, [products, search, categoryFilter, statusFilter])

     const activeProducts = products.filter((p) => p.isActive).length
     const variantCount = products.reduce(
          (total, product) => total + product.variants.filter((v) => v.isActive).length,
          0,
     )
     const totalUnits = products.reduce(
          (total, product) =>
               total + product.variants.reduce((sum, variant) => sum + variant.stockQuantity, 0),
          0,
     )

     function toggleExpanded(id: string) {
          setExpanded((current) =>
               current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
          )
     }

     return (
          <main className="products-page">
               <header className="products-heading">
                    <div className="products-heading-copy">
                         <div className="products-eyebrow"><span className="eyebrow-dot" /> CATALOGUE MANAGEMENT</div>
                         <h1>Products</h1>
                         <p className="products-subtitle">Manage your products, variants, pricing, and stock in one place.</p>
                    </div>
                    <div className="products-actions">
                         <button className="products-button secondary" onClick={() => void loadData()} disabled={loading} type="button">
                              <RefreshCw size={16} className={loading ? 'spin' : ''} />
                              Refresh
                         </button>
                         <Link className="products-button primary" to="/products/new">
                              <PackagePlus size={17} />
                              Add product
                              <ArrowUpRight size={16} />
                         </Link>
                    </div>
               </header>

               <section className="products-stats" aria-label="Product summary">
                    <StatCard icon={<Boxes size={19} />} label="Total products" value={products.length.toLocaleString('en-IN')} tone="blue" detail="Across your catalogue" />
                    <StatCard icon={<CheckCircle2 size={19} />} label="Active products" value={activeProducts.toLocaleString('en-IN')} tone="violet" detail={`${products.length - activeProducts} archived`} />
                    <StatCard icon={<Layers3 size={19} />} label="Active variants" value={variantCount.toLocaleString('en-IN')} tone="teal" detail="Available product options" />
                    <StatCard icon={<Warehouse size={19} />} label="Units in stock" value={totalUnits.toLocaleString('en-IN')} tone="amber" detail="Across all variants" />
               </section>

               <section className="products-catalogue-card">
                    <div className="catalogue-heading">
                         <div className="catalogue-heading-icon"><Package size={19} /></div>
                         <div>
                              <h2>Product catalogue</h2>
                              <p>Search, filter, and manage your inventory items.</p>
                         </div>
                         <div className="catalogue-count">{filteredProducts.length} <span>results</span></div>
                    </div>

                    <div className="products-toolbar">
                         <label className="products-search-wrap">
                              <Search size={18} />
                              <input
                                   className="products-search"
                                   value={search}
                                   onChange={(event) => setSearch(event.target.value)}
                                   placeholder="Search product, SKU, category, attribute..."
                                   aria-label="Search products"
                              />
                              {search && <button type="button" className="clear-search" onClick={() => setSearch('')} aria-label="Clear search">×</button>}
                         </label>
                         <label className="products-select-wrap">
                              <SlidersHorizontal size={16} />
                              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category">
                                   <option value="all">All categories</option>
                                   {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                              </select>
                              <ChevronDown size={15} />
                         </label>
                         <label className="products-select-wrap">
                              <Archive size={16} />
                              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status">
                                   <option value="active">Active products</option>
                                   <option value="archived">Archived products</option>
                                   <option value="all">All statuses</option>
                              </select>
                              <ChevronDown size={15} />
                         </label>
                    </div>

                    {error && (
                         <div className="products-error" role="alert">
                              <CircleAlert size={18} />
                              <span>{error}</span>
                              <button type="button" onClick={() => void loadData()}>Try again</button>
                         </div>
                    )}

                    <div className="products-table-wrap">
                         <table className="products-table">
                              <thead>
                                   <tr>
                                        <th>Product</th>
                                        <th>Category</th>
                                        <th>Attributes</th>
                                        <th>Variants</th>
                                        <th>Stock on hand</th>
                                        <th>Status</th>
                                        <th><span className="sr-only">Actions</span></th>
                                   </tr>
                              </thead>
                              <tbody>
                                   {loading ? (
                                        <tr><td colSpan={7} className="products-empty"><span className="loading-indicator" />Loading products from your database…</td></tr>
                                   ) : error ? (
                                        <tr><td colSpan={7} className="products-empty">Products could not be loaded.</td></tr>
                                   ) : filteredProducts.length === 0 ? (
                                        <tr>
                                             <td colSpan={7} className="products-empty">
                                                  <div className="empty-state">
                                                       <div className="empty-state-icon"><Package size={24} /></div>
                                                       <strong>{products.length === 0 ? 'Your catalogue is empty' : 'No matching products'}</strong>
                                                       <span>{products.length === 0 ? 'Add your first product to start tracking stock.' : 'Try changing your search or filters.'}</span>
                                                       {products.length === 0 && <Link className="products-button primary" to="/products/new"><PackagePlus size={16} /> Add your first product</Link>}
                                                  </div>
                                             </td>
                                        </tr>
                                   ) : (
                                        filteredProducts.map((product) => {
                                             const stock = product.variants.reduce((sum, variant) => sum + variant.stockQuantity, 0)
                                             return (
                                                  <ProductRows
                                                       key={product.id}
                                                       product={product}
                                                       stock={stock}
                                                       expanded={expanded.includes(product.id)}
                                                       onToggle={() => toggleExpanded(product.id)}
                                                  />
                                             )
                                        })
                                   )}
                              </tbody>
                         </table>
                    </div>

                    <footer className="products-footer">
                         <span>Showing <strong>{filteredProducts.length}</strong> of <strong>{products.length}</strong> products</span>
                         <span className="footer-live"><span /> Live local database</span>
                    </footer>
               </section>
               <p className="products-note">Product attributes and variant options are displayed dynamically. No product type or attribute is hardcoded.</p>
          </main>
     )
}

function StatCard({ icon, label, value, tone, detail }: {
     icon: ReactNode
     label: string
     value: string
     tone: 'blue' | 'violet' | 'teal' | 'amber'
     detail: string
}) {
     return (
          <article className={`products-stat tone-${tone}`}>
               <div className="products-stat-top">
                    <span>{label}</span>
                    <span className="products-stat-icon">{icon}</span>
               </div>
               <strong>{value}</strong>
               <small>{detail}</small>
          </article>
     )
}

function ProductRows({ product, stock, expanded, onToggle }: {
     product: Product
     stock: number
     expanded: boolean
     onToggle: () => void
}) {
     return (
          <Fragment>
               <tr className={`product-main-row ${expanded ? 'is-expanded' : ''}`}>
                    <td>
                         <div className="product-identity">
                              <button className={`products-expand ${expanded ? 'expanded' : ''}`} type="button" onClick={onToggle} aria-expanded={expanded} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${product.name}`}>
                                   {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </button>
                              <div className="product-avatar"><Package size={18} /></div>
                              <div className="product-identity-copy">
                                   <strong>{product.name}</strong>
                                   <small>{product.sku || 'No product SKU'}</small>
                              </div>
                         </div>
                    </td>
                    <td><span className="category-pill">{product.category?.name || 'Uncategorised'}</span></td>
                    <td>
                         <div className="products-attributes">
                              {product.attributes.length ? product.attributes.slice(0, 2).map((attribute) => (
                                   <span key={attribute.id} className="products-chip">{attribute.name}: {attribute.value}</span>
                              )) : <span className="products-muted">No attributes</span>}
                              {product.attributes.length > 2 && <span className="products-muted">+{product.attributes.length - 2}</span>}
                         </div>
                    </td>
                    <td><span className="count-pill">{product.variants.length}</span></td>
                    <td><span className={`stock-value ${stock === 0 ? 'stock-empty' : ''}`}>{stock.toLocaleString('en-IN')} <small>units</small></span></td>
                    <td><span className={`products-status ${product.isActive ? 'active' : 'archived'}`}><span />{product.isActive ? 'Active' : 'Archived'}</span></td>
                    <td>
                         <div className="products-row-actions">
                              <Link className="products-text-button" to={`/products/${encodeURIComponent(product.id)}/edit`}>Edit</Link>
                              <button className="products-text-button details-button" type="button" onClick={onToggle}>{expanded ? 'Hide' : 'Details'}</button>
                         </div>
                    </td>
               </tr>
               {expanded && (
                    <tr className="products-detail-row">
                         <td colSpan={7}>
                              <div className="products-variant-panel">
                                   <div className="products-variant-heading">
                                        <div><h3>Variants</h3><p>Pricing, stock levels, and variant attributes</p></div>
                                        <span className="variant-total">{product.variants.length} total</span>
                                   </div>
                                   {product.variants.length === 0 ? (
                                        <div className="variant-empty">This product has no variants yet.</div>
                                   ) : (
                                        <div className="products-variant-list">
                                             {product.variants.map((variant) => (
                                                  <div className="products-variant" key={variant.id}>
                                                       <div className="products-variant-main">
                                                            <div className="variant-name-line"><strong>{variant.name}</strong><span className={`products-status compact ${variant.isActive ? 'active' : 'archived'}`}><span />{variant.isActive ? 'Active' : 'Inactive'}</span></div>
                                                            <small>SKU: {variant.sku || '—'} <span>·</span> Unit: {variant.unit}</small>
                                                            <div className="products-attributes">
                                                                 {variant.attributes.map((attribute) => <span className="products-chip" key={attribute.id}>{attribute.name}: {attribute.value}</span>)}
                                                            </div>
                                                       </div>
                                                       <div className="products-variant-number"><small>Purchase price</small><strong>{money(variant.purchasePricePaise)}</strong></div>
                                                       <div className="products-variant-number"><small>Selling price</small><strong>{money(variant.sellingPricePaise)}</strong></div>
                                                       <div className="products-variant-number"><small>Available stock</small><strong>{variant.stockQuantity.toLocaleString('en-IN')}</strong>{variant.stockQuantity <= variant.lowStockThreshold && <span className="products-warning">Low stock threshold reached</span>}</div>
                                                       <div className="products-variant-edit-action"><Link className="variant-edit-link" to={`/variants/${encodeURIComponent(variant.id)}/edit`}>Edit variant <ArrowUpRight size={14} /></Link></div>
                                                  </div>
                                             ))}
                                        </div>
                                   )}
                              </div>
                         </td>
                    </tr>
               )}
          </Fragment>
     )
}
