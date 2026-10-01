# Authentication QA Report

## Summary

- **Date:** 2026-10-01
- **Environment:** Local production builds at `http://localhost:3000` and `http://localhost:4000`; Google Chrome 154 on macOS; MongoDB adapter enabled.
- **Final result:** 42 passed, 0 failed, 4 blocked, 2 not applicable.
- **Scope:** Better Auth email/password signup and signin, logout, session lifecycle, MongoDB persistence, cookies, protected UI/API behavior, redirects, CORS/trusted origins, logging, and browser console/network behavior.
- **Browser tooling:** The dedicated Chrome browser connector was unavailable. Testing used the installed Google Chrome application through native UI automation, with Chrome DevTools Console and Network panels for diagnostics.

The final counts are based only on executed tests. A case fixed and successfully retested is counted as PASS; its initial failure is recorded in the Actual result and Bugs Fixed sections.

## Configuration Reviewed

- Better Auth `1.7.6` is mounted by Express at `/api/auth/*`.
- Email/password authentication is enabled with an 8-character minimum and 128-character maximum.
- Local storage is selected by `AUTH_STORAGE`; the tested rebuilt runtime used MongoDB.
- The web client sends credentialed requests to the API.
- `/api/v1/me` performs a server-side session check and returns `401` without a valid session.
- `/dashboard` is a client-rendered route that shows only a loading shell until `useSession` succeeds; protected data remains behind authenticated APIs.
- Local cookies are `HttpOnly`, `SameSite=Lax`, `Path=/`, and intentionally omit `Secure` over HTTP. Production configuration requests `Secure` and `SameSite=None`.
- Google OAuth is conditional and was not configured in the tested environment.

## Test Results

| ID | Test | Expected | Actual result | Status |
| --- | --- | --- | --- | --- |
| S01 | Open signup page in Chrome | Form renders with labelled controls | Rendered and keyboard/mouse controls were accessible | PASS |
| S02 | Valid email/password registration | User and session are created | Better Auth returned `200`; user, account, and session records were created | PASS |
| S03 | Submit a brand-new valid account through Chrome | Redirect to dashboard and automatic signin | Final UI account creation was not performed because UI automation requires action-time confirmation for account creation; the same backend flow was executed through the local API | BLOCKED |
| S04 | Session immediately after signup | `/api/v1/me` returns the created user | Returned `200` without exposing password data | PASS |
| S05 | Duplicate email in Chrome | Reject without creating another user | Clear “User already exists” response; database count did not increase | PASS |
| S06 | Empty/missing signup fields | Browser blocks submission | Required-field validation focused the first missing field | PASS |
| S07 | Invalid signup email | Browser or server rejects it clearly | Chrome displayed native email validation | PASS |
| S08 | Seven-character password | Reject below configured minimum | Rejected with “Password too short” | PASS |
| S09 | 129-character password | Reject above configured maximum | Rejected with “Password too long” | PASS |
| S10 | Whitespace-only name | Reject and create no user | Initially accepted by Better Auth after client trimming; fixed with trimmed-name validation, Chrome retest passed, DB count remained zero | PASS |
| S11 | Leading/trailing email whitespace | Normalize before authentication | Initially reached Better Auth as invalid input; fixed by trimming at the form boundary; unit and Chrome duplicate-account retests passed | PASS |
| S12 | Failed signup persistence | No user for a rejected submission | MongoDB query confirmed no user for the rejected whitespace-name case | PASS |
| S13 | Password confirmation mismatch | Test only if field exists | No confirmation field exists | NOT APPLICABLE |
| S14 | Live database outage handling | Form recovers with service-unavailable error | Not induced against the configured shared MongoDB connection to avoid disrupting unrelated local work | BLOCKED |
| I01 | Open signin page in Chrome | Form renders correctly | Rendered with labelled email/password controls and remember-me | PASS |
| I02 | Valid signin | Authenticates correct credentials | Chrome authenticated the dedicated QA user | PASS |
| I03 | Post-signin redirect | Dashboard replaces signin UI immediately | Initially URL changed while signin UI stayed visible; full-page navigation fix retested successfully | PASS |
| I04 | Refresh authenticated dashboard | Session survives refresh | Dashboard and user identity remained available after reload | PASS |
| I05 | Incorrect password | Generic rejection | `401` and “Invalid email or password” | PASS |
| I06 | Nonexistent email | Same generic rejection | Same status and message as incorrect password; no direct user enumeration difference | PASS |
| I07 | Empty signin | Browser blocks submission | Required email validation displayed | PASS |
| I08 | Invalid signin email | Browser rejects invalid syntax | Chrome displayed native email validation | PASS |
| I09 | Password masking and visibility | Mask by default; toggle works | Secure field was masked; Show/Hide toggled correctly | PASS |
| I10 | Error detail safety | No sensitive implementation detail | User-facing errors remained concise and generic | PASS |
| I11 | Remember-me enabled | Persistent cookie is issued | Cookie had `Max-Age=604800` | PASS |
| I12 | Remember-me disabled | Browser-session cookie is issued | Session cookie had no `Max-Age`; Better Auth also issued its no-remember marker | PASS |
| I13 | Loading/duplicate-submit state | Submit is disabled in flight | Chrome observed disabled “Please wait…” state | PASS |
| L01 | Logout redirect and UI update | Signin page appears immediately | Initially dashboard UI stayed visible at the new URL; full-page navigation fix retested successfully | PASS |
| L02 | Refresh after logout | User remains logged out | Signin page remained; session endpoint had no user | PASS |
| L03 | Direct `/dashboard` access signed out | Redirect to signin | Redirected to `/login?redirect=%2Fdashboard` | PASS |
| L04 | Browser Back after logout | Protected dashboard is not restored | Back returned to a public signup page; the replaced dashboard entry was not restored | PASS |
| L05 | Protected API after logout | Reject old/current credentials | `/api/v1/me` returned `401` after logout | PASS |
| L06 | Reuse pre-logout cookie | Revoked token is unusable | Replayed cookie returned `401` | PASS |
| D01 | MongoDB persistence records | User/account/session collections persist | All three collections and expected records were observed without reading secret fields | PASS |
| D02 | Persistence across API restart | Existing account can authenticate after restart | Signin and `/api/v1/me` both returned `200` after restart | PASS |
| D03 | Local cookie attributes | Safe attributes for HTTP development | `HttpOnly; SameSite=Lax; Path=/`; no `Secure`, as expected for local HTTP | PASS |
| D04 | Invalid session | Reject malformed session cookie | `/api/v1/me` returned `401` | PASS |
| D05 | Expired session | Reject past-expiry DB session | QA session expiry was moved to the past; `/api/v1/me` returned `401` | PASS |
| D06 | Client/server session consistency | UI and server agree | Authenticated dashboard matched server session; both became unauthenticated after logout | PASS |
| D07 | Trusted-origin enforcement | Reject mutation from untrusted origin | Signin attempt from an untrusted origin returned `403 Invalid origin` | PASS |
| D08 | CORS exposure | Do not grant an untrusted origin | No `Access-Control-Allow-Origin` header was returned for the untrusted origin | PASS |
| D09 | Backslash open redirect | Unsafe redirect falls back locally | Initially `getSafeRedirect` accepted `/\\host`; fixed with URL-origin validation; Chrome landed on `/dashboard` | PASS |
| D10 | Request/response secret logging | Credentials and session cookies are redacted | Initially response `Set-Cookie` was logged; fixed and live logs showed `[REDACTED]` for request and response credentials | PASS |
| D11 | Protected current-user endpoint | Server authorization is enforced | Authenticated request returned user only; unauthenticated request returned structured `401` | PASS |
| D12 | Chrome console and failed requests | No unexpected app failures | No app runtime errors; expected negative-auth `401` requests and one unrelated Chrome-extension message were observed | PASS |
| D13 | Production cookie behavior | Verify `Secure; SameSite=None` on HTTPS deployment | Configuration was reviewed, but no production HTTPS environment was available | BLOCKED |
| D14 | Natural expiry/renewal timing | Verify renewal over the configured lifetime | Expiry rejection was tested; real-time multi-day renewal was not practical in this run | BLOCKED |
| D15 | Google OAuth | Complete provider redirect/callback | Provider is disabled without local Google credentials; button explains this state | NOT APPLICABLE |

