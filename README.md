# Pro Scan V2

A fresh production planning and QR/barcode scan tracking application.

## Core workflow

1. **Monthly plan** — record brand, product, MRP, planned month, and upload one or more QR/barcode PDFs.
2. **Serial registry** — extract serial/barcode values from uploaded documents, deduplicate them, and show confirmed unique quantity.
3. **Daily production plan** — allocate serial ranges or selected serials to a production date, line, and shift.
4. **Hourly targets** — configure shift start/end, breaks, and planned production per hour. Hourly targets should sum to the allocated daily quantity, with capacity warnings when they do not fit the available production time/rate.
5. **Scan production** — record each scan with timestamp, plan, line, shift, and operator/device context. Valid first scans count as production; repeat scans are logged as duplicates without inflating the unique production count.
6. **Reports** — planned vs actual, missing serials, duplicates, invalid scans, hourly/shift/line/day totals, production timing, and manpower.

## Architecture principles

- This is a separate V2 application. Do not reuse or mutate the existing PRO_SCAN Supabase project.
- Keep secrets out of source control. Use environment variables and commit only .env.example.
- Enforce unique serial numbers within the appropriate production scope at the database layer.
- Preserve scan-event history for auditability; do not overwrite duplicate or invalid attempts.
- Missing counts are calculated from allocated serials that have no valid first scan, not simply from total scan events.
- Treat scan event time as the source for actual hourly production and store timestamps with timezone.
- Uploaded PDFs must be parsed and validated before the monthly plan is finalized. Store import summaries and errors.

## Initial build phases

- [ ] App scaffold and design system
- [ ] Supabase V2 schema, RLS, and seed/configuration data
- [ ] Monthly plan creation and PDF serial import
- [ ] Daily plan, line/shift setup, serial allocation, and hourly targets
- [ ] Barcode scanning and validation
- [ ] Live monitoring
- [ ] Reports and exports
- [ ] End-to-end and security checks

## Current status

- Responsive dashboard UI is deployed to Vercel.
- Monthly plan and daily plan forms are available with local demo state.
- Multiple text-based QR/barcode PDF files can be selected for browser-side text extraction; the UI previews candidate serials and duplicate candidates.
- Scan station, live monitoring, report cards, and CSV export are UI prototypes using sample data.
- The initial database migration is in `supabase/migrations/` but has not been applied to a V2 Supabase project yet.
- PDF text extraction does not decode image-only QR/barcode artwork. A sample label PDF should be tested before deciding whether image decoding/OCR is required.
- Data entered into the prototype is not yet persisted to a backend.

## Development setup

1. Install Node.js LTS and npm.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set the new V2 Supabase URL and publishable key after the database is created.
4. Run `npm run dev` for local development or `npm run build` to check the production build.

Never add service-role keys or other production secrets to source control.
