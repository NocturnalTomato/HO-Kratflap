function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stringifyLogArg(arg) {
  if (typeof arg === "string") return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

async function runScript(script) {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => {
    logs.push(args.map(stringifyLogArg).join(" "));
  };

  try {
    // Wrapping in an async IIFE lets the submitted script use `return`
    // and `await` while still running through eval() as requested.
    const result = await eval(`(async () => {\n${script}\n})()`);
    return { success: true, result: result === undefined ? null : result, logs };
  } catch (err) {
    return {
      success: false,
      error: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack : null,
      logs,
    };
  } finally {
    console.log = originalLog;
  }
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
    }

    if (!env.AUTH_TOKEN || request.headers.get("X-Auth-Token") !== env.AUTH_TOKEN) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    if (typeof body.script !== "string") {
      return jsonResponse({ error: 'Missing "script" string field' }, 400);
    }

    const outcome = await runScript(body.script);

    return jsonResponse(
      {
        success: outcome.success,
        result: outcome.result ?? null,
        logs: outcome.logs,
        error: outcome.error ?? null,
        stack: outcome.stack ?? null,
        timestamp: new Date().toISOString(),
      },
      outcome.success ? 200 : 500
    );
  },
};
