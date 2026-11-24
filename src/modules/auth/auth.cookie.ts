import { CookieOptions, Response } from 'express';
import ms from 'ms';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

const ACCESS_PATH = '/';
const REFRESH_PATH = '/api/v1/auth';

const base = (secure: boolean): CookieOptions => ({
  httpOnly: true,
  secure,
  sameSite: 'lax',
});

export function setAccesCookie(res: Response, token: string, ttl: string, secure: boolean) {
  res.cookie(ACCESS_COOKIE, token, {
    ...base(secure),
    path: ACCESS_PATH,
    maxAge: ms(ttl as ms.StringValue),
  });
}

export function clearCookie(res: Response, secure: boolean) {
  res.clearCookie(ACCESS_COOKIE, { ...base(secure), path: ACCESS_PATH });
  res.clearCookie(REFRESH_COOKIE, { ...base(secure), path: REFRESH_PATH });
}
