# AGENT TASK: Add Jobsheet-Style Print Receipt to Photo Studio App

## CONTEXT & GOAL
This is a React (Vite) + Node.js/Express + MongoDB photo studio management app.
Currently the app prints a "TAX INVOICE" when the print button is clicked on an order.
**Goal:** Add a second print style called "JOBSHEET" that exactly matches the K RAJ DIGITAL PRESS
jobsheet format (see PDF reference described below). The existing TAX INVOICE must NOT be broken.
Data comes dynamically from the backend. Studio constant info (name, address, logo etc.)
comes from the Settings tab (Studio model). A new toggle in Settings will let the owner
switch between Invoice and Jobsheet print mode.

---

## REFERENCE JOBSHEET LAYOUT (from the PDF)
The print must look exactly like this, top to bottom:

```
┌─────────────────────────────────────────────────────────────────┐
│  [LOGO]   STUDIO NAME (large, bold)                             │
│           Studio Address                        Phone: xxxxxxxx │
│  ─────────────────────────────────────────────────────────────  │
│           JOBSHEET          (New Album)    ║║║║║║║║ (barcode)   │
├──────────────┬────────────────────┬────────────────────────────┤
│ Party Name   │ Order No.          │ Order Date                  │
│ PARTY NAME   │ ORDER-ID           │ 14-Apr-2026                 │
│ City, State  ├────────────────────┴────────────────────────────┤
│              │ Job No.            │ Receipt No.                 │
│              │ ORDER-ID           │                             │
├──────────────┴────────────────────────────────────────────────┤
│ Contact Name │ PARTY NAME         │                            │
├──────────────┼──────────┬─────────┬────────┬────────┬─────────┤
│ Mobile No.   │ Design   │ Urgent  │ Input  │ Del.   │ Del.    │
│ 97xxxxxxxx   │ No       │ No      │ Type   │ Date   │ Thru    │
├──────────────┴──────────┴─────────┴────────┴────────┴─────────┤
│ Product      │ PRODUCT NAME       │ No (Design) │ No (Urgent) │
├──────────────┼────────────────────┬─────────────────────────── │
│ Event        │                    │ Couple Name │ COUPLE NAME  │
├──────────────┴────────────────────┴─────────────────────────── │
│ Item Type    │ Item Name          │ Qty  │ Rate     │ Amount   │
│ Paper        │ Category name      │  31  │  45.00   │ 1395.00  │
│ Cover        │ Category name      │   1  │ 910.00   │  910.00  │
│ Others       │ Category name      │   1  │  60.00   │   60.00  │
├──────────────────────────────────┬──────────────────────────── │
│ Remarks:                         │ Total Estimated Amount Rs.: │
│                                  │                      XXXX   │
│                                  │ Advance Amount Rs.:         │
│                                  │                      XXXX   │
│                                  │ Current Job Balance Rs.:    │
│                                  │                      XXXX   │
│                                  ├─────────────────────────────│
│                                  │     Authorized Signatory    │
├──────────────────────────────────┴─────────────────────────────│
│ Counter:Binding  By [user] [date] [time] | Printed by [user]   │
│ [Software Footer text]                           Page 1 of 1   │
└─────────────────────────────────────────────────────────────────┘
```

---

## DATA MAPPING (Order fields → Jobsheet fields)

| Jobsheet Field         | Source                                              |
|------------------------|-----------------------------------------------------|
| Studio Name            | `order.studio.name`                                 |
| Studio Address         | `order.studio.address`                              |
| Studio Phone           | `order.studio.phone`                                |
| Logo                   | `order.studio.logo` (use `getFileUrl()` helper)     |
| Party Name             | `order.customer?.name`                              |
| Party City/State       | `order.customer?.address` (if available)            |
| Order No.              | `order.orderId`                                     |
| Order Date             | `order.createdAt` formatted as DD-Mon-YYYY          |
| Job No.                | `order.orderId` (same as Order No.)                 |
| Contact Name           | `order.customer?.name`                              |
| Mobile No.             | `order.customer?.phone`                             |
| Product                | First category name: `order.categories[0]?.name`   |
| Event                  | hardcoded "wedding" or from `order.notes` (first word, or left blank) |
| Couple Name            | `order.coupleName`                                  |
| Del. Date Time         | `order.estimatedCompletion` formatted               |
| Item Type              | Cycle: "Paper", "Cover", "Others", "Others"... for each category |
| Item Name              | `cat.name` for each category                        |
| Qty                    | `cat.qty` if exists, else 1                         |
| Rate                   | `order.isParty ? cat.partyPrice : cat.basePrice`    |
| Amount                 | Rate × Qty                                          |
| Total Estimated Amount | `billingData.totalAmount`                           |
| Advance Amount         | `billingData.advancePayment`                        |
| Current Job Balance    | `totalAmount - advancePayment`                      |
| Remarks                | `billingData.notes` or `order.notes`                |

