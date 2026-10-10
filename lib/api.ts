import { NextResponse } from 'next/server';
import { ConfigurationError } from './provider';
export function failure(error: unknown) {
  if (error instanceof ConfigurationError) return NextResponse.json({error:error.message}, {status:503});
  console.error(error);
  return NextResponse.json({error:'Something went wrong. Please try again.'},{status:500});
}
export const unauthorized = () => NextResponse.json({error:'Sign in to continue.'},{status:401});
