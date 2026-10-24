
import {
     Fragment,
     useCallback,
     useEffect,
     useMemo,
     useState,
     type FormEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import './CategoriesPage.css'

type Category = {
     id: string
     name: string
     isActive: boolean
     createdAt?: string
     updatedAt?: string
}

type ProductVariant = {
     id: string
     name?: string
     sku?: string | null
}

type Product = {
     id: string
     name: string
     sku?: string | null
     categoryId?: string | null
     category?: { id: string; name: string } | null
     variants?: ProductVariant[]
}

type ApiResponse<T> = {
     success: boolean
     data: T
     message?: string
}

const UNCATEGORIZED_ID = '__uncategorized__'

function unwrap<T>(response: ApiResponse<T> | T): T {
     if (
          response &&
          typeof response === 'object' &&
          'success' in response &&
          'data' in response
     ) {
          const result = response as ApiResponse<T>

          if (!result.success) {
               throw new Error(result.message || 'The request failed.')
          }

          return result.data
     }

     return response as T
}

export default function CategoriesPage() {
     const navigate = useNavigate()

     const [categories, setCategories] = useState<Category[]>([])
     const [products, setProducts] = useState<Product[]>([])
     const [search, setSearch] = useState('')
     const [showInactive, setShowInactive] = useState(false)
     const [name, setName] = useState('')
     const [editing, setEditing] = useState<Category | null>(null)
     const [expandedCategories, setExpandedCategories] = useState<string[]>([])
     const [loading, setLoading] = useState(true)
     const [saving, setSaving] = useState(false)
     const [changingId, setChangingId] = useState('')
     const [error, setError] = useState('')
     const [success, setSuccess] = useState('')

     const loadCategories = useCallback(async () => {
          setLoading(true)
          setError('')

          try {
               const [categoryResponse, productResponse] = await Promise.all([
                    apiRequest<ApiResponse<Category[]>>(
                         `/categories${showInactive ? '?includeInactive=true' : ''}`,
                    ),
                    apiRequest<ApiResponse<Product[]>>('/products'),
               ])

               setCategories(unwrap(categoryResponse) ?? [])
               setProducts(unwrap(productResponse) ?? [])
          } catch (err) {
               setError(
                    err instanceof Error
                         ? err.message
                         : 'Could not load categories and products.',
               )
          } finally {
               setLoading(false)
          }
     }, [showInactive])

     useEffect(() => {
          void loadCategories()
     }, [loadCategories])

     const filteredCategories = useMemo(() => {
          const query = search.trim().toLowerCase()

          return categories.filter((category) => {
               const matchesSearch = category.name.toLowerCase().includes(query)
               return matchesSearch && (showInactive || category.isActive)
          })
     }, [categories, search, showInactive])

     const activeCount = categories.filter((category) => category.isActive).length
     const inactiveCount = categories.filter((category) => !category.isActive).length

     function getProductsForCategory(category: Category) {
          return products.filter(
               (product) =>
                    (product.categoryId ?? product.category?.id ?? null) === category.id,
          )
     }

     const uncategorizedProducts = useMemo(
          () =>
               products.filter(
                    (product) => !(product.categoryId ?? product.category?.id),
               ),
          [products],
     )

     function toggleCategory(categoryId: string) {
          setExpandedCategories((current) =>
               current.includes(categoryId)
                    ? current.filter((id) => id !== categoryId)
                    : [...current, categoryId],
          )
     }

     function resetForm() {
          setName('')
          setEditing(null)
     }

     function startEditing(category: Category) {
          setEditing(category)
          setName(category.name)
          setError('')
          setSuccess('')
     }

     async function handleSubmit(event: FormEvent<HTMLFormElement>) {
          event.preventDefault()
          setError('')
          setSuccess('')

          const cleanName = name.trim()

          if (!cleanName) {
               setError('Enter a category name.')
               return
          }

          if (cleanName.length > 100) {
               setError('Category names cannot exceed 100 characters.')
               return
          }

          const duplicate = categories.some(
               (category) =>
                    category.id !== editing?.id &&
                    category.name.trim().toLocaleLowerCase() ===
                    cleanName.toLocaleLowerCase(),
          )

          if (duplicate) {
               setError('A category with this name already exists.')
               return
          }

          setSaving(true)

          try {
               if (editing) {
                    await apiRequest<ApiResponse<Category>>(`/categories/${editing.id}`, {
                         method: 'PATCH',
                         body: JSON.stringify({ name: cleanName }),
                    })

                    setSuccess(`Category "${cleanName}" updated.`)
               } else {
                    await apiRequest<ApiResponse<Category>>('/categories', {
                         method: 'POST',
                         body: JSON.stringify({ name: cleanName }),
                    })

                    setSuccess(`Category "${cleanName}" created.`)
               }

               resetForm()
               await loadCategories()
          } catch (err) {
               setError(
                    err instanceof Error ? err.message : 'Could not save the category.',
               )
          } finally {
               setSaving(false)
          }
     }

     async function toggleActive(category: Category) {
          const action = category.isActive ? 'deactivate' : 'activate'

          const confirmed = window.confirm(
               `${category.isActive ? 'Deactivate' : 'Activate'} "${category.name}"?` +
               (category.isActive
                    ? '\n\nExisting products will retain their category association, but this category will no longer be available for new product selections.'
                    : ''),
          )

          if (!confirmed) return

          setError('')
          setSuccess('')
          setChangingId(category.id)

          try {
               await apiRequest<ApiResponse<Category>>(`/categories/${category.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ isActive: !category.isActive }),
               })

               setSuccess(
                    `"${category.name}" has been ${category.isActive ? 'deactivated' : 'activated'
                    }.`,
               )

               if (editing?.id === category.id) {
                    resetForm()
               }

               await loadCategories()
          } catch (err) {
               setError(
                    err instanceof Error ? err.message : `Could not ${action} category.`,
               )
          } finally {
               setChangingId('')
          }
     }

     function renderProductList(items: Product[]) {
          if (items.length === 0) {
               return (
                    <div className="categories-no-products">
                         No products in this category yet.
                    </div>
               )
          }

          return (
               <div className="categories-product-list">
                    {items.map((product) => (
                         <div className="categories-product-row" key={product.id}>
                              <div className="categories-product-icon">
                                   <span>P</span>
                              </div>

                              <div className="categories-product-info">
                                   <strong>{product.name}</strong>
                                   <span>
                                        SKU: {product.sku || 'Not set'}
                                        {' · '}
                                        {product.variants?.length ?? 0} variant
                                        {product.variants?.length === 1 ? '' : 's'}
                                   </span>
                              </div>

                              <button
                                   type="button"
                                   className="categories-text-button"
                                   onClick={() => navigate(`/products/${product.id}/edit`)}
                              >
                                   View / Edit
                              </button>
                         </div>
                    ))}
               </div>
          )
     }

     return (
          <div className="categories-page">
               <header className="categories-header">
                    <div>
                         <div className="categories-eyebrow">PRODUCT CATALOG</div>
                         <h1>Categories</h1>
                         <p>Organize products into categories that suit your shop.</p>
                    </div>

                    <button
                         type="button"
                         className="categories-button categories-button-secondary"
                         onClick={() => void loadCategories()}
                         disabled={loading || saving || Boolean(changingId)}
                    >
                         {loading ? 'Refreshing…' : 'Refresh'}
                    </button>
               </header>

               <div className="categories-stats">
                    <div className="categories-stat">
                         <span>Total categories loaded</span>
                         <strong>{categories.length}</strong>
                    </div>

                    <div className="categories-stat">
                         <span>Active</span>
                         <strong>{activeCount}</strong>
                    </div>

                    <div className="categories-stat">
                         <span>Inactive</span>
                         <strong>{inactiveCount}</strong>
                    </div>
               </div>

               {error && (
                    <div className="categories-alert categories-alert-error" role="alert">
                         {error}
                    </div>
               )}

               {success && (
                    <div className="categories-alert categories-alert-success" role="status">
                         {success}
                    </div>
               )}

               <div className="categories-layout">
                    <section className="categories-panel">
                         <div className="categories-panel-heading">
                              <div>
                                   <h2>{editing ? 'Edit category' : 'Add category'}</h2>
                                   <p>
                                        {editing
                                             ? 'Update the category name.'
                                             : 'Create a category for grouping your products.'}
                                   </p>
                              </div>
                         </div>

                         <form className="categories-form" onSubmit={handleSubmit}>
                              <label htmlFor="category-name">Category name</label>

                              <input
                                   id="category-name"
                                   type="text"
                                   value={name}
                                   onChange={(event) => setName(event.target.value)}
                                   placeholder="e.g. Paper Cups"
                                   maxLength={100}
                                   required
                                   disabled={saving}
                              />

                              <div className="categories-character-count">
                                   {name.length}/100 characters
                              </div>

                              <div className="categories-form-actions">
                                   <button
                                        type="submit"
                                        className="categories-button categories-button-primary"
                                        disabled={saving || !name.trim()}
                                   >
                                        {saving
                                             ? 'Saving…'
                                             : editing
                                                  ? 'Save changes'
                                                  : 'Create category'}
                                   </button>

                                   {editing && (
                                        <button
                                             type="button"
                                             className="categories-button categories-button-secondary"
                                             onClick={resetForm}
                                             disabled={saving}
                                        >
                                             Cancel
                                        </button>
                                   )}
                              </div>
                         </form>

                         <div className="categories-note">
                              <strong>Note</strong>
                              <p>
                                   Deactivation preserves the category and its existing product
                                   associations. You can reactivate it later.
                              </p>
                         </div>
                    </section>

                    <section className="categories-panel categories-list-panel">
                         <div className="categories-panel-heading">
                              <div>
                                   <h2>All categories</h2>
                                   <p>
                                        {filteredCategories.length} categor
                                        {filteredCategories.length === 1 ? 'y' : 'ies'}
                                   </p>
                              </div>
                         </div>

                         <div className="categories-toolbar">
                              <input
                                   type="search"
                                   value={search}
                                   onChange={(event) => setSearch(event.target.value)}
                                   placeholder="Search categories…"
                                   aria-label="Search categories"
                              />

                              <label className="categories-checkbox">
                                   <input
                                        type="checkbox"
                                        checked={showInactive}
                                        onChange={(event) => setShowInactive(event.target.checked)}
                                   />
                                   Show inactive
                              </label>
                         </div>

                         {loading ? (
                              <div className="categories-empty">Loading categories and products…</div>
                         ) : filteredCategories.length === 0 ? (
                              <div className="categories-empty">
                                   <h3>{search ? 'No matching categories' : 'No categories yet'}</h3>
                                   <p>
                                        {search
                                             ? 'Try a different search term.'
                                             : 'Create your first category using the form.'}
                                   </p>
                              </div>
                         ) : (
                              <div className="categories-table-wrap">
                                   <table className="categories-table">
                                        <thead>
                                             <tr>
                                                  <th>Category and products</th>
                                                  <th>Status</th>
                                                  <th>Actions</th>
                                             </tr>
                                        </thead>

                                        <tbody>
                                             {filteredCategories.map((category) => {
                                                  const categoryProducts = getProductsForCategory(category)
                                                  const expanded = expandedCategories.includes(category.id)

                                                  return (
                                                       <Fragment key={category.id}>
                                                            <tr>
                                                                 <td>
                                                                      <div className="categories-name-cell">
                                                                           <button
                                                                                type="button"
                                                                                className="categories-expand-button"
                                                                                aria-label={`${expanded ? 'Collapse' : 'Expand'} ${category.name}`}
                                                                                aria-expanded={expanded}
                                                                                onClick={() => toggleCategory(category.id)}
                                                                           >
                                                                                {expanded ? '▾' : '▸'}
                                                                           </button>

                                                                           <div>
                                                                                <strong>{category.name}</strong>
                                                                                <div className="categories-product-count">
                                                                                     {categoryProducts.length} product
                                                                                     {categoryProducts.length === 1 ? '' : 's'}
                                                                                </div>
                                                                           </div>
                                                                      </div>
                                                                 </td>

                                                                 <td>
                                                                      <span
                                                                           className={`categories-status ${category.isActive ? 'is-active' : 'is-inactive'
                                                                                }`}
                                                                      >
                                                                           {category.isActive ? 'Active' : 'Inactive'}
                                                                      </span>
                                                                 </td>

                                                                 <td>
                                                                      <div className="categories-row-actions">
                                                                           <button
                                                                                type="button"
                                                                                className="categories-text-button"
                                                                                onClick={() => startEditing(category)}
                                                                                disabled={saving || Boolean(changingId)}
                                                                           >
                                                                                Edit
                                                                           </button>

                                                                           <button
                                                                                type="button"
                                                                                className={`categories-text-button ${category.isActive
                                                                                          ? 'categories-deactivate'
                                                                                          : 'categories-activate'
                                                                                     }`}
                                                                                onClick={() => void toggleActive(category)}
                                                                                disabled={saving || Boolean(changingId)}
                                                                           >
                                                                                {changingId === category.id
                                                                                     ? 'Please wait…'
                                                                                     : category.isActive
                                                                                          ? 'Deactivate'
                                                                                          : 'Activate'}
                                                                           </button>
                                                                      </div>
                                                                 </td>
                                                            </tr>

                                                            {expanded && (
                                                                 <tr className="categories-expanded-row">
                                                                      <td colSpan={3}>
                                                                           {renderProductList(categoryProducts)}
                                                                      </td>
                                                                 </tr>
                                                            )}
                                                       </Fragment>
                                                  )
                                             })}
                                        </tbody>
                                   </table>

                                   {uncategorizedProducts.length > 0 && (
                                        <section className="categories-uncategorized">
                                             <button
                                                  type="button"
                                                  className="categories-uncategorized-heading"
                                                  onClick={() => toggleCategory(UNCATEGORIZED_ID)}
                                                  aria-expanded={expandedCategories.includes(UNCATEGORIZED_ID)}
                                             >
                                                  <span>
                                                       <span className="categories-uncategorized-arrow">
                                                            {expandedCategories.includes(UNCATEGORIZED_ID)
                                                                 ? '▾'
                                                                 : '▸'}
                                                       </span>
                                                       Uncategorized
                                                  </span>

                                                  <span>
                                                       {uncategorizedProducts.length} product
                                                       {uncategorizedProducts.length === 1 ? '' : 's'}
                                                  </span>
                                             </button>

                                             {expandedCategories.includes(UNCATEGORIZED_ID) &&
                                                  renderProductList(uncategorizedProducts)}
                                        </section>
                                   )}
                              </div>
                         )}
                    </section>
               </div>
          </div>
     )
}