---

## FILES TO MODIFY

### 1. `frontend/src/pages/studio/StudioSettings.jsx`
Add two new fields to the settings form (after the existing fields, before Save button):

```jsx
// New field 1: Print Mode toggle
<div className="settings-field">
  <label>Default Print Mode</label>
  <select
    value={form.printMode || 'invoice'}
    onChange={e => setForm({ ...form, printMode: e.target.value })}
  >
    <option value="invoice">Tax Invoice</option>
    <option value="jobsheet">Jobsheet</option>
  </select>
  <small>Controls which format prints when you click the print button on an order.</small>
</div>

// New field 2: Jobsheet footer text (optional)
<div className="settings-field">
  <label>Jobsheet Footer Text</label>
  <input
    type="text"
    placeholder="e.g. A Marv Systems Product +91-8090842211"
    value={form.jobsheetFooter || ''}
    onChange={e => setForm({ ...form, jobsheetFooter: e.target.value })}
  />
  <small>Appears at the bottom of jobsheet prints.</small>
</div>
```

### 2. `backend/models/Studio.js`
Add two new fields to the studioSchema:

```js
printMode: {
    type: String,
    enum: ['invoice', 'jobsheet'],
    default: 'invoice'
},
jobsheetFooter: {
    type: String,
    trim: true,
    default: ''
},
```

### 3. `backend/controllers/studioController.js`
In the `updateStudio` controller, make sure `printMode` and `jobsheetFooter` are included in the fields that are saved. Find where fields like `name`, `address`, `phone` are being assigned from `req.body` and add:

```js
if (req.body.printMode !== undefined) studio.printMode = req.body.printMode;
if (req.body.jobsheetFooter !== undefined) studio.jobsheetFooter = req.body.jobsheetFooter;
```

### 4. `frontend/src/pages/studio/OrdersPage.jsx`
This is the main file. Make the following changes:

#### 4a. Create a new `JobsheetReceipt` component (add near top of file, before the `OrdersPage` component):

