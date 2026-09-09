"""Sump request authentication + per-user identity (cor-CORE.FEDERATION-001).

`X-Correlator-Token` was already generated, stored, and sent by the
client on every request since Phase 2/5/6 (`app/lib/auth-token.ts`,
`app/shell.ts`) -- nothing server-side ever checked it before this
module. `require_token` is what closes that gap. `X-Correlator-User-Id`
is new: an opaque, non-secret per-installation label, not a second
authentication factor -- a request already valid under the token is
trusted to state its own user id honestly.
"""

from __future__ import annotations

import hmac

from fastapi import Header, HTTPException, Request, status


def require_token(request: Request, x_correlator_token: str | None = Header(default=None)) -> None:
    """Unset/empty `request.app.state.api_token` means no gate -- as
    permissive as an unreachable-from-the-network Sump already is; this
    only ever tightens a deployment that opted into being reachable.
    `hmac.compare_digest`, not `==`, to avoid a timing side-channel on
    the configured token.
    """
    configured = getattr(request.app.state, "api_token", None)
    if not configured:
        return
    if not x_correlator_token or not hmac.compare_digest(x_correlator_token, configured):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid or missing X-Correlator-Token")


def get_user_id(x_correlator_user_id: str | None = Header(default=None)) -> str | None:
    """The opaque per-installation id a client sends, or `None` if it
    sent none (an older client, or one with no persisted identity yet)."""
    return x_correlator_user_id or None
