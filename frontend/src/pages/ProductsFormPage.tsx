import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import './ProductsFormPage.css'

type AttributeInput = { id: string; name: string; value: string }
type VariantInput = {
     id: string
     name: string
     sku: string
     unit: string
     purchasePrice: string
     sellingPrice: string
     attributes: AttributeInput[]
}
type Category = { id: string; name: string; isActive: boolean }
type ProductSummary = {
     id: string
     name: string
     sku: string | null
     description?: string | null
     categoryId?: string | null
     category?: { id: string; name: string } | null
     attributes?: Array<{ id?: string; name: string; value: string }>
     variants?: Array<{
          id: string
          name: string
          sku: string | null
          unit: string
          purchasePricePaise: number
          sellingPricePaise: number
          stockQuantity?: number
          attributes?: Array<{ id?: string; name: string; value: string }>
     }>
}
type ApiResponse<T> = {
     success: boolean
     data: T
     count?: number
     message?: string
     error?: string
}
type SavedProduct = { id: string; name: string; variants?: Array<{ id: string }> }
type SavedVariant = { id: string; name: string }

let nextId = 0
function createId() {
     nextId += 1
     return `field-${nextId}`
}
function emptyAttribute(): AttributeInput {
     return { id: createId(), name: '', value: '' }
}
function emptyVariant(): VariantInput {
     return {
          id: createId(),
          name: '',
          sku: '',
          unit: 'piece',
          purchasePrice: '',
          sellingPrice: '',
          attributes: [],
     }
}
function toPaise(value: string) {
     return Math.round(Number(value) * 100)
}
function parseOptionalPrice(value: string, label: string): number {
     if (!value.trim()) return 0
     const amount = Number(value)
     if (!Number.isFinite(amount) || amount < 0) {
          throw new Error(`${label} must be a valid non-negative amount.`)
     }
     if (Math.round(amount * 100) !== amount * 100) {
          throw new Error(`${label} can have at most two decimal places.`)
     }
     return toPaise(value)
}
function validateAttributes(items: AttributeInput[], label: string) {
     const completed = items
          .filter((attribute) => attribute.name.trim() || attribute.value.trim())
          .map((attribute) => ({
               name: attribute.name.trim(),
               value: attribute.value.trim(),
          }))

     for (const attribute of completed) {
          if (!attribute.name || !attribute.value) {
               throw new Error(`${label}: fill in both the attribute name and value, or remove the empty row.`)
          }
     }
     return completed
}