```jsx
const JobsheetReceipt = ({ order, billingData, getFileUrl }) => {
  if (!order || !order.studio) return null;

  const studio = order.studio;
  const orderDate = new Date(order.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).replace(/ /g, '-');

  const deliveryDate = order.estimatedCompletion
    ? new Date(order.estimatedCompletion).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      })
    : '';

  const totalAmount = billingData.totalAmount || 0;
  const advanceAmount = billingData.advancePayment || 0;
  const balance = Math.max(0, totalAmount - advanceAmount);

  const itemTypes = ['Paper', 'Cover', 'Others', 'Others', 'Others', 'Others'];

  const printedBy = 'Admin';
  const printTime = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  return (
    <div className="jobsheet-print">
      {/* ===== HEADER ===== */}
      <div className="js-header">
        <div className="js-header-left">
          {studio.logo ? (
            <img className="js-logo" src={getFileUrl(studio.logo)} alt="Logo" />
          ) : (
            <div className="js-logo-placeholder">LOGO</div>
          )}
        </div>
        <div className="js-header-center">
          <div className="js-studio-name">{studio.name}</div>
          {studio.address && <div className="js-studio-address">{studio.address}</div>}
        </div>
        <div className="js-header-right">
          {studio.phone && <div>Phone No. : {studio.phone}</div>}
        </div>
      </div>

      {/* ===== SUBHEADER: JOBSHEET label + barcode ===== */}
      <div className="js-subheader">
        <div className="js-subheader-left">
          <span className="js-title-label">JOBSHEET</span>
          <span className="js-subtitle">(New Album)</span>
        </div>
        <div className="js-barcode">
          {/* Simple barcode representation using order ID */}
          <div className="js-barcode-lines">
            {order.orderId.split('').map((_, i) => (
              <div key={i} className={`js-bar ${i % 3 === 0 ? 'wide' : ''}`}></div>
            ))}
          </div>
          <div className="js-barcode-text">*{order.orderId}*</div>
        </div>
      </div>

      {/* ===== PARTY / ORDER INFO GRID ===== */}
      <table className="js-info-table">
        <tbody>
          <tr>
            <td className="js-label-cell" rowSpan="2">Party Name</td>
            <td className="js-value-cell" rowSpan="2">
              <strong>{order.customer?.name || '-'}</strong>
              <br />
              {order.customer?.address || ''}
            </td>
            <td className="js-label-cell">Order No.</td>
            <td className="js-label-cell">Order Date</td>
          </tr>
          <tr>
            <td className="js-value-cell js-order-id" colSpan="1">
              <strong>{order.orderId}</strong>
            </td>
            <td className="js-value-cell"><strong>{orderDate}</strong></td>
          </tr>
          <tr>
            <td className="js-label-cell" colSpan="2"></td>
            <td className="js-label-cell">Job No.</td>
            <td className="js-label-cell">Receipt No.</td>
          </tr>
          <tr>
            <td colSpan="2"></td>
            <td className="js-value-cell js-order-id" colSpan="2">
              <strong>{order.orderId}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== CONTACT + DETAILS ROW ===== */}
      <table className="js-details-table">
        <tbody>
          <tr>
            <td className="js-label-cell">Contact Name</td>
            <td className="js-value-cell" colSpan="6">
              <strong>{order.customer?.name || '-'}</strong>
            </td>
          </tr>
          <tr>
            <td className="js-label-cell">Mobile No.</td>
            <td className="js-value-cell">{order.customer?.phone || '-'}</td>
            <td className="js-label-cell">Design</td>
            <td className="js-label-cell">Urgent</td>
            <td className="js-label-cell">Input Type</td>
            <td className="js-label-cell">Del. Date Time</td>
            <td className="js-label-cell">Del. Thru</td>
          </tr>
          <tr>
            <td className="js-label-cell">Product</td>
            <td className="js-value-cell">
              <strong>{order.categories?.[0]?.name || '-'}</strong>
            </td>
            <td className="js-value-cell">No</td>
            <td className="js-value-cell">No</td>
            <td className="js-value-cell"></td>
            <td className="js-value-cell">{deliveryDate}</td>
            <td className="js-value-cell"></td>
          </tr>
          <tr>
            <td className="js-label-cell">Event</td>
            <td className="js-value-cell"></td>
            <td className="js-label-cell" colSpan="2">Couple Name</td>
            <td className="js-value-cell" colSpan="3">
              {order.coupleName || ''}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== ITEMS TABLE ===== */}
      <table className="js-items-table">
        <thead>
          <tr>
            <th className="js-th-type">Item Type</th>
            <th className="js-th-name">Item Name</th>
            <th className="js-th-qty">Qty.</th>
            <th className="js-th-rate">Rate</th>
            <th className="js-th-amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          {(order.categories || []).map((cat, idx) => {
            const rate = order.isParty ? (cat.partyPrice || 0) : (cat.basePrice || 0);
            const qty = cat.qty || 1;
            const amount = rate * qty;
            return (
              <tr key={idx}>
                <td>{itemTypes[idx] || 'Others'}</td>
                <td>{cat.name}</td>
                <td style={{ textAlign: 'center' }}>{qty}</td>
                <td style={{ textAlign: 'right' }}>{rate.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{amount.toFixed(2)}</td>
              </tr>
            );
          })}
          {/* Fill empty rows to minimum 4 rows */}
          {Array.from({ length: Math.max(0, 4 - (order.categories?.length || 0)) }).map((_, i) => (
            <tr key={`empty-${i}`} style={{ height: '22px' }}>
              <td></td><td></td><td></td><td></td><td></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ===== REMARKS + TOTALS ===== */}
      <table className="js-footer-table">
        <tbody>
          <tr>
            <td className="js-remarks-cell" rowSpan="5">
              <span className="js-label-cell-inline">Remarks :</span>
              <div style={{ marginTop: '6px', fontSize: '11px' }}>
                {billingData.notes || order.notes || ''}
              </div>
            </td>
            <td className="js-total-label">Total Estimated Amount Rs.:</td>
            <td className="js-total-value"><strong>{totalAmount.toFixed(2)}</strong></td>
          </tr>
          <tr>
            <td className="js-total-label">Advance Amount Rs. :</td>
            <td className="js-total-value">{advanceAmount > 0 ? advanceAmount.toFixed(2) : ' - '}</td>
          </tr>
          <tr>
            <td className="js-total-label">Current Job Balance Rs. :</td>
            <td className="js-total-value"><strong>{balance.toFixed(2)}</strong></td>
          </tr>
          <tr>
            <td colSpan="2"></td>
          </tr>
          <tr>
            <td colSpan="2" style={{ textAlign: 'right', fontSize: '11px', paddingTop: '20px', paddingRight: '8px' }}>
              Authorized Signatory
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== PRINT FOOTER ===== */}
      <div className="js-print-footer">
        <span>Counter:Binding</span>
        <span>By {printedBy} {printTime}</span>
        <span>{studio.jobsheetFooter || ''}</span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  );
};
```

