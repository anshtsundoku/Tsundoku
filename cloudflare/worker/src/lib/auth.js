// Auth / user-identity boundary.
//
// Every route should call `currentUser(env, request)` to discover whose data
// it's acting on, then pass that user's id into queries — never reach for
// "the first user" inline.
//
// Why this layer exists even in single-tenant mode:
//   When we eventually add multi-tenancy via Cloudflare Access (Google email
//   login), Access injects an "Cf-Access-Jwt-Assertion" header on every request.
//   The JWT's `email` claim identifies the requester. The only code that
//   needs to change is this file: parse the JWT, look up the user by email
//   (auto-create on first sight). Every route already calls currentUser, so
//   no other changes are required.
//
// Today: single-tenant. We return the one row in `users` regardless of who's
// asking. The `request` argument is unused but kept in the signature so the
// future swap is mechanical.

import { first } from './db.js';

export async function currentUser(env, _request) {
  // TODO(multi-tenant): replace with JWT parse + user lookup/upsert by email.
  const u = await first(env, `SELECT id, email FROM users LIMIT 1`);
  if (!u) {
    // Schema is bootstrapped during migrate; this only happens if someone
    // wipes the users table manually.
    throw new Error('no user — run migrate:remote');
  }
  return u;
}
