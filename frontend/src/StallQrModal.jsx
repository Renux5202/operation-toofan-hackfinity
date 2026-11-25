import React, { useState, useEffect } from "react";
import { X, QrCode, Printer, ExternalLink, ShieldCheck, Store } from "lucide-react";
import QRCode from "qrcode";
import { sounds } from "./soundEffects";

export default function StallQrModal({ isOpen = false, onClose = () => {} }) {
  const [bakeryQrDataUrl, setBakeryQrDataUrl] = useState("");
  const [tipQrDataUrl, setTipQrDataUrl] = useState("");

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  const bakeryPayUrl = `${origin}/pay?shop=Fort+Road+Bakery&vpa=bakery.demo@upi&amount=35`;
  const campusTipUrl = `${origin}/tip`;

  useEffect(() => {
    if (isOpen) {
      // Generate clean high-res local QR data URLs immediately on modal open (zero external network latency)
      QRCode.toDataURL(bakeryPayUrl, { width: 220, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } })
        .then(setBakeryQrDataUrl)
        .catch(console.error);

      QRCode.toDataURL(campusTipUrl, { width: 220, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } })
        .then(setTipQrDataUrl)
        .catch(console.error);
    }
  }, [isOpen, bakeryPayUrl, campusTipUrl]);

  if (!isOpen) return null;

  const handlePrint = () => {
    try {
      sounds.playClick();
    } catch {}
    window.print();
  };

  return (
    <div className="sheet-backdrop-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="police-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "720px", width: "95%", background: "#ffffff", borderRadius: "14px", overflow: "hidden" }}
      >
        {/* MODAL HEADER */}
        <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ background: "#0284c7", padding: "6px", borderRadius: "8px" }}>
              <QrCode size={20} className="text-white" />
            </div>
            <div>
              <span style={{ fontSize: "10px", fontWeight: "800", background: "#f59e0b", color: "#000", padding: "2px 6px", borderRadius: "4px" }}>
                EXHIBITION READY · HACKFINITY 2026
              </span>
              <h3 style={{ margin: "3px 0 0", fontSize: "16px", fontWeight: "700" }}>
                Printable Exhibition Standee QRs
              </h3>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              onClick={handlePrint}
              style={{ background: "#334155", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
            >
              <Printer size={14} /> Print QRs
            </button>
            <button
              onClick={onClose}
              style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px" }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {/* QR 1: FORT ROAD BAKERY */}
          <div style={{ border: "2px solid #e2e8f0", borderRadius: "12px", padding: "16px", textAlign: "center", background: "#fafafa" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#dbeafe", color: "#1e40af", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", marginBottom: "10px" }}>
              <Store size={13} />
              <span>SHOP COUNTER QR</span>
            </div>
            <h4 style={{ margin: "0 0 4px", fontSize: "14px", color: "#0f172a" }}>Fort Road Bakery Standee</h4>
            <p style={{ margin: "0 0 12px", fontSize: "11px", color: "#64748b" }}>
              Scan on your mobile phone to launch the Google Pay simulator pre-filled for ₹35.
            </p>

            <div style={{ background: "#ffffff", padding: "10px", borderRadius: "8px", display: "inline-block", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0", minWidth: "160px", minHeight: "160px" }}>
              {bakeryQrDataUrl ? (
                <img
                  src={bakeryQrDataUrl}
                  alt="Fort Road Bakery UPI QR"
                  style={{ width: "160px", height: "160px", display: "block" }}
                />
              ) : (
                <div style={{ width: "160px", height: "160px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "12px" }}>
                  Generating QR...
                </div>
              )}
            </div>

            <div style={{ marginTop: "12px", fontSize: "11px", color: "#334155", background: "#f1f5f9", padding: "7px 10px", borderRadius: "6px", lineHeight: "1.4" }}>
              <span>VPA: <b>bakery.demo@upi</b></span>{" "}
              <span style={{ whiteSpace: "nowrap", color: "#64748b" }}>(Amount: ₹35)</span>
            </div>
            <a
              href={bakeryPayUrl}
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#0284c7", fontWeight: "700", marginTop: "8px", textDecoration: "none" }}
            >
              Open Direct Simulator Link <ExternalLink size={12} />
            </a>
          </div>

          {/* QR 2: ANONYMOUS CAMPUS TIP LINE */}
          <div style={{ border: "2px solid #e2e8f0", borderRadius: "12px", padding: "16px", textAlign: "center", background: "#fafafa" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#d1fae5", color: "#065f46", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", marginBottom: "10px" }}>
              <ShieldCheck size={13} />
              <span>SEC 74 JJ ACT TIP LINE</span>
            </div>
            <h4 style={{ margin: "0 0 4px", fontSize: "14px", color: "#0f172a" }}>Anonymous Campus Tip Line</h4>
            <p style={{ margin: "0 0 12px", fontSize: "11px", color: "#64748b" }}>
              Judges & students can scan with their phone camera to submit an anonymous cash tip to the radar.
            </p>

            <div style={{ background: "#ffffff", padding: "10px", borderRadius: "8px", display: "inline-block", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0", minWidth: "160px", minHeight: "160px" }}>
              {tipQrDataUrl ? (
                <img
                  src={tipQrDataUrl}
                  alt="Campus Anonymous Tip QR"
                  style={{ width: "160px", height: "160px", display: "block" }}
                />
              ) : (
                <div style={{ width: "160px", height: "160px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "12px" }}>
                  Generating QR...
                </div>
              )}
            </div>

            <div style={{ marginTop: "12px", fontSize: "11px", color: "#334155", background: "#f1f5f9", padding: "7px 10px", borderRadius: "6px", lineHeight: "1.4" }}>
              <span>Route: <b style={{ wordBreak: "break-all" }}>{campusTipUrl}</b></span>
            </div>
            <a
              href={campusTipUrl}
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#059669", fontWeight: "700", marginTop: "8px", textDecoration: "none" }}
            >
              Open Tip Portal Direct <ExternalLink size={12} />
            </a>
          </div>
        </div>

        <div style={{ padding: "12px 20px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", fontSize: "11px", color: "#64748b", textAlign: "center" }}>
          💡 <b>Exhibition Tip:</b> Print this dialog or leave the QR codes on your laptop screen for judges to scan with their iPhones/Android phones!
        </div>
      </div>
    </div>
  );
}
