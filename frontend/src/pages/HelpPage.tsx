import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  BookOpen,
  Boxes,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  Database,
  FileBarChart,
  Mail,
  Package,
  Phone,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Undo2,
  Warehouse,
} from 'lucide-react'
import './HelpPage.css'

type HelpItem = {
  title: string
  description: string
  steps: string[]
  path?: string
  keywords: string
}

const modules: HelpItem[] = [
  {
    title: 'Dashboard',
    description: 'Your starting point for navigating the shop and reviewing the available overview.',
    steps: ['Open Dashboard from the left sidebar or click the Stockwise logo.', 'Use the sidebar to open the module you need.', 'Use the top-bar Search pages control to find a page quickly.'],
    path: '/',
    keywords: 'home overview navigation search pages',
  },
  {
    title: 'Products',
    description: 'Create and maintain products, variants, and product-specific attributes.',
    steps: ['Open Products from the Catalog section.', 'Choose Add product to create a product.', 'Enter the product name and any relevant description or SKU.', 'Select an existing category or create a category if the form offers that option.', 'Add the attributes and variants that describe this product, and enter the required buying cost.', 'Save the product. Use edit controls to correct product details later.'],
    path: '/products',
    keywords: 'add create edit product sku variants attributes buying cost',
  },
  {
    title: 'Categories',
    description: 'Group related products so the catalog is easier to browse.',
    steps: ['Open Categories from the Catalog section.', 'Create a category with a clear name.', 'Assign products to the appropriate category in the product form or edit workflow.', 'Avoid creating multiple categories for the same purpose.'],
    path: '/categories',
    keywords: 'category organize grouping',
  },
  {
    title: 'Inventory',
    description: 'Check available stock quantities for product variants.',
    steps: ['Open Inventory from the Inventory section.', 'Find the product or variant you want to check.', 'Review its available quantity and relevant cost information.', 'Use the stock adjustment workflow only when correcting the physical quantity; use Purchases and Sales for normal business transactions.'],
    path: '/inventory',
    keywords: 'stock quantity available count on hand',
  },
  {
    title: 'Stock history',
    description: 'Review recorded stock movements and investigate why a quantity changed.',
    steps: ['Open Stock history from the Inventory section.', 'Find the relevant product or variant.', 'Review movement type, quantity change, date, and any available note or reference.', 'Compare the history with the corresponding purchase, sale, return, or adjustment.'],
    path: '/stock-history',
    keywords: 'movement ledger audit adjustment history',
  },
  {
    title: 'Purchases',
    description: 'Record stock received from a supplier. A purchase should increase stock.',
    steps: ['Open Purchases from Transactions.', 'Start a new purchase and select the product variant.', 'Enter the received quantity and the buying cost details requested by the form.', 'Add supplier/reference information if available.', 'Review the totals and save the purchase.', 'Check Inventory or Stock history to confirm the stock movement.'],
    path: '/purchases',
    keywords: 'buy supplier incoming stock purchase cost receive',
  },
  {
    title: 'Sales',
    description: 'Record goods sold to a customer. A sale should reduce stock and contribute to sales/profit history.',
    steps: ['Open Sales from Transactions.', 'Start a new sale.', 'Select the product variant and enter the quantity sold and selling price.', 'Enter the customer name and contact number when available/requested.', 'Review the total and the items before saving.', 'After saving, check stock or the sales report if you need to verify the transaction.'],
    path: '/sales',
    keywords: 'sell billing customer name phone revenue invoice',
  },
  {
    title: 'Returns',
    description: 'Record a customer return or return goods to a supplier.',
    steps: ['Open Returns from Transactions.', 'Choose the appropriate return type: sales return or purchase return.', 'Select the original transaction/item when the form supports it.', 'Enter the quantity being returned and review the details carefully.', 'Save the return and verify the resulting stock movement.'],
    path: '/returns',
    keywords: 'refund customer return supplier return purchase sales',
  },
  {
    title: 'Reports',
    description: 'Review stock, sales, purchase, and profit information over the available reporting period.',
    steps: ['Open Reports from Insights.', 'Choose the report that matches your question: Stock, Sales, Purchases, or Profit.', 'Apply the available date filters where relevant.', 'Use the Profit report to review calculated profit and identify incomplete cost information.', 'If a figure looks unexpected, compare the report with the underlying transaction and stock history.'],
    path: '/reports',
    keywords: 'analytics stock report sales report purchases profit date filter',
  },
  {
    title: 'Backup & restore',
    description: 'Protect the local shop data with a backup and use restore only when you intend to replace/restore data.',
    steps: ['Open Backup & restore from the bottom of the sidebar.', 'Create a backup before major changes, updates, or troubleshooting.', 'Keep a copy somewhere separate from the computer running the app.', 'Before restoring, read the on-screen warning and confirm that the selected backup is the correct one.', 'After a restore, reopen the relevant pages and verify the data.'],
    path: '/backup',
    keywords: 'backup restore database export protect recover',
  },
  {
    title: 'Settings',
    description: 'Review application preferences and local-data options that are available in this version.',
    steps: ['Open Settings from the bottom of the sidebar.', 'Review each setting before changing it.', 'Use Backup & restore to protect data before any change that could affect local records.'],
    path: '/settings',
    keywords: 'preferences configuration local data',
  },
]

