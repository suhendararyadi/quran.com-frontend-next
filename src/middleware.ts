import { NextRequest, NextResponse } from 'next/server';

export default function middleware(req: NextRequest) {
  // Check for ramadan2026 and ramadanchallenge (case-insensitive)
  const { pathname } = req.nextUrl;
  const lowerPathname = pathname.toLowerCase();

  const caseInsensitiveRoutes = ['/ramadan2026', '/ramadanchallenge'];
  const isMatch = caseInsensitiveRoutes.some((route) => lowerPathname.includes(route));

  // If the path contains the target routes (case-insensitive) but is not already fully lowercase
  if (isMatch && pathname !== lowerPathname) {
    const url = req.nextUrl.clone();
    url.pathname = lowerPathname;
    return NextResponse.redirect(url);
  }

  // Continue with any other middleware processing
  return NextResponse.next();
}
