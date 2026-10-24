# Inventory Manager --- Complete Project Handoff and Roadmap

> **Purpose of this document:** Give another developer/AI agent enough
> context to understand the product goal, current implementation,
> confirmed test results, known inconsistencies, architecture, and next
> steps without having to reconstruct the conversation.
>
> **Project root:** `D:\inventory-manager`\
> **Target:** A simple, offline-first Windows desktop inventory
> application for a small local shop.\
> **Last handoff update:** 19 October 2026 (based on the latest
> conversation context).

------------------------------------------------------------------------

## 1. Product goal

Build a Windows application for a non-technical shop owner to manage
inventory for products such as paper plates, paper cups, and other shop
goods.

The application must work **without an internet connection after
installation**. It should be easy to install and use on a normal Windows
computer without requiring the shop owner to install Node.js, configure
a database, or use a terminal.

### Core requirements

-   Add, edit, search, archive/deactivate, restore, and manage products.
-   Support **arbitrary product types and dynamic attributes**. Do not
    hard-code fields such as "plate size," "cup capacity," or "quality"
    for every product. Different products can have different attributes.
-   Support multiple variants per product. Example: product
    `Paper Plate`, variant `10 inch - Premium`.
-   Store stock quantities and record every inventory movement.
-   Record purchases and their line items.
-   Record sales and their line items.
-   Support sales returns and purchase returns, with safeguards against
    returning more than the original transaction quantity.
-   Track historical sales, costs, and profit so lifetime reports can be
    calculated.
-   Calculate gross profit only when the historical cost basis is known.
    Never invent a cost for stock whose cost is unknown.
-   Preserve transaction and stock history. Prefer
    archiving/deactivation over hard deletion when history exists.
-   Show current stock, low-stock information, sales/purchase history,
    and basic business summaries.
-   Include local backup and restore.
-   Package the application as a Windows installer that bundles the
    required runtime and runs offline.

### Simplicity constraint

This is a small-shop application. Prioritize correctness, reliability,
and ease of use over adding many advanced features. Do not add
complicated features unless required by the core use case.

------------------------------------------------------------------------

## 2. Intended technology and architecture

### Current/selected technologies

-   **Desktop shell:** Electron
-   **Frontend:** React + Vite (confirm the exact current frontend setup
    in `package.json`)
-   **Backend/API:** Node.js + Express, using `.mjs` ES modules
-   **Database:** SQLite
-   **ORM:** Prisma 7.10.1
-   **SQLite adapter:** `PrismaBetterSqlite3` adapter (the project has
    used a Better SQLite adapter)
-   **Packaging target:** Windows installer, likely through
    `electron-builder`
-   **Database file currently used in development:**
    `D:\inventory-manager\dev.db`

### Target production architecture

The application should be offline-first:

1.  Electron launches the desktop UI and local application services.
2.  React renders the shop interface.
3.  Local backend/database operations work without internet.
4.  SQLite stores all products, variants, purchases, sales, returns,
    stock movements, settings, and audit history.
5.  The database should live in the user's application-data directory in
    the packaged application (for example, under `%APPDATA%`), **not
    inside a read-only installation directory**.
6.  A packaged installer should include the required runtime so the shop
    owner does not need to install Node.js or configure the project
    manually.

### Electron security requirements

For the packaged desktop application:

-   Use a secure preload bridge for any renderer-to-main-process
    privileged operations.
-   Keep `contextIsolation: true`.
-   Keep `nodeIntegration: false`.
-   Do not expose unrestricted filesystem, shell, or database access to
    the renderer.
-   Validate inputs in the backend/service layer, not only in the UI.
-   Ensure the local backend is started and stopped reliably with
    Electron.
-   Ensure the app can launch without network access. Localhost
    communication may be used internally if the current architecture
    requires it, but do not depend on external services.

> **Important:** The exact current Electron launch wiring and production
> packaging configuration have not been verified in the latest
> conversation. Inspect the current `package.json`, Electron
> main/preload files, and frontend scripts before changing architecture.

------------------------------------------------------------------------

## 3. Repository and environment

-   Project directory: `D:\inventory-manager`
-   Backend source directory: `backend/src`
-   Main Express application: `backend/src/app.mjs`
-   Development database: `D:\inventory-manager\dev.db`
-   Backend development URL used in tests: `http://localhost:3000`
-   Prisma version reported: `7.10.1`
-   `@prisma/client` version reported: `7.10.1`
-   Project uses Prisma 7 configuration via `prisma.config.ts` and a
    SQLite adapter.
