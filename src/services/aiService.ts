import type { AISettings } from '../types/settings';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: () => void;
  onError: (error: string) => void;
}

const SYSTEM_PROMPT = `You are an expert database assistant integrated into OneDB, a database management tool. You help users with:

1. **SQL Generation**: Write accurate SQL queries based on natural language descriptions
2. **SQL Explanation**: Break down complex SQL queries and explain each part
3. **SQL Optimization**: Suggest performance improvements, index recommendations, and query rewrites
4. **Error Fixing**: Identify and fix SQL syntax errors and logical issues
5. **Database Design**: Advise on schema design, normalization, and best practices

Supported databases: MySQL, PostgreSQL, SQLite, MongoDB, Redis.

Guidelines:
- Always specify which database dialect you're using when writing SQL
- When generating SQL, wrap the final query in a code block with \`\`\`sql
- When generating MongoDB queries, wrap the final query in a code block with \`\`\`json
- Keep explanations concise but informative
- If the user's request is ambiguous, ask clarifying questions
- For Redis, use Redis CLI commands

MongoDB Query Format (MUST follow this exact JSON structure):
\`\`\`json
{"collection": "collection_name", "operation": "find", "filter": {}, "limit": 100}
\`\`\`

Supported MongoDB operations:
- find: {"collection": "...", "operation": "find", "filter": {...}, "limit": 100, "skip": 0}
- insertOne: {"collection": "...", "operation": "insertOne", "document": {...}}
- insertMany: {"collection": "...", "operation": "insertMany", "documents": [{...}, {...}]}
- updateMany: {"collection": "...", "operation": "updateMany", "filter": {...}, "update": {...}}
- deleteMany: {"collection": "...", "operation": "deleteMany", "filter": {...}}
- count: {"collection": "...", "operation": "count", "filter": {...}}
- aggregate: {"collection": "...", "operation": "aggregate", "pipeline": [{...}]}

Format your SQL output like:
\`\`\`sql
SELECT ...
\`\`\`

Respond in the same language as the user's question.`;

export async function chatStream(
  messages: { role: 'user' | 'assistant'; content: string }[],
  settings: AISettings,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  if (!settings.apiKey) {
    callbacks.onError('API Key not configured. Please set your API key in Settings > AI.');
    return;
  }

  if (!settings.enabled) {
    callbacks.onError('AI assistant is disabled. Enable it in Settings > AI.');
    return;
  }

  const baseUrl = settings.baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  const chatMessages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  // Create a timeout that aborts after 60 seconds
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 60000);

  // Combine external signal with timeout signal
  let effectiveSignal: AbortSignal;
  if (signal) {
    // If external signal aborts, also abort timeout
    signal.addEventListener('abort', () => timeoutController.abort());
    effectiveSignal = timeoutController.signal;
  } else {
    effectiveSignal = timeoutController.signal;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: chatMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: 2048,
      }),
      signal: effectiveSignal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      let errorMsg: string;
      try {
        const parsed = JSON.parse(errorBody);
        errorMsg = parsed.error?.message || parsed.message || errorBody;
      } catch {
        errorMsg = errorBody || `HTTP ${response.status}`;
      }
      callbacks.onError(`API Error (${response.status}): ${errorMsg}`);
      return;
    }

    if (!response.body) {
      callbacks.onError('Response body is empty');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            callbacks.onToken(delta);
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }

    callbacks.onComplete();
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (signal?.aborted) return; // User clicked stop - abort() handler already reset state
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('aborted')) {
      callbacks.onError('Request timed out (60s). Please try again.');
    } else {
      callbacks.onError(message.includes('Failed to fetch')
        ? 'Network error. Please check your API base URL and internet connection.'
        : message
      );
    }
  }
}

/** Extract SQL/JSON code blocks from AI response */
export function extractSqlFromResponse(content: string): string | null {
  // Match ```sql ... ```, ```json ... ```, or ``` ... ```
  const codeBlockRegex = /```(?:sql|json)?\s*\n?([\s\S]*?)```/g;
  const matches: string[] = [];
  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const code = match[1].trim();
    if (code) matches.push(code);
  }
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

/** Test API key validity by sending a minimal request */
export async function testApiKey(settings: AISettings): Promise<{ success: boolean; message: string }> {
  if (!settings.apiKey) {
    return { success: false, message: 'API Key is empty' };
  }

  if (!settings.baseUrl) {
    return { success: false, message: 'Base URL is empty' };
  }

  if (!settings.model) {
    return { success: false, message: 'Model is not selected' };
  }

  const baseUrl = settings.baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { success: true, message: '' };
    }

    const errorBody = await response.text().catch(() => '');
    let errorMsg: string;
    try {
      const parsed = JSON.parse(errorBody);
      errorMsg = parsed.error?.message || parsed.message || errorBody;
    } catch {
      errorMsg = errorBody || `HTTP ${response.status}`;
    }

    if (response.status === 401 || response.status === 403) {
      return { success: false, message: errorMsg || 'Invalid API Key' };
    }
    return { success: false, message: `HTTP ${response.status}: ${errorMsg}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('aborted') || message.includes('AbortError')) {
      return { success: false, message: 'Connection timed out (15s)' };
    }
    return { success: false, message: message.includes('Failed to fetch') ? 'Network error' : message };
  }
}
