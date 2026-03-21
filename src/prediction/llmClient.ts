const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const SYSTEM_PROMPT =
  'You complete sentences. Given an incomplete sentence, output only the single most likely next word. No punctuation. No explanation. One word only.';

/**
 * Calls OpenAI chat completions with streaming enabled.
 * Extracts the first non-empty delta.content token from the SSE stream.
 * Returns only the first whitespace-delimited word.
 *
 * @param contextWords - Array of recent context words
 * @param signal - AbortSignal to cancel the request (used for 200ms hard timeout)
 * @returns The predicted next word (first token only)
 */
export async function predictNextWord(
  contextWords: string[],
  signal: AbortSignal
): Promise<string> {
  const prompt = contextWords.join(' ');

  const resp = await fetch(OPENAI_URL, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      stream: true,
      max_tokens: 3,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Complete: "${prompt} ___"` },
      ],
    }),
  });

  if (!resp.ok) {
    throw new Error(`OpenAI ${resp.status}`);
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines
      const lines = buffer.split('\n');
      // Keep the last (potentially incomplete) line in buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice('data: '.length);
        if (data === '[DONE]') break;

        try {
          const chunk = JSON.parse(data);
          const content: string | undefined = chunk.choices?.[0]?.delta?.content;
          if (content && content.trim().length > 0) {
            // Cancel the stream — we have what we need
            await reader.cancel();
            return content.trim().split(/\s+/)[0];
          }
        } catch {
          // Ignore malformed SSE chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  throw new Error('No token received');
}