-   A migration named similar to `20261017121359_init` was created for
    the initial schema.
-   A later migration was run to add `averageCostKnown` (migration name
    used: `track_average_cost_status`).
-   The Git repository was initialized and pushed to:
    `https://github.com/BikashChamua01/Inventory-manager.git`, branch
    `main`.

### Database-path caution

A previous issue involved an empty or mismatched database path such as
`backend/src/dev.db` while the intended development database was
`D:\inventory-manager\dev.db`. Always verify the actual database path
used by `backend/src/config/database.mjs`, `.env`, and
`prisma.config.ts` before running migrations, tests, or any
data-changing operation.

Do not assume that a database file found elsewhere is the active
database.

### Repository safety check

Because the repository was pushed after a broad `git add .`, inspect Git
tracking before publishing further changes. Confirm that `.env`,
database files such as `dev.db`, generated files, and local secrets are
not unintentionally tracked. Never put credentials or sensitive local
data in the handoff document or Git history.

------------------------------------------------------------------------

## 4. Confirmed backend files and route setup

### Main app

`backend/src/app.mjs` currently imports and registers these route
modules:

-   `productRoutes` at `/api/products`
-   `variantRoutes` at `/api` (therefore variant routes include
    `/api/products/:productId/variants` and `/api/variants/:id`)
-   `categoryRoutes` at `/api/categories`
-   `stockRoutes` at `/api/stock`
-   `purchaseRoutes` at `/api/purchases`
-   `saleRoutes` at `/api/sales`
-   `returnRoutes` at `/api/returns`

The main app also registers:

-   `GET /api/health`
-   `cors()`
-   `express.json({ limit: "1mb" })`
-   `notFoundHandler`
-   `errorHandler`

### Existing source paths confirmed in the working tree

-   `backend/src/app.mjs`
-   `backend/src/controllers/category.controller.mjs`
-   `backend/src/controllers/product.controller.mjs`
-   `backend/src/controllers/purchase.controller.mjs`
-   `backend/src/controllers/return.controller.mjs`
-   `backend/src/controllers/sale.controller.mjs`
-   `backend/src/controllers/stock.controller.mjs`
-   `backend/src/controllers/variant.controller.mjs`
-   `backend/src/routes/category.routes.mjs`
-   `backend/src/routes/product.routes.mjs`
-   `backend/src/routes/purchase.routes.mjs`
-   `backend/src/routes/return.routes.mjs`
-   `backend/src/routes/sale.routes.mjs`
-   `backend/src/routes/stock.routes.mjs`
-   `backend/src/routes/variant.routes.mjs`
-   `backend/src/services/product.service.mjs`
-   `backend/src/services/purchase.service.mjs`
-   `backend/src/services/return.service.mjs`
-   `backend/src/services/sale.service.mjs`
-   `backend/src/services/stock.service.mjs`
-   `backend/src/services/variant.service.mjs`
-   `backend/src/config/database.mjs`

There may be additional files; this is not a complete file inventory.

------------------------------------------------------------------------

## 5. Database design and important data rules

The Prisma schema contains or has been planned to contain these
concepts. Verify the current `prisma/schema.prisma` before relying on
any field not explicitly confirmed below.

### Core entities

-   **Category** --- optional grouping for products.
-   **Product** --- product name, SKU, description, optional category,
    dynamic attributes, active/archive status.
-   **ProductAttribute** --- product-level flexible name/value
    attributes.
-   **ProductVariant** --- a sellable/inventory-managed variant of a
    product; includes name, SKU, unit, prices, stock, average cost,
    active status, and flexible variant attributes.
-   **VariantAttribute** --- dynamic attributes attached to a variant,
    depending on the exact current schema.
-   **Purchase** and **PurchaseItem** --- purchase header and line
    items.
-   **Sale** and **SaleItem** --- sale header and line items.
-   **PurchaseReturn** and **PurchaseReturnItem** --- returns to a
    supplier / reduction of purchased stock.
-   **SaleReturn** and **SaleReturnItem** --- items returned by a
    customer / restoration of stock.
-   **StockMovement** --- append-only record of quantity changes and
    their references.
-   **Supplier / Customer** --- optional relationships; the currently
    tested sample transactions have `supplierId: null` and
    `customerId: null`.
-   **Payment** --- planned/available in the schema context; inspect the
    current schema and service coverage before claiming complete
    functionality.
