import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock import.meta.env before imports
vi.stubEnv('VITE_OPENAI_API_KEY', 'test-key');

import { predictNextWord } from './llmClient';

// Helper to create a mock SSE ReadableStream
function createSSEStream(words: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const word of words) {
        const chunk = `data: {"choices":[{"delta":{"content":"${word}"}}]}\n\n`;
        controller.enqueue(encoder.encode(chunk));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}

function createMockSSEResponse(word: string): Response {
  const stream = createSSEStream([word]);
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

function createMockMultiWordSSEResponse(content: string): Response {
  const stream = createSSEStream([content]);
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('predictNextWord', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls fetch with correct URL and method POST', async () => {
    const mockFetch = vi.fn().mockResolvedValue(createMockSSEResponse('hello'));
    vi.stubGlobal('fetch', mockFetch);

    const controller = new AbortController();
    await predictNextWord(['I', 'want'], controller.signal);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(options.method).toBe('POST');
  });

  it('request body has model gpt-4o-mini, stream true, max_tokens 3, temperature 0', async () => {
    const mockFetch = vi.fn().mockResolvedValue(createMockSSEResponse('hello'));
    vi.stubGlobal('fetch', mockFetch);

    const controller = new AbortController();
    await predictNextWord(['I', 'want'], controller.signal);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.stream).toBe(true);
    expect(body.max_tokens).toBe(3);
    expect(body.temperature).toBe(0);
  });

  it('Authorization header is Bearer test-key', async () => {
    const mockFetch = vi.fn().mockResolvedValue(createMockSSEResponse('hello'));
    vi.stubGlobal('fetch', mockFetch);

    const controller = new AbortController();
    await predictNextWord(['I', 'want'], controller.signal);

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['Authorization']).toBe('Bearer test-key');
  });

  it('returns extracted word from SSE stream', async () => {
    const mockFetch = vi.fn().mockResolvedValue(createMockSSEResponse('world'));
    vi.stubGlobal('fetch', mockFetch);

    const controller = new AbortController();
    const result = await predictNextWord(['hello'], controller.signal);
    expect(result).toBe('world');
  });

  it('returns first word only when response contains multiple words', async () => {
    const mockFetch = vi.fn().mockResolvedValue(createMockMultiWordSSEResponse('going home'));
    vi.stubGlobal('fetch', mockFetch);

    const controller = new AbortController();
    const result = await predictNextWord(['I', 'am'], controller.signal);
    expect(result).toBe('going');
  });

  it('throws on non-200 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(null, { status: 401, statusText: 'Unauthorized' })
    );
    vi.stubGlobal('fetch', mockFetch);

    const controller = new AbortController();
    await expect(predictNextWord(['test'], controller.signal)).rejects.toThrow('OpenAI 401');
  });

  it('respects AbortSignal when aborted before call', async () => {
    const controller = new AbortController();
    controller.abort();

    const mockFetch = vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));
    vi.stubGlobal('fetch', mockFetch);

    await expect(predictNextWord(['test'], controller.signal)).rejects.toThrow();
  });

  it('includes correct system and user messages in body', async () => {
    const mockFetch = vi.fn().mockResolvedValue(createMockSSEResponse('cat'));
    vi.stubGlobal('fetch', mockFetch);

    const controller = new AbortController();
    await predictNextWord(['the', 'big'], controller.signal);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('single most likely next word');
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toContain('the big');
    expect(body.messages[1].content).toContain('___');
  });
});
