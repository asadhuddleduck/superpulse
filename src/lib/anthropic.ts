import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

/**
 * Lazy proxy for the Anthropic SDK. Defers client creation until first use so
 * routes that don't call Claude don't pay the env-var lookup cost on cold start.
 */
export function getAnthropic(): Anthropic {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY?.trim();
    if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

export const HAIKU_MODEL = "claude-haiku-4-5-20251001";