#### 4b. Update the print portal section in `OrdersPage`
Find the existing block:
```jsx
{invoiceOrder && invoiceOrder.studio && createPortal(
    <div className="print-only">
```

Replace the condition so it renders EITHER the existing invoice OR the new jobsheet based on `studio.printMode`:

```jsx
{invoiceOrder && invoiceOrder.studio && createPortal(
    <>
      {invoiceOrder.studio.printMode === 'jobsheet' ? (
        <JobsheetReceipt
          order={invoiceOrder}
          billingData={currentBillingData}
          getFileUrl={getFileUrl}
        />
      ) : (
        <div className="print-only">
          {/* ---- ALL EXISTING TAX INVOICE JSX STAYS HERE UNCHANGED ---- */}
        </div>
      )}
    </>,
    document.body
)}
```

**IMPORTANT**: Keep ALL existing TAX INVOICE JSX code exactly as it is, just wrapped inside the else branch above.

---

### 5. Add CSS for jobsheet styles
Add the following to `frontend/src/pages/studio/OrdersPage.css` (or create `JobsheetReceipt.css` and import it in OrdersPage):

```css
/* ====== JOBSHEET PRINT STYLES ====== */
.jobsheet-print {
  display: none; /* hidden normally */
}

@media print {
  /* Hide everything except jobsheet (when in jobsheet mode) */
  body > *:not(.jobsheet-print) {
    display: none !important;
  }
  .jobsheet-print {
    display: block !important;
    font-family: Arial, sans-serif;
    font-size: 11px;
    color: #000;
    background: #fff;
    width: 100%;
    padding: 0;
    margin: 0;
  }
}

/* Header */
.js-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 8px 10px 4px 10px;
  border-bottom: 1px solid #000;
}
.js-logo {
  width: 80px;
  height: 80px;
  object-fit: contain;
}
.js-logo-placeholder {
  width: 80px;
  height: 80px;
  border: 1px solid #999;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #999;
}
.js-studio-name {
  font-size: 22px;
  font-weight: bold;
  text-align: center;
  letter-spacing: 1px;
}
.js-studio-address {
  font-size: 11px;
  text-align: center;
  color: #333;
}
.js-header-right {
  font-size: 11px;
  text-align: right;
}

/* Subheader (JOBSHEET title + barcode) */
.js-subheader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  border-bottom: 2px solid #000;
}
.js-title-label {
  font-size: 18px;
  font-weight: bold;
  margin-right: 10px;
}
.js-subtitle {
  font-size: 12px;
}
.js-barcode {
  text-align: right;
}
.js-barcode-lines {
  display: flex;
  gap: 1px;
  height: 30px;
  align-items: flex-end;
  justify-content: flex-end;
}
.js-bar {
  width: 2px;
  height: 100%;
  background: #000;
}
.js-bar.wide {
  width: 4px;
}
.js-barcode-text {
  font-size: 9px;
  text-align: center;
  letter-spacing: 1px;
  margin-top: 2px;
}

/* Info/Details tables */
.js-info-table,
.js-details-table,
.js-items-table,
.js-footer-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.js-info-table td,
.js-details-table td,
.js-items-table td,
.js-items-table th,
.js-footer-table td {
  border: 1px solid #000;
  padding: 3px 6px;
  vertical-align: top;
}
.js-label-cell {
  background: #f0f0f0;
  font-size: 10px;
  color: #444;
  white-space: nowrap;
}
.js-value-cell {
  background: #fff;
}
.js-order-id {
  font-size: 14px;
  font-weight: bold;
  letter-spacing: 1px;
}

/* Items table */
.js-items-table thead tr {
  background: #ddd;
  font-weight: bold;
}
.js-th-type { width: 12%; }
.js-th-name { width: 46%; }
.js-th-qty  { width: 8%; text-align: center; }
.js-th-rate { width: 17%; text-align: right; }
.js-th-amount { width: 17%; text-align: right; }

/* Footer totals */
.js-remarks-cell {
  width: 50%;
  vertical-align: top;
  padding: 6px;
}
.js-total-label {
  text-align: right;
  padding-right: 8px;
  white-space: nowrap;
  font-size: 11px;
}
.js-total-value {
  text-align: right;
  min-width: 80px;
  font-size: 12px;
  padding-right: 6px;
}

/* Print footer */
.js-print-footer {
  display: flex;
  justify-content: space-between;
  padding: 4px 10px;
  font-size: 10px;
  color: #333;
  border-top: 1px solid #999;
  margin-top: 2px;
}
```

