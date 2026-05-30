export const runtime = 'edge';
import { db } from '../lib/db';
export async function GET(){ return Response.json({ ok: !!db }); }
