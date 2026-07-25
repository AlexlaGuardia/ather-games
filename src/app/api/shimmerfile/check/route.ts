import { NextResponse, type NextRequest } from 'next/server'
import { checkUsername } from '@/lib/accounts/db'
import { readSessionToken, SESSION_COOKIE } from '@/lib/accounts/session'

// Live availability for the username picker's debounced check. Public on purpose (a signed
// -out player types a name before the account exists), and it only ever answers yes/no about
// a name — it never reveals who holds a taken one.
export function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username') ?? ''
  // Your own current name reads as available, so re-submitting it isn't a false "taken".
  const claims = readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)
  const result = checkUsername(username, claims?.user_id)
  return NextResponse.json(
    result.available ? { available: true } : { available: false, reason: result.reason },
    { headers: { 'cache-control': 'no-store' } },
  )
}