-   **AuditLog** --- records important operations and protects
    historical entities from hard deletion.
-   **AppSetting** --- local settings.

### Confirmed `StockMovement` model

The current schema provided in the conversation was:

``` prisma
model StockMovement {
  id             String         @id @default(cuid())
  variantId      String
  variant        ProductVariant @relation(fields: [variantId], references: [id], onDelete: Restrict)
  movementType   String
  quantityChange Int
  unitCostPaise  Int?
  referenceType  String?
  referenceId    String?
  note           String?
  createdAt      DateTime       @default(now())

  @@index([variantId, createdAt])
  @@index([referenceType, referenceId])
}
```

### Confirmed return schema supplied by the user

``` prisma
model PurchaseReturn {
  id           String   @id @default(cuid())
  returnNumber String   @unique
  purchaseId   String?
  purchase     Purchase? @relation(fields: [purchaseId], references: [id], onDelete: SetNull)
  supplierId   String?
  supplier     Supplier? @relation(fields: [supplierId], references: [id], onDelete: SetNull)
  returnedAt   DateTime @default(now())
  status       String   @default("COMPLETED")
  totalPaise   Int      @default(0)
  reason       String?
  items        PurchaseReturnItem[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([purchaseId])
  @@index([supplierId, returnedAt])
}

model PurchaseReturnItem {
  id                   String   @id @default(cuid())
  purchaseReturnId     String
  variantId            String
  originalPurchaseItemId String?
  quantity             Int
  unitCostPaise        Int
  lineTotalPaise       Int
  purchaseReturn       PurchaseReturn @relation(fields: [purchaseReturnId], references: [id], onDelete: Restrict)
  variant              ProductVariant @relation(fields: [variantId], references: [id], onDelete: Restrict)
  originalPurchaseItem PurchaseItem? @relation(fields: [originalPurchaseItemId], references: [id], onDelete: SetNull)
  createdAt            DateTime @default(now())

  @@index([purchaseReturnId])
  @@index([variantId])
}

model SaleReturn {
  id         String   @id @default(cuid())
  returnNumber String @unique
  saleId     String
  sale       Sale     @relation(fields: [saleId], references: [id], onDelete: Restrict)
  returnedAt DateTime @default(now())
  status     String   @default("COMPLETED")
  totalPaise Int      @default(0)
  reason     String?
  items      SaleReturnItem[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([saleId])
  @@index([returnedAt])
}

model SaleReturnItem {
  id            String @id @default(cuid())
  saleReturnId  String
  saleItemId    String
  variantId     String
  quantity      Int
  unitPricePaise Int
  unitCostPaise Int
  lineTotalPaise Int
  saleReturn    SaleReturn @relation(fields: [saleReturnId], references: [id], onDelete: Restrict)
  saleItem      SaleItem @relation(fields: [saleItemId], references: [id], onDelete: Restrict)
  variant       ProductVariant @relation(fields: [variantId], references: [id], onDelete: Restrict)
  createdAt     DateTime @default(now())

  @@index([saleReturnId])
  @@index([saleItemId])
  @@index([variantId])
}
```

> Formatting above is for handoff readability. The exact live schema is
> authoritative; run `Get-Content prisma/schema.prisma` before schema
> changes.

### Money and stock principles

-   Prices/costs are represented in integer **paise**, not
    floating-point rupees.
-   Example: `₹3.00` is stored as `300` paise; `₹2.00` is `200` paise.
-   Stock quantity is integer quantity in the variant's unit.
-   Stock changes must happen inside a database transaction and must
    create a matching `StockMovement` in that same transaction.
-   A sale should decrease stock; a sale return should increase stock.
-   A purchase should increase stock; a purchase return should decrease
    stock.
-   Reject any operation that would result in negative stock.
-   Never silently rewrite old sale costs when new purchase costs
    arrive.
-   Use archived/inactive status for entities with inventory or
    transaction history.
-   All list/report calculations should use completed transactions and
    account for returns.
-   A return must link to the original sale item or purchase item to
    enforce per-line return limits.
-   Consider concurrent return requests: safeguards should remain
    correct even if two requests arrive close together.

------------------------------------------------------------------------

## 6. Implementation status --- what is done

The following is based on the code and successful commands reported in
the conversation. "Syntax passed" means Node accepted the file syntax;
it does **not** prove every business rule works.

### 6.1 Database and Prisma

