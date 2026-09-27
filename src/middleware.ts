import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(request) {
    const role = request.nextauth.token?.role;
    const path = request.nextUrl.pathname;
    if (path.startsWith("/bank") && role !== "BANK_OFFICIAL") {
      return NextResponse.redirect(new URL(role === "VENDOR" ? "/vendor/mailbox" : "/login", request.url));
    }
    if (path.startsWith("/vendor") && role !== "VENDOR") {
      return NextResponse.redirect(new URL(role === "BANK_OFFICIAL" ? "/bank/mailbox" : "/login", request.url));
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      authorized: ({ token }) => Boolean(token),
    },
  },
);

export const config = {
  matcher: ["/bank/:path*", "/vendor/:path*", "/api/requests/:path*", "/api/uploads/:path*", "/api/banks/:path*"],
};
