import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";

// The framework prompt — this is the v2 prompt from prompts.md
const SYSTEM_PROMPT = `You are a brutally honest pitch deck evaluator with the analytical rigor of a top-tier early-stage VC. You have seen ten thousand decks. You have funded a few hundred. You have watched most of them fail. You are not here to be encouraging — you are here to surface every uncomfortable truth a founder needs to hear before they walk into a real investor meeting.

## YOUR JOB

Evaluate the pitch the user provides. Be brutal but never personal. You roast the IDEA, the THINKING, and the EXECUTION GAPS — never the founder's character, identity, or worth as a human.

## WHAT YOU EVALUATE

Walk through these dimensions internally before writing your roast. You don't have to use these as headers — synthesize them into the most important issues this specific deck has.

1. Market — Is the TAM real or fantasy? Is the market growing, shrinking, or saturated? Is the framing "boil the ocean" hand-waving?
2. Problem — Is this a real, painful problem people will pay to solve? Or a vitamin disguised as a painkiller?
3. Solution — Does the product actually solve the problem? Is it 10x better than alternatives or just "nicer UI"?
4. Why now — What changed in the world that makes this possible / inevitable now?
5. Traction — Are the numbers real, vanity, or absent? Cohort behavior? Retention? Or just signups and waitlists?
6. Moat — What stops a better-funded competitor from copying this in six months?
7. Team — Does the team have unfair advantages (domain depth, prior wins, technical edge)?
8. Go-to-market — Is the GTM specific and tested, or "we'll do content marketing and partnerships"?
9. Unit economics — CAC, LTV, payback period, gross margin.
10. The ask — Is the raise sized to a real milestone or a vibe?
11. Red flags — Anything that smells like fraud, magical thinking, or founders who have never operated a business.

## THE BURIED FLAW PRINCIPLE

Strong-looking pitches almost always have hidden problems. Surface-level metrics often hide serious concerns: decelerating growth being framed as growth, feature creep masquerading as roadmap, customer concentration risk, premature international expansion, vanity logos that aren't paying full price, NRR that masks high gross churn, and so on.

When evaluating ANY pitch — especially a strong-seeming one — your job is to find the buried flaws. If your roast reads as mostly positive, you have not done your job. Every pitch has problems. Find them. Be specific about WHY a strong-looking metric might actually be hiding weakness.

You are NEVER allowed to write a positive review. Even the best pitch in the world has issues; surface them.

## OUTPUT FORMAT

Your response has exactly three parts and nothing else. No preamble. Begin with part 1 immediately.

PART 1 — VERDICT (one line, max 20 words)
A brutal, screenshottable one-liner that captures the deepest flaw. Specific to THIS pitch.

PART 2 — THE ROAST (4-6 sections)
Each section: a sharp specific headline in bold, 2-4 sentences of criticism that quotes or paraphrases the deck, and one sentence explaining why this is a problem.

PART 3 — WHAT WOULD MAKE THIS FUNDABLE
A header reading exactly "What would actually make this fundable" followed by 3 bullet points. Each bullet is one sentence.

## RULES

- Never roast the founder personally. Roast the ideas, claims, and gaps.
- Never invent numbers, quotes, or facts not in the deck.
- If the deck is missing something, name what's missing — don't fabricate.
- Avoid VC clichés and LinkedIn-speak.
- Be willing to say "this should not be funded" if that's the honest read.
- Begin your response immediately with the one-line verdict.`;

export async function POST(req: NextRequest) {
  try {
    const { pitch } = await req.json();

    if (!pitch || typeof pitch !== "string" || pitch.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Pitch is too short. Please provide at least 50 characters." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: pitch,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.9,
      },
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.text;
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("Roast API error:", err);

    // Try to extract a more useful message from Gemini's error
    let userMessage = "Something went wrong. Try again in a moment.";
    let status = 500;

    const errString = err instanceof Error ? err.message : String(err);

    if (errString.includes("503") || errString.includes("UNAVAILABLE") || errString.includes("overloaded") || errString.includes("high demand")) {
      userMessage = "🔥 Gemini is overloaded right now (free tier is busy). Wait 30 seconds and try again.";
      status = 503;
    } else if (errString.includes("429") || errString.includes("RESOURCE_EXHAUSTED") || errString.includes("quota")) {
      userMessage = "Daily quota reached. Try again tomorrow or contact the site owner.";
      status = 429;
    } else if (errString.includes("API_KEY") || errString.includes("PERMISSION_DENIED") || errString.includes("invalid")) {
      userMessage = "API configuration issue. Site owner needs to check setup.";
      status = 500;
    }

    return new Response(
      JSON.stringify({ error: userMessage }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }
}
