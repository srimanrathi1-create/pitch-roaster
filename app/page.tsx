"use client";

import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";

// ============================================================
// PERSONA DEFINITIONS — must match keys in app/api/roast/route.ts
// ============================================================
const PERSONAS = [
  {
    key: "veteran_vc",
    name: "Veteran VC",
    description: "Surgical, restrained, devastating. Pattern-matches your idea against ten thousand failed companies.",
    emoji: "🎯",
  },
  {
    key: "skeptical_buyer",
    name: "Skeptical Buyer",
    description: "Speaks as the customer you're hoping to sell to. Asks why they'd actually click 'buy'.",
    emoji: "🛒",
  },
  {
    key: "compliance_lawyer",
    name: "Compliance Lawyer",
    description: "Finds the regulatory landmines you didn't know you were standing on.",
    emoji: "⚖️",
  },
  {
    key: "journalist",
    name: "Journalist",
    description: "Asks the uncomfortable questions VCs are too polite to ask. Smells what you're hiding.",
    emoji: "📰",
  },
  {
    key: "shark",
    name: "Shark",
    description: "Cares only about unit economics. CAC, LTV, payback. The math doesn't lie.",
    emoji: "📊",
  },
  {
    key: "comedian",
    name: "Comedian",
    description: "Deadpan, observational, accurate. Finds the absurd in your buzzwords. The roast that hurts because it's true.",
    emoji: "🎤",
  },
] as const;

type PersonaKey = typeof PERSONAS[number]["key"];
type InputMode = "text" | "pdf";

