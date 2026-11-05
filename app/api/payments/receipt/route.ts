import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { user } from '@/lib/auth';
import { adminEmails } from '@/lib/admin';
import { dbAsync } from '@/lib/db';
import { deliverPurchaseReceipt } from '@/lib/receipt-delivery';
import { failure } from '@/lib/api';
export const runtime='nodejs';
// Retry delivery only. Never calls fulfillment or touches balances.
export async function POST(req:NextRequest){try{
 const account=await user();if(!account)return NextResponse.json({error:'Sign in required.'},{status:401});
 const input=z.object({method:z.enum(['card','bank']),orderId:z.string().uuid()}).safeParse(await req.json());
 if(!input.success)return NextResponse.json({error:'Invalid order.'},{status:400});
 const {method,orderId}=input.data;const pool=await dbAsync();
 const table=method==='card'?'payment_orders':'bank_orders';
 const order=(await pool.query(`SELECT user_id,status FROM ${table} WHERE id=$1`,[orderId])).rows[0];
 if(!order || (order.user_id!==account.id && !adminEmails().includes(account.email.toLowerCase())))return NextResponse.json({error:'Not found.'},{status:404});
 if(order.status!=='credited')return NextResponse.json({error:'Order is not credited.'},{status:409});
 const reset=await pool.query("UPDATE purchase_receipt_outbox SET state='pending',updated_at=now() WHERE method=$1 AND order_id=$2 AND (state='failed' OR (state='sending' AND updated_at<now()-interval '2 minutes')) AND (first_attempt_at IS NULL OR first_attempt_at>now()-interval '23 hours') RETURNING order_id",[method,orderId]);
 if(!reset.rowCount)return NextResponse.json({error:'Already sent, in progress, or requires delivery review (retry window expired). No new message was sent.'},{status:409});
 return NextResponse.json(await deliverPurchaseReceipt(method,orderId));
}catch(e){return failure(e);}}
