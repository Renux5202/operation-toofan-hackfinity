import React, { useState, useEffect, useRef } from "react";
import {
  X,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RotateCcw,
  Trash2,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
  Layers,
  Database,
  Building,
} from "lucide-react";
import { sounds } from "./soundEffects";

function money(val) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val || 0);
}

// ----------------------------------------------------
// INTELLIGENT MULTI-FORMAT BANK & STATEMENT TEXT PARSER
// ----------------------------------------------------
export function parseBankText(rawText) {
  if (!rawText || typeof rawText !== "string") return [];
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // 1. Try JSON Array format
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsedJson = JSON.parse(trimmed);
      if (Array.isArray(parsedJson)) {
        return parsedJson
          .filter((item) => item && (item.amount || item.amt) && (item.sender || item.from) && (item.receiver || item.to))
          .map((item, idx) => ({
            tx_id: item.tx_id || `TX-JSON-${Date.now()}-${idx}`,
            sender: String(item.sender || item.from).toUpperCase().trim(),
            receiver: String(item.receiver || item.to).toUpperCase().trim(),
            amount: Number(item.amount || item.amt) || 0,
            channel: (item.channel || "upi").toLowerCase(),
            is_p2m: Boolean(item.is_p2m || String(item.receiver || "").includes("BAKERY") || String(item.receiver || "").includes("SHOP")),
            reference_id: item.reference_id || item.ref || `BNSS94/JSON/${Date.now()}-${idx + 1}`,
            timestamp: item.timestamp || new Date().toISOString(),
            event_type: item.event_type || "bank_import",
          }));
      }
    } catch {}
  }

  // 2. Line by line parsing
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  // Check if first line is a CSV/TSV header
  const firstLine = lines[0].toLowerCase();
  const hasHeader =
    firstLine.includes("sender") ||
    firstLine.includes("receiver") ||
    firstLine.includes("amount") ||
    firstLine.includes("from") ||
    firstLine.includes("to") ||
    firstLine.includes("narration") ||
    firstLine.includes("description");

  let startIdx = 0;
  let sIdx = -1;
  let rIdx = -1;
  let aIdx = -1;
  let cIdx = -1;
  let refIdx = -1;
  let tsIdx = -1;

  if (hasHeader) {
    startIdx = 1;
    const delim = firstLine.includes(",") ? "," : firstLine.includes("\t") ? "\t" : firstLine.includes("|") ? "|" : ";";
    const headers = firstLine.split(delim).map((h) => h.trim().replace(/^["']|["']$/g, ""));
    sIdx = headers.findIndex((h) => h.includes("sender") || h.includes("from"));
    rIdx = headers.findIndex((h) => h.includes("receiver") || h.includes("recipient") || h.includes("to"));
    aIdx = headers.findIndex((h) => h.includes("amount") || h.includes("amt") || h.includes("debit") || h.includes("credit"));
    cIdx = headers.findIndex((h) => h.includes("channel") || h.includes("method") || h.includes("mode") || h.includes("type"));
    refIdx = headers.findIndex((h) => h.includes("ref") || h.includes("utr") || h.includes("txn") || h.includes("id"));
    tsIdx = headers.findIndex((h) => h.includes("time") || h.includes("date"));
  }

  const results = [];

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    // Pattern A: Delimited (CSV, TSV, Pipe, Semicolon)
    if (line.includes(",") || line.includes("\t") || line.includes("|") || line.includes(";")) {
      const delim = line.includes(",") ? "," : line.includes("\t") ? "\t" : line.includes("|") ? "|" : ";";
      const cols = line.split(delim).map((c) => c.trim().replace(/^["']|["']$/g, ""));

      if (cols.length >= 3) {
        let sender = "UNKNOWN";
        let receiver = "UNKNOWN";
        let amount = 0;
        let channel = "upi";
        let ref = "";
        let ts = new Date().toISOString();

        if (sIdx >= 0 && cols[sIdx]) sender = cols[sIdx];
        if (rIdx >= 0 && cols[rIdx]) receiver = cols[rIdx];
        if (aIdx >= 0 && cols[aIdx]) {
          const rawAmt = cols[aIdx].replace(/[^0-9.]/g, "");
          amount = parseFloat(rawAmt) || 0;
        }

        // Auto-detect columns if headers were absent
        if (sIdx < 0 || rIdx < 0 || aIdx < 0) {
          // Find numeric column for amount
          const numIdx = cols.findIndex((c) => {
            const clean = c.replace(/[^0-9.]/g, "");
            return clean.length > 0 && !isNaN(parseFloat(clean)) && parseFloat(clean) > 0;
          });

          if (numIdx >= 0) {
            amount = parseFloat(cols[numIdx].replace(/[^0-9.]/g, "")) || 0;
            const nonNums = cols.filter((_, idx) => idx !== numIdx);
            sender = nonNums[0] || "SENDER";
            receiver = nonNums[1] || "RECEIVER";
            if (nonNums[2]) channel = nonNums[2];
            if (nonNums[3]) ref = nonNums[3];
          }
        }

        if (cIdx >= 0 && cols[cIdx]) channel = cols[cIdx];
        if (refIdx >= 0 && cols[refIdx]) ref = cols[refIdx];
        if (tsIdx >= 0 && cols[tsIdx]) ts = cols[tsIdx];

        if (amount > 0 && sender !== "UNKNOWN") {
          const chLower = channel.toLowerCase();
          const cleanChannel = chLower.includes("cash")
            ? "physical-cash"
            : chLower.includes("cdm") || chLower.includes("atm")
            ? "cdm"
            : chLower.includes("settle")
            ? "merchant-settlement"
            : chLower.includes("bank") || chLower.includes("imps") || chLower.includes("neft")
            ? "bank-transfer"
            : "upi";

          results.push({
            tx_id: `TX-IMPORT-${Date.now()}-${i}`,
            sender: sender.toUpperCase().replace(/\s+/g, "-"),
            receiver: receiver.toUpperCase().replace(/\s+/g, "-"),
            amount,
            channel: cleanChannel,
            is_p2m: cleanChannel.includes("settle") || receiver.includes("BAKERY") || receiver.includes("SHOP") || receiver.includes("MERCHANT"),
            reference_id: ref || `BNSS94/TXT/${Date.now()}-${i}`,
            timestamp: ts,
            event_type: "bank_statement_import",
          });
          continue;
        }
      }
    }

    // Pattern B: Arrow Syntax: "SENDER -> RECEIVER : 5000" or "SENDER to RECEIVER 5000"
    const arrowMatch = line.match(/^([A-Za-z0-9_\-\.]+)\s*(?:->|=>|-->|to)\s*([A-Za-z0-9_\-\.]+)\s*[:=\-]?\s*(?:Rs\.?|INR|₹)?\s*([0-9,]+(?:\.[0-9]+)?)(?:\s*\((.*?)\))?/i);
    if (arrowMatch) {
      const sender = arrowMatch[1].trim().toUpperCase();
      const receiver = arrowMatch[2].trim().toUpperCase();
      const amtStr = arrowMatch[3].replace(/,/g, "");
      const amount = parseFloat(amtStr) || 0;
      const note = (arrowMatch[4] || "").toLowerCase();

      let channel = "upi";
      if (note.includes("cash") || sender.includes("STUDENT") && receiver.includes("DEALER")) channel = "physical-cash";
      else if (note.includes("cdm") || sender.includes("CDM")) channel = "cdm";
      else if (note.includes("settle") || sender.includes("BAKERY")) channel = "merchant-settlement";
      else if (note.includes("bank") || note.includes("transfer") || note.includes("boss")) channel = "bank-transfer";

      if (amount > 0) {
        results.push({
          tx_id: `TX-ARROW-${Date.now()}-${i}`,
          sender,
          receiver,
          amount,
          channel,
          is_p2m: receiver.includes("BAKERY") || receiver.includes("SHOP") || channel === "merchant-settlement",
          reference_id: `ARROW/REF/${Date.now()}-${i}`,
          timestamp: new Date().toISOString(),
          event_type: "arrow_syntax_import",
        });
        continue;
      }
    }

    // Pattern C: Indian Bank SMS & UPI Alerts
    // "Sent Rs.5,000.00 from SENDER to RECEIVER via UPI Ref 92837482"
    // "Paid Rs. 500 to DEALER-01 from STUDENT-014 Ref 8492019"
    // "Debited Rs. 9,500.00 from A/C X to FAKE-ACC-7A via UPI"
    // "Deposited Rs 9500 at CDM-KIOSK-04 to FAKE-ACC-7A Ref CDM948102"
    const smsAmtMatch = line.match(/(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]+)?)/i);
    if (smsAmtMatch) {
      const amount = parseFloat(smsAmtMatch[1].replace(/,/g, "")) || 0;

      // Extract sender and receiver
      let sender = "BANK-ACC";
      let receiver = "BENEFICIARY";
      let channel = "upi";
      let ref = `SMS/BNSS/${Date.now()}-${i}`;

      const toMatch = line.match(/(?:to|paid to|credited to)\s+([A-Za-z0-9_\-\.\*]+)/i);
      const fromMatch = line.match(/(?:from|debited from|deposited at)\s+([A-Za-z0-9_\-\.\*]+)/i);
      const refMatch = line.match(/(?:Ref|UPI Ref|UTR|Txn|Reference)\s*(?:No\.?|[:#])?\s*([A-Za-z0-9_\-\/]+)/i);

      if (toMatch && toMatch[1]) receiver = toMatch[1].toUpperCase();
      if (fromMatch && fromMatch[1]) sender = fromMatch[1].toUpperCase();
      if (refMatch && refMatch[1]) ref = refMatch[1];

      if (line.toLowerCase().includes("cash") || line.toLowerCase().includes("handover")) channel = "physical-cash";
      else if (line.toLowerCase().includes("cdm") || line.toLowerCase().includes("atm")) channel = "cdm";
      else if (line.toLowerCase().includes("imps") || line.toLowerCase().includes("neft") || line.toLowerCase().includes("rtgs")) channel = "bank-transfer";

      if (amount > 0) {
        results.push({
          tx_id: `TX-SMS-${Date.now()}-${i}`,
          sender: sender.replace(/\s+/g, "-"),
          receiver: receiver.replace(/\s+/g, "-"),
          amount,
          channel,
          is_p2m: receiver.includes("BAKERY") || receiver.includes("SHOP") || receiver.includes("MERCHANT"),
          reference_id: ref,
          timestamp: new Date().toISOString(),
          event_type: "bank_sms_import",
        });
        continue;
      }
    }
  }

  return results;
}

// ----------------------------------------------------
// PRESET DEMO TEMPLATES FOR EXCELLENT 1-CLICK DEMO USE
// ----------------------------------------------------
const SAMPLE_PRESETS = {
  statementCsv: {
    label: "Sample Bank Statement (CSV)",
    badge: "CSV / TSV",
    text: `Sender,Receiver,Amount,Channel,Reference,Timestamp
STUDENT-014,DEALER-01,500,physical-cash,BNSS94/2026/001,2026-11-20T14:10:00Z
STUDENT-028,DEALER-01,1000,physical-cash,BNSS94/2026/002,2026-11-20T14:25:00Z
STUDENT-031,DEALER-01,1500,physical-cash,BNSS94/2026/003,2026-11-20T14:40:00Z
DEALER-01,SUPPLIER-MULE-9X,5000,upi,UPI/PREPAID/D01,2026-11-20T16:00:00Z
DEALER-02,SUPPLIER-MULE-9X,5000,upi,UPI/PREPAID/D02,2026-11-20T16:15:00Z
DEALER-03,SUPPLIER-MULE-9X,5000,upi,UPI/PREPAID/D03,2026-11-20T16:30:00Z
SUPPLIER-MULE-9X,MAIN-BOSS-HUB,15000,bank-transfer,TRF/BOSS/15000,2026-11-20T17:15:00Z`,
  },
  smsLogs: {
    label: "Raw Bank SMS / UPI Logs",
    badge: "SMS / TEXT",
    text: `Sent Rs.500.00 from STUDENT-014 to DEALER-01 via UPI Ref 8392019481 on 20-Nov-2026
Sent Rs.1,000.00 from STUDENT-028 to DEALER-01 via UPI Ref 8392019482 on 20-Nov-2026
Paid Rs.5,000.00 to SUPPLIER-MULE-9X from DEALER-01 via UPI Ref UPI/D01/5000
Paid Rs.5,000.00 to SUPPLIER-MULE-9X from DEALER-02 via UPI Ref UPI/D02/5000
Paid Rs.5,000.00 to SUPPLIER-MULE-9X from DEALER-03 via UPI Ref UPI/D03/5000
Transfer of Rs.15,000.00 from SUPPLIER-MULE-9X to MAIN-BOSS-HUB via IMPS Ref IMPS/BOSS/15000`,
  },
  arrowFormat: {
    label: "Simple Line Arrow Notes",
    badge: "FAST NOTATION",
    text: `STUDENT-014 -> FORT-ROAD-BAKERY : 35 (Counter UPI)
FORT-ROAD-BAKERY -> FAKE-ACC-7A : 3400 (Shop Settlement)
STUDENT-028 -> FAKE-ACC-7A : 950 (Direct Mule UPI)
FAKE-ACC-7A -> CASHOUT-HUB : 4350 (Hub Sweep)`,
  },
  cdmLoop: {
    label: "ATM CDM-to-UPI Wash Loop",
    badge: "ATM / CDM",
    text: `CDM-KIOSK-04,FAKE-ACC-7A,9500,cdm,CDM/DEP/948102,2026-11-20T10:14:00Z
FAKE-ACC-7A,CASHOUT-HUB,9400,upi,UPI/SWEEP/841029,2026-11-20T10:36:00Z
PROVIDER-HARSH,FORT-ROAD-BAKERY,2000,physical-cash,CSH/BAK/002,2026-11-20T11:00:00Z
FORT-ROAD-BAKERY,FAKE-ACC-7A,2000,merchant-settlement,STTL/003,2026-11-20T11:45:00Z`,
  },
};

export default function BankTextImporterModal({
  isOpen = false,
  onClose = () => {},
  onImportTransactions = () => {},
  lang = "en",
}) {
  const [activeTab, setActiveTab] = useState("paste"); // "paste" | "upload"
  const [rawText, setRawText] = useState("");
  const [importMode, setImportMode] = useState("append"); // "append" | "replace"
  const [parsedList, setParsedList] = useState([]);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef(null);

  // Parse in real-time as text changes
  useEffect(() => {
    const list = parseBankText(rawText);
    setParsedList(list);
  }, [rawText]);

  if (!isOpen) return null;

  function handleFileChoose(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result || "";
      setRawText(String(content));
      sounds.playClick();
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleDropFile(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result || "";
      setRawText(String(content));
      sounds.playClick();
    };
    reader.readAsText(file);
  }

  function handleLoadPreset(presetKey) {
    sounds.playClick();
    const preset = SAMPLE_PRESETS[presetKey];
    if (preset) {
      setRawText(preset.text);
      setFileName(`${preset.label}.txt`);
    }
  }

  function handleRemoveItem(idx) {
    sounds.playClick();
    setParsedList((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleExecuteImport() {
    if (parsedList.length === 0) return;
    sounds.playPaySuccess();
    onImportTransactions(parsedList, importMode);
    onClose();
  }

  const totalVolume = parsedList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return (
    <div className="sheet-backdrop-overlay" onClick={onClose} style={{ zIndex: 1250 }}>
      <div
        className="police-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "880px",
          width: "95%",
          background: "#0f172a",
          borderRadius: "14px",
          overflow: "hidden",
          border: "1px solid rgba(56, 189, 248, 0.4)",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.5)",
          color: "#f8fafc",
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            background: "linear-gradient(135deg, #091e3a 0%, #173254 100%)",
            padding: "16px 22px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ background: "#0284c7", padding: "7px", borderRadius: "8px" }}>
              <FileSpreadsheet size={20} className="text-white" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "10px", fontWeight: "800", background: "#f59e0b", color: "#000", padding: "2px 7px", borderRadius: "4px" }}>
                  SECTION 94 BNSS INGESTION
                </span>
                <small style={{ color: "#94a3b8" }}>Raw Bank Text &amp; Statement Parser</small>
              </div>
              <h3 style={{ margin: "4px 0 0", color: "#fff", fontSize: "17px", fontWeight: "800" }}>
                {lang === "ml" ? "ബാങ്ക് രേഖകൾ ഇൻസേർട്ട് ചെയ്യുക" : "Bank Text & Statement File Inserter"}
              </h3>
            </div>
          </div>
          <button
            className="btn-close-police-modal"
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div style={{ padding: "18px 22px", maxHeight: "80vh", overflowY: "auto" }}>
          {/* STATUTORY EXPLANATION */}
          <div
            style={{
              background: "rgba(14, 165, 233, 0.12)",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              borderRadius: "8px",
              padding: "10px 14px",
              marginBottom: "14px",
              display: "flex",
              gap: "10px",
              alignItems: "center",
            }}
          >
            <ShieldCheck size={18} className="text-sky-400" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: "12px", color: "#e0f2fe", lineHeight: "1.4" }}>
              <b>Universal Forensic Parser:</b> Paste raw text from bank SMS alerts, copy-pasted bank statement rows, or upload any <code>.txt</code> / <code>.csv</code> file. The engine extracts the sender, receiver, amount, and payment channel, immediately visualizing them on the Money Flow Map.
            </span>
          </div>

          {/* INPUT MODE TABS & SAMPLE PRESETS BAR */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
            <div style={{ display: "inline-flex", background: "rgba(15, 23, 42, 0.9)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "8px", padding: "3px" }}>
              <button
                type="button"
                onClick={() => { sounds.playClick(); setActiveTab("paste"); }}
                style={{
                  padding: "5px 12px",
                  borderRadius: "6px",
                  border: 0,
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  background: activeTab === "paste" ? "#0284c7" : "transparent",
                  color: activeTab === "paste" ? "#fff" : "#94a3b8",
                  transition: "all 0.15s",
                }}
              >
                Paste Text / SMS
              </button>
              <button
                type="button"
                onClick={() => { sounds.playClick(); setActiveTab("upload"); }}
                style={{
                  padding: "5px 12px",
                  borderRadius: "6px",
                  border: 0,
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  background: activeTab === "upload" ? "#0284c7" : "transparent",
                  color: activeTab === "upload" ? "#fff" : "#94a3b8",
                  transition: "all 0.15s",
                }}
              >
                Upload File (.txt, .csv)
              </button>
            </div>

            {/* QUICK PRESETS CLUSTER */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600" }}>Presets:</span>
              {Object.entries(SAMPLE_PRESETS).map(([k, p]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleLoadPreset(k)}
                  style={{
                    background: "rgba(30, 41, 59, 0.7)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "6px",
                    color: "#cbd5e1",
                    fontSize: "11px",
                    fontWeight: "600",
                    padding: "4px 8px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  title={p.label}
                >
                  <Sparkles size={11} className="text-amber-400" />
                  <span>{p.badge}</span>
                </button>
              ))}
              {rawText && (
                <button
                  type="button"
                  onClick={() => { sounds.playClick(); setRawText(""); setFileName(""); }}
                  style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "6px",
                    color: "#f87171",
                    fontSize: "11px",
                    fontWeight: "600",
                    padding: "4px 8px",
                    cursor: "pointer",
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* TAB 1: PASTE TEXT */}
          {activeTab === "paste" && (
            <div style={{ marginBottom: "14px" }}>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`Paste raw bank text here... Example lines:
1) STUDENT-014, DEALER-01, 500, physical-cash, BNSS94/2026/001
2) Sent Rs.5,000.00 from DEALER-01 to SUPPLIER-MULE-9X via UPI Ref 92837482
3) DEALER-02 -> SUPPLIER-MULE-9X : 5000 (Prepaid Consignment)
4) CDM-KIOSK-04, FAKE-ACC-7A, 9500, cdm, CDM/DEP/948102`}
                rows={6}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "#090d16",
                  color: "#e2e8f0",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  lineHeight: "1.5",
                  resize: "vertical",
                }}
              />
            </div>
          )}

          {/* TAB 2: UPLOAD FILE DROPZONE */}
          {activeTab === "upload" && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropFile}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed rgba(56, 189, 248, 0.4)",
                borderRadius: "10px",
                background: "rgba(15, 23, 42, 0.6)",
                padding: "24px 16px",
                textAlign: "center",
                cursor: "pointer",
                marginBottom: "14px",
                transition: "all 0.2s",
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept=".txt,.csv,.log,.json"
                onChange={handleFileChoose}
              />
              <Upload size={32} className="text-sky-400" style={{ margin: "0 auto 8px" }} />
              <b style={{ display: "block", color: "#f8fafc", fontSize: "14px" }}>
                {fileName ? `Selected: ${fileName}` : "Click to select or drag & drop a bank file"}
              </b>
              <span style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginTop: "4px" }}>
                Supported formats: <b>.txt</b> (Bank SMS / notes), <b>.csv</b> (Statement export), <b>.log</b>, <b>.json</b>
              </span>
            </div>
          )}

          {/* PARSED PREVIEW SECTION */}
          <div style={{ marginTop: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Database size={15} className="text-sky-400" />
                <b style={{ fontSize: "12.5px", textTransform: "uppercase", letterSpacing: "0.04em", color: "#f8fafc" }}>
                  Parsed Transaction Stream Preview
                </b>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: "750",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  background: parsedList.length > 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  color: parsedList.length > 0 ? "#10b981" : "#f87171",
                  border: `1px solid ${parsedList.length > 0 ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                }}
              >
                {parsedList.length > 0
                  ? `✓ ${parsedList.length} Transactions Detected (${money(totalVolume)})`
                  : "0 Transactions Parsed (Paste lines or choose preset above)"}
              </span>
            </div>

            {/* PREVIEW TABLE */}
            {parsedList.length > 0 ? (
              <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "8px", background: "rgba(15, 23, 42, 0.85)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px" }}>
                  <thead>
                    <tr style={{ background: "rgba(30, 41, 59, 0.9)", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", textAlign: "left", color: "#94a3b8" }}>
                      <th style={{ padding: "6px 10px" }}>#</th>
                      <th style={{ padding: "6px 10px" }}>SENDER (FROM)</th>
                      <th style={{ padding: "6px 10px" }}>RECEIVER (TO)</th>
                      <th style={{ padding: "6px 10px" }}>AMOUNT</th>
                      <th style={{ padding: "6px 10px" }}>CHANNEL</th>
                      <th style={{ padding: "6px 10px" }}>REFERENCE</th>
                      <th style={{ padding: "6px 8px", textAlign: "center" }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedList.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                        <td style={{ padding: "6px 10px", color: "#64748b" }}>{idx + 1}</td>
                        <td style={{ padding: "6px 10px", fontWeight: "700", color: "#38bdf8" }}>{item.sender}</td>
                        <td style={{ padding: "6px 10px", fontWeight: "700", color: "#f8fafc" }}>{item.receiver}</td>
                        <td style={{ padding: "6px 10px", fontWeight: "800", color: "#10b981" }}>{money(item.amount)}</td>
                        <td style={{ padding: "6px 10px" }}>
                          <span
                            style={{
                              fontSize: "9.5px",
                              fontWeight: "750",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: item.channel.includes("cash")
                                ? "rgba(245, 158, 11, 0.2)"
                                : item.channel.includes("cdm")
                                ? "rgba(249, 115, 22, 0.2)"
                                : item.channel.includes("settle")
                                ? "rgba(16, 185, 129, 0.2)"
                                : "rgba(56, 189, 248, 0.2)",
                              color: item.channel.includes("cash")
                                ? "#fbbf24"
                                : item.channel.includes("cdm")
                                ? "#fb923c"
                                : item.channel.includes("settle")
                                ? "#34d399"
                                : "#38bdf8",
                            }}
                          >
                            {item.channel.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "6px 10px", color: "#94a3b8", fontFamily: "monospace", fontSize: "10.5px" }}>{item.reference_id}</td>
                        <td style={{ padding: "6px 8px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            style={{ background: "transparent", border: 0, color: "#f87171", cursor: "pointer", padding: "2px" }}
                            title="Remove line"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  background: "rgba(15, 23, 42, 0.5)",
                  borderRadius: "8px",
                  border: "1px dashed rgba(255, 255, 255, 0.1)",
                  color: "#64748b",
                  fontSize: "12px",
                }}
              >
                No transactions detected. Paste text above or click one of the preset buttons.
              </div>
            )}
          </div>

          {/* INGESTION TARGET MODE (APPEND VS REPLACE) */}
          <div
            style={{
              marginTop: "16px",
              padding: "10px 14px",
              background: "rgba(30, 41, 59, 0.6)",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Layers size={16} className="text-amber-400" />
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#f8fafc" }}>Import Mode:</span>
            </div>
            <div style={{ display: "flex", gap: "16px", fontSize: "12px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", color: "#e2e8f0" }}>
                <input
                  type="radio"
                  name="importMode"
                  value="append"
                  checked={importMode === "append"}
                  onChange={() => setImportMode("append")}
                />
                <span>Append to Current Investigation</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", color: "#e2e8f0" }}>
                <input
                  type="radio"
                  name="importMode"
                  value="replace"
                  checked={importMode === "replace"}
                  onChange={() => setImportMode("replace")}
                />
                <span style={{ color: "#fca5a5" }}>Replace Entire List (Clean Slate)</span>
              </label>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: "14px 22px",
            background: "linear-gradient(135deg, #091e3a 0%, #0d2342 100%)",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 16px",
              borderRadius: "6px",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              background: "rgba(15, 23, 42, 0.6)",
              color: "#94a3b8",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={parsedList.length === 0}
            onClick={handleExecuteImport}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 20px",
              borderRadius: "8px",
              border: 0,
              background: parsedList.length > 0 ? "linear-gradient(135deg, #0284c7, #0369a1)" : "#334155",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: "750",
              cursor: parsedList.length > 0 ? "pointer" : "not-allowed",
              boxShadow: parsedList.length > 0 ? "0 4px 14px rgba(2, 132, 199, 0.4)" : "none",
              opacity: parsedList.length > 0 ? 1 : 0.6,
              transition: "all 0.2s",
            }}
          >
            <CheckCircle2 size={16} />
            <span>
              {parsedList.length > 0
                ? `Import ${parsedList.length} Transactions (${money(totalVolume)})`
                : "Import Transactions"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
