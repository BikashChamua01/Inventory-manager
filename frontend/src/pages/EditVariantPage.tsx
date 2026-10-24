import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import './ProductsFormPage.css'
import './EditVariantPage.css'

type Attribute = { id?: string; name: string; value: string }
type ProductSummary = { id: string; name: string; sku: string | null; isActive: boolean }
type Variant = {
  id: string
  productId: string
  name: string
  sku: string | null
  unit: string
  purchasePricePaise: number
  sellingPricePaise: number
  isActive: boolean
  attributes: Attribute[]
  product: ProductSummary
}
type ApiResponse<T> = {
  success: boolean
  data: T
  message?: string
  error?: string
}

function paiseToRupees(paise: number | null | undefined) {
  return paise == null ? '' : (paise / 100).toString()
}

function rupeesToPaise(value: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  const paise = Math.round(parsed * 100)
  return Number.isSafeInteger(paise) ? paise : null
}

export default function EditVariantPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [variant, setVariant] = useState<Variant | null>(null)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [unit, setUnit] = useState('piece')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadVariant() {
      if (!id) {
        setError('Variant ID is missing.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const response = await apiRequest<ApiResponse<Variant>>(
          `/variants/${encodeURIComponent(id)}`,
        )

        if (cancelled) return
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Variant could not be loaded.')
        }

        const loaded = response.data
        setVariant(loaded)
        setName(loaded.name ?? '')
        setSku(loaded.sku ?? '')
        setUnit(loaded.unit ?? 'piece')
        setPurchasePrice(paiseToRupees(loaded.purchasePricePaise))
        setSellingPrice(paiseToRupees(loaded.sellingPricePaise))
        setAttributes(
          (loaded.attributes ?? []).map((attribute, index) => ({
            id: attribute.id ?? `attribute-${index}`,
            name: attribute.name,
            value: attribute.value,
          })),
        )
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Variant could not be loaded.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadVariant()
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!id) return
    setError('')

    const purchasePaise = rupeesToPaise(purchasePrice)
    const sellingPaise = rupeesToPaise(sellingPrice)

    if (purchasePaise === null || sellingPaise === null) {
      setError('Enter valid non-negative prices in rupees, with up to two decimal places.')
      return
    }

    const cleanedAttributes = attributes
      .filter((attribute) => attribute.name.trim() || attribute.value.trim())
      .map((attribute) => ({
        name: attribute.name.trim(),
        value: attribute.value.trim(),
      }))

    if (cleanedAttributes.some((attribute) => !attribute.name || !attribute.value)) {
      setError('For each attribute, enter both the name and value, or remove the empty row.')
      return
    }

    setSaving(true)
    try {
      const response = await apiRequest<ApiResponse<Variant>>(
        `/variants/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: name.trim(),
            sku: sku.trim() || null,
            unit: unit.trim() || 'piece',
            purchasePricePaise: purchasePaise,
            sellingPricePaise: sellingPaise,
            attributes: cleanedAttributes,
          }),
        },
      )

      if (!response.success) {
        throw new Error(response.message || 'Variant could not be updated.')
      }

      navigate('/products', {
        state: {
          message: `Variant "${name.trim()}" updated successfully.`,
          expandProductId: variant?.productId,
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Variant could not be updated.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="product-form-page"><div className="product-form-card">Loading variant details…</div></div>
  }

  if (!variant) {
    return (
      <div className="product-form-page">
        <header className="product-form-heading">
          <div>
            <p className="product-form-eyebrow">CATALOGUE</p>
            <h1>Edit</h1>
            <p>The requested variant could not be loaded.</p>
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
        <Link to="/products">Products</Link><span>/</span><span>{variant.product?.name ?? 'Product'}</span><span>/</span><span>Edit</span>
      </div>

      <header className="product-form-heading">
        <div>
          <p className="product-form-eyebrow">VARIANT DETAILS</p>
          <h1>Edit</h1>
          <p>Product: <strong>{variant.product?.name ?? 'Unknown product'}</strong></p>
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
              <h2>Variant information</h2>
              <p>Update this variant's identity, unit, and default prices.</p>
            </div>
          </div>

          <div className="product-form-grid">
            <label className="product-form-field full">
              <span>Variant name <b>*</b></span>
              <input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
            </label>

            <label className="product-form-field">
              <span>Variant SKU <small>Optional</small></span>
              <input maxLength={100} value={sku} onChange={(event) => setSku(event.target.value)} placeholder="e.g. PLATE-10-PREM" />
            </label>

            <label className="product-form-field">
              <span>Unit <b>*</b></span>
              <input required maxLength={50} value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="piece, packet, box…" />
            </label>

            <label className="product-form-field">
              <span>Default purchase price (₹) <b>*</b></span>
              <input required type="number" min="0" step="0.01" disabled inputMode="decimal" value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value) } />
              <small>Used as the variant's default purchase price; past purchases remain unchanged.</small>
            </label>

            <label className="product-form-field">
              <span>Default selling price (₹) <b>*</b></span>
              <input required disabled type="number" min="0" step="0.01" inputMode="decimal" value={sellingPrice} onChange={(event) => setSellingPrice(event.target.value)} />
              <small>Used as the default price for future sales; past sales remain unchanged.</small>
            </label>
          </div>
        </section>

        <section className="product-form-card">
          <div className="product-form-section-heading">
            <div className="product-form-section-number">02</div>
            <div>
              <h2>Variant attributes</h2>
              <p>Attributes are flexible. Add any name/value pair that describes this variant.</p>
            </div>
          </div>

          {attributes.length === 0 ? (
            <div className="product-form-empty">
              <p>No variant attributes added.</p>
              <span>Examples: size, pack count, quality, or material.</span>
            </div>
          ) : (
            <div className="product-form-attribute-list">
              {attributes.map((attribute, index) => (
                <div className="product-form-attribute-row" key={attribute.id ?? index}>
                  <span className="product-form-row-index">{index + 1}</span>
                  <label className="product-form-field">
                    <span>Attribute name</span>
                    <input maxLength={100} value={attribute.name} onChange={(event) => updateAttribute(index, 'name', event.target.value)} placeholder="e.g. Size" />
                  </label>
                  <label className="product-form-field">
                    <span>Value</span>
                    <input maxLength={500} value={attribute.value} onChange={(event) => updateAttribute(index, 'value', event.target.value)} placeholder="e.g. 10 inch" />
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
          <strong>Stock and history protection</strong>
          <p>Current stock quantity, average cost, stock movements, and previous sale/purchase records are not changed by this form.</p>
        </div>

        <div className="product-form-submit-bar">
          <div>
            <strong>Save variant changes</strong>
            <p>Only this variant's details and default prices will be updated.</p>
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
