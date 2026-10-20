# Pro Scan V2 — Workflow specification

## Monthly production plan

Required fields:
- Brand
- Product / model
- MRP
- Planned month
- One or more QR/barcode PDF files

Import behavior:
- Extract serial/barcode values from every uploaded PDF.
- Normalize whitespace, but preserve meaningful leading zeros and prefixes.
- Detect duplicates within the upload and against serials already registered to the plan.
- Show counts for extracted values, unique serials, duplicates, unreadable pages, and invalid values.
- Require the user to review import errors before finalizing the plan.
- Total plan availability is the number of unique accepted serials, not the sum of raw PDF rows.

## Daily production plan

A daily plan belongs to a monthly plan and includes:
- Production date
- Production line
- Shift
- Shift start/end times and planned breaks
- Allocated quantity / serial range or selected serial list
- Planned units per working hour
- Manpower count (per shift and, where needed, hourly adjustments)

Before saving, validate that selected serials belong to the monthly plan and are not allocated to a different active daily plan. Warn if hourly targets do not sum to the allocated quantity or exceed available time/capacity.

## Scan rules

Every scan attempt is an append-only event with:
- Raw scanned value and normalized serial value
- Timestamp (timezone-aware)
- Daily plan, line, shift, operator and device context where available
- Classification: valid first scan, duplicate, invalid/unknown, or not allocated to this plan

Only the first valid scan of an allocated serial counts toward actual production. Further scans are kept as duplicate events but must not increase actual quantity. Serial uniqueness and scan validation must be protected by database constraints/transactions, not only by frontend checks.

## Calculations

- Monthly available quantity = unique accepted serials in the monthly plan.
- Daily planned quantity = quantity allocated to the daily plan.
- Actual production = count of allocated serials with a valid first scan.
- Missing/pending = allocated serials without a valid first scan, at the report cutoff.
- Duplicate count = repeat scan attempts, reported separately from produced units.
- Hourly production = valid first scans grouped by scan timestamp and the configured shift-hour intervals.
- Remaining monthly quantity = monthly serials not yet produced and not allocated elsewhere, with canceled/released allocations handled explicitly.

## Required reports

- Monthly plan availability and consumption
- Daily planned vs actual
- Missing serial list
- Duplicate scan log
- Invalid / unallocated scan log
- Hourly production vs target
- Line and shift reports
- Manpower vs production
- Downloadable report exports

## Open implementation detail

PDF layout varies. Import should support text-based PDFs first and report clearly when a PDF requires OCR or uses an unsupported layout. Do not silently treat the number of pages or labels in a file as the number of serials.
