
import { useEffect, useState } from 'react'
import {
  Bell,
  Boxes,
  CheckCircle2,
  Info,
  LoaderCircle,
  Save,
  Store,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import './SettingsPage.css'

type Settings = {
  'shop.name': string
  'shop.owner': string
  'shop.phone': string
  'shop.email': string
  'shop.address': string
  'shop.invoiceHeading': string
  'shop.invoiceFooter': string
  'inventory.defaultUnit': string
  'inventory.defaultLowStockThreshold': string
  'inventory.lowStockWarnings': string
  'preferences.confirmBeforeDelete': string
  'preferences.confirmBeforeStockAdjustment': string
  'backup.reminderEnabled': string
  'backup.reminderIntervalDays': string
}

type ApiResponse<T> = {
  success: boolean
  data: T
  message?: string
}

const DEFAULT_SETTINGS: Settings = {
  'shop.name': '',
  'shop.owner': '',
  'shop.phone': '',
  'shop.email': '',
  'shop.address': '',
  'shop.invoiceHeading': 'INVOICE',
  'shop.invoiceFooter': 'Thank you for your business!',
  'inventory.defaultUnit': 'piece',
  'inventory.defaultLowStockThreshold': '5',
  'inventory.lowStockWarnings': 'true',
  'preferences.confirmBeforeDelete': 'true',
  'preferences.confirmBeforeStockAdjustment': 'true',
  'backup.reminderEnabled': 'true',
  'backup.reminderIntervalDays': '7',
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="settings-field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function ToggleField({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="settings-toggle">
      <span className="settings-toggle-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true

    async function loadSettings() {
      setLoading(true)
      setError('')

      try {
        const response =
          await apiRequest<ApiResponse<Settings>>('/settings')

        if (!response.success || !response.data) {
          throw new Error('Could not load settings.')
        }

        if (active) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...response.data,
          })
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load settings.',
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadSettings()

    return () => {
      active = false
    }
  }, [])

  function update<K extends keyof Settings>(
    key: K,
    value: Settings[K],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }))
    setSuccess('')
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await apiRequest<ApiResponse<Settings>>(
        '/settings',
        {
          method: 'PUT',
          body: JSON.stringify(settings),
        },
      )

      if (!response.success || !response.data) {
        throw new Error('Could not save settings.')
      }

      setSettings({
        ...DEFAULT_SETTINGS,
        ...response.data,
      })
      setSuccess(response.message || 'Settings saved successfully.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save settings.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page-content">
        <div className="settings-state">
          <LoaderCircle className="settings-spinner" size={22} />
          <span>Loading settings…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content settings-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">APPLICATION CONFIGURATION</p>
          <h1>Settings</h1>
          <p className="page-description">
            Customize the application for your shop.
            Your changes are saved locally.
          </p>
        </div>

        <button
          type="submit"
          form="settings-form"
          className="button button-primary"
          disabled={saving}
        >
          {saving ? (
            <LoaderCircle className="settings-spinner" size={17} />
          ) : (
            <Save size={17} />
          )}
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {error && (
        <div className="settings-message settings-message-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div
          className="settings-message settings-message-success"
          role="status"
        >
          <CheckCircle2 size={17} />
          {success}
        </div>
      )}

      <form id="settings-form" onSubmit={saveSettings}>
        <section className="panel settings-panel">
          <div className="settings-section-heading">
            <span className="settings-section-icon">
              <Store size={20} />
            </span>
            <div>
              <h2>Shop profile</h2>
              <p>Business information for your local workspace.</p>
            </div>
          </div>

          <div className="settings-fields-grid">
            <TextField
              label="Shop name"
              value={settings['shop.name']}
              onChange={(v) => update('shop.name', v)}
              placeholder="e.g. Sharma General Store"
            />
            <TextField
              label="Owner name"
              value={settings['shop.owner']}
              onChange={(v) => update('shop.owner', v)}
              placeholder="Owner's full name"
            />
            <TextField
              label="Phone number"
              value={settings['shop.phone']}
              onChange={(v) => update('shop.phone', v)}
              placeholder="Business contact number"
              type="tel"
            />
            <TextField
              label="Email address"
              value={settings['shop.email']}
              onChange={(v) => update('shop.email', v)}
              placeholder="shop@example.com"
              type="email"
            />
            <TextField
              label="Invoice heading"
              value={settings['shop.invoiceHeading']}
              onChange={(v) => update('shop.invoiceHeading', v)}
              placeholder="INVOICE"
            />
            <TextField
              label="Invoice footer"
              value={settings['shop.invoiceFooter']}
              onChange={(v) => update('shop.invoiceFooter', v)}
              placeholder="Thank you for your business!"
            />
            <label className="settings-field settings-field-full">
              <span>Shop address</span>
              <textarea
                value={settings['shop.address']}
                onChange={(event) => update('shop.address', event.target.value)}
                placeholder="Enter the shop's full address"
                rows={3}
              />
            </label>
          </div>
          <p className="settings-note">
            These details are stored now. Connecting them to printed
            invoices will be a separate step in the billing workflow.
          </p>
        </section>

        <section className="panel settings-panel">
          <div className="settings-section-heading">
            <span className="settings-section-icon">
              <Boxes size={20} />
            </span>
            <div>
              <h2>Inventory preferences</h2>
              <p>Choose defaults for new inventory items and stock alerts.</p>
            </div>
          </div>

          <div className="settings-fields-grid">
            <label className="settings-field">
              <span>Default unit for new variants</span>
              <select
                value={settings['inventory.defaultUnit']}
                onChange={(event) =>
                  update('inventory.defaultUnit', event.target.value)
                }
              >
                <option value="piece">Piece</option>
                <option value="packet">Packet</option>
                <option value="box">Box</option>
                <option value="dozen">Dozen</option>
                <option value="kg">Kilogram (kg)</option>
                <option value="gram">Gram (g)</option>
                <option value="litre">Litre (L)</option>
                <option value="ml">Millilitre (ml)</option>
                <option value="metre">Metre (m)</option>
              </select>
            </label>

            <TextField
              label="Default low-stock threshold"
              value={settings['inventory.defaultLowStockThreshold']}
              onChange={(v) =>
                update('inventory.defaultLowStockThreshold', v)
              }
              placeholder="5"
              type="number"
            />
          </div>

          <div className="settings-toggle-list">
            <ToggleField
              title="Low-stock warnings"
              description="Enable the preference for warning about stock running low."
              checked={settings['inventory.lowStockWarnings'] === 'true'}
              onChange={(v) =>
                update('inventory.lowStockWarnings', String(v))
              }
            />
          </div>

          <p className="settings-note">
            These values define defaults. Applying them automatically to
            product creation and existing inventory alerts requires
            connecting those workflows to these preferences.
          </p>
        </section>

        <section className="panel settings-panel">
          <div className="settings-section-heading">
            <span className="settings-section-icon">
              <Bell size={20} />
            </span>
            <div>
              <h2>Confirmations and reminders</h2>
              <p>Configure safety prompts and backup reminder preferences.</p>
            </div>
          </div>

          <div className="settings-toggle-list">
            <ToggleField
              title="Confirm before deleting"
              description="Preference for confirmation before destructive actions."
              checked={settings['preferences.confirmBeforeDelete'] === 'true'}
              onChange={(v) =>
                update('preferences.confirmBeforeDelete', String(v))
              }
            />
            <ToggleField
              title="Confirm stock adjustments"
              description="Preference for confirming manual stock changes."
              checked={
                settings['preferences.confirmBeforeStockAdjustment'] === 'true'
              }
              onChange={(v) =>
                update('preferences.confirmBeforeStockAdjustment', String(v))
              }
            />
            <ToggleField
              title="Backup reminders"
              description="Enable the reminder preference for regular backups."
              checked={settings['backup.reminderEnabled'] === 'true'}
              onChange={(v) =>
                update('backup.reminderEnabled', String(v))
              }
            />
          </div>

          <div className="settings-fields-grid settings-reminder-field">
            <TextField
              label="Backup reminder interval (days)"
              value={settings['backup.reminderIntervalDays']}
              onChange={(v) => update('backup.reminderIntervalDays', v)}
              placeholder="7"
              type="number"
            />
          </div>

          <p className="settings-note">
            These preferences are saved. Actual system notifications,
            automatic confirmation dialogs, and scheduled backup reminders
            will be connected in their respective implementation steps.
          </p>
        </section>
      </form>

      <section className="panel settings-panel settings-about">
        <div className="settings-section-heading">
          <span className="settings-section-icon">
            <Info size={20} />
          </span>
          <div>
            <h2>About Inventory Manager</h2>
            <p>Application information.</p>
          </div>
        </div>

        <div className="settings-about-row">
          <span>Application version</span>
          <strong>1.0.0</strong>
        </div>
        <div className="settings-about-row">
          <span>Storage</span>
          <strong>Local SQLite database</strong>
        </div>
        <div className="settings-about-row">
          <span>Internet requirement</span>
          <strong>Designed for offline use</strong>
        </div>
      </section>
    </div>
  )
}
