"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

export default function Home() {
  const [pitch, setPitch] = useState("");
  const [roast, setRoast] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRoast() {
    if (pitch.trim().length < 50) {
      setError("Please enter at least 50 characters of pitch content.");
      return;
    }

    setError("");
    setRoast("");
    setLoading(true);

    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pitch }),
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

// Split roast into verdict (first line/paragraph) and the rest
  function extractVerdict(text: string): { verdict: string | null; rest: string } {
    if (!text) return { verdict: null, rest: text };

    // The verdict is everything before "THE ROAST" or "## THE ROAST" or "**THE ROAST**"
    const roastHeaderMatch = text.match(/(?:\*\*|##\s*)?THE\s+ROAST(?:\*\*)?/i);

    if (!roastHeaderMatch) {
      // No "THE ROAST" header found — can't reliably split
      return { verdict: null, rest: text };
    }

    const splitIndex = roastHeaderMatch.index!;
    let verdict = text.slice(0, splitIndex).trim().replace(/[#*\s]+$/, "").trim();
    const rest = text.slice(splitIndex).trim();

    // Clean up any leading **VERDICT** label if present
    verdict = verdict.replace(/^\*\*[^*]*VERDICT[^*]*\*\*[:\s]*/i, "").trim();
    verdict = verdict.replace(/^#{1,3}\s*VERDICT[^\n]*\n+/i, "").trim();
    verdict = verdict.replace(/^VERDICT[:\s]+/i, "").trim();

    // If verdict is empty or super short, abandon
    if (verdict.length < 10) {
      return { verdict: null, rest: text };
    }

    return { verdict, rest };
  }

  const { verdict: verdictText, rest: restOfRoast } = extractVerdict(roast);

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

          {/* Input */}
          <section className="mb-8">
            <label className="block text-sm font-medium mb-3 text-zinc-300">
              Paste your pitch
            </label>
            <div className="relative">
              <textarea
                value={pitch}
                onChange={(e) => setPitch(e.target.value)}
                placeholder="Describe your startup, the problem, the solution, the market, traction, team, and ask. The more detail you give, the sharper the roast."
                className="w-full h-64 bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 resize-none transition-all"
                disabled={loading}
              />
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-zinc-500">
                {pitch.length} characters {pitch.length < 50 && pitch.length > 0 && "(min 50)"}
              </span>
              <button
                onClick={handleRoast}
                disabled={loading || pitch.trim().length < 50}
                className="bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-medium px-6 py-2.5 rounded-lg transition-all shadow-lg shadow-orange-600/20 disabled:shadow-none flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Roasting...
                  </>
                ) : (
                  "Roast Me"
                )}
              </button>
            </div>
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
                <div className="text-xs uppercase tracking-widest text-orange-500 mb-2 font-medium">
                  Verdict
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
