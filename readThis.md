INSTRUCTIONS FOR AI
Your role: You are an expert full-stack developer building a production-grade PDF extraction pipeline for an existing offline-first Progressive Web App (PWA). You must:

KNOW THE SYSTEM — Understand the existing architecture before writing any code

READ THE LOGS — Check DEV_LOG.md for what's already built

TEST EVERYTHING — Each feature must be validated with Playwright

MAINTAIN OFFLINE-FIRST — All features must work without internet

USE THE TOOLS — Use the specific libraries and tools listed below

STAY WITHIN BUDGET — Only use free/open-source tools ($0 cost)

DOCUMENT AS YOU GO — Update DEV_LOG.md after each feature

HANDLE 300+ PAGES — Must handle large PDFs efficiently

🔗 REPOSITORIES & TOOLS
Primary Tools (Use These)
Tool	Repository	License	Purpose
LiteDoc	https://github.com/0xovo/LiteDoc	AGPL-3.0	Primary extraction — 100% browser-based, handles scanned PDFs, clean Markdown with structure
unpdf	https://github.com/unjs/unpdf	MIT	Server fallback 1 — Lightweight Node.js PDF extraction with positions
PDFExcavator	https://github.com/hyscaler/pdfexcavator	MIT	Server fallback 2 — Advanced table extraction, character-level precision
markitdown	https://github.com/microsoft/markitdown	MIT	Server fallback 3 — Microsoft's tool, multi-format support
marker	https://github.com/datalab-to/marker	GPL	Final fallback — Highest accuracy, heavy (PyTorch, ~5GB models)
Existing System (Already Built)
Component	Technology	Purpose
Frontend	TanStack Start + React + shadcn/ui	PWA shell
Storage	Dexie.js + IndexedDB	Offline storage
Auth	Supabase	Authentication + profiles
Database	Supabase (PostgreSQL)	Shared content + sync
AI	Transformers.js + T5	On-device summarization
Sync	Custom sync engine	Cross-device progress
Hosting	Render.com	Free tier deployment
🏛️ ARCHITECTURE OVERVIEW
text
┌─────────────────────────────────────────────────────────────────────────────┐
│                     COMPLETE PDF EXTRACTION PIPELINE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    STUDENT UPLOADS PDF                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  TIER 0: LITEdoc (Browser — PRIMARY)                               │    │
│  │  - Runs 100% client-side in the browser                            │    │
│  │  - Uses Tesseract.js for OCR on scanned PDFs                       │    │
│  │  - Returns clean Markdown with:                                    │    │
│  │    ✓ Headings (h1-h6)                                              │    │
│  │    ✓ Paragraphs (properly grouped)                                │    │
│  │    ✓ Tables (GitHub-Flavored Markdown)                           │    │
│  │    ✓ Math (KaTeX-ready)                                           │    │
│  │    ✓ Images (extracted and saved)                                 │    │
│  │    ✓ Reading order (multi-column support)                        │    │
│  │  - Cost: $0 (100% free)                                           │    │
│  │  - License: AGPL-3.0 (free for research/non-commercial)           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                    ┌───────────────┴───────────────┐                       │
│                    ▼                               ▼                       │
│              SUCCESS                          FAILED                        │
│                    │                               │                       │
│                    ▼                               ▼                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  TIER 1: unpdf (Server — FALLBACK 1)                              │    │
│  │  - Node.js library: npm install unpdf                              │    │
│  │  - Extracts text with positional data (x, y, font, size)          │    │
│  │  - Extracts links, images, metadata                               │    │
│  │  - Fast, lightweight, no heavy dependencies                       │    │
│  │  - Cost: $0 (free)                                                │    │
│  │  - License: MIT (commercial-friendly)                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                    ┌───────────────┴───────────────┐                       │
│                    ▼                               ▼                       │
│              SUCCESS                          FAILED                        │
│                    │                               │                       │
│                    ▼                               ▼                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  TIER 2: PDFExcavator (Server — FALLBACK 2)                      │    │
│  │  - Node.js library: npm install pdfexcavator                      │    │
│  │  - Advanced table extraction with confidence scoring              │    │
│  │  - Character-level precision, graphics extraction                 │    │
│  │  - Borderless table detection                                     │    │
│  │  - Cost: $0 (free)                                                │    │
│  │  - License: MIT (commercial-friendly)                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                    ┌───────────────┴───────────────┐                       │
│                    ▼                               ▼                       │
│              SUCCESS                          FAILED                        │
│                    │                               │                       │
│                    ▼                               ▼                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  TIER 3: markitdown (Server — FALLBACK 3)                        │    │
│  │  - Python library: pip install 'markitdown[pdf]'                  │    │
│  │  - Microsoft's production-grade tool                              │    │
│  │  - Supports: PDF, DOCX, XLSX, PPTX, HTML, EPUB                   │    │
│  │  - Good for mixed-format documents                                │    │
│  │  - Cost: $0 (free)                                                │    │
│  │  - License: MIT (commercial-friendly)                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                    ┌───────────────┴───────────────┐                       │
│                    ▼                               ▼                       │
│              SUCCESS                          FAILED                        │
│                    │                               │                       │
│                    ▼                               ▼                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  TIER 4: marker (Server — FINAL FALLBACK)                        │    │
│  │  - Python + PyTorch (heavy)                                       │    │
│  │  - Downloads ~5GB of models (one-time)                           │    │
│  │  - Highest accuracy for complex PDFs:                            │    │
│  │    ✓ Nested tables                                                │    │
│  │    ✓ Scientific formulas                                          │    │
│  │    ✓ Multi-column layouts                                         │    │
│  │    ✓ Forms and complex structures                                 │    │
│  │  - Cost: $0 (free)                                                │    │
│  │  - License: GPL (free for research, commercial requires license)  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  UNIFIED OUTPUT FORMAT                                             │    │
│  │  {                                                                  │    │
│  │    heading: string;        // First h1 or title                    │    │
│  │    lead: string;           // First paragraph                     │    │
│  │    body: string[];         // All remaining paragraphs            │    │
│  │    pull: string;           // Optional pull quote                 │    │
│  │    markdown: string;       // Full Markdown (for rendering)       │    │
│  │    tables: Table[];        // Extracted tables (if any)           │    │
│  │    images: Image[];        // Extracted images (if any)           │    │
│  │    metadata: Metadata;     // Title, author, pages, etc.          │    │
│  │    method: string;         // Which tier succeeded                │    │
│  │  }                                                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  STORE IN:                                                         │    │
│  │  1. IndexedDB (elearn_user_${userId}.downloadedMaterials.content)  │    │
│  │  2. Supabase (materials.content)                                   │    │
│  │  3. Device storage (images)                                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  STUDENT READS OFFLINE                                            │    │
│  │  - Uses react-markdown to render                                   │    │
│  │  - Headings, tables, math, images all work                         │    │
│  │  - AI summary generation works on extracted text                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
📁 FILE STRUCTURE TO BUILD
text
your-project/
├── DEV_LOG.md                    # ← READ THIS FIRST — existing features
├── package.json
├── bun.lock
├── .env                          # Supabase keys (gitignored)
├── .gitignore                    # Add .env, node_modules, dist
│
├── src/
│   ├── components/
│   │   ├── MobileShell.tsx       # Layout with auth gate + offline banner
│   │   ├── RoutePending.tsx      # Loading spinner
│   │   ├── LibrarySearch.tsx     # Command palette search
│   │   ├── PDFUploader.tsx       # NEW: Upload PDF with progress
│   │   ├── ExtractionProgress.tsx # NEW: Progress during extraction
│   │   ├── MarkdownRenderer.tsx  # NEW: Renders Markdown from content
│   │   └── ui/                   # shadcn components
│   │
│   ├── hooks/
│   │   ├── use-auth.tsx          # Supabase auth
│   │   ├── use-downloads.ts      # IndexedDB downloads
│   │   ├── use-activity.ts       # Streak + read tracking
│   │   ├── use-summaries.ts      # AI summaries
│   │   ├── use-sync.ts           # Cross-device sync
│   │   ├── use-storage-quota.ts  # Device storage
│   │   ├── use-ai-model.ts       # AI model download
│   │   └── use-extraction.ts     # NEW: Orchestrates extraction pipeline
│   │
│   ├── lib/
│   │   ├── db.ts                 # Dexie IndexedDB schemas
│   │   ├── supabase.ts           # Supabase client + types
│   │   ├── modules-api.ts        # Supabase queries
│   │   ├── summarize.ts          # Extractive summarizer
│   │   ├── ai-model.ts           # Neural summarization (T5)
│   │   ├── sync.ts               # Sync logic
│   │   └── extraction/           # NEW: Extraction pipeline
│   │       ├── litedoc.ts        # LiteDoc integration (browser)
│   │       ├── unpdf.ts          # unpdf API client
│   │       ├── pdfexcavator.ts   # PDFExcavator API client
│   │       ├── markitdown.ts     # markitdown API client
│   │       ├── marker.ts         # marker API client (optional)
│   │       ├── orchestrator.ts   # Orchestrates all tiers
│   │       ├── content-parser.ts # Parses Markdown → {heading, lead, body}
│   │       └── index.ts          # Public exports
│   │
│   ├── routes/
│   │   ├── __root.tsx            # Root layout + auth provider
│   │   ├── index.tsx             # Onboarding
│   │   ├── login.tsx             # Login page
│   │   ├── signup.tsx            # Signup page
│   │   ├── dashboard.tsx         # Dashboard
│   │   ├── courses.tsx           # Layout
│   │   ├── courses.index.tsx     # Library grid
│   │   ├── courses.$moduleId.tsx # Layout
│   │   ├── courses.$moduleId.index.tsx # Module detail
│   │   ├── courses.$moduleId.read.$docId.tsx # Reader (UPDATED)
│   │   ├── courses.upload.tsx    # NEW: PDF upload page
│   │   ├── summaries.tsx         # AI summaries feed
│   │   ├── progress.tsx          # Progress + streak
│   │   └── profile.tsx           # Settings + storage + sync
│   │
│   ├── server/
│   │   └── api/
│   │       ├── auth/             # Auth endpoints
│   │       ├── modules/          # Module endpoints
│   │       ├── progress/         # Sync endpoints
│   │       └── extract/          # NEW: Extraction endpoints
│   │           ├── unpdf.post.ts
│   │           ├── pdfexcavator.post.ts
│   │           └── markitdown.post.ts
│   │
│   ├── styles.css                # Design tokens + dark mode
│   └── router.tsx                # TanStack Router config
│
├── public/
│   ├── manifest.webmanifest      # PWA manifest
│   ├── sw.js                     # Service worker
│   └── favicon.ico
│
├── supabase/
│   └── migrations/
│       ├── 0001_init.sql
│       ├── 0002_material_content.sql
│       ├── 0003_fix_content_encoding.sql
│       └── 0004_progress_sync.sql
│
├── __tests__/
│   ├── extraction/
│   │   ├── litedoc.test.ts
│   │   ├── unpdf.test.ts
│   │   └── orchestrator.test.ts
│   └── playwright/
│       └── extraction.spec.ts    # Full end-to-end tests
│
└── README.md
📝 RULES FOR AI
Rule 1: Always Read the Context First
Before writing any code, you must:

