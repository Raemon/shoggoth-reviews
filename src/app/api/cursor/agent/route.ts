import { launchAgent } from '@/features/ai-chat/cursorApi';
import { cursorRoute, optionalText, requireText } from '@/features/ai-chat/cursorRoute';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  return cursorRoute(request, (key) =>
    launchAgent(key, {
      owner: requireText(body, 'owner'),
      repo: requireText(body, 'repo'),
      ref: optionalText(body, 'ref'),
      prUrl: optionalText(body, 'prUrl'),
      prompt: requireText(body, 'prompt'),
      model: optionalText(body, 'model'),
      name: optionalText(body, 'name') ?? 'Human in the Loop',
    }),
  );
}