-   Prisma 7.10.1 installed.
-   SQLite database configured for local development.
-   Prisma 7 config file is in use.
-   Initial migration created.
-   `averageCostKnown` field migration was run and Prisma client
    regenerated.
-   A test script `verify-cost.mjs` showed a variant with
    `averageCostPaise: 9` and `averageCostKnown: false`.
-   The exact active database path must still be verified before data
    repair.

### 6.2 Products, variants, and categories

-   Product and category API modules exist.
-   Product creation supports dynamic product attributes and variants.
-   Product/variant creation initializes stock to zero, with stock
    changes expected to happen through the inventory module.
-   Variant attributes are flexible name/value pairs rather than fixed
    product-specific columns.
-   Variant list/get/update/status/delete controller/service code
    exists.
-   Product archive/restore behavior was previously tested.
-   Products with variants/history are archived rather than permanently
    deleted.
-   Variants with stock/history cannot be permanently deleted;
    deactivation is the intended alternative.
-   `product.service.mjs` was inspected. It sets new variant
    `stockQuantity: 0` and does not modify stock on product updates.
-   `variant.service.mjs` was inspected. It sets new variant stock to
    zero and does not include `stockQuantity` in the allowed update
    fields.

### 6.3 Stock and movement history

-   `backend/src/services/stock.service.mjs` exists.
-   `POST /api/stock/variants/:variantId/adjust` adjusts stock and
    creates an `ADJUSTMENT` movement in one Prisma transaction.
-   `GET /api/stock/variants/:variantId/history` lists stock movements,
    newest first.
-   `backend/src/controllers/stock.controller.mjs` exposes these
    operations.
-   Current stock history route has been successfully called.
-   There is **no** `GET /api/stock` list endpoint in the current route
    file.
-   There is **no** `GET /api/variants` list endpoint. Correct routes
    are:
    -   `GET /api/products/:productId/variants`
    -   `GET /api/variants/:id`
-   Variant detail response includes `stockQuantity`.

### 6.4 Purchases and sales

-   Purchase and sale service/controller/routes exist.
-   The APIs have returned completed transactions successfully.
-   A sale and a purchase have been created in the test database.
-   Purchase/sale services must still be inspected and tested for
    correct weighted-average cost, cost-known status, and historical
    profit.
-   Sale service was reported in prior project context to use
    `averageCostKnown`: when cost is unknown, it should not invent a
    unit cost or profit. Confirm the exact current schema and service
    agree.
-   The existing sample sale contains a historical cost that appears
    inconsistent with the sample purchase; details are in Section 7.

### 6.5 Returns module --- recently added

Files: - `backend/src/services/return.service.mjs` -
`backend/src/controllers/return.controller.mjs` -
`backend/src/routes/return.routes.mjs`

The controller and routes had been empty. They have now been populated.

The return service syntax check passed:

``` powershell
node --check backend/src/services/return.service.mjs
```

The controller/routes were added and syntax-checked:

``` powershell
node --check backend/src/controllers/return.controller.mjs
node --check backend/src/routes/return.routes.mjs
```

`backend/src/app.mjs` now imports and registers:

``` js
import returnRoutes from "./routes/return.routes.mjs";
app.use("/api/returns", returnRoutes);
```

The full `app.mjs` syntax check passed:

``` powershell
node --check backend/src/app.mjs
```

### Current return endpoints

-   `GET /api/returns/sales`
-   `POST /api/returns/sales`
-   `GET /api/returns/purchases`
-   `POST /api/returns/purchases`

Both list endpoints were successfully tested and returned:

``` json
{
  "success": true,
  "data": []
}
```

No return has been created during the test sequence so far.

### Intended return service behavior from the implementation supplied in the conversation

-   Require an original completed sale/purchase.
-   Link sale return lines to `saleItemId`.
-   Link purchase return lines to `originalPurchaseItemId`.
-   Prevent returned quantity from exceeding the original line quantity,
    counting earlier returns.
-   Create return header and line items in a transaction.
-   Sales return: increase stock, create positive `SALE_RETURN` stock
    movement.
-   Purchase return: decrease stock, create negative `PURCHASE_RETURN`
    stock movement.
-   Save return totals in paise.
-   List returns with related transaction/variant details.

**Do not assume the return workflow is fully correct just because syntax
and list endpoints pass.** The create endpoints still need careful
validation and integration tests. Check that controller error handling
uses the actual error property (`status` vs `statusCode`) consistently
with the application's `errorHandler.mjs`. Existing service functions
commonly set `error.statusCode`; if the controller only checks
`error.status`, it may return 500 instead of the intended 4xx status.