Read DEV_LOG.md — Understand what's already built

Read package.json — Know existing dependencies

Read relevant existing files — Understand patterns

Check .env.example — Know required environment variables

Rule 2: Test Everything
Every feature must be validated:

typescript
// Example test pattern
describe('PDF Extraction Pipeline', () => {
  it('should extract text from digital PDF', async () => {
    // Test with real PDF
  });
  
  it('should handle scanned PDF with OCR', async () => {
    // Test with scanned PDF
  });
  
  it('should fall back to server when LiteDoc fails', async () => {
    // Test fallback logic
  });
});
Rule 3: Maintain Offline-First
✅ Everything should work offline after initial download

✅ Use IndexedDB for all user data

✅ Cache everything possible

❌ Never require internet for core features

Rule 4: Stay Free
✅ Only use open-source, free tools

✅ No paid APIs (no OpenAI, no Gemini, no AWS)

✅ No tools that require credit card to start

✅ Host on Render.com free tier

Rule 5: Document Everything
After each feature, update DEV_LOG.md with:

markdown
## Feature X: Description

**Status: implemented and verified.**

### What changed
- List of changes

### How it was validated
- Test results

### Problems encountered
- Issues and fixes
Rule 6: Handle Large Files
✅ Must handle 300+ page PDFs

✅ Use streaming/workers for large files

✅ Show progress during extraction

✅ Don't block UI thread

Rule 7: Follow Existing Patterns
✅ Use same import/export patterns

✅ Use same naming conventions

✅ Use same error handling

✅ Use same UI components (shadcn)

🧩 COMPONENTS TO BUILD
Component 1: useExtraction Hook
typescript
// src/hooks/use-extraction.ts

/**
 * Orchestrates the PDF extraction pipeline
 * 
 * Flow:
 * 1. Try LiteDoc (browser)
 * 2. If fails, try unpdf (server)
 * 3. If complex tables, try PDFExcavator (server)
 * 4. If multi-format, try markitdown (server)
 * 5. If all fail, try marker (server, heavy)
 * 6. Convert to { heading, lead, body, pull }
 * 7. Store in IndexedDB + Supabase
 */

export function useExtraction() {
  // Returns:
  // - extract(file, options): Promise<ExtractionResult>
  // - progress: number (0-100)
  // - status: 'idle' | 'loading' | 'success' | 'error'
  // - error: Error | null
  // - method: string | null (which tier succeeded)
}
Component 2: LiteDoc Integration
typescript
// src/lib/extraction/litedoc.ts

