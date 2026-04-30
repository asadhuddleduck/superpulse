import { getAnthropic, HAIKU_MODEL } from "@/lib/anthropic";
import {
  type Candidate,
  lookupPostcode,
  postcodeAsCandidate,
  searchNearPostcode,
  searchOpen,
} from "@/lib/places-lookup";

export const UK_POSTCODE_RE =
  /\b([A-PR-UWYZ][A-HK-Y]?\d[A-Z\d]?\s*\d[ABD-HJLNP-UW-Z]{2})\b/i;

export interface ParsedFields {
  bizName: string | null;
  street: string | null;
  locality: string | null;
  postcode: string | null;
}

export interface ParseResult {
  input: string;
  parsed: ParsedFields;
  candidates: Candidate[];
  message?: string;
}

/**
 * Cheap heuristic: take the first 2-4 words before any obvious address marker
 * (numbers, "road", "street", a postcode) as the biz name. Falls back to the
 * whole text if no markers found.
 */
function heuristicBizName(text: string): string {
  const stripped = text.replace(UK_POSTCODE_RE, " ").trim();
  const splitRe = /\b(\d+|road|rd|street|st|avenue|ave|lane|ln|way|close|drive|dr)\b/i;
  const m = splitRe.exec(stripped);
  const head = m ? stripped.slice(0, m.index).trim() : stripped;
  return head.split(/\s+/).slice(0, 4).join(" ").trim() || stripped;
}

interface HaikuFields {
  biz_name: string | null;
  street: string | null;
  locality: string | null;
  postcode: string | null;
}

/**
 * Last-resort LLM extraction. Called only when regex misses or Nominatim
 * returns 0. Cost: ~$0.0001/call, latency ~500ms-1s.
 */
async function llmExtractFields(text: string): Promise<HaikuFields | null> {
  try {
    const client = getAnthropic();
    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `From this UK location description, extract business name, street, locality, and postcode. Respond ONLY with JSON, no other text. Use null for any field you can't determine.

Schema: { "biz_name": string|null, "street": string|null, "locality": string|null, "postcode": string|null }

Input: "${text.replace(/"/g, '\\"')}"`,
        },
      ],
    });

    const block = response.content.find((c) => c.type === "text");
    if (!block || block.type !== "text") return null;
    const raw = block.text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as HaikuFields;
  } catch {
    return null;
  }
}

/**
 * Parse free-form UK location text and return candidate matches.
 *
 * Stack:
 *   1. UK postcode regex
 *   2. postcodes.io lookup (postcode → bbox)
 *   3. Nominatim structured search within bbox
 *   4. Claude Haiku 4.5 fallback when regex misses or Nominatim returns 0
 *   5. Empty path returns retry message
 */
export async function parseLocationInput(text: string): Promise<ParseResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      input: text,
      parsed: { bizName: null, street: null, locality: null, postcode: null },
      candidates: [],
      message: "Type something to find a location.",
    };
  }

  const postcodeMatch = UK_POSTCODE_RE.exec(trimmed);
  let postcode = postcodeMatch ? postcodeMatch[1] : null;
  let pcInfo = postcode ? await lookupPostcode(postcode) : null;
  if (pcInfo) postcode = pcInfo.postcode;

  let bizName = heuristicBizName(trimmed);
  let street: string | null = null;
  let locality: string | null = pcInfo?.district ?? null;

  if (pcInfo) {
    const nearby = await searchNearPostcode(bizName, pcInfo, 5);
    if (nearby.length > 0) {
      return {
        input: text,
        parsed: { bizName, street, locality, postcode },
        candidates: nearby,
      };
    }
  }

  const fields = await llmExtractFields(trimmed);
  if (fields) {
    bizName = fields.biz_name ?? bizName;
    street = fields.street;
    locality = fields.locality ?? locality;
    if (!postcode && fields.postcode) {
      postcode = fields.postcode;
      pcInfo = await lookupPostcode(fields.postcode);
    }

    if (pcInfo) {
      const nearby = await searchNearPostcode(bizName, pcInfo, 5);
      if (nearby.length > 0) {
        return {
          input: text,
          parsed: { bizName, street, locality, postcode },
          candidates: nearby,
        };
      }
    }

    const queryParts = [bizName, street, locality].filter(Boolean);
    if (queryParts.length > 0) {
      const open = await searchOpen(queryParts.join(" "), 5);
      if (open.length > 0) {
        return {
          input: text,
          parsed: { bizName, street, locality, postcode },
          candidates: open,
        };
      }
    }
  }

  if (pcInfo) {
    return {
      input: text,
      parsed: { bizName, street, locality, postcode },
      candidates: [postcodeAsCandidate(pcInfo, bizName)],
      message:
        "Couldn't find that exact business — confirming the postcode area for now. You can rename it after adding.",
    };
  }

  return {
    input: text,
    parsed: { bizName, street, locality, postcode },
    candidates: [],
    message: "Couldn't find that — try adding a street name and postcode.",
  };
}
