import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { user } from '@/lib/auth';
import { dbAsync } from '@/lib/db';
import { failure, unauthorized } from '@/lib/api';
export async function GET() { try { const account=await user(); if(!account) return unauthorized(); const {rows}=await (await dbAsync()).query('SELECT id,title,mode,created_at FROM workspaces WHERE user_id=$1 ORDER BY created_at DESC LIMIT 60',[account.id]); return NextResponse.json({workspaces:rows}); } catch(e) {return failure(e);} }
export async function POST(req:NextRequest) {
  try { const account=await user(); if(!account) return unauthorized(); const parsed=z.object({mode:z.enum(['text','image','video']),title:z.string().trim().min(1).max(100)}).safeParse(await req.json()); if(!parsed.success) return NextResponse.json({error:'Invalid workspace.'},{status:400}); const id=randomUUID(); await (await dbAsync()).query('INSERT INTO workspaces (id,user_id,mode,title) VALUES ($1,$2,$3,$4)',[id,account.id,parsed.data.mode,parsed.data.title]); return NextResponse.json({workspace:{id,...parsed.data}},{status:201}); } catch(e) {return failure(e);}
}
