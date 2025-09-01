import {NextResponse} from 'next/server'
import {auth as middleware} from '@/auth';

const signInPathName = '/login';

export default middleware((req) => {
    const {nextUrl} = req;

    const isAuthenticated = !!req.auth;

    // Prevent login redirect loop
    if (nextUrl.pathname === signInPathName) return NextResponse.next();
    if (!isAuthenticated) return Response.redirect(new URL(signInPathName, nextUrl));

    return NextResponse.next();
})

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
