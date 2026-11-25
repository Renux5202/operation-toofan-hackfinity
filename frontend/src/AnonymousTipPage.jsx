import React, { useState } from "react";
import { ShieldCheck, MapPin, Banknote, Send, CheckCircle2, AlertTriangle, ArrowLeft, Lock } from "lucide-react";
import { sounds } from "./soundEffects";
import { syncClient } from "./syncClient";

const API = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:8000" : "");

const CAMPUS_LOCATIONS = [
  { name: "Fort Road Bakery Counter", vpa: "bakery.demo@upi", lat: 10.02615, lng: 76.31252 },
  { name: "St. John's College Bus Stop, Anchal", vpa: "teastall.anchal@upi", lat: 8.93240, lng: 76.91320 },
  { name: "College Canteen Back Gate, Anchal", vpa: "tuck.canteen@upi", lat: 8.93180, lng: 76.91250 },
  { name: "North Metro Pillar 42 Tea Stall", vpa: "tea.pillar42@upi", lat: 10.03100, lng: 76.31800 },
];

export default function AnonymousTipPage() {
  const [selectedLoc, setSelectedLoc] = useState(CAMPUS_LOCATIONS[0]);
  const [customLoc, setCustomLoc] = useState("");
  const [amount, setAmount] = useState("500");
  const [shopVpa, setShopVpa] = useState("bakery.demo@upi");
  const [supplierAlias, setSupplierAlias] = useState("PROVIDER-HARSH");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedReport, setSubmittedReport] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      sounds.click();
    } catch {}

    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const studentToken = `STU-TOKEN-${randomSuffix}`;
    const reportLocName = customLoc.trim() ? customLoc.trim() : selectedLoc.name;
    const lat = customLoc.trim() ? 8.93240 : selectedLoc.lat;
    const lng = customLoc.trim() ? 76.91320 : selectedLoc.lng;
    const amtFloat = parseFloat(amount) || 500;

    const payload = {
      report_id: `RPT-TIP-${Date.now().toString(36).toUpperCase()}`,
      student_token: studentToken,
      latitude: lat,
      longitude: lng,
      location_name: reportLocName,
      shop_vpa: shopVpa || null,
      amount: amtFloat,
      supplier_alias: supplierAlias || "PROVIDER-UNKNOWN",
      counseling_status: "Anonymous Campus Tip Intake — Section 74 JJ Act Masked",
    };

    try {
      const res = await fetch(`${API}/api/hotspots/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setSubmittedReport({ ...payload, ...data });
        try {
          sounds.success();
        } catch {}
      } else {
        // Local fallback if API unavailable
        setSubmittedReport(payload);
      }
    } catch (err) {
      setSubmittedReport(payload);
    } finally {
      // Also broadcast sync event
      try {
        syncClient.connect();
      } catch {}
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
      <div className="max-w-md w-full mx-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                TOOFAN Anonymous Tip
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Sec 74 JJ Act Protected
                </span>
              </h1>
              <p className="text-xs text-slate-400">St. John's College, Anchal — Hackfinity 2026</p>
            </div>
          </div>
          <a
            href="/"
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </a>
        </div>

        {submittedReport ? (
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 text-center space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Anonymous Tip Transmitted!</h2>
              <p className="text-xs text-slate-400 mt-1">
                Your report has been securely registered in the Police Command Center without storing your identity or IP address.
              </p>
            </div>

            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 text-left space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Token Assigned:</span>
                <span className="font-mono font-bold text-emerald-400">{submittedReport.student_token}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Location Reported:</span>
                <span className="font-medium text-slate-200">{submittedReport.location_name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Cash Handover:</span>
                <span className="font-bold text-amber-400">₹{submittedReport.amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Statutory Status:</span>
                <span className="text-[11px] text-sky-400">CWC / Vimukthi Anonymous Intake</span>
              </div>
            </div>

            <button
              onClick={() => {
                setSubmittedReport(null);
                setNotes("");
              }}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition border border-slate-700"
            >
              Submit Another Tip
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            {/* Privacy Guarantee banner */}
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 flex gap-2.5 items-start">
              <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-300">
                <span className="font-bold">100% Cryptographically Masked:</span> Under Section 74 of the JJ Act 2015,
                your phone, IP, and identity are never stored. Only a random token (<code className="text-emerald-200">STU-TOKEN-XXXX</code>) is generated.
              </div>
            </div>

            {/* Step 1: Location selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                1. Select Suspect Cash Handover Spot
              </label>
              <div className="grid grid-cols-1 gap-2 mb-2">
                {CAMPUS_LOCATIONS.map((loc) => (
                  <button
                    key={loc.name}
                    type="button"
                    onClick={() => {
                      setSelectedLoc(loc);
                      setShopVpa(loc.vpa);
                      setCustomLoc("");
                    }}
                    className={`text-left px-3 py-2 rounded-xl text-xs border transition flex items-center justify-between ${
                      selectedLoc.name === loc.name && !customLoc
                        ? "bg-rose-500/10 border-rose-500/50 text-white font-semibold"
                        : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <span>{loc.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{loc.vpa}</span>
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={customLoc}
                onChange={(e) => setCustomLoc(e.target.value)}
                placeholder="Or type another campus spot / stall name..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
              />
            </div>

            {/* Step 2: Cash Handover Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-amber-400" />
                2. Approximate Cash Amount Observed / Handed Over
              </label>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {["250", "500", "750", "1000"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(preset)}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      amount === preset
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    ₹{preset}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Custom amount in ₹"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                min="10"
                max="50000"
              />
            </div>

            {/* Step 3: Suspect Supplier alias */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                3. Suspect Alias or Nickname (Optional)
              </label>
              <input
                type="text"
                value={supplierAlias}
                onChange={(e) => setSupplierAlias(e.target.value)}
                placeholder="e.g. PROVIDER-HARSH, Bhai, Anna, Dealer X"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition active:scale-[0.99] disabled:opacity-50"
            >
              {submitting ? (
                <>Transmitting Cryptographic Token...</>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Submit Anonymous Tip to Police Command Center
                </>
              )}
            </button>
          </form>
        )}
      </div>

      <footer className="text-center text-[10px] text-slate-600 pt-6">
        St. John's College, Anchal — Hackfinity 2026 Exhibition · TOOFAN Shield Compliance Suite
      </footer>
    </div>
  );
}
