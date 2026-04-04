import type { Metadata } from "next";
import { readFileSync } from "fs";
import { join } from "path";

export const metadata: Metadata = {
  title: "Privacy Policy — SuperPulse",
  description:
    "How SuperPulse handles your Instagram and advertising data.",
};

/**
 * Parse a subset of Markdown into React elements.
 * Handles: headings (##/###), bold (**), links, unordered lists, paragraphs,
 * horizontal rules (---), and inline code.
 */
function parseMarkdown(md: string) {
  const lines = md.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;
  let listItems: React.ReactNode[] = [];

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="list-disc pl-6 space-y-2 text-zinc-300">
          {listItems}
        </ul>
      );
      listItems = [];
    }
  }

  function inlineFormat(text: string): React.ReactNode {
    // Bold: **text**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="text-white font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip the H1 title — we render it manually
    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      flushList();
      continue;
    }

    // Horizontal rule
    if (trimmed === "---") {
      flushList();
      elements.push(<hr key={key++} className="border-zinc-800 my-6" />);
      continue;
    }

    // H2
    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={key++} className="text-2xl font-bold text-viridian mt-10 mb-4">
          {trimmed.slice(3)}
        </h2>
      );
      continue;
    }

    // H3
    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={key++} className="text-xl font-semibold text-white mt-8 mb-3">
          {trimmed.slice(4)}
        </h3>
      );
      continue;
    }

    // List item
    if (trimmed.startsWith("- ")) {
      listItems.push(<li key={key++}>{inlineFormat(trimmed.slice(2))}</li>);
      continue;
    }

    // Empty line
    if (trimmed === "") {
      flushList();
      continue;
    }

    // Paragraph
    flushList();
    elements.push(
      <p key={key++} className="text-zinc-300 leading-relaxed">
        {inlineFormat(trimmed)}
      </p>
    );
  }

  flushList();
  return elements;
}

export default function PrivacyPage() {
  const filePath = join(process.cwd(), "docs", "PRIVACY-POLICY.md");
  const raw = readFileSync(filePath, "utf-8");
  const content = parseMarkdown(raw);

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          <span className="text-viridian">Privacy Policy</span>
        </h1>
        <p className="text-zinc-500 mb-10 text-sm">Last updated: 3 April 2026</p>
        <div className="space-y-4">{content}</div>
      </div>
    </div>
  );
}