---

## IMPORTANT NOTES FOR AGENT

1. **DO NOT remove or change any existing TAX INVOICE code.** Only wrap it in the conditional as shown in step 4b.

2. **The `handleQuickPrint` function does NOT change.** It still sets `printInvoiceData`, which still triggers `window.print()` after 300ms. The only difference is what HTML is rendered.

3. **Existing `@media print` CSS** already hides `.print-only` on screen — check `OrdersPage.css` and ensure the new `.jobsheet-print` class follows the same pattern. The new print styles use their own `@media print` block.

4. **The `billingData.notes` field** — check if `notes` is already saved in the billing update `handleUpdateBilling`. If not, add `notes: billingData.notes` to the billing save payload.

5. **Category `qty` field** — The current `Category` model does NOT have a `qty` field. Use `1` as the default quantity for all items. Do NOT add a `qty` field to the model.

6. **`getFileUrl` helper** — This function is already used in `OrdersPage.jsx` for loading images. Import or reference it the same way when passing it to `JobsheetReceipt`.

7. **Order populate** — The `getOrder` endpoint already populates `categories` with `name slaHours basePrice partyPrice hsnCode`. No backend changes needed for data.

8. **StudioSettings save** — The existing `handleSave` in StudioSettings likely does `PUT /api/studios/:id` with the full `form` state. The new `printMode` and `jobsheetFooter` fields will be included automatically if you add them to the form state.

9. **Studio populate in order API** — Make sure the `getOrder` controller populates studio with the new fields: `.populate('studio', 'name address phone logo gstin pan bankDetails paymentQR printMode jobsheetFooter')`. Check `orderController.js` lines where studio is populated and add `printMode jobsheetFooter` to the field list.

10. **Test flow**: Settings → change to "Jobsheet" → Save → Go to Orders → click Print on any order → should show jobsheet format in print preview. Switch back to "Invoice" → same button should show TAX INVOICE.

---

## SUMMARY OF ALL FILES CHANGED

| File | What changes |
|------|-------------|
| `backend/models/Studio.js` | Add `printMode`, `jobsheetFooter` fields |
| `backend/controllers/studioController.js` | Save new fields |
| `backend/controllers/orderController.js` | Add `printMode jobsheetFooter` to studio populate string |
| `frontend/src/pages/studio/StudioSettings.jsx` | Add 2 new form fields |
| `frontend/src/pages/studio/OrdersPage.jsx` | Add `JobsheetReceipt` component, wrap invoice portal in conditional |
| `frontend/src/pages/studio/OrdersPage.css` | Add jobsheet CSS styles |

No other files need to be changed.
