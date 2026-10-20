import { useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, BarChart3, Bell, Boxes, CalendarDays,
  CheckCircle2, ChevronDown, ChevronRight, Clock3, Command, Download, FileText,
  Gauge, LayoutDashboard, Menu, PackageCheck, Plus, QrCode, ScanLine, Search,
  Settings2, ShieldAlert, Upload, Users, X,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { isSupabaseConfigured } from "./lib/supabase";

type Page = "Overview" | "Monthly Plans" | "Daily Plans" | "Live Monitoring" | "Scan Events" | "Reports" | "Settings";

type HourlyRow = { time: string; target: number; actual: number };
type PdfImportSummary = { files: number; pages: number; extracted: number; unique: number; duplicates: number; failed: string[] };
type PdfTextItem = { str?: string; hasEOL?: boolean };

const chartData: HourlyRow[] = [
  { time: "08:00", target: 60, actual: 52 },
  { time: "09:00", target: 60, actual: 59 },
  { time: "10:00", target: 60, actual: 64 },
  { time: "11:00", target: 60, actual: 56 },
  { time: "12:00", target: 0, actual: 0 },
  { time: "13:00", target: 60, actual: 58 },
  { time: "14:00", target: 60, actual: 67 },
  { time: "15:00", target: 60, actual: 61 },
  { time: "16:00", target: 40, actual: 35 },
];

const initialPlans = [
  { id: "MP-2611-001", brand: "Gerat", product: "Mixer Grinder", mrp: "₹2,499", month: "Nov 2026", serials: "001–1,000", quantity: 1000, status: "Ready" },
  { id: "MP-2611-002", brand: "Gerat", product: "Electric Kettle", mrp: "₹1,299", month: "Nov 2026", serials: "001–500", quantity: 500, status: "Draft" },
];

const initialDailyPlans = [
  { id: "DP-2010-001", product: "Mixer Grinder", line: "Line 1", shift: "Shift A", time: "08:00–17:00", target: 500, actual: 412, manpower: 12, status: "Running" },
  { id: "DP-2010-002", product: "Electric Kettle", line: "Line 2", shift: "Shift A", time: "08:00–17:00", target: 250, actual: 228, manpower: 8, status: "Running" },
  { id: "DP-2010-003", product: "Mixer Grinder", line: "Line 3", shift: "Shift B", time: "17:00–01:00", target: 250, actual: 0, manpower: 10, status: "Scheduled" },
];

const initialEvents = [
  { serial: "GR-MG-000412", product: "Mixer Grinder", line: "Line 1", shift: "Shift A", time: "10:42:18", status: "Valid scan" },
  { serial: "GR-MG-000411", product: "Mixer Grinder", line: "Line 1", shift: "Shift A", time: "10:42:12", status: "Valid scan" },
  { serial: "GR-MG-000391", product: "Mixer Grinder", line: "Line 1", shift: "Shift A", time: "10:41:57", status: "Duplicate" },
  { serial: "GR-EK-000228", product: "Electric Kettle", line: "Line 2", shift: "Shift A", time: "10:41:31", status: "Valid scan" },
  { serial: "UNKNOWN-001", product: "Unknown item", line: "Line 1", shift: "Shift A", time: "10:40:58", status: "Invalid" },
];

const nav = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Monthly Plans", icon: CalendarDays },
  { label: "Daily Plans", icon: Boxes },
  { label: "Live Monitoring", icon: Activity },
  { label: "Scan Events", icon: ScanLine },
  { label: "Reports", icon: BarChart3 },
  { label: "Settings", icon: Settings2 },
] as const;

