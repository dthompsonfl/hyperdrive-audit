'use client';
import { db } from '../lib/db';
export function Client(){ return <button>{String(db)}</button> }