export default function ProductsFormPage() {
     const navigate = useNavigate()
     const [mode, setMode] = useState<'new' | 'existing'>('new')
     const [name, setName] = useState('')
     const [sku, setSku] = useState('')
     const [description, setDescription] = useState('')
     const [categoryId, setCategoryId] = useState('')
     const [newCategoryName, setNewCategoryName] = useState('')
     const CREATE_CATEGORY_VALUE = '__create_new_category__'
     const [attributes, setAttributes] = useState<AttributeInput[]>([])
     const [variants, setVariants] = useState<VariantInput[]>([emptyVariant()])
     const [existingProducts, setExistingProducts] = useState<ProductSummary[]>([])
     const [selectedProductId, setSelectedProductId] = useState('')
     const [productSearch, setProductSearch] = useState('')
     const [categories, setCategories] = useState<Category[]>([])
     const [loadingReferenceData, setLoadingReferenceData] = useState(true)
     const [saving, setSaving] = useState(false)
     const [error, setError] = useState('')

     useEffect(() => {
          let cancelled = false
          async function loadReferenceData() {
               setLoadingReferenceData(true)
               try {
                    const [categoryResponse, productResponse] = await Promise.all([
                         apiRequest<ApiResponse<Category[]>>('/categories'),
                         apiRequest<ApiResponse<ProductSummary[]>>('/products'),
                    ])
                    if (cancelled) return
                    setCategories((categoryResponse.data ?? []).filter((category) => category.isActive))
                    setExistingProducts((productResponse.data ?? []).filter((product) => product))
               } catch (err) {
                    if (!cancelled) {
                         setError(err instanceof Error ? `Could not load products/categories: ${err.message}` : 'Could not load products/categories.')
                    }
               } finally {
                    if (!cancelled) setLoadingReferenceData(false)
               }
          }
          void loadReferenceData()
          return () => {
               cancelled = true
          }
     }, [])

     const selectedProduct = useMemo(
          () => existingProducts.find((product) => product.id === selectedProductId) ?? null,
          [existingProducts, selectedProductId],
     )
     const filteredProducts = useMemo(() => {
          const query = productSearch.trim().toLowerCase()
          if (!query) return existingProducts
          return existingProducts.filter((product) =>
               [product.name, product.sku ?? '', product.category?.name ?? '']
                    .some((value) => value.toLowerCase().includes(query)),
          )
     }, [existingProducts, productSearch])

     function updateAttribute(id: string, field: 'name' | 'value', value: string) {
          setAttributes((current) => current.map((attribute) => attribute.id === id ? { ...attribute, [field]: value } : attribute))
     }
     function updateVariant(id: string, field: keyof Omit<VariantInput, 'id' | 'attributes'>, value: string) {
          setVariants((current) => current.map((variant) => variant.id === id ? { ...variant, [field]: value } : variant))
     }
     function updateVariantAttribute(variantId: string, attributeId: string, field: 'name' | 'value', value: string) {
          setVariants((current) => current.map((variant) => variant.id === variantId
               ? { ...variant, attributes: variant.attributes.map((attribute) => attribute.id === attributeId ? { ...attribute, [field]: value } : attribute) }
               : variant))
     }
     function addVariantAttribute(variantId: string) {
          setVariants((current) => current.map((variant) => variant.id === variantId
               ? { ...variant, attributes: [...variant.attributes, emptyAttribute()] }
               : variant))
     }
     function removeVariantAttribute(variantId: string, attributeId: string) {
          setVariants((current) => current.map((variant) => variant.id === variantId
               ? { ...variant, attributes: variant.attributes.filter((attribute) => attribute.id !== attributeId) }
               : variant))
     }
     function makeVariantPayload(variant: VariantInput, index: number) {
          if (!variant.name.trim()) throw new Error(`Variant ${index + 1}: enter a variant name.`)
          if (!variant.unit.trim()) throw new Error(`Variant ${index + 1}: unit is required.`)
          return {
               name: variant.name.trim(),
               sku: variant.sku.trim() || null,
               unit: variant.unit.trim(),
               purchasePricePaise: parseOptionalPrice(variant.purchasePrice, `Variant ${index + 1} purchase price`),
               sellingPricePaise: parseOptionalPrice(variant.sellingPrice, `Variant ${index + 1} selling price`),
               attributes: validateAttributes(variant.attributes, `Variant ${index + 1}`),
          }
     }

     async function handleSubmit(event: FormEvent<HTMLFormElement>) {
          event.preventDefault()
          setError('')

          if (mode === 'existing' && !selectedProductId) {
               setError('Select an existing product before adding a variant.')
               return
          }
          if (mode === 'new' && !name.trim()) {
               setError('Product name is required.')
               return
          }

          try {
               setSaving(true)
               if (mode === 'existing') {
                    const variant = makeVariantPayload(variants[0], 0)
                    const response = await apiRequest<ApiResponse<SavedVariant>>(
                         `/products/${encodeURIComponent(selectedProductId)}/variants`,
                         { method: 'POST', body: JSON.stringify(variant) },
                    )
                    if (!response.success) throw new Error(response.message || 'The variant could not be saved.')
                    const productName = selectedProduct?.name ?? 'the selected product'
                    navigate('/products', { state: { message: `Variant "${variant.name}" added to "${productName}" successfully.` } })
                    return
               }

               const productName = name.trim()
               const cleanedVariants = variants
                    .filter((variant) =>
                         variant.name.trim() || variant.sku.trim() || variant.purchasePrice.trim() ||
                         variant.sellingPrice.trim() || variant.attributes.some((attribute) => attribute.name.trim() || attribute.value.trim()),
                    )
                    .map(makeVariantPayload)
               if (cleanedVariants.length === 0) throw new Error('Add at least one variant to this product.')

               const productAttributes = validateAttributes(attributes, 'Product attributes')

               // Reuse an existing category with the same name; otherwise create it first.
               let resolvedCategoryId = categoryId
               if (categoryId === CREATE_CATEGORY_VALUE) {
                    const categoryName = newCategoryName.trim()
                    if (!categoryName) throw new Error('Enter a name for the new category.')

                    const existingCategory = categories.find(
                         (category) => category.name.trim().toLocaleLowerCase() === categoryName.toLocaleLowerCase(),
                    )
                    if (existingCategory) {
                         resolvedCategoryId = existingCategory.id
                    } else {
                         const categoryResponse = await apiRequest<ApiResponse<Category>>('/categories', {
                              method: 'POST',
                              body: JSON.stringify({ name: categoryName }),
                         })
                         if (!categoryResponse.success || !categoryResponse.data?.id) {
                              throw new Error(categoryResponse.message || 'The new category could not be created.')
                         }
                         resolvedCategoryId = categoryResponse.data.id
                    }
               }

               const response = await apiRequest<ApiResponse<SavedProduct>>('/products', {
                    method: 'POST',
                    body: JSON.stringify({
                         name: productName,
                         sku: sku.trim() || null,
                         description: description.trim() || null,
                         categoryId: resolvedCategoryId && resolvedCategoryId !== CREATE_CATEGORY_VALUE ? resolvedCategoryId : null,
                         attributes: productAttributes,
                         variants: cleanedVariants,
                    }),
               })
               if (!response.success || !response.data?.id) {
                    throw new Error(response.message || 'The product could not be saved.')
               }
               navigate('/products', { state: { message: `Product "${productName}" created successfully.` } })
          } catch (err) {
               setError(err instanceof Error ? err.message : 'The information could not be saved.')
          } finally {
               setSaving(false)
          }
     }

     return (
          <div className="product-form-page">
               <div className="product-form-breadcrumb">
                    <Link to="/products">Products</Link><span>/</span><span>Add product</span>
               </div>

               <header className="product-form-heading">
                    <div>
                         <p className="product-form-eyebrow">CATALOGUE</p>
                         <h1>Add product</h1>
                         <p>Create a new product or add a variant to a product already in your catalogue.</p>
                    </div>
                    <Link className="product-form-button secondary" to="/products">Cancel</Link>
               </header>

               {error && (
                    <div className="product-form-error" role="alert">
                         <span>{error}</span>
                         <button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button>
                    </div>
               )}

               <div className="product-form-card product-form-mode-card">
                    <div className="product-form-section-heading">
                         <div className="product-form-section-number">01</div>
                         <div><h2>What would you like to add?</h2><p>Choose the workflow before entering details.</p></div>
                    </div>
                    <div className="product-form-mode-options">
                         <button type="button" className={`product-form-mode-option ${mode === 'new' ? 'selected' : ''}`} onClick={() => { setMode('new'); setError('') }}>
                              <strong>Create a new product</strong><span>Enter product details and one or more initial variants.</span>
                         </button>
                         <button type="button" className={`product-form-mode-option ${mode === 'existing' ? 'selected' : ''}`} onClick={() => { setMode('existing'); setError('') }}>
                              <strong>Add to an existing product</strong><span>Select a product and add only a new variant to it.</span>
                         </button>
                    </div>
               </div>

               <form onSubmit={handleSubmit} className="product-form">
                    {mode === 'existing' ? (
                         <>
                              <section className="product-form-card">
                                   <div className="product-form-section-heading">
                                        <div className="product-form-section-number">02</div>
                                        <div><h2>Select existing product</h2><p>The existing product's details will not be changed.</p></div>
                                   </div>
                                   <div className="product-form-grid">
                                        <label className="product-form-field full">
                                             <span>Search products</span>
                                             <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search by product name, SKU, or category" />
                                        </label>
                                        <label className="product-form-field full">
                                             <span>Existing product <b>*</b></span>
                                             <select required value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} disabled={loadingReferenceData}>
                                                  <option value="">{loadingReferenceData ? 'Loading products...' : 'Select a product'}</option>
                                                  {filteredProducts.map((product) => (
                                                       <option key={product.id} value={product.id}>
                                                            {product.name}{product.sku ? ` — ${product.sku}` : ''}{product.category?.name ? ` (${product.category.name})` : ''}
                                                       </option>
                                                  ))}
                                             </select>
                                             {!loadingReferenceData && filteredProducts.length === 0 && <small>No matching products found.</small>}
                                        </label>
                                   </div>
                                   {selectedProduct && (
                                        <div className="product-form-info">
                                             <strong>{selectedProduct.name}</strong>
                                             {selectedProduct.sku ? ` · SKU ${selectedProduct.sku}` : ''}
                                             {selectedProduct.category?.name ? ` · ${selectedProduct.category.name}` : ''}
                                             <p>{selectedProduct.variants?.length ?? 0} existing variant(s). Product details and shared attributes will be retained.</p>
                                        </div>
                                   )}
                              </section>
                              <section className="product-form-card">
                                   <div className="product-form-section-heading">
                                        <div className="product-form-section-number">03</div>
                                        <div><h2>New variant details</h2><p>Only the variant below will be added to the selected product.</p></div>
                                   </div>
                                   <div className="product-form-info">A new variant starts with zero stock. Use Inventory or Purchases to add stock after saving.</div>
                                   <VariantEditor
                                        variant={variants[0]}
                                        index={0}
                                        updateVariant={updateVariant}
                                        updateVariantAttribute={updateVariantAttribute}
                                        addVariantAttribute={addVariantAttribute}
                                        removeVariantAttribute={removeVariantAttribute}
                                   />
                              </section>
                         </>
                    ) : (
                         <>
                              <section className="product-form-card">
                                   <div className="product-form-section-heading">
                                        <div className="product-form-section-number">02</div>
                                        <div><h2>Basic information</h2><p>Enter the main details for this new product.</p></div>
                                   </div>
                                   <div className="product-form-grid">
                                        <label className="product-form-field full">
                                             <span>Product name <b>*</b></span>
                                             <input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter product name" maxLength={200} />
                                        </label>
                                        <label className="product-form-field">
                                             <span>Product SKU <small>Optional</small></span>
                                             <input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="e.g. PROD-001" maxLength={100} />
                                             <small>A unique identifier for the product.</small>
                                        </label>
                                        <label className="product-form-field">
                                             <span>Category <small>Optional</small></span>
                                             <select
                                                  value={categoryId}
                                                  onChange={(event) => {
                                                       setCategoryId(event.target.value)
                                                       if (event.target.value !== CREATE_CATEGORY_VALUE) setNewCategoryName('')
                                                  }}
                                                  disabled={loadingReferenceData || saving}
                                             >
                                                  <option value="">{loadingReferenceData ? 'Loading categories...' : 'No category'}</option>
                                                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                                                  <option value={CREATE_CATEGORY_VALUE}>+ Other — create a new category</option>
                                             </select>
                                        </label>
                                        {categoryId === CREATE_CATEGORY_VALUE && (
                                             <label className="product-form-field full product-form-new-category-field">
                                                  <span>New category name <b>*</b></span>
                                                  <input
                                                       autoFocus
                                                       required
                                                       value={newCategoryName}
                                                       onChange={(event) => setNewCategoryName(event.target.value)}
                                                       placeholder="Type the new category name"
                                                       maxLength={100}
                                                       disabled={saving}
                                                  />
                                                  <small>The category will be saved and selected when you create this product.</small>
                                             </label>
                                        )}
                                        <label className="product-form-field full">
                                             <span>Description <small>Optional</small></span>
                                             <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add a short description" rows={3} maxLength={2000} />
                                        </label>
                                   </div>
                              </section>

                              <section className="product-form-card">
                                   <div className="product-form-section-heading">
                                        <div className="product-form-section-number">03</div>
                                        <div><h2>Product attributes</h2><p>Add any customizable properties shared by this product.</p></div>
                                   </div>
                                   {attributes.length === 0 ? (
                                        <div className="product-form-empty"><p>No product attributes added.</p><span>Examples: material, brand, or product type.</span></div>
                                   ) : (
                                        <div className="product-form-attribute-list">
                                             {attributes.map((attribute, index) => (
                                                  <div className="product-form-attribute-row" key={attribute.id}>
                                                       <span className="product-form-row-index">{index + 1}</span>
                                                       <label className="product-form-field"><span>Attribute name</span><input value={attribute.name} onChange={(event) => updateAttribute(attribute.id, 'name', event.target.value)} placeholder="e.g. Material" maxLength={100} /></label>
                                                       <label className="product-form-field"><span>Value</span><input value={attribute.value} onChange={(event) => updateAttribute(attribute.id, 'value', event.target.value)} placeholder="e.g. Paper" maxLength={500} /></label>
                                                       <button type="button" className="product-form-remove" onClick={() => setAttributes((current) => current.filter((item) => item.id !== attribute.id))} aria-label={`Remove attribute ${index + 1}`}>×</button>
                                                  </div>
                                             ))}
                                        </div>
                                   )}
                                   <button type="button" className="product-form-add-link" onClick={() => setAttributes((current) => [...current, emptyAttribute()])}><span>+</span> Add attribute</button>
                              </section>

                              <section className="product-form-card">
                                   <div className="product-form-section-heading">
                                        <div className="product-form-section-number">04</div>
                                        <div><h2>Variants and pricing</h2><p>Add one or more versions of this new product.</p></div>
                                   </div>
                                   <div className="product-form-info">Each variant can have its own SKU, unit, prices, and attributes. New variants start with zero stock.</div>
                                   <div className="product-form-variants">
                                        {variants.map((variant, index) => (
                                             <VariantEditor
                                                  key={variant.id}
                                                  variant={variant}
                                                  index={index}
                                                  canRemove={variants.length > 1}
                                                  updateVariant={updateVariant}
                                                  updateVariantAttribute={updateVariantAttribute}
                                                  addVariantAttribute={addVariantAttribute}
                                                  removeVariantAttribute={removeVariantAttribute}
                                                  onRemove={() => setVariants((current) => current.filter((item) => item.id !== variant.id))}
                                             />
                                        ))}
                                   </div>
                                   <button type="button" className="product-form-add-variant" onClick={() => setVariants((current) => [...current, emptyVariant()])}><span>+</span> Add another variant</button>
                              </section>
                         </>
                    )}

                    <div className="product-form-submit-bar">
                         <div>
                              <strong>{mode === 'existing' ? 'Add one variant' : `${variants.length} variant${variants.length === 1 ? '' : 's'} configured`}</strong>
                              <p>{mode === 'existing' ? 'The selected product will be kept; only its variants will change.' : 'Review the details before saving.'}</p>
                         </div>
                         <div className="product-form-submit-actions">
                              <Link className="product-form-button secondary" to="/products">Cancel</Link>
                              <button type="submit" className="product-form-button primary" disabled={saving || loadingReferenceData || (mode === 'existing' && existingProducts.length === 0)}>
                                   {saving ? 'Saving...' : mode === 'existing' ? 'Add variant' : 'Save product'}
                              </button>
                         </div>
                    </div>
               </form>
          </div>
     )
}