------------------------------------------------------------------------

## 7. Known data inconsistencies and test data

These details were observed from API responses on 19 October 2026. They
refer to the current local development database at the time of testing;
re-query before acting because data may have changed.

### Sample product and variant

-   Product: `Paper Plate`
-   Product ID: `cmvcdqsp00001zww9e2yhej45`
-   Variant: `10 inch - Premium`
-   Variant ID: `cmvcdqsp70005zww9x0j0attp`
-   Variant unit: `piece`
-   Purchase price: `200` paise = ₹2.00
-   Selling price: `300` paise = ₹3.00
-   `averageCostPaise`: `9` paise
-   `averageCostKnown`: `false`
-   Actual `stockQuantity` returned by `GET /api/variants/:id`: **105**

### Sample completed purchase

-   Purchase ID: `cmvdkzexz00006ww9ek3lg6gt`
-   Purchase number: `PUR-65f9cbed-d77e-4f9d-aac4-c28caf2b0f2c`
-   Status: `COMPLETED`
-   Purchase item ID: `cmvdkzey700016ww9ksxindhb`
-   Variant ID: `cmvcdqsp70005zww9x0j0attp`
-   Quantity: `5`
-   Unit cost: `200` paise = ₹2.00
-   Line total: `1000` paise = ₹10.00
-   Supplier ID: `null`
-   Purchase timestamp: `2026-10-18T08:46:07.463Z`

### Sample completed sale

-   Sale ID: `cmvdlpcg10000v8w9ql9d69fp`
-   Sale number: `SALE-9abf8fac-dabe-474c-a597-bce784d15eab`
-   Status: `COMPLETED`
-   Sale item ID: `cmvdlpcg40001v8w9ojfst6j3`
-   Variant ID: `cmvcdqsp70005zww9x0j0attp`
-   Quantity: `2`
-   Unit selling price: `300` paise = ₹3.00
-   Line total: `600` paise = ₹6.00
-   Historical unit cost recorded on sale: `9` paise = ₹0.09
-   Historical cost total: `18` paise = ₹0.18
-   Historical gross profit: `582` paise = ₹5.82
-   Sale notes: `Testing sales module`
-   Customer ID: `null`
-   Sale timestamp: `2026-10-18T09:06:17.281Z`

### Stock movements returned by the history endpoint

For variant `cmvcdqsp70005zww9x0j0attp`, the API returned four
movements:

  Type             Quantity change   Unit cost Reference/note
  -------------- ----------------- ----------- ----------------------------
  `SALE`                        -2     9 paise Sample sale above
  `PURCHASE`                    +5   200 paise Sample purchase above
  `ADJUSTMENT`                  -3        null `Testing stock removal`
  `ADJUSTMENT`                  +5        null `Testing stock adjustment`

Net movement quantity = `-2 + 5 - 3 + 5 = +5`.

But actual `ProductVariant.stockQuantity` was **105**.

### Critical unresolved discrepancy

-   Actual stored stock: **105**
-   Net quantity in the four recorded movements: **+5**
-   Difference: **100 units**
-   `averageCostPaise = 9`, while the sample purchase price is `200`
    paise.
-   `averageCostKnown = false`, yet the sample sale recorded unit cost
    `9` paise and gross profit `582` paise.

These are important accounting/inventory inconsistencies. Do not assume
the correct stock is 5. The stored stock is currently 105. The movement
history is incomplete or otherwise inconsistent with the stored stock.
The source of the extra 100 has **not** been identified.

**Do not create a test return or adjust stock just to force the totals
to match until the discrepancy is understood.** Do not silently rewrite
the old sale cost/profit.

------------------------------------------------------------------------

## 8. Immediate next steps --- follow this order

### Step 1 --- Inspect purchase service

The last user action was reading
`backend/src/services/product.service.mjs`; the next intended command
is:

``` powershell
Get-Content backend/src/services/purchase.service.mjs
```

Review carefully: - Does purchase processing use `averageCostKnown`
correctly? - Does it calculate weighted-average cost correctly? - Does
it reset/set average cost correctly when previous stock is zero? - Does
it increment `stockQuantity` and create a matching `PURCHASE` movement
in the same transaction? - Does the code update stock once or twice? -
Does the code assume an old cost when `averageCostKnown` is false? -
Does the service's behavior match the current Prisma schema?

