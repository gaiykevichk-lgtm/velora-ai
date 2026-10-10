import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { user } from '@/lib/auth';
import { dbAsync } from '@/lib/db';
import { failure, unauthorized } from '@/lib/api';
import { videoStatus } from '@/lib/provider';
export async function GET(req:NextRequest) {
  try { const account=await user(); if(!account) return unauthorized(); const id=req.nextUrl.searchParams.get('id'); if(!z.string().uuid().safeParse(id).success) return NextResponse.json({error:'Invalid run.'},{status:400}); const {rows}=await (await dbAsync()).query<{provider_job_id:string;status:string;result:string}>('SELECT provider_job_id,status,result FROM runs WHERE id=$1 AND user_id=$2 AND mode=\'video\'',[id,account.id]); if(!rows[0]) return NextResponse.json({error:'Run not found.'},{status:404}); if(rows[0].status!=='pending') return NextResponse.json({status:rows[0].status,result:rows[0].result}); const latest=await videoStatus(rows[0].provider_job_id); const status=latest.status==='completed'?'completed':latest.status==='failed'?'failed':'pending'; if(status!=='pending') await (await dbAsync()).query('UPDATE runs SET status=$1,result=$2,error=$3 WHERE id=$4 AND user_id=$5',[status,latest.outputUrl,status==='failed'?'The video provider could not complete this job.':null,id,account.id]); return NextResponse.json({status,result:latest.outputUrl}); } catch(e) {return failure(e);}
}
