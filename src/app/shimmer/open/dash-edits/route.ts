// BETA M247 s2: the Dash tent's PUBLISHED course for every keeper (public read; only the World Builder's publish / roll back on
// map 'dash' writes it: /shimmer/save-builder, owner only). Only the layer's `course` goes out ({ v: 1 } = none published);
// the race (dash-panel -> dash-view) reads it with dash-course cleanCourse and falls back to the fixed course without one.
// Read from disk on each request (never imported, never cached), so a publish races on the next sign-up with no build.
import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { cleanCourse } from '../ather/dash-course'

export const dynamic = 'force-dynamic'
const FILE = join(process.cwd(), 'src/app/shimmer/world/dash-edits.json')

export async function GET() {
  let course = null
  try { course = cleanCourse(JSON.parse(await readFile(FILE, 'utf-8'))) } catch { /* nothing published yet */ }
  return NextResponse.json(course ? { v: 1, course } : { v: 1 }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}
