#!/usr/bin/env python3
"""
Seed script: creates 25 nodes (2 API trees) in the target workspace.

Usage:
    python3 scripts/seed_flowtree.py [workspace_id]

If workspace_id is omitted a fresh workspace is created and you will be
given the browser DevTools cookie command to load it.
"""
import sys
import json
import urllib.request
import http.cookiejar

BASE = "http://localhost:8000"
WORKSPACE_ID = sys.argv[1] if len(sys.argv) > 1 else None

# ── HTTP helpers ──────────────────────────────────────────────────────────────

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

if WORKSPACE_ID:
    cookie = http.cookiejar.Cookie(
        version=0, name="workspace_id", value=WORKSPACE_ID,
        port=None, port_specified=False,
        domain="localhost", domain_specified=True, domain_initial_dot=False,
        path="/", path_specified=True, secure=False, expires=None,
        discard=False, comment=None, comment_url=None, rest={},
    )
    jar.set_cookie(cookie)


def api(method, path, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    with opener.open(req) as r:
        return json.loads(r.read())


def post(body):
    return api("POST", "/api/nodes", body)


def patch(node_id, body):
    return api("PATCH", f"/api/nodes/{node_id}", body)


def create(value, name, **kw):
    payload = {"value": value, "name": name, **kw}
    return post(payload)["id"]


def link(node_id, left=None, right=None, parent=None):
    body = {}
    if left is not None:
        body["left_child_id"] = left
    if right is not None:
        body["right_child_id"] = right
    if parent is not None:
        body["parent_id"] = parent
    if body:
        patch(node_id, body)


# ── Bootstrap workspace ───────────────────────────────────────────────────────

api("GET", "/api/nodes")  # triggers cookie creation

workspace_id = WORKSPACE_ID or next(
    (c.value for c in jar if c.name == "workspace_id"), None
)

# ── Tree 1: POST /enhance/note/ ───────────────────────────────────────────────

print("Creating POST /enhance/note/ nodes...")

A1 = create(1, "receive_post_request",
            node_role="start",
            description="Entry point for POST /enhance/note/ endpoint",
            owner_team="platform-api",
            http_status_code=200)

A2 = create(2, "validate_user",
            node_role="process",
            description="Authenticate JWT token via auth-service",
            owner_team="auth-team",
            service_method="auth_service.validate_token",
            retry_count=2, timeout_ms=1000, sla_ms=2000)

A3 = create(3, "error_unauthorized",
            node_role="error",
            branch_condition="failure",
            description="Return 401 when token is invalid or expired",
            owner_team="auth-team",
            http_status_code=401,
            error_type="AuthenticationError",
            output_schema={"error": "string", "code": 401})

A4 = create(4, "validate_note_schema",
            node_role="decision",
            branch_condition="success",
            description="Validate request body against NoteCreateRequest schema",
            owner_team="platform-api",
            condition="note.title != null && note.content.length <= 10000",
            input_schema={"title": "string", "content": "string",
                          "tags": ["string"]})

A5 = create(5, "error_invalid_schema",
            node_role="error",
            branch_condition="failure",
            description="Return 422 when body fails schema validation",
            owner_team="platform-api",
            http_status_code=422,
            error_type="ValidationError",
            output_schema={"error": "string", "fields": ["string"]})

A6 = create(6, "validate_content_policy",
            node_role="process",
            branch_condition="success",
            description="Screen note content through moderation service",
            owner_team="trust-safety",
            external_api_call="moderation_service.screen_content",
            timeout_ms=2000, sla_ms=3000)

A7 = create(7, "error_content_rejected",
            node_role="error",
            branch_condition="failure",
            description="Return 400 when content violates policy",
            owner_team="trust-safety",
            http_status_code=400,
            error_type="ContentPolicyViolation",
            output_schema={"error": "string", "reason": "string"})

A8 = create(8, "create_stream_session",
            node_role="process",
            branch_condition="success",
            description="Persist a new stream session record in Postgres",
            owner_team="data-team",
            database_query=(
                "INSERT INTO stream_sessions (note_id, user_id, status) "
                "VALUES (:note_id, :user_id, 'PENDING')"
            ),
            retry_count=3, timeout_ms=500, sla_ms=1000)

A9 = create(9, "error_stream_init_failed",
            node_role="error",
            branch_condition="failure",
            description="Return 503 when session creation fails after retries",
            owner_team="data-team",
            http_status_code=503,
            error_type="DatabaseError",
            output_schema={"error": "string", "retry_after": "int"})

A10 = create(10, "send_to_note_service",
             node_role="process",
             branch_condition="success",
             description="Enqueue note for async AI enhancement via note-service",
             owner_team="note-service-team",
             external_api_call="note_service.enqueue_enhancement",
             service_method="note_service.POST /internal/enhance",
             is_async=True, timeout_ms=3000, sla_ms=5000)

A11 = create(11, "error_note_svc_unavailable",
             node_role="error",
             branch_condition="failure",
             description="Return 503 when note-service is down or queue full",
             owner_team="note-service-team",
             http_status_code=503,
             error_type="ServiceUnavailable",
             output_schema={"error": "string", "retry_after": "int"})

A12 = create(12, "return_stream_id",
             node_role="terminal",
             branch_condition="success",
             description="Return 202 Accepted with stream_id for SSE polling",
             owner_team="platform-api",
             http_status_code=202,
             output_schema={"stream_id": "uuid", "status": "PENDING",
                            "poll_url": "string"})

print(f"  A1={A1} → A12={A12}  ({A12 - A1 + 1} nodes)")

# Link Tree 1
print("Linking POST /enhance/note/ tree...")
link(A1, left=A2)
link(A2, parent=A1,  left=A4,  right=A3)
link(A3, parent=A2)
link(A4, parent=A2,  left=A6,  right=A5)
link(A5, parent=A4)
link(A6, parent=A4,  left=A8,  right=A7)
link(A7, parent=A6)
link(A8, parent=A6,  left=A10, right=A9)
link(A9, parent=A8)
link(A10, parent=A8, left=A12, right=A11)
link(A11, parent=A10)
link(A12, parent=A10)
print("  Tree 1 linked.")

# ── Tree 2: GET /{stream_id}/{note_id}/stream ─────────────────────────────────

print("Creating GET /{stream_id}/{note_id}/stream nodes...")

B1 = create(1, "receive_stream_request",
            node_role="start",
            description="Entry point for GET /{stream_id}/{note_id}/stream SSE endpoint",
            owner_team="platform-api",
            http_status_code=200)

B2 = create(2, "validate_session",
            node_role="decision",
            description="Check session exists and belongs to requesting user",
            owner_team="auth-team",
            service_method="session_service.validate",
            condition="session != null && session.user_id == request.user_id",
            retry_count=1, timeout_ms=500, sla_ms=1000)

B3 = create(3, "error_not_found",
            node_role="error",
            branch_condition="failure",
            description="Return 404 when stream_id or note_id does not exist",
            owner_team="auth-team",
            http_status_code=404,
            error_type="ResourceNotFound",
            output_schema={"error": "string", "code": 404})

B4 = create(4, "check_ownership",
            node_role="decision",
            branch_condition="success",
            description="Verify the authenticated user owns this stream session",
            owner_team="auth-team",
            condition="session.owner_id == auth.user_id",
            service_method="auth_service.check_ownership")

B5 = create(5, "error_forbidden",
            node_role="error",
            branch_condition="failure",
            description="Return 403 when user does not own this stream",
            owner_team="auth-team",
            http_status_code=403,
            error_type="ForbiddenError",
            output_schema={"error": "string", "code": 403})

B6 = create(6, "check_session_status",
            node_role="decision",
            branch_condition="success",
            description=(
                "Route to live SSE stream if session is LIVE, "
                "else serve cached result"
            ),
            owner_team="streaming-team",
            condition="session.status == 'LIVE'",
            service_method="session_service.get_status")

B7 = create(7, "fetch_cached_result",
            node_role="process",
            branch_condition="failure",
            description="Retrieve completed enhancement result from Redis cache",
            owner_team="data-team",
            service_method="cache_service.get_result",
            external_api_call="redis.GET note:result:{note_id}",
            timeout_ms=200, sla_ms=500)

B8 = create(8, "connect_to_stream",
            node_role="process",
            branch_condition="success",
            description="Establish SSE connection and subscribe to note enhancement events",
            owner_team="streaming-team",
            service_method="stream_service.subscribe",
            external_api_call="kafka.subscribe note.events.{stream_id}",
            timeout_ms=5000, sla_ms=8000)

B9 = create(9, "error_internal_server",
            node_role="error",
            branch_condition="failure",
            description="Return 500 when stream connection or Kafka subscribe fails",
            owner_team="streaming-team",
            http_status_code=500,
            error_type="InternalServerError",
            output_schema={"error": "string", "trace_id": "string"})

B10 = create(10, "stream_notes",
             node_role="process",
             branch_condition="success",
             description="Stream enhanced note chunks via SSE until completion or timeout",
             owner_team="streaming-team",
             service_method="stream_service.emit_chunks",
             is_async=True, timeout_ms=60000, sla_ms=30000,
             output_schema={"event": "string", "data": "string", "id": "int"})

B11 = create(11, "error_stream_timeout",
             node_role="error",
             branch_condition="failure",
             description="Return 504 when streaming exceeds SLA timeout",
             owner_team="streaming-team",
             http_status_code=504,
             error_type="StreamTimeout",
             output_schema={"error": "string", "elapsed_ms": "int"})

B12 = create(12, "stream_complete",
             node_role="terminal",
             branch_condition="success",
             description="Send SSE 'done' event and close the connection cleanly",
             owner_team="streaming-team",
             http_status_code=200,
             output_schema={"event": "done", "data": {"status": "COMPLETE"}})

B13 = create(13, "return_cached_response",
             node_role="terminal",
             branch_condition="success",
             description="Return 200 with full cached enhancement result (non-streaming)",
             owner_team="data-team",
             http_status_code=200,
             output_schema={
                 "stream_id": "uuid",
                 "status": "COMPLETE",
                 "result": {"enhanced_content": "string", "tags": ["string"]},
             })

print(f"  B1={B1} → B13={B13}  ({B13 - B1 + 1} nodes)")

# Link Tree 2
print("Linking GET /stream tree...")
link(B1,  left=B2)
link(B2,  parent=B1,  left=B4,  right=B3)
link(B3,  parent=B2)
link(B4,  parent=B2,  left=B6,  right=B5)
link(B5,  parent=B4)
link(B6,  parent=B4,  left=B8,  right=B7)
link(B7,  parent=B6,  left=B13)
link(B13, parent=B7)
link(B8,  parent=B6,  left=B10, right=B9)
link(B9,  parent=B8)
link(B10, parent=B8,  left=B12, right=B11)
link(B11, parent=B10)
link(B12, parent=B10)
print("  Tree 2 linked.")

# ── Summary ───────────────────────────────────────────────────────────────────

print()
print("=" * 60)
print("  25 nodes created across 2 trees")
print(f"  Workspace ID: {workspace_id}")
print("=" * 60)
print()
print("Open DevTools in your browser (F12 → Console) and paste:")
print()
print(f'  document.cookie = "workspace_id={workspace_id}; path=/";')
print()
print("Then press Enter and refresh the page (F5).")
print()
