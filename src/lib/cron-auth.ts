import crypto from 'node:crypto';
import { getCronKey } from '@/lib/db/queries';

function safeCompare(a: string, b: string): boolean {
  return crypto.timingSafeEqual(crypto.createHash('sha256').update(a).digest(),crypto.createHash('sha256').update(b).digest());
}

export async function isAuthorizedCronRequest(request: Request, options: { allowLegacySecret?: boolean } = {}): Promise<boolean> {
  const authorization=request.headers.get('authorization');
  const url=new URL(request.url);
  const token=(authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '') || url.searchParams.get('key')?.trim() || (options.allowLegacySecret ? url.searchParams.get('secret')?.trim() : '');
  if (!token) return false;
  const key=await getCronKey({allowLegacyFallback:Boolean(options.allowLegacySecret)});
  if (key && safeCompare(token,key)) return true;
  return Boolean(options.allowLegacySecret && process.env.CRON_SECRET && safeCompare(token,process.env.CRON_SECRET));
}
