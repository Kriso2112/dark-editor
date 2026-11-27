/**
 * DARK WORK BRIDGE — deployment bootstrap.
 *
 * This endpoint is intentionally limited to a health check.
 * It does not expose remote shell, arbitrary code execution, or account
 * management operations. A separate authenticated ChatGPT integration
 * would be required before this Worker could accept management commands.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return Response.json({
        ok: true,
        service: "dark-work-bridge",
        status: "ready",
        purpose: "deployment-bootstrap",
        timestamp: new Date().toISOString()
      }, {
        headers: {
          "Cache-Control": "no-store"
        }
      });
    }

    return Response.json({
      ok: false,
      error: "Not found"
    }, {
      status: 404,
      headers: {
        "Cache-Control": "no-store"
      }
    });
  }
};
