# RASBot — IEEE RAS VIT Chennai RAG Assistant

A deliberately small, Vercel-ready Retrieval-Augmented Generation (RAG) demo for IEEE Robotics and Automation Society information related to VIT Chennai.

## Only 4 code files + this README

```text
ieee-ras-rag-assistant/
├── index.html          # Entire frontend: HTML + CSS + browser JavaScript
├── api/
│   └── chat.js         # Retrieval + prompt construction + Groq LLM call
├── data/
│   └── knowledge.js    # Public-source knowledge records
├── package.json        # Makes the project an ES module + local dev command
└── README.md           # This guide
```

There is deliberately no React, no database, no CSS framework, and no embedding service in v1. The goal is to make every part of RAG visible.

---

## What makes this RAG?

When a user asks a question:

```text
Question
   ↓
BM25-style retriever
   ↓
Top 4 relevant knowledge records
   ↓
Grounded system prompt
   ↓
Groq-hosted LLM
   ↓
Answer with [S1], [S2] source markers
```

The language model does **not** receive the whole knowledge base. `api/chat.js` first retrieves the most relevant records and then augments the prompt with those records. That is the core RAG pattern.

This first version uses a BM25-style lexical retriever rather than embeddings. It keeps the project tiny and requires no vector database. You can later replace only the `retrieve()` function with embeddings + ChromaDB, Pinecone, Qdrant, Supabase pgvector, etc.

---

## 1. Run locally

You need Node.js installed.

Install/sign in to the Vercel CLI if needed:

```bash
npm i -g vercel
```

From this project folder:

```bash
vercel dev
```

The site normally opens at:

```text
http://localhost:3000
```

### Run without an AI key

It still works in **retrieval-only mode**. You can ask a question and see which records were found. This is useful for learning/debugging the RAG retrieval stage.

---

## 2. Turn on generated AI answers

This project uses Groq's OpenAI-compatible chat endpoint and defaults to:

```text
openai/gpt-oss-20b
```

Create a Groq API key, then in local Vercel development add:

```text
GROQ_API_KEY=your_key_here
```

Optional model override:

```text
GROQ_MODEL=openai/gpt-oss-120b
```

Do **not** put the secret API key inside `index.html`. It belongs in a server-side environment variable.

---

## 3. Deploy to Vercel

### Easiest workflow

1. Put this folder in a GitHub repository.
2. Import the repository in Vercel.
3. In the Vercel project, open **Settings → Environment Variables**.
4. Add `GROQ_API_KEY`.
5. Optionally add `GROQ_MODEL`.
6. Redeploy.

No `vercel.json` is required for this structure. Vercel serves `index.html` as the static frontend and treats `api/chat.js` as a serverless function.

---

## 4. How the files work

### `data/knowledge.js`

This is your mini knowledge base. Every record has:

```js
{
  id: "unique-id",
  title: "Human-readable title",
  source: "Source organization/site",
  url: "https://...",
  updated: "When this fact was checked",
  text: "The factual information RAG is allowed to retrieve"
}
```

To teach the assistant something new, add another verified record here.

### `api/chat.js`

This is the brain of the project.

It does four important things:

1. Tokenizes the user's question.
2. Scores every knowledge record with a BM25-style relevance formula.
3. Sends the top records to the LLM as `RETRIEVED CONTEXT`.
4. Returns the model's answer and the exact sources that were retrieved.

Look for these functions:

```js
tokenize()
retrieve()
buildContext()
handler()
```

### `index.html`

Everything visual is here: layout, responsive CSS, chat UI, sample questions, API request, source cards and the small RAG trace shown after every answer.

---

## 5. Public sources currently included

Starter records were prepared from publicly accessible information and checked on 20 September 2026 where applicable:

- VIT Chennai — IEEE Chapters  
  https://chennai.vit.ac.in/campus/chapters/ieeechapters/
- VIT Chennai — Clubs / Technical Chapters  
  https://chennai.vit.ac.in/campus-category/clubs/
- VIT Chennai — Student Chapters / IEEE Student Branch  
  https://chennai.vit.ac.in/student-chapters-2/
- IEEE VIT Chennai Student Branch  
  https://edu.ieee.org/in-vit-chennai/
- IEEE VIT Chennai — Societies  
  https://edu.ieee.org/in-vit-chennai/societies/
- HackVerse: Into the Web — Devfolio  
  https://hackverse-into-the-web.devfolio.co/
- IEEE RAS VIT Chennai Student Chapter — public LinkedIn profile  
  https://www.linkedin.com/company/ieeerasvitc/
- VIT Chennai historical IEEE RAS activity material and VIT robotics-facility pages.

Some records are explicitly marked **historical** so the assistant does not present old coordinators or activities as current information.

---

## 6. Best questions for this starter version

Try:

```text
What is IEEE RAS at VIT Chennai?
What does the chapter focus on?
What happened at HackVerse 2026?
When was the IEEE Student Branch at VIT Chennai started?
Why might a student join IEEE at VIT Chennai?
What robotics and IoT topics has RAS covered historically?
What is the SMARTS lab and is it part of IEEE RAS?
```

If you ask for something not in the knowledge base—such as the current chairperson or next recruitment date—the prompt tells the model to say it does not have verified information rather than make something up.

---

## 7. How to upgrade this to vector RAG later

Keep the frontend exactly the same and replace the current `retrieve()` function.

A larger version can become:

```text
Official webpages / PDFs / event data
            ↓
        text chunks
            ↓
     embedding model
            ↓
 vector DB (Qdrant/Chroma/Pinecone)
            ↓
       top-K chunks
            ↓
          LLM
```

Useful next upgrades:

- automatic website/PDF ingestion
- semantic embeddings
- metadata filters (`event`, `team`, `history`, `projects`)
- admin page for adding documents
- scheduled re-indexing
- conversation history
- source freshness dates
- current-event retrieval from approved club channels

For a first RAG project, however, understand this small version completely before adding those layers.