/**
 * Extracts PDF via LiteDoc (100% browser-based)
 * 
 * LiteDoc is a self-contained HTML file that does:
 * - PDF parsing with PDF.js
 * - OCR with Tesseract.js (scanned PDFs)
 * - Layout analysis (headings, tables, reading order)
 * - Math detection + rendering
 * - Image extraction
 * 
 * Integration options:
 * 1. Embed via iframe (fastest)
 * 2. Self-contained HTML (standalone)
 * 3. Extract core logic (most integrated)
 */

export async function extractWithLiteDoc(
  file: File
): Promise<{ markdown: string; metadata: Metadata; images: Record<string, string> }> {
  // Option A: Iframe (recommended for quick integration)
  // Open litedoc.xyz or your hosted LiteDoc in iframe
  // Listen for postMessage results
  
  // Option B: Self-contained HTML
  // Load dist/index.html from LiteDoc repo
  // Call extractPDF() function
  
  // Option C: Core logic extraction
  // Copy LiteDoc's core extraction logic into your codebase
}
Component 3: unpdf API Route
typescript
// src/server/api/extract/unpdf.post.ts

import { defineEventHandler, readMultipartFormData } from 'h3';
import { writeFile, unlink } from 'node:fs/promises';
import { extractText, getDocumentProxy } from 'unpdf';

export default defineEventHandler(async (event) => {
  // 1. Get uploaded file
  const formData = await readMultipartFormData(event);
  const file = formData?.find(f => f.name === 'file');
  if (!file) throw createError({ status: 400, message: 'No file uploaded' });

  // 2. Save temporarily
  const tempPath = `/tmp/${Date.now()}.pdf`;
  await writeFile(tempPath, file.data);

  try {
    // 3. Extract with unpdf
    const pdfData = new Uint8Array(file.data);
    const pdf = await getDocumentProxy(pdfData);
    const { totalPages, text } = await extractText(pdf, { mergePages: true });

    // 4. Convert to content format
    const content = parseTextToContent(text);

    return {
      success: true,
      content,
      totalPages,
      method: 'unpdf',
      metadata: await pdf.getMetadata(),
    };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    // 5. Clean up
    await unlink(tempPath);
  }
});

function parseTextToContent(text: string) {
  const lines = text.split('\n').filter(l => l.trim());
  const heading = detectHeading(lines);
  const body = lines.filter(l => !l.startsWith(heading));
  const lead = body[0] || '';
  return { heading, lead, body: body.slice(1), pull: '' };
}