### Step 2 --- Inspect sale service

``` powershell
Get-Content backend/src/services/sale.service.mjs
```

Review: - Does each completed sale decrement stock and write exactly one
movement? - Does it use a known cost only when `averageCostKnown` is
true? - Can it record `unitCostPaise = 9` and a gross profit even when
the variant says cost is unknown? - Does the schema allow nullable
cost/profit fields if the service wants to save null? - Is historical
sale cost preserved permanently? - Are quantities and monetary values
validated? - Does the entire sale transaction roll back if any line
fails?

### Step 3 --- Find the source of the 100-unit discrepancy

Before data changes: 1. Verify active database path in `.env`,
`prisma.config.ts`, and `backend/src/config/database.mjs`. 2. Inspect
`git status` and confirm the DB path. 3. Search all backend source for
writes to `stockQuantity`, including update expressions and Prisma
`increment`/`decrement` operations. 4. Check whether any other script or
test modified the database directly. 5. Inspect the current row and full
stock movement history directly using a read-only Prisma script if
needed. 6. Do not edit or reset `dev.db` without a verified backup. 7.
Decide whether the extra 100 is a legitimate opening balance, a test
adjustment that was not logged, or an actual bug. If an opening balance
is needed, record it as an explicit opening-stock movement rather than
leaving unexplained stock.

### Step 4 --- Correct cost accounting behavior

The sample sale has historical unit cost 9 paise even though
`averageCostKnown = false`. That must be investigated before trusting
profit reports.

Rules: - Unknown cost must not be guessed. - Historical sales should
retain the cost snapshot they had at the time unless the user explicitly
chooses a data-correction procedure. - If `SaleItem.unitCostPaise`,
`costTotalPaise`, and `grossProfitPaise` are currently required `Int`
fields, the schema and service cannot safely disagree about nulls.
Inspect the actual schema. Decide whether the fields should be nullable
and create a migration only if the design requires it. - A report should
distinguish "profit known" from "profit unavailable"; it must not report
fake zero profit or fake positive profit for unknown cost.

### Step 5 --- Test purchase and sales operations

Use a separate test database or a verified database backup if practical.
Avoid destructive tests against the only live development database.

Test: - Purchase increases stock and records one movement. - Sale
decreases stock and records one movement. - Insufficient-stock sale
fails atomically. - Multi-line transaction failure rolls back all lines
and movements. - Average-cost calculation for known costs. -
Unknown-cost inventory remains unknown until enough reliable cost
information is available. - Sale historical cost remains unchanged after
later purchases.

### Step 6 --- Test return operations

Only after the current stock inconsistency and cost logic are
understood:

-   Create a sales return for a quantity no greater than the original
    sale item quantity.
-   Verify a sales return increments stock by exactly the returned
    quantity.
-   Verify one positive `SALE_RETURN` movement is created per returned
    line.
-   Verify refund/return totals in paise.
-   Attempt to return more than the remaining quantity; expect a 4xx
    error and no database changes.
-   Attempt a return for an incomplete/nonexistent sale; expect a 4xx
    error and no database changes.
-   Create a purchase return linked to the original purchase item.
-   Verify purchase return decrements stock and creates a negative
    `PURCHASE_RETURN` movement.
-   Reject a purchase return greater than remaining purchased quantity
    or greater than current stock.
-   Verify transaction rollback if any return line fails.
-   Check `error.statusCode`/`error.status` compatibility in controller
    and global error middleware.
-   Check whether `SaleReturnItem.unitCostPaise` should allow null for
    unknown costs; current schema supplied by the user defines it as
    required `Int`, so the service must not send null unless the schema
    is deliberately migrated.
-   Verify list endpoints include correct sale/purchase and variant
    details.

### Step 7 --- Add missing backend functionality

After core transaction logic is stable: - Basic dashboard metrics. -
Stock report and low-stock report. - Sales report and purchase report. -
Gross profit/lifetime profit report that subtracts sales returns and
accounts for purchase returns appropriately. - Return history and
transaction details. - Local settings. - Database backup and restore. -
Validation and useful error messages. - Pagination/search for long lists
if needed, but keep it simple. - Audit logging for important edits and
adjustments.

### Step 8 --- Frontend integration

Inspect current frontend before assuming which modules are complete.
Planned/expected screens: - Dashboard - Products and categories -
Product detail / variants / dynamic attributes - Stock overview and
stock adjustment/history - Purchase creation and purchase history -
Sales/POS flow and sales history - Sales return and purchase return -
Reports - Settings and backup/restore