type VariantEditorProps = {
     variant: VariantInput
     index: number
     canRemove?: boolean
     updateVariant: (id: string, field: keyof Omit<VariantInput, 'id' | 'attributes'>, value: string) => void
     updateVariantAttribute: (variantId: string, attributeId: string, field: 'name' | 'value', value: string) => void
     addVariantAttribute: (variantId: string) => void
     removeVariantAttribute: (variantId: string, attributeId: string) => void
     onRemove?: () => void
}
function VariantEditor({
     variant,
     index,
     canRemove = false,
     updateVariant,
     updateVariantAttribute,
     addVariantAttribute,
     removeVariantAttribute,
     onRemove,
}: VariantEditorProps) {
     return (
          <article className="product-form-variant">
               <div className="product-form-variant-heading">
                    <div><span className="product-form-variant-label">VARIANT {index + 1}</span><h3>{variant.name.trim() || 'New variant'}</h3></div>
                    {canRemove && <button type="button" className="product-form-remove-variant" onClick={onRemove}>Remove variant</button>}
               </div>
               <div className="product-form-grid">
                    <label className="product-form-field"><span>Variant name <b>*</b></span><input required value={variant.name} onChange={(event) => updateVariant(variant.id, 'name', event.target.value)} placeholder="e.g. 10-inch Premium" maxLength={200} /></label>
                    <label className="product-form-field"><span>Variant SKU <small>Optional</small></span><input value={variant.sku} onChange={(event) => updateVariant(variant.id, 'sku', event.target.value)} placeholder="e.g. PROD-001-A" maxLength={100} /></label>
                    <label className="product-form-field"><span>Unit <b>*</b></span><input required value={variant.unit} onChange={(event) => updateVariant(variant.id, 'unit', event.target.value)} placeholder="piece, pack, box, kg" maxLength={50} /></label>
                    <label className="product-form-field"><span>Purchase price (₹)</span><input type="number" min="0" step="0.01" inputMode="decimal" value={variant.purchasePrice} onChange={(event) => updateVariant(variant.id, 'purchasePrice', event.target.value)} placeholder="0.00" /></label>
                    <label className="product-form-field"><span>Selling price (₹)</span><input type="number" min="0" step="0.01" inputMode="decimal" value={variant.sellingPrice} onChange={(event) => updateVariant(variant.id, 'sellingPrice', event.target.value)} placeholder="0.00" /></label>
               </div>
               <div className="product-form-variant-attributes">
                    <div className="product-form-subheading">
                         <div><h4>Variant attributes</h4><p>Optional properties specific to this variant.</p></div>
                         <button type="button" className="product-form-add-link compact" onClick={() => addVariantAttribute(variant.id)}><span>+</span> Add attribute</button>
                    </div>
                    {variant.attributes.length > 0 && (
                         <div className="product-form-attribute-list">
                              {variant.attributes.map((attribute, attributeIndex) => (
                                   <div className="product-form-attribute-row" key={attribute.id}>
                                        <span className="product-form-row-index">{attributeIndex + 1}</span>
                                        <label className="product-form-field"><span>Attribute name</span><input value={attribute.name} onChange={(event) => updateVariantAttribute(variant.id, attribute.id, 'name', event.target.value)} placeholder="e.g. Size" maxLength={100} /></label>
                                        <label className="product-form-field"><span>Value</span><input value={attribute.value} onChange={(event) => updateVariantAttribute(variant.id, attribute.id, 'value', event.target.value)} placeholder="e.g. 10 inch" maxLength={500} /></label>
                                        <button type="button" className="product-form-remove" onClick={() => removeVariantAttribute(variant.id, attribute.id)} aria-label={`Remove variant attribute ${attributeIndex + 1}`}>×</button>
                                   </div>
                              ))}
                         </div>
                    )}
               </div>
          </article>
     )
}
