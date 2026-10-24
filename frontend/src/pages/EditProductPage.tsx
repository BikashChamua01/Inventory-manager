import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import './ProductsFormPage.css'

type Attribute = { id?: string; name: string; value: string }
type Category = { id: string; name: string; isActive: boolean }
type Product = {
  id: string
  name: string
  sku: string | null
  description: string | null
  categoryId: string | null
  category?: { id: string; name: string } | null
  attributes: Attribute[]
}
type ApiResponse<T> = {
  success: boolean
  data: T
  message?: string
  error?: string
}

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [product, setProduct] = useState<Product | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!id) {
        setError('Product ID is missing.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const [productResponse, categoryResponse] = await Promise.all([
          apiRequest<ApiResponse<Product>>(`/products/${encodeURIComponent(id)}`),
          apiRequest<ApiResponse<Category[]>>('/categories'),
        ])

        if (cancelled) return
        if (!productResponse.success || !productResponse.data) {
          throw new Error(productResponse.message || 'Product could not be loaded.')
        }

        const loaded = productResponse.data
        setProduct(loaded)
        setName(loaded.name ?? '')
        setSku(loaded.sku ?? '')
        setDescription(loaded.description ?? '')
        setCategoryId(loaded.categoryId ?? '')
        setAttributes(
          (loaded.attributes ?? []).map((attribute, index) => ({
            id: attribute.id ?? `attribute-${index}`,
            name: attribute.name,
            value: attribute.value,
          })),
        )
        setCategories((categoryResponse.data ?? []).filter((category) => category.isActive))
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Product could not be loaded.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  function updateAttribute(index: number, field: 'name' | 'value', value: string) {
    setAttributes((current) =>
      current.map((attribute, itemIndex) =>
        itemIndex === index ? { ...attribute, [field]: value } : attribute,
      ),
    )
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const cleanedAttributes = attributes
      .filter((attribute) => attribute.name.trim() || attribute.value.trim())
      .map((attribute) => ({
        name: attribute.name.trim(),
        value: attribute.value.trim(),
      }))

    const incomplete = cleanedAttributes.some((attribute) => !attribute.name || !attribute.value)
    if (incomplete) {
      setError('For each attribute, enter both the name and value, or remove the empty row.')
      return
    }

    void saveProduct(cleanedAttributes)
  }

  async function saveProduct(cleanedAttributes: Array<{ name: string; value: string }>) {
    if (!id) return

    setSaving(true)
    try {
      const response = await apiRequest<ApiResponse<Product>>(
        `/products/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: name.trim(),
            sku: sku.trim() || null,
            description: description.trim() || null,
            categoryId: categoryId || null,
            attributes: cleanedAttributes,
          }),
        },
      )

      if (!response.success) {
        throw new Error(response.message || 'Product could not be updated.')
      }

      navigate('/products', {
        state: { message: `Product "${name.trim()}" updated successfully.` },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Product could not be updated.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="product-form-page">
        <div className="product-form-card">Loading product details…</div>
      </div>
    )
  }

  if (!product && !loading) {
    return (
      <div className="product-form-page">
        <header className="product-form-heading">
          <div>
            <p className="product-form-eyebrow">CATALOGUE</p>
            <h1>Edit product</h1>
            <p>The requested product could not be loaded.</p>
          </div>
          <Link className="product-form-button secondary" to="/products">Back to products</Link>
        </header>
        {error && <div className="product-form-error" role="alert">{error}</div>}
      </div>
    )
  }

  return (
    <div className="product-form-page">
      <div className="product-form-breadcrumb">
        <Link to="/products">Products</Link><span>/</span><span>Edit product</span>
      </div>

      <header className="product-form-heading">
        <div>
          <p className="product-form-eyebrow">CATALOGUE</p>
          <h1>Edit product</h1>
          <p>Update the product's shared details. Variant prices and stock are managed separately.</p>
        </div>
        <Link className="product-form-button secondary" to="/products">Cancel</Link>
      </header>

      {error && (
        <div className="product-form-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button>
        </div>
      )}

      <form className="product-form" onSubmit={handleSubmit}>
        <section className="product-form-card">
          <div className="product-form-section-heading">
            <div className="product-form-section-number">01</div>
            <div>
              <h2>Basic information</h2>
              <p>Edit the product-level information shared by its variants.</p>
            </div>
          </div>

          <div className="product-form-grid">
            <label className="product-form-field full">
              <span>Product name <b>*</b></span>
              <input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
            </label>

            <label className="product-form-field">
              <span>Product SKU <small>Optional</small></span>
              <input maxLength={100} value={sku} onChange={(event) => setSku(event.target.value)} placeholder="e.g. PROD-001" />
            </label>

            <label className="product-form-field">
              <span>Category <small>Optional</small></span>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={saving}>
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
                {product?.categoryId && !categories.some((category) => category.id === product.categoryId) && (
                  <option value={product.categoryId}>{product.category?.name ?? 'Current inactive category'}</option>
                )}
              </select>
            </label>

            <label className="product-form-field full">
              <span>Description <small>Optional</small></span>
              <textarea rows={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add a short description" />
            </label>
          </div>
        </section>

        <section className="product-form-card">
          <div className="product-form-section-heading">
            <div className="product-form-section-number">02</div>
            <div>
              <h2>Product attributes</h2>
              <p>Manage any shared properties. Attribute names and values are fully customizable.</p>
            </div>
          </div>

          {attributes.length === 0 ? (
            <div className="product-form-empty">
              <p>No product attributes added.</p>
              <span>Examples: material, brand, or product type.</span>
            </div>
          ) : (
            <div className="product-form-attribute-list">
              {attributes.map((attribute, index) => (
                <div className="product-form-attribute-row" key={attribute.id ?? index}>
                  <span className="product-form-row-index">{index + 1}</span>
                  <label className="product-form-field">
                    <span>Attribute name</span>
                    <input maxLength={100} value={attribute.name} onChange={(event) => updateAttribute(index, 'name', event.target.value)} placeholder="e.g. Material" />
                  </label>
                  <label className="product-form-field">
                    <span>Value</span>
                    <input maxLength={500} value={attribute.value} onChange={(event) => updateAttribute(index, 'value', event.target.value)} placeholder="e.g. Paper" />
                  </label>
                  <button
                    type="button"
                    className="product-form-remove"
                    onClick={() => setAttributes((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    aria-label={`Remove attribute ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="product-form-add-link"
            onClick={() => setAttributes((current) => [...current, { id: `new-${Date.now()}-${current.length}`, name: '', value: '' }])}
          >
            <span>+</span> Add attribute
          </button>
        </section>

        <div className="product-form-info">
          <strong>Stock and variant safety</strong>
          <p>This form does not modify variants, purchase prices, selling prices, quantities, or transaction history.</p>
        </div>

        <div className="product-form-submit-bar">
          <div>
            <strong>Update product details</strong>
            <p>Changes are saved to your local inventory database.</p>
          </div>
          <div className="product-form-submit-actions">
            <Link className="product-form-button secondary" to="/products">Cancel</Link>
            <button className="product-form-button primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