export default function Home() {
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [pitch, setPitch] = useState("");
  const [persona, setPersona] = useState<PersonaKey>("veteran_vc");
  const [roast, setRoast] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // PDF upload state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfExtracting, setPdfExtracting] = useState(false);
  const [pdfText, setPdfText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The actual content we'll send to the roast API:
  // typed text in "text" mode, extracted PDF text in "pdf" mode
  const submissionContent = inputMode === "text" ? pitch : pdfText;
  const submissionContentLength = submissionContent.trim().length;
  const canSubmit = submissionContentLength >= 50 && !loading && !pdfExtracting;

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setRoast("");
    setPdfText("");
    setPdfFile(file);
    setPdfExtracting(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/extract-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to extract PDF.");
      }

      setPdfText(data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process PDF.");
      setPdfFile(null);
    } finally {
      setPdfExtracting(false);
    }
  }

  function clearPdf() {
    setPdfFile(null);
    setPdfText("");
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleRoast() {
    if (submissionContentLength < 50) {
      setError("Please provide at least 50 characters of pitch content.");
      return;
    }

    setError("");
    setRoast("");
    setLoading(true);

    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pitch: submissionContent, persona }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to generate roast.");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response stream available.");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setRoast((prev) => prev + chunk);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // Split roast on the verdict marker
  const VERDICT_MARKER = "---VERDICT-END---";
  let verdictText: string | null = null;
  let restOfRoast: string = roast;

  if (roast.includes(VERDICT_MARKER)) {
    const [verdict, ...rest] = roast.split(VERDICT_MARKER);
    verdictText = verdict
      .replace(/^\*+|\*+$/g, "")
      .replace(/^#{1,6}\s*/gm, "")
      .replace(/\*\*[^*]*VERDICT[^*]*\*\*[:\s]*/i, "")
      .replace(/^VERDICT[:\s]+/i, "")
      .trim();
    restOfRoast = rest.join(VERDICT_MARKER).trim();
  }

  const selectedPersona = PERSONAS.find((p) => p.key === persona)!;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 relative overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(234,88,12,0.08),_transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(220,38,38,0.05),_transparent_50%)] pointer-events-none" />

      <main className="relative px-6 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto">
          {/* Hero */}
          <header className="mb-16 text-center">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-[0.2em] text-orange-500 font-medium">
                For founders with thick skin
              </span>
            </div>
            <h1 className="text-6xl sm:text-7xl font-bold tracking-tight mb-4 bg-gradient-to-b from-zinc-50 to-zinc-400 bg-clip-text text-transparent">
              Prepitch
            </h1>
            <p className="text-zinc-400 text-lg sm:text-xl max-w-xl mx-auto leading-relaxed">
              Brutal feedback on your pitch — before reality gives it.
            </p>
          </header>

          {/* Persona picker */}
          <section className="mb-8">
            <label className="block text-sm font-medium mb-3 text-zinc-300">
              Choose your roaster
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PERSONAS.map((p) => {
                const isSelected = p.key === persona;
                return (
                  <button
                    key={p.key}
                    onClick={() => setPersona(p.key)}
                    disabled={loading}
                    className={`text-left p-3 rounded-lg border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      isSelected
                        ? "border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/10"
                        : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{p.emoji}</span>
                      <span className={`font-medium text-sm ${isSelected ? "text-orange-400" : "text-zinc-100"}`}>
                        {p.name}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 leading-snug line-clamp-2">
                      {p.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Input — tabs for text vs PDF */}
          <section className="mb-8">
            {/* Tabs */}
            <div className="flex gap-1 mb-3 bg-zinc-900/50 border border-zinc-800 rounded-lg p-1 w-fit">
              <button
                onClick={() => setInputMode("text")}
                disabled={loading || pdfExtracting}
                className={`text-sm px-4 py-1.5 rounded-md transition-all disabled:opacity-50 ${
                  inputMode === "text"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Type pitch
              </button>
              <button
                onClick={() => setInputMode("pdf")}
                disabled={loading || pdfExtracting}
                className={`text-sm px-4 py-1.5 rounded-md transition-all disabled:opacity-50 ${
                  inputMode === "pdf"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Upload PDF
              </button>
            </div>

            {/* Text mode */}
            {inputMode === "text" && (
              <>
                <textarea
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  placeholder="Describe your startup, the problem, the solution, the market, traction, team, and ask. The more detail you give, the sharper the roast."
                  className="w-full h-64 bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 resize-none transition-all"
                  disabled={loading}
                />
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-zinc-500">
                    {pitch.length} characters {pitch.length < 50 && pitch.length > 0 && "(min 50)"}
                  </span>
                  <button
                    onClick={handleRoast}
                    disabled={!canSubmit}
                    className="bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-medium px-6 py-2.5 rounded-lg transition-all shadow-lg shadow-orange-600/20 disabled:shadow-none flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Roasting...
                      </>
                    ) : (
                      `Roast Me — ${selectedPersona.name}`
                    )}
                  </button>
                </div>
              </>
            )}

            {/* PDF mode */}
            {inputMode === "pdf" && (
              <>
                {!pdfFile && !pdfExtracting && (
                  <label className="block w-full border-2 border-dashed border-zinc-800 hover:border-orange-500/50 bg-zinc-900/50 rounded-xl p-12 text-center cursor-pointer transition-all">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <div className="text-zinc-400">
                      <div className="text-4xl mb-3">📄</div>
                      <div className="text-base font-medium text-zinc-200 mb-1">
                        Click to upload your pitch deck
                      </div>
                      <div className="text-xs text-zinc-500">
                        PDF only · Max 10MB · Text-based PDFs only (not scanned)
                      </div>
                    </div>
                  </label>
                )}

                {pdfExtracting && (
                  <div className="w-full border border-zinc-800 bg-zinc-900/50 rounded-xl p-12 text-center">
                    <div className="inline-block w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mb-3" />
                    <div className="text-sm text-zinc-300">Extracting text from PDF...</div>
                  </div>
                )}

                {pdfFile && !pdfExtracting && pdfText && (
                  <div className="w-full border border-zinc-800 bg-zinc-900/50 rounded-xl p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="text-2xl flex-shrink-0">📄</div>
                        <div className="min-w-0">
                          <div className="font-medium text-zinc-100 truncate">
                            {pdfFile.name}
                          </div>
                          <div className="text-xs text-zinc-500 mt-0.5">
                            {(pdfFile.size / 1024).toFixed(0)} KB · {pdfText.length.toLocaleString()} characters extracted
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={clearPdf}
                        disabled={loading}
                        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="text-xs text-zinc-500 bg-zinc-950/50 border border-zinc-800 rounded p-3 max-h-32 overflow-y-auto leading-relaxed">
                      {pdfText.slice(0, 500)}
                      {pdfText.length > 500 && "..."}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end mt-4">
                  <button
                    onClick={handleRoast}
                    disabled={!canSubmit}
                    className="bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-medium px-6 py-2.5 rounded-lg transition-all shadow-lg shadow-orange-600/20 disabled:shadow-none flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Roasting...
                      </>
                    ) : (
                      `Roast Me — ${selectedPersona.name}`
                    )}
                  </button>
                </div>
              </>
            )}

            {error && (
              <p className="mt-4 text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-4 py-3">
                {error}
              </p>
            )}
          </section>

          {/* Verdict (highlighted) */}
          {verdictText && (
            <section className="mt-16 mb-8">
              <div className="border-l-4 border-orange-500 pl-6 py-2">
                <div className="text-xs uppercase tracking-widest text-orange-500 mb-2 font-medium flex items-center gap-2">
                  <span>{selectedPersona.emoji}</span>
                  <span>Verdict — {selectedPersona.name}</span>
                </div>
                <p className="text-2xl sm:text-3xl font-medium leading-tight text-zinc-100">
                  {verdictText}
                </p>
              </div>
            </section>
          )}

          {/* Rest of the roast */}
          {restOfRoast && (
            <section className={verdictText ? "" : "mt-16"}>
              <div className="text-zinc-300 leading-relaxed">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h1 className="text-2xl font-bold text-zinc-100 mt-10 mb-4">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-xl font-bold text-zinc-100 mt-10 mb-4">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-lg font-bold text-zinc-100 mt-8 mb-3">{children}</h3>,
                    p: ({ children }) => <p className="mb-5 text-zinc-300">{children}</p>,
                    strong: ({ children }) => <strong className="text-orange-400 font-semibold block mt-6 mb-2 text-base">{children}</strong>,
                    ul: ({ children }) => <ul className="list-disc pl-6 space-y-2 my-4 marker:text-orange-500/60">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-6 space-y-2 my-4 marker:text-orange-500/60">{children}</ol>,
                    li: ({ children }) => <li className="text-zinc-300 pl-1">{children}</li>,
                  }}
                >
                  {restOfRoast}
                </ReactMarkdown>
              </div>
            </section>
          )}

          {/* Footer */}
          <footer className="mt-24 pt-8 border-t border-zinc-900 text-center">
            <p className="text-xs text-zinc-600">
              Built with brutal honesty. Roasts the deck, not the founder.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