const quickTasks = [
  { title: 'Add a new product', detail: 'Products → Add product', path: '/products', icon: Package },
  { title: 'Check stock on hand', detail: 'Inventory', path: '/inventory', icon: Warehouse },
  { title: 'Record incoming stock', detail: 'Purchases', path: '/purchases', icon: ShoppingCart },
  { title: 'Record a customer sale', detail: 'Sales', path: '/sales', icon: ShoppingBag },
  { title: 'Process a return', detail: 'Returns', path: '/returns', icon: Undo2 },
  { title: 'Review profit', detail: 'Insights → Profit report', path: '/reports/profit', icon: FileBarChart },
  { title: 'Review stock movements', detail: 'Stock history', path: '/stock-history', icon: Activity },
  { title: 'Create a data backup', detail: 'Backup & restore', path: '/backup', icon: Database },
]

export default function HelpPage() {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const filteredModules = useMemo(
    () => modules.filter((item) =>
      `${item.title} ${item.description} ${item.keywords} ${item.steps.join(' ')}`
        .toLowerCase()
        .includes(normalizedQuery),
    ),
    [normalizedQuery],
  )

  return (
    <div className="help-page">
      <section className="help-hero">
        <div className="help-hero-icon"><BookOpen size={25} /></div>
        <div className="help-hero-copy">
          <p className="help-eyebrow">HELP CENTRE · USER MANUAL</p>
          <h1>How can we help?</h1>
          <p>Find your way around Inventory Manager, follow common workflows, and contact support if you need assistance.</p>
        </div>
        <div className="help-hero-mark" aria-hidden="true"><Boxes size={76} strokeWidth={1.1} /></div>
      </section>

      <section className="help-search-panel" aria-label="Search the user guide">
        <Search size={19} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search help topics, e.g. add product, sale, stock, backup…"
          aria-label="Search help topics"
        />
        {query && <button type="button" onClick={() => setQuery('')}>Clear</button>}
      </section>

      {!normalizedQuery && (
        <section className="help-section">
          <div className="help-section-heading">
            <div><span className="help-kicker">QUICK ACTIONS</span><h2>What do you want to do?</h2></div>
            <p>Choose a task to open the relevant page.</p>
          </div>
          <div className="help-quick-grid">
            {quickTasks.map(({ title, detail, path, icon: Icon }) => (
              <Link className="help-quick-card" to={path} key={title}>
                <span className="help-quick-icon"><Icon size={19} /></span>
                <span className="help-quick-text"><strong>{title}</strong><small>{detail}</small></span>
                <ArrowRight size={16} className="help-arrow" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="help-section">
        <div className="help-section-heading">
          <div><span className="help-kicker">MODULE GUIDE</span><h2>Pages and how to use them</h2></div>
          <p>{filteredModules.length} {filteredModules.length === 1 ? 'topic' : 'topics'}</p>
        </div>
        <div className="help-module-list">
          {filteredModules.map((item, index) => (
            <details className="help-module" key={item.title} open={Boolean(normalizedQuery)}>
              <summary>
                <span className="help-module-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="help-module-title"><strong>{item.title}</strong><small>{item.description}</small></span>
                <span className="help-expand-label">View steps</span>
              </summary>
              <div className="help-module-body">
                <ol>{item.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                {item.path && <Link className="help-open-link" to={item.path}>Open {item.title} <ArrowRight size={15} /></Link>}
              </div>
            </details>
          ))}
          {filteredModules.length === 0 && (
            <div className="help-no-results"><Search size={23} /><strong>No matching help topic</strong><p>Try searching for “product”, “sale”, “return”, “stock”, “report”, or “backup”.</p></div>
          )}
        </div>
      </section>

      <section className="help-section">
        <div className="help-section-heading">
          <div><span className="help-kicker">IMPORTANT WORKFLOWS</span><h2>Keep your records accurate</h2></div>
        </div>
        <div className="help-principles-grid">
          <article className="help-principle">
            <span className="help-principle-icon"><ShoppingCart size={20} /></span>
            <h3>Purchases are for incoming stock</h3>
            <p>Record goods received from a supplier through Purchases. This preserves the purchase record and stock movement.</p>
          </article>
          <article className="help-principle">
            <span className="help-principle-icon"><ShoppingBag size={20} /></span>
            <h3>Sales are for goods sold</h3>
            <p>Record sales through Sales rather than editing the inventory quantity manually. Sales are important for sales and profit history.</p>
          </article>
          <article className="help-principle">
            <span className="help-principle-icon"><ClipboardList size={20} /></span>
            <h3>Edits are for corrections</h3>
            <p>Edit product details when correcting information. Use stock adjustment only to reconcile a real difference in physical stock.</p>
          </article>
          <article className="help-principle">
            <span className="help-principle-icon"><ShieldCheck size={20} /></span>
            <h3>Back up regularly</h3>
            <p>Create backups regularly and before important changes. Store a copy away from the computer running the app.</p>
          </article>
        </div>
        <div className="help-note"><CheckCircle2 size={18} /><p><strong>Before saving:</strong> check the selected product/variant, quantity, buying or selling price, and total. If a transaction was entered incorrectly, use the app’s available correction/return workflow rather than making an unrelated stock adjustment.</p></div>
      </section>

      <section className="help-contact-section">
        <div className="help-contact-copy">
          <span className="help-kicker">NEED MORE HELP?</span>
          <h2>Contact support</h2>
          <p>When asking for help, mention the page you were using, what you expected to happen, and the message shown by the app. Do not send passwords or private backup files over an untrusted channel.</p>
        </div>
        <div className="help-contact-cards">
          <a className="help-contact-card" href="tel:9101658375"><span className="help-contact-icon"><Phone size={19} /></span><span><small>Phone</small><strong>9101658375</strong></span><ArrowRight size={16} /></a>
          <a className="help-contact-card" href="tel:9898989898"><span className="help-contact-icon"><Phone size={19} /></span><span><small>Phone</small><strong>9898989898</strong></span><ArrowRight size={16} /></a>
          <a className="help-contact-card" href="mailto:bikashchamua537@gmail.com"><span className="help-contact-icon"><Mail size={19} /></span><span><small>Email</small><strong>bikashchamua537@gmail.com</strong></span><ArrowRight size={16} /></a>
          <a className="help-contact-card" href="mailto:nuffhub@gmail.com"><span className="help-contact-icon"><Mail size={19} /></span><span><small>Email</small><strong>nuffhub@gmail.com</strong></span><ArrowRight size={16} /></a>
        </div>
      </section>

      <footer className="help-footer"><CircleHelp size={16} /><span>Inventory Manager · Help and user guide</span><span className="help-footer-note">This guide describes the current visible modules; exact fields may vary by app version.</span></footer>
    </div>
  )
}