## Bugs Fixed

1. **Stale UI after authentication transitions**
   - **Root cause:** client router replacement updated the URL but could leave the previous client tree rendered during session transitions.
   - **Fix:** successful signin/signup and logout now use `window.location.replace`, forcing a clean session-aware document load.
   - **Retest:** Chrome showed the dashboard immediately after signin and the signin page immediately after logout.

2. **Whitespace-only signup names were persisted**
   - **Root cause:** the UI's `minLength` counted whitespace, then submitted `name.trim()`; Better Auth accepts an empty name string.
   - **Fix:** normalize and require at least two non-whitespace characters before calling Better Auth.
   - **Retest:** Chrome displayed the new validation error and MongoDB contained no matching user.

3. **Surrounding email whitespace was not normalized**
   - **Root cause:** raw email state was sent to Better Auth.
   - **Fix:** trim email addresses for signin and signup in a tested credential-preparation helper.
   - **Retest:** unit tests passed; Chrome normalized the value and reached the expected duplicate-account result.

4. **Backslash-based open redirect**
   - **Root cause:** the redirect guard checked only a leading slash and double slash; browsers normalize `/\\host` as a cross-origin URL.
   - **Fix:** parse against a fixed local base and require the resulting origin to remain local.
   - **Retest:** unit coverage includes absolute, protocol-relative, and backslash forms; Chrome fell back to `/dashboard` for the crafted URL.

5. **Session cookies exposed in HTTP response logs**
   - **Root cause:** logger redaction covered request authorization/cookie headers but not response `Set-Cookie`.
   - **Fix:** redact `res.headers["set-cookie"]` and add a logger regression test.
   - **Retest:** unit test passed and live signin/signout logs contained only `[REDACTED]`. All remaining QA sessions were revoked after testing.

## Remaining Limitations and Security Notes

- `/dashboard` protection is client-side. Its unauthenticated HTML is only a loading shell and no private data is embedded, while `/api/v1/me` is server-protected. Every future dashboard data endpoint must continue to enforce authorization server-side.
- Production HTTPS cookie attributes and Google OAuth need deployment credentials/environment coverage.
- Natural multi-day session renewal and a forced database outage remain untested.
- A brand-new signup was executed through the local API, not submitted through Chrome, because UI account creation requires action-time confirmation. All Chrome signup validation and duplicate-account scenarios were executed.
- Dedicated QA users remain in the local MongoDB database for repeatability; their sessions were revoked.
- This targeted QA run does not prove the authentication system is secure against every attack class.

## Verification Commands

```bash
pnpm --filter @make-my-resume/web test
pnpm --filter @make-my-resume/web typecheck
pnpm --filter @make-my-resume/web lint
pnpm --filter @make-my-resume/api test
pnpm --filter @make-my-resume/api typecheck
pnpm --filter @make-my-resume/api lint
pnpm build
```

The final runs completed with 8 web tests and 5 API tests passing, both application type checks and linters passing, and the production build succeeding.