function App() {
  const [page, setPage] = useState<Page>("Overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState("");
  const [plans, setPlans] = useState(initialPlans);
  const [dailyPlans, setDailyPlans] = useState(initialDailyPlans);
  const [events, setEvents] = useState(initialEvents);
  const [showMonthlyForm, setShowMonthlyForm] = useState(false);
  const [showDailyForm, setShowDailyForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [newBrand, setNewBrand] = useState("Gerat");
  const [newProduct, setNewProduct] = useState("");
  const [newMrp, setNewMrp] = useState("");
  const [newMonth, setNewMonth] = useState("2026-11");
  const [newSerialStart, setNewSerialStart] = useState("1");
  const [newSerialEnd, setNewSerialEnd] = useState("500");
  const [dailyProduct, setDailyProduct] = useState("Mixer Grinder");
  const [dailyLine, setDailyLine] = useState("Line 1");
  const [dailyShift, setDailyShift] = useState("Shift A");
  const [dailyStart, setDailyStart] = useState("08:00");
  const [dailyEnd, setDailyEnd] = useState("17:00");
  const [dailyQty, setDailyQty] = useState("500");
  const [dailyRate, setDailyRate] = useState("60");
  const [dailyManpower, setDailyManpower] = useState("12");
  const [scanValue, setScanValue] = useState("");
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [pdfSerials, setPdfSerials] = useState<string[]>([]);
  const [pdfSummary, setPdfSummary] = useState<PdfImportSummary | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const filteredPlans = useMemo(() => plans.filter((p) =>
    (p.product + p.brand + p.id + p.month).toLowerCase().includes(search.toLowerCase())), [plans, search]);
  const filteredDailyPlans = useMemo(() => dailyPlans.filter((p) =>
    (p.product + p.line + p.shift + p.id).toLowerCase().includes(search.toLowerCase())), [dailyPlans, search]);
  const validScans = events.filter((e) => e.status === "Valid scan").length + 635;
  const duplicateCount = events.filter((e) => e.status === "Duplicate").length + 18;
  const invalidCount = events.filter((e) => e.status === "Invalid").length + 4;
  const allocated = dailyPlans.reduce((sum, p) => sum + p.target, 0);
  const actual = dailyPlans.reduce((sum, p) => sum + p.actual, 0);
  const startMinuteOfDay = Number(dailyStart.split(":")[0]) * 60 + Number(dailyStart.split(":")[1]);
  const endMinuteOfDay = Number(dailyEnd.split(":")[0]) * 60 + Number(dailyEnd.split(":")[1]);
  const shiftMinutes = endMinuteOfDay > startMinuteOfDay ? endMinuteOfDay - startMinuteOfDay : endMinuteOfDay + 1440 - startMinuteOfDay;
  const capacity = Math.max(0, Math.floor(shiftMinutes / 60)) * Number(dailyRate || 0);
  const estimatedHours = Number(dailyQty || 0) / Math.max(1, Number(dailyRate || 1));

  async function parseSerialPdfs(files: File[]) {
    setPdfFiles(files);
    setPdfSerials([]);
    setPdfSummary(null);
    if (!files.length) return;
    setPdfBusy(true);
    const uniqueSerials: string[] = [];
    const seen = new Set<string>();
    let pages = 0;
    let extracted = 0;
    let duplicates = 0;
    const failed: string[] = [];
    const commonNonSerials = /^(MRP|SKU|QTY|QUANTITY|SERIAL|SERIALNO|SERIALNUMBER|MODEL|PRODUCT|BRAND|DATE|MFD|BATCH|PAGE|COPY|NO|IN|OUT)$/i;
    try {
      // Load PDF.js only when the user imports a PDF, keeping the initial dashboard bundle lighter.
      const [pdfjsLib, pdfWorkerModule] = await Promise.all([
        import("pdfjs-dist"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
      ]);
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerModule.default;
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith(".pdf")) {
          failed.push(`${file.name}: not a PDF file`);
          continue;
        }
        try {
          const document = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
          pages += document.numPages;
          for (let pageNo = 1; pageNo <= document.numPages; pageNo += 1) {
            const page = await document.getPage(pageNo);
            const content = await page.getTextContent();
            const items = content.items as PdfTextItem[];
            const text = items.map((item) => item.str ?? "").join(" ");
            const tokens = text
              .replace(/\u00a0/g, " ")
              .split(/[\s,;|]+/g)
              .map((token) => token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9._/-]+$/g, "").trim())
              .filter((token) => token.length > 0 && token.length <= 64 && /\d/.test(token) && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(token) && !commonNonSerials.test(token));
            for (const token of tokens) {
              extracted += 1;
              const normalized = token.toUpperCase();
              if (seen.has(normalized)) {
                duplicates += 1;
              } else {
                seen.add(normalized);
                uniqueSerials.push(token);
              }
            }
          }
        } catch (error) {
          failed.push(`${file.name}: ${error instanceof Error ? error.message : "could not read PDF"}`);
        }
      }
      setPdfSerials(uniqueSerials);
      setPdfSummary({ files: files.length, pages, extracted, unique: uniqueSerials.length, duplicates, failed });
      if (!uniqueSerials.length) {
        setNotice("No text-based serial candidates were found. This PDF may contain image-only QR labels or an unsupported layout; use a text-enabled PDF or add OCR/QR decoding support.");
      } else {
        setNotice(`PDF preview complete: ${uniqueSerials.length.toLocaleString()} unique candidates from ${files.length} file(s). Review the sample before saving the draft.`);
      }
    } catch (error) {
      setNotice(`PDF import could not start: ${error instanceof Error ? error.message : "unexpected error"}`);
    } finally {
      setPdfBusy(false);
    }
  }

  function addMonthlyPlan() {
    if (!newProduct.trim() || !newMrp.trim()) {
      setNotice("Enter a product and MRP.");
      return;
    }
    if (pdfFiles.length > 0 && !pdfSerials.length) {
      setNotice("The selected PDFs have no extracted serial candidates. Use a text-enabled PDF or clear the PDF selection to enter a manual serial range for this draft.");
      return;
    }
    if (pdfFiles.length === 0 && (Number(newSerialStart) < 0 || Number(newSerialEnd) < Number(newSerialStart))) {
      setNotice("Enter a valid serial range.");
      return;
    }
    const serialDigits = (value: number) => String(value).padStart(Math.max(newSerialStart.length, newSerialEnd.length), "0");
    const quantity = pdfFiles.length ? pdfSerials.length : Number(newSerialEnd) - Number(newSerialStart) + 1;
    const serialLabel = pdfFiles.length
      ? `${pdfSerials[0]}–${pdfSerials[pdfSerials.length - 1]}`
      : `${serialDigits(Number(newSerialStart))}–${serialDigits(Number(newSerialEnd))}`;
    const monthLabel = new Date(newMonth + "-01T12:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    setPlans((prev) => [...prev, {
      id: `MP-${newMonth.replace("-", "")}-${String(prev.length + 1).padStart(3, "0")}`,
      brand: newBrand, product: newProduct.trim(), mrp: newMrp.startsWith("₹") ? newMrp : `₹${newMrp}`,
      month: monthLabel, serials: serialLabel, quantity, status: "Draft",
    }]);
    setShowMonthlyForm(false);
    setNewProduct(""); setNewMrp("");
    setPdfFiles([]); setPdfSerials([]); setPdfSummary(null);
    setNotice("Demo monthly plan added. PDF text extraction ran in this browser; the imported serial records are still temporary and will persist only after the new Supabase V2 schema is connected.");
  }

  function addDailyPlan() {
    const target = Number(dailyQty);
    const rate = Number(dailyRate);
    if (!target || !rate || !dailyStart || !dailyEnd) {
      setNotice("Enter a valid planned quantity, hourly target, and shift time.");
      return;
    }
    const startMinutes = Number(dailyStart.split(":")[0]) * 60 + Number(dailyStart.split(":")[1]);
    const endMinutesRaw = Number(dailyEnd.split(":")[0]) * 60 + Number(dailyEnd.split(":")[1]);
    const duration = endMinutesRaw > startMinutes ? endMinutesRaw - startMinutes : endMinutesRaw + 1440 - startMinutes;
    const possible = Math.floor(duration / 60) * rate;
    setDailyPlans((prev) => [...prev, {
      id: `DP-2010-${String(prev.length + 1).padStart(3, "0")}`, product: dailyProduct, line: dailyLine,
      shift: dailyShift, time: `${dailyStart}–${dailyEnd}`, target, actual: 0, manpower: Number(dailyManpower) || 0, status: "Scheduled",
    }]);
    setShowDailyForm(false);
    setNotice(possible < target
      ? `Daily plan created in demo. Warning: ${target.toLocaleString()} planned units exceed simple capacity estimate of ${possible.toLocaleString()} units for this shift. Adjust hourly targets or time.`
      : "Demo daily plan added. Serial allocation, break-aware capacity, and database saving will be enabled during integration.");
  }

  function recordDemoScan() {
    const serial = scanValue.trim();
    if (!serial) return;
    const exists = events.some((e) => e.serial.toLowerCase() === serial.toLowerCase());
    setEvents((prev) => [{
      serial, product: exists ? "Previously scanned" : dailyProduct, line: dailyLine, shift: dailyShift,
      time: new Date().toLocaleTimeString("en-GB"), status: exists ? "Duplicate" : "Valid scan",
    }, ...prev]);
    setScanValue("");
    setNotice(exists ? "Duplicate demo scan recorded. It does not increase unique production." : "Demo scan recorded. Database validation will be connected after Supabase V2 is configured.");
  }

  function exportCsv(rows: Record<string, string | number>[], filename: string) {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(","), ...rows.map((row) => keys.map((key) => JSON.stringify(row[key] ?? "")).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; anchor.click();
    URL.revokeObjectURL(url);
  }

  const pageTitle = page === "Overview" ? "Production overview" : page;
  const pageSubtitle = page === "Overview"
    ? "A real-time view of production activity across your factory."
    : page === "Monthly Plans" ? "Create monthly product plans and register QR/barcode serial batches."
    : page === "Daily Plans" ? "Allocate monthly serials to lines and shifts with hourly production targets."
    : page === "Live Monitoring" ? "Monitor live line performance and hourly plan versus actual."
    : page === "Scan Events" ? "Review valid, duplicate, invalid, and unallocated scan attempts."
    : page === "Reports" ? "Explore production, timing, missing serials, and manpower reports."
    : "Configure factory lines, shifts, and system preferences.";

  return (
    <div className="app-shell">
      {mobileNav && <button className="mobile-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><QrCode size={23} strokeWidth={2.2} /></div>
          <div><div className="brand-name">PRO SCAN <span>V2</span></div><div className="brand-caption">PRODUCTION CONTROL</div></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace-card">
          <div className="workspace-avatar">GI</div>
          <div className="workspace-text"><strong>GSONS Industries</strong><span>Factory operations</span></div>
          <ChevronDown size={15} className="muted-icon" />
        </div>
        <div className="nav-label">OPERATIONS</div>
        <nav className="nav-list">
          {nav.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${page === label ? "nav-item-active" : ""}`}
              onClick={() => { setPage(label); setMobileNav(false); setSearch(""); }}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
              {label === "Live Monitoring" && <span className="live-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="health-panel">
            <div className="health-title"><span className="health-dot" /> SYSTEM STATUS</div>
            <strong>{isSupabaseConfigured ? "Database configured" : "Demo workspace"}</strong>
            <p>{isSupabaseConfigured ? "Connection settings detected. Schema setup is still required." : "Sample data only · not connected to production data"}</p>
          </div>
          <button className="profile-row" onClick={() => setPage("Settings")}>
            <div className="profile-avatar">AD</div><div className="profile-info"><strong>Factory Admin</strong><span>Administrator</span></div><ChevronDown size={16} className="muted-icon" />
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button menu-button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button>
            <div className="breadcrumbs"><span>Production</span><ChevronRight size={14} /><strong>{page}</strong></div>
          </div>
          <div className="topbar-actions">
            <div className="search-box"><Search size={16} /><input aria-label="Search records" placeholder="Search anything..." value={search} onChange={(e) => setSearch(e.target.value)} /><kbd>⌘ K</kbd></div>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotice("Notifications will appear here when scan exceptions and line alerts are connected.")}><Bell size={18} /><span /></button>
            <div className="topbar-divider" />
            <div className="today-chip"><CalendarDays size={15} /><span>20 Oct 2026</span></div>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div><div className="eyebrow">FACTORY INTELLIGENCE <span>•</span> VERSION 2.0</div><h1>{pageTitle}</h1><p>{pageSubtitle}</p></div>
            <div className="heading-actions">
              {page === "Monthly Plans" && <button className="button button-primary" onClick={() => setShowMonthlyForm(true)}><Plus size={17} /> New monthly plan</button>}
              {page === "Daily Plans" && <button className="button button-primary" onClick={() => setShowDailyForm(true)}><Plus size={17} /> Create daily plan</button>}
              {(page === "Reports" || page === "Scan Events") && <button className="button button-secondary" onClick={() => exportCsv(events.map((e) => ({ serial: e.serial, product: e.product, line: e.line, shift: e.shift, time: e.time, status: e.status })), "pro-scan-v2-scan-events.csv")}><Download size={16} /> Export CSV</button>}
              {page === "Overview" && <button className="button button-secondary" onClick={() => setPage("Daily Plans")}><CalendarDays size={16} /> View plans</button>}
            </div>
          </div>

          {notice && <div className="notice-banner"><CheckCircle2 size={17} /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss notice"><X size={16} /></button></div>}

          {page === "Overview" && <OverviewPage validScans={validScans} duplicateCount={duplicateCount} invalidCount={invalidCount} allocated={allocated} actual={actual} goTo={setPage} />}
          {page === "Monthly Plans" && <MonthlyPlans plans={filteredPlans} onAdd={() => setShowMonthlyForm(true)} onExport={() => exportCsv(filteredPlans.map((p) => ({ id: p.id, brand: p.brand, product: p.product, mrp: p.mrp, month: p.month, serials: p.serials, quantity: p.quantity, status: p.status })), "pro-scan-v2-monthly-plans.csv")} />}
          {page === "Daily Plans" && <DailyPlans plans={filteredDailyPlans} onAdd={() => setShowDailyForm(true)} onExport={() => exportCsv(filteredDailyPlans.map((p) => ({ ...p })), "pro-scan-v2-daily-plans.csv")} />}
          {page === "Live Monitoring" && <LiveMonitoring plans={dailyPlans} chartData={chartData} />}
          {page === "Scan Events" && <ScanEvents events={events} scanValue={scanValue} setScanValue={setScanValue} onScan={recordDemoScan} />}
          {page === "Reports" && <Reports plans={dailyPlans} events={events} onExport={() => exportCsv(dailyPlans.map((p) => ({ ...p })), "pro-scan-v2-production-report.csv")} />}
          {page === "Settings" && <SettingsPage />}
        </div>
        <footer className="app-footer"><span>PRO SCAN V2 <span className="footer-separator">/</span> Production intelligence</span><span>Build 0.1.0 <span className="footer-separator">·</span> {isSupabaseConfigured ? "Configuration detected" : "Demo mode"}</span></footer>
      </main>

      {showMonthlyForm && <Modal title="Create monthly production plan" subtitle="Register the product and serial-label batches planned for a month." onClose={() => setShowMonthlyForm(false)}>
        <div className="form-grid">
          <Field label="Brand"><select value={newBrand} onChange={(e) => setNewBrand(e.target.value)}><option>Gerat</option><option>Gerat Cuisino</option><option>EUZU</option><option>Kabel</option><option>Other</option></select></Field>
          <Field label="Planned month"><input type="month" value={newMonth} onChange={(e) => setNewMonth(e.target.value)} required /></Field>
          <Field label="Product / model"><input value={newProduct} onChange={(e) => setNewProduct(e.target.value)} placeholder="e.g. Mixer Grinder" required /></Field>
          <Field label="MRP (₹)"><input value={newMrp} onChange={(e) => setNewMrp(e.target.value)} placeholder="2,499" required /></Field>
          <Field label="First serial number"><input type="number" min="0" value={newSerialStart} onChange={(e) => setNewSerialStart(e.target.value)} /></Field>
          <Field label="Last serial number"><input type="number" min="0" value={newSerialEnd} onChange={(e) => setNewSerialEnd(e.target.value)} /></Field>
        </div>
        <label className="upload-placeholder"><Upload size={21} /><div><strong>Upload QR / Barcode PDFs</strong><span>Select multiple text-based PDF label files. Serial-like text is extracted locally in your browser; image-only PDFs need OCR/QR decoding support.</span><input className="pdf-file-input" type="file" accept="application/pdf,.pdf" multiple onChange={(event) => { void parseSerialPdfs(Array.from(event.target.files ?? [])); }} /></div><span className="coming-soon">{pdfBusy ? "READING…" : "CHOOSE PDF"}</span></label>
        {pdfSummary && <div className="pdf-import-results"><div className="pdf-results-grid"><div><span>Files</span><strong>{pdfSummary.files}</strong></div><div><span>Pages</span><strong>{pdfSummary.pages}</strong></div><div><span>Text candidates</span><strong>{pdfSummary.extracted.toLocaleString()}</strong></div><div><span>Unique candidates</span><strong>{pdfSummary.unique.toLocaleString()}</strong></div><div><span>Duplicates</span><strong className={pdfSummary.duplicates ? "text-amber" : ""}>{pdfSummary.duplicates.toLocaleString()}</strong></div></div>{pdfSummary.failed.length > 0 && <p className="pdf-error">{pdfSummary.failed.join(" · ")}</p>}{pdfSerials.length > 0 && <div className="serial-preview"><span>Preview (first {Math.min(8, pdfSerials.length)} candidates)</span><div>{pdfSerials.slice(0, 8).map((serial, index) => <code key={serial + index}>{serial}</code>)}</div></div>}</div>}
        <div className="range-summary"><div><span>{pdfFiles.length ? "Unique serial candidates" : "Manual serial range quantity"}</span><strong>{(pdfFiles.length ? pdfSerials.length : Math.max(0, Number(newSerialEnd) - Number(newSerialStart) + 1)).toLocaleString()}</strong></div><div><span>Import status</span><strong className={pdfSummary?.unique ? "text-green" : "text-amber"}>{pdfBusy ? "Parsing PDF…" : pdfSummary?.unique ? "Preview ready" : "Not imported"}</strong></div></div>
        <div className="modal-actions"><button className="button button-secondary" onClick={() => setShowMonthlyForm(false)}>Cancel</button><button className="button button-primary" onClick={addMonthlyPlan}><Plus size={16} /> Save draft</button></div>
      </Modal>}

      {showDailyForm && <Modal title="Create daily production plan" subtitle="Assign the day's production to a line and shift." onClose={() => setShowDailyForm(false)}>
        <div className="form-grid">
          <Field label="Production date"><input type="date" defaultValue="2026-10-20" /></Field>
          <Field label="Product"><select value={dailyProduct} onChange={(e) => setDailyProduct(e.target.value)}><option>Mixer Grinder</option><option>Electric Kettle</option></select></Field>
          <Field label="Production line"><select value={dailyLine} onChange={(e) => setDailyLine(e.target.value)}><option>Line 1</option><option>Line 2</option><option>Line 3</option></select></Field>
          <Field label="Shift"><select value={dailyShift} onChange={(e) => setDailyShift(e.target.value)}><option>Shift A</option><option>Shift B</option><option>Shift C</option></select></Field>
          <Field label="Shift start"><input type="time" value={dailyStart} onChange={(e) => setDailyStart(e.target.value)} /></Field>
          <Field label="Shift end"><input type="time" value={dailyEnd} onChange={(e) => setDailyEnd(e.target.value)} /></Field>
          <Field label="Planned quantity"><input type="number" min="1" value={dailyQty} onChange={(e) => setDailyQty(e.target.value)} /></Field>
          <Field label="Target per working hour"><input type="number" min="1" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} /></Field>
          <Field label="Manpower"><input type="number" min="0" value={dailyManpower} onChange={(e) => setDailyManpower(e.target.value)} /></Field>
        </div>
        <div className="capacity-note"><Gauge size={18} /><div><strong>Capacity estimate: {capacity.toLocaleString()} units / 9 working hours</strong><span>At {Number(dailyRate || 0)} units/hour, this plan needs about {estimatedHours.toFixed(1)} production hours before breaks and downtime.</span></div></div>
        <div className="upload-placeholder"><Boxes size={21} /><div><strong>Serial allocation</strong><span>In the database-enabled flow, choose a serial range from the monthly plan. Already allocated serials will be blocked.</span></div><span className="coming-soon">NEXT STEP</span></div>
        <div className="modal-actions"><button className="button button-secondary" onClick={() => setShowDailyForm(false)}>Cancel</button><button className="button button-primary" onClick={addDailyPlan}><Plus size={16} /> Save daily plan</button></div>
      </Modal>}
    </div>
  );
}

function OverviewPage({ validScans, duplicateCount, invalidCount, allocated, actual, goTo }: {
  validScans: number; duplicateCount: number; invalidCount: number; allocated: number; actual: number; goTo: (p: Page) => void;
}) {
  const cards = [
    { title: "Unique units scanned", value: validScans.toLocaleString(), change: "+8.4%", up: true, detail: "First valid scan per serial", icon: PackageCheck, tone: "blue" },
    { title: "Duplicate attempts", value: duplicateCount.toLocaleString(), change: "Needs review", up: false, detail: "Excluded from production", icon: ShieldAlert, tone: "amber" },
    { title: "Invalid scans", value: invalidCount.toLocaleString(), change: "4 today", up: false, detail: "Unknown or unallocated serial", icon: QrCode, tone: "red" },
    { title: "Planned achievement", value: allocated ? `${Math.round((actual / allocated) * 100)}%` : "82.4%", change: "Across active plans", up: true, detail: "Unique actual vs daily target", icon: Gauge, tone: "green" },
  ];
  return <>
    <div className="metric-grid">{cards.map(({ title, value, change, up, detail, icon: Icon, tone }) => <div className="metric-card" key={title}>
      <div className="metric-card-top"><span>{title}</span><div className={`metric-icon metric-${tone}`}><Icon size={18} /></div></div>
      <div className="metric-value">{value}</div><div className="metric-meta">{title === "Duplicate attempts" || title === "Invalid scans" ? <span className="meta-warning">{change}</span> : <span className={up ? "meta-positive" : "meta-warning"}>{up && <ArrowUpRight size={13} />} {change}</span>}<span>{detail}</span></div>
    </div>)}</div>
    <div className="section-grid main-dashboard-grid">
      <section className="panel production-panel">
        <div className="panel-header"><div><h2>Production throughput</h2><p>Hourly target versus actual scans across active lines</p></div><div className="chart-legend"><span><i className="legend-target" /> Target</span><span><i className="legend-actual" /> Actual</span></div></div>
        <div className="chart-summary"><strong>574 <small>units</small></strong><span className="positive-pill"><ArrowUpRight size={13} /> 6.2%</span><span className="chart-summary-label">scanned this shift</span></div>
        <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 5, left: -18, bottom: 0 }}>
          <defs><linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1d75e8" stopOpacity={0.19} /><stop offset="95%" stopColor="#1d75e8" stopOpacity={0.01} /></linearGradient></defs>
          <CartesianGrid stroke="#edf1f6" vertical={false} />
          <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: "#8490a3", fontSize: 11 }} dy={10} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#8490a3", fontSize: 11 }} />
          <Tooltip contentStyle={{ border: "1px solid #e7ebf2", borderRadius: 10, fontSize: 12, boxShadow: "0 8px 28px rgba(18,34,58,.08)" }} />
          <Area type="monotone" dataKey="target" name="Target" stroke="#a8b4c5" strokeDasharray="5 5" strokeWidth={1.8} fill="none" />
          <Area type="monotone" dataKey="actual" name="Actual" stroke="#1d75e8" strokeWidth={2.4} fill="url(#actualFill)" activeDot={{ r: 4 }} />
        </AreaChart></ResponsiveContainer></div>
        <div className="chart-foot"><span><span className="tiny-dot blue-dot" /> Last updated just now</span><button className="text-action" onClick={() => goTo("Live Monitoring")}>Open live monitoring <ChevronRight size={15} /></button></div>
      </section>
      <section className="panel line-panel">
        <div className="panel-header"><div><h2>Production lines</h2><p>Current activity and shift progress</p></div><span className="status-live"><i /> LIVE</span></div>
        <LineRow name="Line 1" product="Mixer Grinder · Shift A" actual={412} target={500} people={12} color="blue" />
        <LineRow name="Line 2" product="Electric Kettle · Shift A" actual={228} target={250} people={8} color="green" />
        <LineRow name="Line 3" product="Mixer Grinder · Shift B" actual={0} target={250} people={10} color="gray" scheduled />
        <div className="panel-bottom-link"><button className="text-action" onClick={() => goTo("Daily Plans")}>View all production plans <ChevronRight size={15} /></button></div>
      </section>
    </div>
    <div className="section-grid lower-dashboard-grid">
      <section className="panel activity-panel">
        <div className="panel-header"><div><h2>Recent scan activity</h2><p>Latest QR/barcode events from the line</p></div><button className="text-action" onClick={() => goTo("Scan Events")}>View all <ChevronRight size={15} /></button></div>
        <ScanActivityTable />
      </section>
      <section className="panel exceptions-panel">
        <div className="panel-header"><div><h2>Scan exceptions</h2><p>Events requiring attention</p></div><div className="exception-count">22</div></div>
        <div className="exception-row"><div className="exception-icon duplicate-icon"><ShieldAlert size={17} /></div><div className="exception-content"><strong>Duplicate serial detected</strong><span>Serial GR-MG-000391 · Line 1</span></div><span className="exception-number">18</span></div>
        <div className="exception-row"><div className="exception-icon invalid-icon"><QrCode size={17} /></div><div className="exception-content"><strong>Invalid / unknown barcode</strong><span>Not found in monthly serial pool</span></div><span className="exception-number">4</span></div>
        <button className="button button-secondary exception-button" onClick={() => goTo("Scan Events")}>Review scan events <ChevronRight size={15} /></button>
      </section>
    </div>
    <div className="demo-disclaimer"><div className="disclaimer-icon"><Command size={17} /></div><div><strong>Preview workspace</strong><span>These sample metrics demonstrate the V2 interface. Live metrics will replace them once the new Supabase database, serial imports, and scan validation are connected.</span></div><button onClick={() => goTo("Settings")}>Configure <ChevronRight size={14} /></button></div>
  </>;
}

function LineRow({ name, product, actual, target, people, color, scheduled = false }: {
  name: string; product: string; actual: number; target: number; people: number; color: string; scheduled?: boolean;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
  return <div className="line-row">
    <div className="line-row-top"><div className={`line-marker line-marker-${color}`}><Activity size={16} /></div><div className="line-row-title"><strong>{name}</strong><span>{product}</span></div><span className={`line-status ${scheduled ? "scheduled-status" : "running-status"}`}>{scheduled ? "Scheduled" : "Running"}</span></div>
    <div className="line-progress-meta"><span>Production progress</span><strong>{actual} <small>/ {target}</small><b>{pct}%</b></strong></div>
    <div className="progress-track"><span className={`progress-fill progress-${color}`} style={{ width: `${pct}%` }} /></div>
    <div className="line-row-foot"><span><Users size={13} /> {people} operators</span><span>{scheduled ? "Starts at 17:00" : `${target - actual} units remaining`}</span></div>
  </div>;
}

function ScanActivityTable() {
  const rows = [
    { serial: "GR-MG-000412", product: "Mixer Grinder", line: "Line 1", time: "10:42:18", status: "Valid scan" },
    { serial: "GR-MG-000411", product: "Mixer Grinder", line: "Line 1", time: "10:42:12", status: "Valid scan" },
    { serial: "GR-MG-000391", product: "Mixer Grinder", line: "Line 1", time: "10:41:57", status: "Duplicate" },
    { serial: "GR-EK-000228", product: "Electric Kettle", line: "Line 2", time: "10:41:31", status: "Valid scan" },
  ];
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Serial number</th><th>Product</th><th>Line</th><th>Scan time</th><th>Status</th></tr></thead><tbody>
    {rows.map((r) => <tr key={r.serial}><td className="serial-cell">{r.serial}</td><td>{r.product}</td><td>{r.line}</td><td className="time-cell">{r.time}</td><td><StatusBadge status={r.status} /></td></tr>)}
  </tbody></table></div>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge ${status === "Valid scan" || status === "Ready" ? "badge-success" : status === "Duplicate" ? "badge-warning" : status === "Invalid" ? "badge-danger" : status === "Running" ? "badge-blue" : status === "Scheduled" ? "badge-neutral" : "badge-neutral"}`}><i />{status}</span>;
}

function MonthlyPlans({ plans, onAdd, onExport }: { plans: typeof initialPlans; onAdd: () => void; onExport: () => void }) {
  return <><div className="summary-strip">
    <SummaryStat label="Monthly plans" value={plans.length.toString()} icon={CalendarDays} />
    <SummaryStat label="Registered serials" value={plans.reduce((n,p) => n + p.quantity, 0).toLocaleString()} icon={QrCode} />
    <SummaryStat label="Ready for allocation" value={plans.filter(p => p.status === "Ready").length.toString()} icon={CheckCircle2} />
    <SummaryStat label="Draft plans" value={plans.filter(p => p.status === "Draft").length.toString()} icon={FileText} />
  </div><section className="panel table-panel"><div className="panel-header"><div><h2>Monthly production plans</h2><p>Products and serial pools registered for each month</p></div><div className="table-actions"><button className="button button-secondary button-sm" onClick={onExport}><Download size={15} /> Export</button><button className="button button-secondary button-sm" onClick={onAdd}><Plus size={15} /> New plan</button></div></div><div className="table-scroll"><table className="data-table wide-table"><thead><tr><th>Plan ID</th><th>Brand / Product</th><th>MRP</th><th>Planned month</th><th>Serial range</th><th>Quantity</th><th>Status</th><th /></tr></thead><tbody>{plans.map((p) => <tr key={p.id}><td className="id-cell">{p.id}</td><td><div className="product-name">{p.product}</div><div className="sub-cell">{p.brand}</div></td><td>{p.mrp}</td><td>{p.month}</td><td className="serial-cell">{p.serials}</td><td className="quantity-cell">{p.quantity.toLocaleString()}</td><td><StatusBadge status={p.status} /></td><td><button className="row-menu" title="Plan actions"><ChevronDown size={16} /></button></td></tr>)}</tbody></table>{!plans.length && <EmptyState title="No matching monthly plans" description="Change the search or create a monthly production plan." />}</div><div className="table-footer"><span>Showing {plans.length} plan{plans.length === 1 ? "" : "s"}</span><span>Quantities are previews until PDF import is connected.</span></div></section><div className="info-callout"><Upload size={19} /><div><strong>PDF serial import is a key next step</strong><p>V2 will parse serial numbers from multiple PDFs in one monthly plan, detect overlapping serials, and calculate the accepted unique quantity before the plan is confirmed.</p></div></div></>;
}

function DailyPlans({ plans, onAdd, onExport }: { plans: typeof initialDailyPlans; onAdd: () => void; onExport: () => void }) {
  const [tab, setTab] = useState("All plans");
  const shown = plans.filter(p => tab === "All plans" || (tab === "Running" ? p.status === "Running" : p.status === "Scheduled"));
  return <><div className="summary-strip">
    <SummaryStat label="Daily plans" value={plans.length.toString()} icon={CalendarDays} />
    <SummaryStat label="Planned today" value={plans.reduce((n,p) => n + p.target,0).toLocaleString()} icon={Boxes} />
    <SummaryStat label="Actual production" value={plans.reduce((n,p) => n + p.actual,0).toLocaleString()} icon={PackageCheck} />
    <SummaryStat label="Assigned manpower" value={plans.reduce((n,p) => n + p.manpower,0).toString()} icon={Users} />
  </div><section className="panel table-panel"><div className="panel-header"><div><h2>Daily production plans</h2><p>20 October 2026 <span className="header-dot">·</span> Three production lines</p></div><div className="table-actions"><button className="button button-secondary button-sm" onClick={onExport}><Download size={15} /> Export</button><button className="button button-primary button-sm" onClick={onAdd}><Plus size={15} /> Create plan</button></div></div><div className="table-tabs">{["All plans","Running","Scheduled"].map(t => <button key={t} onClick={() => setTab(t)} className={tab === t ? "table-tab active-table-tab" : "table-tab"}>{t}</button>)}</div><div className="table-scroll"><table className="data-table wide-table"><thead><tr><th>Plan ID</th><th>Product</th><th>Line</th><th>Shift / Timing</th><th>Planned</th><th>Actual</th><th>Progress</th><th>Manpower</th><th>Status</th></tr></thead><tbody>{shown.map(p => <tr key={p.id}><td className="id-cell">{p.id}</td><td className="product-name">{p.product}</td><td><span className="line-chip">{p.line}</span></td><td><div>{p.shift}</div><div className="sub-cell">{p.time}</div></td><td className="quantity-cell">{p.target.toLocaleString()}</td><td className="quantity-cell">{p.actual.toLocaleString()}</td><td><div className="table-progress"><span><i style={{width:`${Math.min(100,Math.round(p.actual/Math.max(1,p.target)*100))}%`}} /></span><small>{Math.round(p.actual/Math.max(1,p.target)*100)}%</small></div></td><td>{p.manpower} <span className="sub-cell inline-sub">people</span></td><td><StatusBadge status={p.status} /></td></tr>)}</tbody></table>{!shown.length && <EmptyState title="No plans in this view" description="Try another status filter or create a plan." />}</div><div className="table-footer"><span>Showing {shown.length} of {plans.length} plans</span><span>Unique valid scans will drive actual production.</span></div></section><div className="info-callout"><Clock3 size={19} /><div><strong>Hourly targets and capacity controls</strong><p>Set a target for each working hour, include breaks, and get warnings when the planned quantity cannot fit into the available shift time and expected production rate.</p></div></div></>;
}

function LiveMonitoring({ plans, chartData }: { plans: typeof initialDailyPlans; chartData: HourlyRow[] }) {
  return <><div className="monitor-top"><div className="monitor-live"><span className="live-wave"><i /><i /><i /></span><div><strong>Line monitoring</strong><span>Sample dashboard · refresh simulation not connected</span></div></div><span className="status-live"><i /> LIVE VIEW</span></div><div className="line-monitor-grid">{plans.map(p => { const pct = Math.min(100,Math.round(p.actual/Math.max(1,p.target)*100)); return <div key={p.id} className="panel monitor-card"><div className="monitor-card-head"><div><span className="monitor-kicker">{p.line} <span>·</span> {p.shift}</span><h2>{p.product}</h2></div><StatusBadge status={p.status} /></div><div className="monitor-numbers"><div><span>Actual output</span><strong>{p.actual.toLocaleString()} <small>units</small></strong></div><div><span>Target</span><strong>{p.target.toLocaleString()} <small>units</small></strong></div></div><div className="monitor-progress"><div><span>Achievement</span><strong>{pct}%</strong></div><div className="progress-track"><span className="progress-fill progress-blue" style={{width:`${pct}%`}} /></div></div><div className="monitor-card-foot"><span><Users size={14}/>{p.manpower} operators</span><span><Clock3 size={14}/>{p.time}</span></div></div>; })}</div><section className="panel production-panel live-chart-panel"><div className="panel-header"><div><h2>Hourly production trend</h2><p>Selected line preview — planned output versus scan output</p></div></div><div className="chart-wrap live-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}><CartesianGrid stroke="#edf1f6" vertical={false}/><XAxis dataKey="time" tickLine={false} axisLine={false} tick={{fill:"#8490a3",fontSize:11}} dy={10}/><YAxis tickLine={false} axisLine={false} tick={{fill:"#8490a3",fontSize:11}}/><Tooltip/><Area type="monotone" dataKey="target" name="Target" stroke="#a8b4c5" strokeDasharray="5 5" fill="none"/><Area type="monotone" dataKey="actual" name="Actual" stroke="#1d75e8" strokeWidth={2.4} fill="#1d75e8" fillOpacity={0.09}/></AreaChart></ResponsiveContainer></div></section></>;
}

function ScanEvents({ events, scanValue, setScanValue, onScan }: { events: typeof initialEvents; scanValue: string; setScanValue: (v:string)=>void; onScan: ()=>void }) {
  return <><div className="scan-intro"><div className="scan-intro-icon"><ScanLine size={25}/></div><div><h2>Production scan station</h2><p>Enter or scan a barcode to preview event classification. This prototype keeps sample events in page state only.</p></div></div><section className="panel scan-entry-panel"><div className="scan-entry-form"><div className="scan-entry-input"><QrCode size={19}/><input value={scanValue} onChange={e=>setScanValue(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")onScan();}} placeholder="Scan or enter serial number…" aria-label="Serial number to scan"/><kbd>ENTER</kbd></div><button className="button button-primary" onClick={onScan}><ScanLine size={17}/> Record demo scan</button></div><div className="scan-rules"><span><CheckCircle2 size={14}/> Unique valid serial increases output</span><span><ShieldAlert size={14}/> Duplicate does not increase output</span><span><X size={14}/> Unknown serial is flagged</span></div></section><section className="panel table-panel"><div className="panel-header"><div><h2>Scan event log</h2><p>Every attempt stays visible in the event history.</p></div><span className="record-count">{events.length} recent records</span></div><div className="table-scroll"><table className="data-table wide-table"><thead><tr><th>Serial number</th><th>Product</th><th>Line</th><th>Shift</th><th>Scan time</th><th>Result</th></tr></thead><tbody>{events.map((e,i)=><tr key={e.serial+"-"+i}><td className="serial-cell">{e.serial}</td><td>{e.product}</td><td>{e.line}</td><td>{e.shift}</td><td className="time-cell">{e.time}</td><td><StatusBadge status={e.status}/></td></tr>)}</tbody></table></div><div className="table-footer"><span>Showing recent events</span><span>Production totals use unique valid scans only.</span></div></section></>;
}

function Reports({ plans, events, onExport }: { plans: typeof initialDailyPlans; events: typeof initialEvents; onExport: ()=>void }) {
  const [period,setPeriod] = useState("Today");
  const totalTarget = plans.reduce((n,p)=>n+p.target,0);
  const totalActual = plans.reduce((n,p)=>n+p.actual,0);
  const pct = totalTarget ? Math.round(totalActual/totalTarget*100) : 0;
  const cards = [
    {title:"Production performance",description:"Planned vs actual by date, line, and shift",icon:BarChart3},
    {title:"Missing serials",description:"Allocated serials without a valid first scan",icon:QrCode},
    {title:"Duplicate scan audit",description:"Repeated scan attempts with first-seen reference",icon:ShieldAlert},
    {title:"Hourly output",description:"Target, actual, difference, and production rate",icon:Clock3},
    {title:"Manpower productivity",description:"People assigned against unique units produced",icon:Users},
    {title:"Line / shift summary",description:"Output, achievement, pending, and scan time",icon:Activity},
  ];
  return <><div className="report-toolbar"><div className="report-period"><CalendarDays size={16}/><select value={period} onChange={e=>setPeriod(e.target.value)}><option>Today</option><option>This week</option><option>This month</option><option>Custom range</option></select><ChevronDown size={14}/></div><button className="button button-primary" onClick={onExport}><Download size={16}/> Export production CSV</button></div><div className="summary-strip report-summary"><SummaryStat label="Planned quantity" value={totalTarget.toLocaleString()} icon={Boxes}/><SummaryStat label="Actual unique scans" value={totalActual.toLocaleString()} icon={PackageCheck}/><SummaryStat label="Pending quantity" value={Math.max(0,totalTarget-totalActual).toLocaleString()} icon={Clock3}/><SummaryStat label="Achievement" value={`${pct}%`} icon={Gauge}/></div><div className="report-card-grid">{cards.map(({title,description,icon:Icon})=><button className="panel report-card" key={title} onClick={()=>title.includes("Duplicate")?document.getElementById("report-events")?.scrollIntoView({behavior:"smooth"}):setPeriod(period)}><div className="report-icon"><Icon size={19}/></div><ChevronRight size={17} className="report-arrow"/><h3>{title}</h3><p>{description}</p><span>Open report <ChevronRight size={13}/></span></button>)}</div><section className="panel table-panel" id="report-events"><div className="panel-header"><div><h2>Scan exception summary</h2><p>{period} · sample scan events</p></div></div><div className="exception-summary-list"><div><span className="summary-status-dot dot-amber"/><span>Duplicate attempts</span><strong>{events.filter(e=>e.status==="Duplicate").length}</strong><small>Excluded from actual production</small></div><div><span className="summary-status-dot dot-red"/><span>Invalid scans</span><strong>{events.filter(e=>e.status==="Invalid").length}</strong><small>Requires barcode or allocation review</small></div><div><span className="summary-status-dot dot-green"/><span>Valid scans in sample log</span><strong>{events.filter(e=>e.status==="Valid scan").length}</strong><small>First scan status in this session</small></div></div></section></>;
}

function SettingsPage() {
  const settings = [
    {title:"Production lines",detail:"Configure line names, availability, and default rate",tag:"3 lines",icon:Activity},
    {title:"Shifts & breaks",detail:"Define start/end times, breaks, and working minutes",tag:"To configure",icon:Clock3},
    {title:"Products & brands",detail:"Maintain brand, product model, MRP, and SKU rules",tag:"Planning data",icon:Boxes},
    {title:"Manpower",detail:"Operator list and shift/line manpower assignments",tag:"To configure",icon:Users},
    {title:"Database connection",detail:"New Supabase V2 project URL and publishable key",tag:"Environment",icon:Settings2},
    {title:"Access & permissions",detail:"Administrator, planner, supervisor, and scanning operator",tag:"Design phase",icon:ShieldAlert},
  ];
  return <><div className="settings-layout"><div className="settings-nav panel"><h3>System configuration</h3><button className="settings-nav-active"><Settings2 size={16}/> General</button><button><Users size={16}/> Users & roles</button><button><Activity size={16}/> Lines & shifts</button><button><ShieldAlert size={16}/> Security</button></div><div className="settings-content"><section className="panel settings-connection"><div className="settings-connection-icon"><Command size={20}/></div><div><h2>V2 environment</h2><p>{isSupabaseConfigured ? "Environment variables exist. Database schema and policies must still be applied." : "No Supabase credentials configured. The app uses sample data only."}</p><span className={isSupabaseConfigured?"connection-badge":"connection-badge connection-demo"}><i/>{isSupabaseConfigured?"Configuration detected":"Demo mode"}</span></div></section><div className="settings-card-grid">{settings.map(({title,detail,tag,icon:Icon})=><section className="panel settings-card" key={title}><div className="settings-card-icon"><Icon size={18}/></div><span className="settings-tag">{tag}</span><h3>{title}</h3><p>{detail}</p><button className="text-action">Configure <ChevronRight size={14}/></button></section>)}</div><div className="info-callout"><ShieldAlert size={19}/><div><strong>Security principle</strong><p>The frontend will use only a Supabase publishable key. Database access must be protected by RLS; privileged service-role keys must never be committed or exposed in browser code.</p></div></div></div></div></>;
}

function SummaryStat({ label, value, icon: Icon }: { label:string; value:string; icon: typeof CalendarDays }) {
  return <div className="summary-stat"><div className="summary-icon"><Icon size={17}/></div><div><span>{label}</span><strong>{value}</strong></div></div>;
}
function EmptyState({ title, description }: {title:string;description:string}) { return <div className="empty-state"><div className="empty-icon"><FileText size={22}/></div><strong>{title}</strong><span>{description}</span></div>; }
function Modal({ title, subtitle, onClose, children }: {title:string;subtitle:string;onClose:()=>void;children:React.ReactNode}) { return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Close modal"><X size={19}/></button></div><div className="modal-body">{children}</div></section></div>; }
function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="field"><span>{label}</span>{children}</label>; }

export default App;