function detectHeading(lines: string[]): string {
  // Detect first line that looks like a heading
  // - ALL CAPS
  // - Starts with # (if already Markdown)
  // - First line if short
  // - etc.
  for (const line of lines) {
    if (line.match(/^#[^#]/)) return line;
    if (line.match(/^[A-Z\s]{10,}$/)) return line;
    if (line.length < 60 && line === line.toUpperCase()) return line;
  }
  return lines[0]?.slice(0, 60) || '';
}
Component 4: PDF Upload UI
tsx
// src/routes/courses.upload.tsx

import { useState } from 'react';
import { useExtraction } from '~/hooks/use-extraction';
import { useAuth } from '~/hooks/use-auth';
import { useDownloads } from '~/hooks/use-downloads';

export default function UploadPage() {
  const { user } = useAuth();
  const { downloadMaterial } = useDownloads();
  const { extract, progress, status, method } = useExtraction();
  const [file, setFile] = useState<File | null>(null);

  const handleUpload = async () => {
    if (!file || !user) return;
    
    const result = await extract(file);
    
    if (result.success) {
      // Store in IndexedDB
      await downloadMaterial({
        id: `upload-${Date.now()}`,
        moduleId: 'personal',
        title: file.name,
        content: result.content,
        method: result.method,
        sizeMb: file.size / 1024 / 1024,
        downloadedAt: new Date(),
      });
      
      toast.success('PDF converted and saved for offline reading!');
    }
  };

  return (
    <div className="container max-w-4xl py-8">
      <h1>Upload PDF</h1>
      <p>Upload a PDF to extract its content for offline reading and AI summarization.</p>
      
      <div className="mt-6 space-y-4">
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
            id="pdf-upload"
          />
          <label htmlFor="pdf-upload" className="cursor-pointer">
            {file ? file.name : 'Drop PDF here or click to browse'}
          </label>
        </div>
        
        {progress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Extracting... ({method || 'LiteDoc'})</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        
        <button
          onClick={handleUpload}
          disabled={!file || status === 'loading'}
          className="w-full"
        >
          {status === 'loading' ? 'Extracting...' : 'Extract PDF'}
        </button>
      </div>
    </div>
  );
}
Component 5: Markdown Renderer
tsx
// src/components/MarkdownRenderer.tsx

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn('prose prose-slate dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Custom components for better styling
          h1: ({ children }) => <h1 className="text-3xl font-bold mt-8 mb-4">{children}</h1>,
          h2: ({ children }) => <h2 className="text-2xl font-semibold mt-6 mb-3">{children}</h2>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full border-collapse border border-border">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-4 py-2 bg-muted text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-4 py-2">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
Component 6: Updated Reader
tsx
// src/routes/courses.$moduleId.read.$docId.tsx

import { useParams } from '@tanstack/react-router';
import { useAuth } from '~/hooks/use-auth';
import { useDownloads } from '~/hooks/use-downloads';
import { useMaterialSummary } from '~/hooks/use-summaries';
import { MarkdownRenderer } from '~/components/MarkdownRenderer';

export default function ReaderPage() {
  const { moduleId, docId } = useParams({ from: '/courses/$moduleId/read/$docId' });
  const { user } = useAuth();
  const { getMaterial, downloadMaterial } = useDownloads();
  const { summary, generateSummary } = useMaterialSummary(moduleId, docId);
  
  const material = getMaterial(moduleId, docId);
  
  // Check if downloaded
  if (!material?.downloaded) {
    return <DownloadGate onDownload={() => downloadMaterial(moduleId, docId)} />;
  }
  
  // Show content (Markdown)
  return (
    <div className="container max-w-4xl py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{material.title}</h1>
        <button onClick={() => generateSummary()} className="btn-secondary">
          Summarise this page
        </button>
      </div>
      
      {/* Render Markdown content */}
      <MarkdownRenderer content={material.content.markdown || material.content.body.join('\n\n')} />
      
      {/* AI Summary */}
      {summary && (
        <div className="mt-8 p-4 bg-muted rounded-lg">
          <h3 className="font-semibold">AI Summary</h3>
          <p>{summary.text}</p>
        </div>
      )}
    </div>
  );
}
🧪 TESTING REQUIREMENTS
Unit Tests
typescript
// __tests__/extraction/orchestrator.test.ts

describe('Extraction Orchestrator', () => {
  it('should try LiteDoc first', async () => {
    const result = await extractPDF(mockFile);
    expect(result.method).toBe('litedoc');
  });

  it('should fall back to unpdf when LiteDoc fails', async () => {
    jest.spyOn(LiteDoc, 'extract').mockRejectedValue(new Error('Failed'));
    const result = await extractPDF(mockFile);
    expect(result.method).toBe('unpdf');
  });

  it('should handle 300+ page PDFs', async () => {
    const largePDF = await loadLargePDF();
    const result = await extractPDF(largePDF);
    expect(result.success).toBe(true);
    expect(result.content.body.length).toBeGreaterThan(100);
  });
});
End-to-End Tests
typescript
// __tests__/playwright/extraction.spec.ts

import { test, expect } from '@playwright/test';

test.describe('PDF Extraction Flow', () => {
  test('should upload and extract a PDF', async ({ page }) => {
    await page.goto('/upload');
    await page.setInputFiles('input[type="file"]', 'fixtures/sample.pdf');
    await page.click('button:has-text("Extract PDF")');
    await expect(page.locator('.extraction-progress')).toBeVisible();
    await expect(page.locator('text=PDF converted')).toBeVisible();
  });

  test('should extract headings and paragraphs correctly', async ({ page }) => {
    await page.goto('/upload');
    await page.setInputFiles('input[type="file"]', 'fixtures/academic-paper.pdf');
    await page.click('button:has-text("Extract PDF")');
    await page.waitForSelector('.markdown-content');
    const heading = await page.locator('h1').first().textContent();
    expect(heading).toBeTruthy();
    const paragraphs = await page.locator('p').count();
    expect(paragraphs).toBeGreaterThan(5);
  });
});
🚀 DEPLOYMENT PLAN
Render.com Free Tier Setup
yaml
# render.yaml
services:
  - type: web
    name: elearn-backend
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: node .output/server/index.mjs
    envVars:
      - key: VITE_SUPABASE_URL
        sync: false
      - key: VITE_SUPABASE_ANON_KEY
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false

  - type: web
    name: elearn-frontend
    runtime: static
    buildCommand: npm run build
    staticPublishPath: .output/public
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
Environment Variables
bash
# .env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
📝 TASK LIST (Prioritized)
PHASE 1: Foundation (Must Have)
Task 1.1: Read DEV_LOG.md and understand existing system

Task 1.2: Install required packages:

bash
npm install unpdf react-markdown remark-gfm remark-math rehype-katex katex
Task 1.3: Create src/lib/extraction/content-parser.ts — converts Markdown → {heading, lead, body}

Task 1.4: Create src/hooks/use-extraction.ts — orchestrates extraction

Task 1.5: Create src/components/MarkdownRenderer.tsx — renders Markdown

Task 1.6: Update reader to use MarkdownRenderer

Task 1.7: Test with real PDFs

PHASE 2: LiteDoc Integration (Primary)
Task 2.1: Download LiteDoc from https://github.com/0xovo/LiteDoc

Task 2.2: Extract LiteDoc's core extraction logic

Task 2.3: Create src/lib/extraction/litedoc.ts

Task 2.4: Integrate LiteDoc into useExtraction

Task 2.5: Test with digital PDFs, scanned PDFs, 300+ page PDFs

PHASE 3: Server Fallbacks
Task 3.1: Create src/server/api/extract/unpdf.post.ts

Task 3.2: Create src/lib/extraction/unpdf.ts (API client)

Task 3.3: Add unpdf as fallback in useExtraction

Task 3.4: Test fallback logic

PHASE 4: PDF Upload UI
Task 4.1: Create src/routes/courses.upload.tsx

Task 4.2: Add upload button to Library

Task 4.3: Add extraction progress UI

Task 4.4: Save extracted content to IndexedDB + Supabase

Task 4.5: Test upload flow

PHASE 5: Advanced Tools (Optional)
Task 5.1: Add PDFExcavator endpoint

Task 5.2: Add markitdown endpoint

Task 5.3: Add marker microservice (heavy, optional)

PHASE 6: Testing & Deployment
Task 6.1: Write unit tests for extraction pipeline

Task 6.2: Write end-to-end tests (Playwright)

Task 6.3: Test with 300+ page PDFs

Task 6.4: Deploy to Render.com

Task 6.5: Test production build

Task 6.6: Update DEV_LOG.md with all features

🔍 VALIDATION CHECKLIST
Before marking a task complete, verify:

TypeScript compiles: npx tsc --noEmit

ESLint passes: npx eslint src/

Tests pass: npm test

Playwright passes: npx playwright test

Offline works: Disable network, refresh, features still work

Large PDFs work: Test with 300+ page PDF

Scanned PDFs work: Test with scanned PDF (OCR)

Performance OK: Extraction < 30 seconds for 300 pages

No console errors: Dev tools console is clean

DEV_LOG.md updated: Feature documented

📚 REFERENCE LINKS
Tools
LiteDoc: https://github.com/0xovo/LiteDoc

unpdf: https://github.com/unjs/unpdf

PDFExcavator: https://github.com/hyscaler/pdfexcavator

markitdown: https://github.com/microsoft/markitdown

marker: https://github.com/datalab-to/marker

Existing System
DEV_LOG.md: Read this first

package.json: Check dependencies

src/lib/db.ts: IndexedDB schemas

src/hooks/: All existing hooks

Documentation
PDF.js: https://mozilla.github.io/pdf.js/

Tesseract.js: https://tesseract.projectnaptha.com/

React Markdown: https://github.com/remarkjs/react-markdown

KaTeX: https://katex.org/

# COMPREHENSIVE PROJECT INSTRUCTION: PDF Extraction Pipeline for Offline-First eLearning PWA

## 🎯 YOUR TASK

You are building a **multi-tier PDF extraction pipeline** for an existing offline-first Progressive Web App. The system must:
- Extract clean, structured content from PDFs (including 300+ page documents)
- Handle scanned PDFs (image-only) with OCR
- Fall back through multiple extraction tools until one succeeds
- Store content offline (IndexedDB) and sync to the cloud (Supabase)
- Cost: $0 (use only free/open-source tools)
- Work 100% offline after initial setup

---

## 📚 WHAT YOU MUST KNOW BEFORE STARTING

### Existing System (Already Built)

The user has a fully functional offline-first PWA with:

**Frontend:** TanStack Start + React 19 + shadcn/ui + Tailwind CSS
**Offline Storage:** Dexie.js + IndexedDB (elearn_user_${userId})
**Auth:** Supabase (email/password, profiles auto-created)
**Database:** Supabase PostgreSQL (modules, materials, read_materials, activity_events, material_summaries)
**AI:** On-device summarization (T5 via transformers.js + extractive fallback)
**Sync:** Cross-device progress sync (IndexedDB ↔ Supabase)
**PWA:** Service worker + manifest (validated against production build)
**Accessibility:** WCAG 2.1 AA (axe-core verified, 0 violations)
**Hosting:** Render.com free tier (planned)

**Key Files to Read First:**
- `DEV_LOG.md` — Complete feature history
- `package.json` — Dependencies
- `src/lib/db.ts` — IndexedDB schemas
- `src/hooks/use-auth.tsx` — Auth pattern
- `src/hooks/use-downloads.ts` — Download pattern
- `src/routes/` — Route structure

**Key Design Decisions (Must Maintain):**
- Offline-first — everything works without internet
- Per-user IndexedDB (elearn_user_${userId})
- Material content stored as JSON: { heading, lead, body[], pull }
- Downloads are device-local, progress syncs across devices
- AI model is downloaded once (opt-in), then runs offline
- Service worker caches static assets for offline access

---

### The Problem

Current pdf.js extraction gives "lumpy" text — no headings, no paragraphs, no structure. This makes reading difficult and AI summarization less effective.

### The Solution

Build a multi-tier extraction pipeline that:
1. Tries LiteDoc first (browser-based, handles scanned PDFs)
2. Falls back to unpdf (server, lightweight)
3. Falls back to PDFExcavator (server, advanced tables)
4. Falls back to markitdown (server, multi-format)
5. Falls back to marker (server, heavy, highest accuracy)

---

## 🛠️ TOOLS TO USE

| Tool | Repository | License | Purpose | When to Use |
|------|------------|---------|---------|-------------|
| **LiteDoc** | https://github.com/0xovo/LiteDoc | AGPL-3.0 | Primary extraction | Always try first (browser) |
| **unpdf** | https://github.com/unjs/unpdf | MIT | Server fallback 1 | When LiteDoc fails |
| **PDFExcavator** | https://github.com/hyscaler/pdfexcavator | MIT | Server fallback 2 | When tables are critical |
| **markitdown** | https://github.com/microsoft/markitdown | MIT | Server fallback 3 | Multi-format documents |
| **marker** | https://github.com/datalab-to/marker | GPL | Final fallback | Complex layouts (use sparingly) |

### Why These Tools?
- **LiteDoc:** 100% browser-based, handles scanned PDFs with OCR, zero server cost, produces structured Markdown
- **unpdf:** Lightweight, MIT license, works in serverless environments, good fallback
- **PDFExcavator:** Best for tables, character-level precision, MIT license
- **markitdown:** Microsoft's tool, wide format support, MIT license
- **marker:** Highest accuracy for complex PDFs, but heavy (GPL)

---

## 🏗️ ARCHITECTURE TO BUILD

### Tier 0: LiteDoc (Browser — PRIMARY)


**Integration Options (pick ONE):**

**Option A: Iframe (Fastest)**
```html
<iframe src="https://your-domain.com/litedoc/index.html" />
<!-- Listen for postMessage results -->
Option B: Self-contained HTML (Standalone)

Download LiteDoc's dist/index.html

Host it in your public/ folder

Open in iframe or new window

Option C: Core Logic Extraction (Most Integrated)

Copy LiteDoc's core extraction logic into your codebase

Calls: PDF.js + Tesseract.js + layout analysis

Returns: Markdown + metadata + images

Tier 1: unpdf (Server — FALLBACK 1)
text
User uploads PDF → Server API → unpdf.extractText() → Markdown
Implementation:

typescript
// src/server/api/extract/unpdf.post.ts
import { extractText, getDocumentProxy } from 'unpdf';

const pdf = await getDocumentProxy(new Uint8Array(fileData));
const { text } = await extractText(pdf, { mergePages: true });
Tier 2: PDFExcavator (Server — FALLBACK 2)
text
User uploads PDF → Server API → PDFExcavator → Markdown + Tables
Implementation:

typescript
// src/server/api/extract/pdfexcavator.post.ts
import pdfexcavator from 'pdfexcavator';

const pdf = await pdfexcavator.open(tempPath);
const tables = await page.extractTables();
const text = await pdf.extractText({ mergePages: true });
Tier 3: markitdown (Server — FALLBACK 3)
text
User uploads PDF → Server API → markitdown CLI → Markdown
Implementation:

bash
pip install 'markitdown[pdf]'
markitdown input.pdf -o output.md
Tier 4: marker (Server — FINAL FALLBACK)
text
User uploads PDF → Server API → marker (Python microservice) → Markdown + JSON
Implementation:

bash
pip install marker-pdf
marker_single input.pdf --use_llm --output_format json
Orchestrator Flow
text
1. User uploads PDF
2. Try LiteDoc (browser)
3. If success → return content
4. If fails → call unpdf API
5. If success → return content
6. If fails → call PDFExcavator API
7. If success → return content
8. If fails → call markitdown API
9. If success → return content
10. If all fail → call marker API (optional)
11. Convert all outputs to: { heading, lead, body, pull, markdown }
12. Store in IndexedDB + Supabase
13. Student reads offline
📁 FILE STRUCTURE TO BUILD
text
src/
├── components/
│   ├── MarkdownRenderer.tsx      # Renders Markdown with tables/math
│   ├── PDFUploader.tsx           # Upload UI with progress
│   ├── ExtractionProgress.tsx    # Progress during extraction
│   └── (existing files unchanged)
│
├── hooks/
│   ├── use-extraction.ts         # NEW: Orchestrates extraction
│   ├── (existing hooks unchanged)
│
├── lib/
│   ├── db.ts                     # UPDATE: Add content field to DownloadedMaterial
│   ├── extraction/
│   │   ├── litedoc.ts            # LiteDoc integration
│   │   ├── unpdf.ts              # unpdf API client
│   │   ├── pdfexcavator.ts       # PDFExcavator API client
│   │   ├── markitdown.ts         # markitdown API client
│   │   ├── marker.ts             # marker API client (optional)
│   │   ├── orchestrator.ts       # Orchestrates all tiers
│   │   ├── content-parser.ts     # Markdown → { heading, lead, body }
│   │   └── index.ts              # Public exports
│   └── (existing files unchanged)
│
├── routes/
│   ├── courses.upload.tsx        # NEW: PDF upload page
│   ├── courses.$moduleId.read.$docId.tsx  # UPDATE: Use MarkdownRenderer
│   └── (existing routes unchanged)
│
├── server/
│   └── api/
│       └── extract/              # NEW: Extraction endpoints
│           ├── unpdf.post.ts
│           ├── pdfexcavator.post.ts
│           └── markitdown.post.ts
│
└── styles.css                   # ADD: Katex styles for math rendering
📝 CODE TO BUILD (Detailed)
1. content-parser.ts
File: src/lib/extraction/content-parser.ts

Purpose: Converts Markdown to your content schema.

Implementation:

typescript
export interface ParsedContent {
  heading: string;
  lead: string;
  body: string[];
  pull: string;
  markdown: string;
  metadata: {
    title?: string;
    author?: string;
    pages?: number;
    method?: string;
  };
  tables?: Table[];
  images?: Image[];
}

export function parseMarkdownToContent(markdown: string): ParsedContent {
  const lines = markdown.split('\n');
  
  // Extract heading (first h1 or ALL CAPS line)
  let heading = '';
  let headingIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('# ')) {
      heading = line.replace('# ', '');
      headingIndex = i;
      break;
    }
    if (line.length < 60 && line === line.toUpperCase() && line.length > 10) {
      heading = line;
      headingIndex = i;
      break;
    }
  }
  
  // If no heading found, use first 60 chars
  if (!heading && lines.length > 0) {
    heading = lines[0].slice(0, 60);
    headingIndex = 0;
  }
  
  // Filter out heading lines from body
  const bodyLines = lines
    .filter((_, i) => i !== headingIndex)
    .filter(l => l.trim().length > 0);
  
  const lead = bodyLines[0] || '';
  const body = bodyLines.slice(1);
  
  return {
    heading,
    lead,
    body,
    pull: extractPullQuote(bodyLines),
    markdown,
    metadata: extractMetadata(markdown),
  };
}

function extractPullQuote(lines: string[]): string {
  // Look for quoted text
  for (const line of lines) {
    if (line.startsWith('> ')) {
      return line.replace('> ', '');
    }
    if (line.startsWith('"') && line.endsWith('"')) {
      return line;
    }
  }
  return '';
}

function extractMetadata(markdown: string): { title?: string; author?: string; pages?: number } {
  // Extract metadata from markdown
  // Look for title: ... or author: ... patterns
  const metadata: { title?: string; author?: string; pages?: number } = {};
  const lines = markdown.split('\n');
  for (const line of lines) {
    if (line.match(/^title:\s*/i)) {
      metadata.title = line.replace(/^title:\s*/i, '').trim();
    }
    if (line.match(/^author:\s*/i)) {
      metadata.author = line.replace(/^author:\s*/i, '').trim();
    }
    if (line.match(/^pages?:\s*/i)) {
      const pages = parseInt(line.replace(/^pages?:\s*/i, ''));
      if (!isNaN(pages)) metadata.pages = pages;
    }
  }
  return metadata;
}
2. litedoc.ts
File: src/lib/extraction/litedoc.ts

Purpose: Integrates LiteDoc for browser-based extraction.

Implementation (Option A — Iframe):

typescript
export interface LiteDocResult {
  markdown: string;
  metadata: {
    title?: string;
    pages: number;
  };
  images: Record<string, string>; // base64
}

export function extractWithLiteDocViaIframe(file: File): Promise<LiteDocResult> {
  return new Promise((resolve, reject) => {
    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.src = '/litedoc/index.html';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    // Listen for results
    const handler = (event: MessageEvent) => {
      if (event.data.type === 'litedoc-result') {
        window.removeEventListener('message', handler);
        document.body.removeChild(iframe);
        resolve(event.data.payload);
      }
      if (event.data.type === 'litedoc-error') {
        window.removeEventListener('message', handler);
        document.body.removeChild(iframe);
        reject(new Error(event.data.error));
      }
    };
    window.addEventListener('message', handler);
    
    // Send file to iframe
    iframe.onload = () => {
      iframe.contentWindow?.postMessage({
        type: 'convert-pdf',
        file: file,
      }, '*');
    };
  });
}
Implementation (Option B — Self-contained HTML):

typescript
export async function extractWithLiteDocStandalone(file: File): Promise<LiteDocResult> {
  // LiteDoc is self-contained — just load it
  // Open in new window or iframe
  const url = URL.createObjectURL(file);
  window.open(`/litedoc/index.html?file=${encodeURIComponent(url)}`, '_blank');
  
  // Wait for result via postMessage
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (event.data.type === 'litedoc-result') {
        window.removeEventListener('message', handler);
        resolve(event.data.payload);
      }
    };
    window.addEventListener('message', handler);
  });
}
Implementation (Option C — Core Logic):

This requires extracting LiteDoc's core extraction logic from its source code. Since LiteDoc is open-source, you can copy the extraction pipeline into your codebase.

3. orchestrator.ts
File: src/lib/extraction/orchestrator.ts

Purpose: Orchestrates all extraction tiers.

Implementation:

typescript
import { extractWithLiteDoc } from './litedoc';
import { parseMarkdownToContent, ParsedContent } from './content-parser';

export interface ExtractionOptions {
  maxPages?: number;       // Limit pages for testing
  forceOCR?: boolean;      // Force OCR on all pages
  method?: 'auto' | 'litedoc' | 'unpdf' | 'pdfexcavator' | 'markitdown' | 'marker';
}

export interface ExtractionResult extends ParsedContent {
  success: boolean;
  method: string;
  timeMs: number;
  pages: number;
  error?: string;
}

export async function extractPDF(
  file: File,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const startTime = performance.now();
  
  // If method is explicitly set, use that
  if (options.method && options.method !== 'auto') {
    return extractWithMethod(file, options.method, options);
  }
  
  // Auto: Try each tier in order
  const methods = ['litedoc', 'unpdf', 'pdfexcavator', 'markitdown', 'marker'];
  
  for (const method of methods) {
    try {
      const result = await extractWithMethod(file, method as any, options);
      if (result.success) {
        return result;
      }
    } catch (error) {
      console.warn(`${method} failed:`, error);
      // Continue to next method
    }
  }
  
  // All methods failed
  return {
    success: false,
    heading: '',
    lead: '',
    body: [],
    pull: '',
    markdown: '',
    metadata: {},
    method: 'none',
    timeMs: performance.now() - startTime,
    pages: 0,
    error: 'All extraction methods failed',
  };
}

async function extractWithMethod(
  file: File,
  method: 'litedoc' | 'unpdf' | 'pdfexcavator' | 'markitdown' | 'marker',
  options: ExtractionOptions
): Promise<ExtractionResult> {
  const startTime = performance.now();
  
  let markdown: string;
  let metadata: any = {};
  let pages = 0;
  
  switch (method) {
    case 'litedoc':
      // Try LiteDoc (browser)
      const result = await extractWithLiteDoc(file);
      markdown = result.markdown;
      metadata = result.metadata;
      pages = metadata.pages || 0;
      break;
      
    case 'unpdf':
      // Call unpdf API
      const formData = new FormData();
      formData.append('file', file);
      const unpdfRes = await fetch('/api/extract/unpdf', {
        method: 'POST',
        body: formData,
      });
      const unpdfData = await unpdfRes.json();
      if (!unpdfData.success) throw new Error(unpdfData.error);
      markdown = unpdfData.markdown;
      metadata = unpdfData.metadata || {};
      pages = unpdfData.totalPages || 0;
      break;
      
    case 'pdfexcavator':
      // Call PDFExcavator API
      // ... similar pattern
      
    case 'markitdown':
      // Call markitdown API
      // ... similar pattern
      
    case 'marker':
      // Call marker API
      // ... similar pattern
  }
  
  // Parse content
  const content = parseMarkdownToContent(markdown);
  
  return {
    success: true,
    ...content,
    method,
    timeMs: performance.now() - startTime,
    pages,
    metadata: { ...metadata, ...content.metadata },
  };
}
4. use-extraction.ts
File: src/hooks/use-extraction.ts

Purpose: React hook for extraction.

Implementation:

typescript
import { useState, useCallback } from 'react';
import { extractPDF, ExtractionOptions, ExtractionResult } from '~/lib/extraction';
import { useAuth } from './use-auth';
import { useDownloads } from './use-downloads';
import { toast } from 'sonner';

export function useExtraction() {
  const { user } = useAuth();
  const { downloadMaterial } = useDownloads();
  const [status, setStatus] = useState<'idle' | 'extracting' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [method, setMethod] = useState<string | null>(null);

  const extract = useCallback(
    async (file: File, options?: ExtractionOptions): Promise<ExtractionResult> => {
      setStatus('extracting');
      setProgress(0);
      setError(null);
      setMethod(null);

      try {
        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setProgress(p => Math.min(p + 5, 90));
        }, 500);

        const result = await extractPDF(file, options);
        clearInterval(progressInterval);
        setProgress(100);

        if (result.success) {
          setStatus('success');
          setResult(result);
          setMethod(result.method);
          toast.success(`PDF extracted using ${result.method}`);
          
          // Auto-download if user logged in
          if (user) {
            await downloadMaterial({
              id: `extracted-${Date.now()}`,
              moduleId: 'personal',
              title: file.name,
              content: {
                heading: result.heading,
                lead: result.lead,
                body: result.body,
                pull: result.pull,
                markdown: result.markdown,
              },
              method: result.method,
              sizeMb: file.size / 1024 / 1024,
              downloadedAt: new Date().toISOString(),
            });
          }
        } else {
          setStatus('error');
          setError(new Error(result.error || 'Extraction failed'));
          toast.error(result.error || 'Extraction failed');
        }

        return result;
      } catch (err) {
        setStatus('error');
        setError(err as Error);
        toast.error((err as Error).message || 'Extraction failed');
        throw err;
      }
    },
    [user, downloadMaterial]
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setResult(null);
    setError(null);
    setMethod(null);
  }, []);

  return {
    extract,
    reset,
    status,
    progress,
    result,
    error,
    method,
    isExtracting: status === 'extracting',
    isSuccess: status === 'success',
    isError: status === 'error',
  };
}
5. MarkdownRenderer.tsx
File: src/components/MarkdownRenderer.tsx

Purpose: Renders Markdown with tables, math, and custom styling.

Implementation:

typescript
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cn } from '~/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  if (!content) {
    return <p className="text-muted-foreground">No content to display</p>;
  }

  return (
    <div className={cn('prose prose-slate dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-4xl font-bold mt-8 mb-4 border-b pb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-semibold mt-6 mb-3">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl font-medium mt-4 mb-2">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="leading-relaxed mb-4">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary pl-4 my-4 italic">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full border-collapse border border-border text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-4 py-2 bg-muted text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-4 py-2">{children}</td>
          ),
          code: ({ children, className }) => {
            const match = /language-(\w+)/.exec(className || '');
            if (match) {
              return (
                <code className="block bg-muted p-4 rounded-lg overflow-x-auto">
                  {children}
                </code>
              );
            }
            return <code className="bg-muted px-1 py-0.5 rounded font-mono text-sm">{children}</code>;
          },
          a: ({ href, children }) => (
            <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <img src={src} alt={alt} className="max-w-full h-auto my-4 rounded-lg" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
6. PDF Upload Page
File: src/routes/courses.upload.tsx

Purpose: PDF upload interface.

Implementation:

typescript
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '~/hooks/use-auth';
import { useExtraction } from '~/hooks/use-extraction';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Progress } from '~/components/ui/progress';
import { toast } from 'sonner';
import { FileUp, Check, AlertCircle, Loader2 } from 'lucide-react';

export default function UploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { extract, status, progress, result, error, method } = useExtraction();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = (selected: File | null) => {
    if (selected && selected.type === 'application/pdf') {
      setFile(selected);
    } else if (selected) {
      toast.error('Please upload a PDF file');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a PDF file');
      return;
    }
    
    if (!user) {
      toast.error('Please sign in to upload files');
      navigate({ to: '/login' });
      return;
    }

    try {
      const result = await extract(file);
      if (result.success) {
        toast.success('PDF processed successfully!');
        // Navigate to the reader
        navigate({
          to: '/courses/personal/read/$docId',
          params: { docId: `extracted-${Date.now()}` }
        });
      }
    } catch (err) {
      // Error handled in hook
    }
  };

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upload PDF</h1>
        <p className="text-muted-foreground">
          Upload a PDF to extract its content for offline reading and AI summarization.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select PDF File</CardTitle>
          <CardDescription>
            Supports digital and scanned PDFs. Large files (300+ pages) are handled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-12 text-center transition-colors',
              dragActive ? 'border-primary bg-primary/5' : 'border-muted',
              'cursor-pointer hover:border-primary/50'
            )}
            onDragEnter={() => setDragActive(true)}
            onDragLeave={() => setDragActive(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const file = e.dataTransfer.files[0];
              handleFileSelect(file);
            }}
            onClick={() => document.getElementById('pdf-upload')?.click()}
          >
            <Input
              id="pdf-upload"
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
            />
            {file ? (
              <div className="space-y-2">
                <FileUp className="h-12 w-12 mx-auto text-primary" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                >
                  Change file
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <FileUp className="h-12 w-12 mx-auto text-muted-foreground" />
                <p>Drop your PDF here or click to browse</p>
                <p className="text-sm text-muted-foreground">PDF files only</p>
              </div>
            )}
          </div>

          {status === 'extracting' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  <Loader2 className="h-4 w-4 inline animate-spin mr-2" />
                  Extracting {method ? `using ${method}...` : '...'}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {status === 'success' && result && (
            <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">
                    Extraction successful!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Method: {result.method} · {result.pages} pages · {result.body.length} paragraphs
                  </p>
                </div>
              </div>
            </div>
          )}

          {status === 'error' && error && (
            <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-700 dark:text-red-400">Extraction failed</p>
                  <p className="text-sm text-muted-foreground">{error.message}</p>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file || status === 'extracting'}
            className="w-full"
            size="lg"
          >
            {status === 'extracting' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <FileUp className="mr-2 h-4 w-4" />
                Extract PDF
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Extraction Pipeline</CardTitle>
          <CardDescription>
            Your PDF will be processed through multiple tools for the best result.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">1. LiteDoc</span>
              <span className="text-muted-foreground">— 100% browser-based, handles scanned PDFs</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">2. unpdf</span>
              <span className="text-muted-foreground">— Server fallback (lightweight)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">3. PDFExcavator</span>
              <span className="text-muted-foreground">— Advanced table extraction</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">4. markitdown</span>
              <span className="text-muted-foreground">— Microsoft's tool (multi-format)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">5. marker</span>
              <span className="text-muted-foreground">— Highest accuracy (heavy, final fallback)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
7. Updated Reader
File: src/routes/courses.$moduleId.read.$docId.tsx

Purpose: Reader with Markdown rendering.

Implementation (key changes):

typescript
// In the reader component, replace the content rendering:

import { MarkdownRenderer } from '~/components/MarkdownRenderer';

// Inside the component, when content is loaded:
return (
  <div className="container max-w-4xl py-8">
    {/* Header */}
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold">{material.title}</h1>
        <p className="text-sm text-muted-foreground">
          {material.moduleTitle} · {material.kind}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => generateSummary()}
          disabled={isGeneratingSummary}
        >
          {isGeneratingSummary ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Summarise this page'
          )}
        </Button>
      </div>
    </div>

    {/* Main content with Markdown */}
    <MarkdownRenderer 
      content={material.content?.markdown || material.content?.body?.join('\n\n') || ''} 
    />

    {/* AI Summary */}
    {summary && (
      <div className="mt-8 p-4 bg-muted rounded-lg border">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          AI Summary
        </h3>
        <p className="text-sm mt-1 text-muted-foreground">
          Generated using {summary.method || 'neural model'}
        </p>
        <p className="mt-2">{summary.text}</p>
      </div>
    )}
  </div>
);
8. API Routes
File: src/server/api/extract/unpdf.post.ts

typescript
import { defineEventHandler, readMultipartFormData } from 'h3';
import { writeFile, unlink, readFile } from 'node:fs/promises';
import { extractText, getDocumentProxy } from 'unpdf';
import { parseMarkdownToContent } from '~/lib/extraction/content-parser';

export default defineEventHandler(async (event) => {
  // Get file
  const formData = await readMultipartFormData(event);
  const file = formData?.find(f => f.name === 'file');
  if (!file) {
    return { success: false, error: 'No file uploaded' };
  }

  const tempPath = `/tmp/${Date.now()}.pdf`;
  await writeFile(tempPath, file.data);

  try {
    // Extract with unpdf
    const pdfData = new Uint8Array(file.data);
    const pdf = await getDocumentProxy(pdfData);
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    const metadata = await pdf.getMetadata();

    // Parse to content format
    const content = parseMarkdownToContent(text);

    return {
      success: true,
      markdown: text,
      totalPages,
      metadata: {
        title: metadata.info?.Title || '',
        author: metadata.info?.Author || '',
      },
      content,
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message || 'Extraction failed',
    };
  } finally {
    await unlink(tempPath);
  }
});
🧪 TESTING INSTRUCTIONS
Unit Tests (vitest)
typescript
// __tests__/extraction/content-parser.test.ts
describe('content-parser', () => {
  it('should extract heading from Markdown', () => {
    const result = parseMarkdownToContent('# Hello World\n\nThis is a test.');
    expect(result.heading).toBe('Hello World');
  });

  it('should extract body paragraphs', () => {
    const result = parseMarkdownToContent('# Hello\n\nParagraph 1\n\nParagraph 2');
    expect(result.body).toHaveLength(2);
  });
});

// __tests__/extraction/orchestrator.test.ts
describe('orchestrator', () => {
  it('should try LiteDoc first', async () => {
    const result = await extractPDF(mockFile);
    expect(result.method).toBe('litedoc');
  });

  it('should fall back on failure', async () => {
    jest.spyOn(litedoc, 'extractWithLiteDoc').mockRejectedValue(new Error('Fail'));
    const result = await extractPDF(mockFile);
    expect(result.method).toBe('unpdf');
  });
});
End-to-End Tests (Playwright)
typescript
// __tests__/playwright/extraction.spec.ts
test('full extraction flow', async ({ page }) => {
  await page.goto('/upload');
  await page.setInputFiles('input[type="file"]', 'fixtures/sample.pdf');
  await page.click('button:has-text("Extract PDF")');
  await expect(page.locator('.extraction-progress')).toBeVisible();
  await expect(page.locator('text=Extraction successful')).toBeVisible({ timeout: 60000 });
  const content = await page.locator('.markdown-content').textContent();
  expect(content?.length).toBeGreaterThan(100);
});
🚀 DEPLOYMENT INSTRUCTIONS
Render.com Setup
Create account: https://render.com (free tier, no credit card)

Connect repository: GitHub

Service 1: Backend + Frontend

Type: Web Service

Build: npm run build

Start: node .output/server/index.mjs

Environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

Service 2: Python Microservices (Optional)

Type: Web Service

Build: pip install -r requirements.txt

Start: python -m api.app

Environment Variables
bash
# Required
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional (for server-side tools)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
✅ VALIDATION CHECKLIST
TypeScript compiles: npx tsc --noEmit

ESLint passes: npx eslint src/

Unit tests pass: npm test

Playwright passes: npx playwright test

Offline works: Disable network, refresh

300+ page PDF works

Scanned PDF works (OCR)

Extraction < 30 seconds for 300 pages

No console errors

DEV_LOG.md updated

📝 FINAL INSTRUCTION
AI, build this complete PDF extraction pipeline. Start by reading the existing system documentation. Follow the architecture. Use the specified tools. Test everything. Document everything. Keep it offline-first and free.

Start with PHASE 1: Foundation (content-parser, use-extraction, MarkdownRenderer). Then proceed through the phases in order.

When you complete each phase, update DEV_LOG.md with what you built and how you validated it.

text

---

## 🎯 HOW TO USE THIS

1. **Copy the entire content above**
2. **Paste it into your AI chat** (Claude, ChatGPT, Cursor, etc.)
3. **The AI will read and execute the instructions**
4. **Wait for the AI to complete the build**

---

## 📊 QUICK REFERENCE CARD

| Phase | What to Build | Files to Create |
|-------|---------------|-----------------|
| **1** | Foundation | content-parser.ts, use-extraction.ts, MarkdownRenderer.tsx |
| **2** | LiteDoc Integration | litedoc.ts, update orchestrator.ts |
| **3** | Server Fallbacks | unpdf.post.ts, pdfexcavator.post.ts, markitdown.post.ts |
| **4** | PDF Upload UI | courses.upload.tsx, PDFUploader.tsx |
| **5** | Advanced Tools | marker integration (optional) |
| **6** | Testing + Deployment | Tests, Render.com setup |

---

**The AI now has everything it needs to build your PDF extraction pipeline. Good luck!**