UI principles: - Designed for a non-technical shop owner. - Clear
buttons and simple forms. - Dynamic attribute inputs should be generated
from the selected product/variant definitions. - Display currency as
rupees while storing paise. - Show clear stock quantity and unit. - Warn
before archive/deactivation or potentially irreversible operations. -
Avoid showing technical IDs unless useful for debugging. - Show "profit
unavailable" where cost is unknown.

### Step 9 --- Backup/restore

-   Provide a manual backup action that copies the SQLite database
    safely.
-   Do not copy a live database during an unsafe write; use SQLite's
    backup mechanism or otherwise ensure a consistent snapshot.
-   Let the user choose a backup location.
-   Add restore with explicit confirmation and validation.
-   Make a safety copy of the current database before restore.
-   Test backup/restore with purchases, sales, returns, and stock
    movement history intact.
-   Document where the database and backups live.

### Step 10 --- Package and test the Windows app

-   Verify Electron main process, preload bridge, Vite frontend, and
    backend startup.
-   Configure a Windows installer through `electron-builder` or the
    project's chosen packager.
-   Store database under `%APPDATA%` or another suitable per-user
    application-data location.
-   Bundle all required runtime files.
-   Test install, launch, close, relaunch, and uninstall/reinstall
    behavior.
-   Test on a clean Windows environment without Node.js installed.
-   Disconnect internet and test all core features.
-   Ensure app updates or reinstalling do not delete the user's
    database.
-   Confirm no localhost port collision or orphan backend process.
-   Verify backup/restore and migration behavior in the packaged build.

### Step 11 --- Final quality checks

-   Run syntax checks for changed `.mjs` files.
-   Run database migrations and Prisma generation as appropriate.
-   Test every API route.
-   Test invalid input and boundary cases.
-   Check referential integrity and archive/delete safeguards.
-   Verify stock movement totals reconcile with stock quantities.
-   Verify returns are included in inventory and financial reports.
-   Run `git status`, inspect diff, and commit a coherent feature.
-   Do not commit local DB files or secrets.

------------------------------------------------------------------------

## 9. API endpoints confirmed so far

The following are based on the actual route files and successful
requests. The full methods for all endpoints should be rechecked in
their route modules.

### Health

-   `GET /api/health` --- expected to return success and
    `Inventory Manager API is running`. (The latest explicit output
    shown in conversation was for return endpoints; re-test health if
    needed.)

### Products

-   Product route module mounted at `/api/products`.
-   Exact subroutes should be read from
    `backend/src/routes/product.routes.mjs`.

### Variants

Because `variantRoutes` is mounted at `/api`: -
`POST /api/products/:productId/variants` -
`GET /api/products/:productId/variants` - `GET /api/variants/:id` -
`PATCH /api/variants/:id` - `PATCH /api/variants/:id/status` -
`DELETE /api/variants/:id`

### Stock

Because stock routes are mounted at `/api/stock`: -
`POST /api/stock/variants/:variantId/adjust` -
`GET /api/stock/variants/:variantId/history`

There is no `GET /api/stock` endpoint in the current `stock.routes.mjs`.

### Purchases

-   Route module mounted at `/api/purchases`.
-   `GET /api/purchases` was successfully used to list purchases.
-   Inspect `backend/src/routes/purchase.routes.mjs` for other exact
    endpoints.

### Sales

-   Route module mounted at `/api/sales`.
-   `GET /api/sales` was successfully used to list sales.
-   Inspect `backend/src/routes/sale.routes.mjs` for other exact
    endpoints.

### Returns

-   `GET /api/returns/sales` --- tested successfully; returns
    `{"success":true,"data":[]}` when empty.
-   `POST /api/returns/sales` --- route added; creation not yet tested.
-   `GET /api/returns/purchases` --- tested successfully; returns
    `{"success":true,"data":[]}` when empty.
-   `POST /api/returns/purchases` --- route added; creation not yet
    tested.

------------------------------------------------------------------------

## 10. Error handling and coding conventions

-   Backend uses `.mjs` files and ES module `import`/`export`.
-   Controllers commonly use `try/catch` and pass errors to
    `next(error)`.
-   Services throw errors with an HTTP code field. Some service helpers
    use `error.statusCode`; check global error middleware for the
    expected field and make behavior consistent.
-   Validate request data at the controller/validator or service
    boundary.
