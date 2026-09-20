import { KNOWLEDGE_BASE } from "../data/knowledge.js";

const STOP_WORDS = new Set([
  "a","an","and","are","as","at","be","been","but","by","can","do","does","for","from",
  "had","has","have","how","i","in","is","it","its","me","of","on","or","our","so","tell",
  "that","the","their","them","there","this","to","was","we","were","what","when","where",
  "which","who","why","with","would","you","your","about","club","chapter"
]);

function tokenize(value = "") {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.-]+/g, " ")
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length > 1 && !STOP_WORDS.has(token));
}

function buildStats() {
  const docs = KNOWLEDGE_BASE.map(doc => {
    const titleTokens = tokenize(doc.title);
    const bodyTokens = tokenize(doc.text);
    const all = [...titleTokens, ...bodyTokens];
    const tf = new Map();
    for (const token of all) tf.set(token, (tf.get(token) || 0) + 1);
    return { doc, titleTokens, all, tf, length: all.length };
  });

  const df = new Map();
  for (const { tf } of docs) {
    for (const token of tf.keys()) df.set(token, (df.get(token) || 0) + 1);
  }
  const avgLength = docs.reduce((sum, d) => sum + d.length, 0) / Math.max(docs.length, 1);
  return { docs, df, avgLength };
}

const STATS = buildStats();

function retrieve(query, limit = 4) {
  const queryTokens = tokenize(query);
  const uniqueQuery = [...new Set(queryTokens)];
  const N = STATS.docs.length;
  const k1 = 1.35;
  const b = 0.72;

  const scored = STATS.docs.map(item => {
    let score = 0;
    for (const term of uniqueQuery) {
      const freq = item.tf.get(term) || 0;
      if (!freq) continue;
      const docFreq = STATS.df.get(term) || 0;
      const idf = Math.log(1 + (N - docFreq + 0.5) / (docFreq + 0.5));
      const denom = freq + k1 * (1 - b + b * item.length / STATS.avgLength);
      score += idf * ((freq * (k1 + 1)) / denom);

      if (item.titleTokens.includes(term)) score += idf * 0.9;
    }

    const normalizedQuery = query.toLowerCase();
    const normalizedTitle = item.doc.title.toLowerCase();
    if (normalizedQuery.includes("hackverse") && normalizedTitle.includes("hackverse")) score += 5;
    if (normalizedQuery.includes("join") && item.doc.id === "ieee-vitc-vision") score += 2.5;
    if ((normalizedQuery.includes("ras") || normalizedQuery.includes("robotics")) && item.doc.id === "vit-ras-official") score += 1.4;
    if ((normalizedQuery.includes("founded") || normalizedQuery.includes("2018")) && item.doc.id === "ras-linkedin-about") score += 4;
    if ((normalizedQuery.includes("2019") || normalizedQuery.includes("history")) && item.doc.id.startsWith("ras-history")) score += 3;

    return { ...item.doc, score: Number(score.toFixed(3)) };
  });

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function buildContext(results) {
  return results.map((item, index) =>
    `[S${index + 1}] ${item.title}\nSource: ${item.source}\nURL: ${item.url}\nInformation: ${item.text}`
  ).join("\n\n");
}

function fallbackAnswer(results) {
  if (!results.length) {
    return "I couldn't find a close match in the current IEEE RAS VIT Chennai knowledge base. Try asking about the chapter, its purpose, IEEE at VIT Chennai, HackVerse 2026, past robotics activities, or the wider VIT Chennai robotics ecosystem.";
  }

  const bullets = results.slice(0, 3).map((item, i) =>
    `• ${item.title}: ${item.text.split(". ").slice(0, 2).join(". ")}. [S${i + 1}]`
  ).join("\n\n");

  return `The retrieval step found these relevant records:\n\n${bullets}\n\nAdd a GROQ_API_KEY in Vercel to turn this retrieval output into a fully generated conversational answer.`;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "IEEE RAS VIT Chennai RAG API",
      documents: KNOWLEDGE_BASE.length,
      retriever: "BM25-style lexical retrieval",
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b"
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const question = String(req.body?.message || "").trim().slice(0, 1500);
  if (!question) return res.status(400).json({ error: "Please enter a question." });

  const results = retrieve(question, 4);
  const sources = results.map((item, index) => ({
    id: `S${index + 1}`,
    title: item.title,
    source: item.source,
    url: item.url,
    score: item.score,
    updated: item.updated
  }));

  if (!process.env.GROQ_API_KEY) {
    return res.status(200).json({
      answer: fallbackAnswer(results),
      sources,
      mode: "retrieval-only",
      retrieval: { method: "BM25-style lexical retrieval", matched: results.length }
    });
  }

  if (!results.length) {
    return res.status(200).json({
      answer: "I don't have verified information for that in the current IEEE RAS VIT Chennai knowledge base. I can answer questions about the chapter's purpose, IEEE at VIT Chennai, HackVerse 2026, historical robotics activities, and related VIT Chennai robotics context.",
      sources: [],
      mode: "rag",
      retrieval: { method: "BM25-style lexical retrieval", matched: 0 }
    });
  }

  const systemPrompt = `You are RASBot, an informational RAG assistant for the IEEE Robotics and Automation Society (IEEE RAS) at VIT Chennai.

Rules:
1. For facts about IEEE RAS VIT Chennai, use ONLY the RETRIEVED CONTEXT below.
2. Cite factual claims with the matching source marker like [S1] or [S2].
3. Never invent current office-bearers, recruitment dates, event schedules, membership fees, contacts, achievements or statistics.
4. If the requested club-specific fact is not present, clearly say that the current verified knowledge base does not contain it.
5. Distinguish historical information from current information.
6. Be friendly, concise and useful to a VIT Chennai student.
7. Do not output raw URLs; the UI displays source links separately.
8. You may explain general robotics/IEEE concepts when useful, but clearly distinguish general explanation from VIT Chennai-specific facts.

RETRIEVED CONTEXT:\n${buildContext(results)}`;

  try {
    const apiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
        temperature: 0.2,
        max_completion_tokens: 700
      })
    });

    const payload = await apiResponse.json();
    if (!apiResponse.ok) {
      console.error("Groq error:", payload);
      return res.status(502).json({
        error: "The AI model request failed.",
        details: payload?.error?.message || "Unknown Groq API error",
        sources
      });
    }

    const answer = payload?.choices?.[0]?.message?.content?.trim();
    return res.status(200).json({
      answer: answer || fallbackAnswer(results),
      sources,
      mode: "rag",
      retrieval: { method: "BM25-style lexical retrieval", matched: results.length }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Server error while generating the answer.",
      details: error.message,
      sources
    });
  }
}