-   Use Prisma transactions for any operation that changes a
    transaction, stock quantity, average cost, and stock movement
    together.
-   Never report success until the transaction commits.
-   Return JSON shaped consistently, typically
    `{ success: true, data: ... }`.
-   Keep errors readable for the UI but log details server-side.
-   Preserve history and do not hard-delete transaction records.
-   Use clear movement names consistently: `PURCHASE`, `SALE`,
    `ADJUSTMENT`, `SALE_RETURN`, `PURCHASE_RETURN`.

------------------------------------------------------------------------

## 11. How to continue with the next agent

The next agent should begin with these commands and not immediately
rewrite code:

``` powershell
Set-Location D:\inventory-manager

Get-Content backend/src/services/purchase.service.mjs
Get-Content backend/src/services/sale.service.mjs
Get-Content backend/src/middleware/errorHandler.mjs
Get-Content backend/src/config/database.mjs
Get-Content prisma/schema.prisma
```

Then inspect:

``` powershell
Get-Content .env
Get-Content prisma.config.ts
Get-Content package.json
git status --short
```

**Do not paste `.env` secrets into chat or into this handoff.** Inspect
locally and only report the database path/variable name, not
credentials.

Priority order: 1. Understand purchase and sale stock/cost logic. 2.
Investigate why stored stock is 105 while movement net is +5. 3. Fix the
mismatch only after identifying its cause and taking a backup. 4. Align
cost-known behavior and the sale schema. 5. Test return creation, stock
updates, and over-return protection. 6. Build reports, backup/restore,
and complete backend tests. 7. Integrate/verify frontend. 8. Package and
test the offline Windows installer.

------------------------------------------------------------------------

## 12. Completion checklist

Use this checklist as the project progresses.

### Foundation

-   [x] SQLite/Prisma setup and initial migration
-   [x] Dynamic product and variant attributes
-   [x] Product/category/variant services and routes exist
-   [x] Stock adjustment and stock history endpoints exist
-   [x] Purchase and sale modules exist
-   [x] Return service/controller/routes files exist and route
    registration is added
-   [ ] Verify current DB path is the intended database
-   [ ] Reconcile actual stock with movement history
-   [ ] Verify cost-known behavior and historical profit correctness
-   [ ] Test all purchase/sale edge cases and atomic rollback
-   [ ] Test sales/purchase return creation and safeguards
-   [ ] Make controller/global error status codes consistent

### Business reporting

-   [ ] Dashboard
-   [ ] Current stock and low-stock report
-   [ ] Purchase/sales history and detail views
-   [ ] Lifetime profit and return-aware calculations
-   [ ] Return history
-   [ ] Audit history where appropriate

### Reliability

-   [ ] Backup/restore
-   [ ] Full input validation
-   [ ] API integration tests
-   [ ] Stock movement reconciliation tests
-   [ ] Database integrity tests

### Desktop delivery

-   [ ] Verify React/Vite/Electron integration
-   [ ] Secure preload bridge and Electron settings
-   [ ] Production data path under application data
-   [ ] Windows installer
-   [ ] Clean-machine test without Node.js
-   [ ] Offline test
-   [ ] Upgrade/reinstall data-retention test

------------------------------------------------------------------------

## 13. Important guardrails for the next agent

1.  **Do not assume the current stock is 5.** The API returned 105;
    movement history only explains net +5. Investigate before modifying
    stock.
2.  **Do not create a test return yet** against the current sample data
    until the stock discrepancy is understood or the test is moved to an
    isolated database.
3.  **Do not assume the sample sale's profit is correct.** It recorded
    cost of 9 paise per unit while the sample purchase was 200 paise per
    unit and `averageCostKnown` was false.
4.  **Do not rewrite historical sales silently.** Historical cost and
    profit corrections need an explicit, backed-up data-correction plan.
5.  **Do not hard-code product fields.** Dynamic attributes are a core
    requirement.
6.  **Do not delete products/variants with stock or transaction
    history.** Archive/deactivate instead.
7.  **Do not add stock changes without a matching stock movement in the
    same transaction.**
8.  **Do not put the SQLite database in the packaged install
    directory.** Use an application-data location.
9.  **Do not rely on syntax checks alone.** The return create endpoints
    still need integration tests.
10. **Keep the application simple and offline-first.** Prioritize
    accurate inventory, costs, returns, and backups before advanced
    features.

------------------------------------------------------------------------

**End of handoff document.**
