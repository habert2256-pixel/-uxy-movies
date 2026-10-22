// UXY MOVIES
// Secure admin session verification
import crypto from "crypto";
function send(res, status, data) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(data);
}
function parseCookies(header = "") {
  const cookies = {};
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) {
      cookies[name] = value;
    }
  }
  return cookies;
}
function verifyToken(token) {
  if (
    typeof token !== "string" ||
    !process.env.SESSION_SECRET ||
    token.length > 4096
  ) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) {
    return null;
  }
  try {
    const expectedSignature = crypto
      .createHmac("sha256", process.env.SESSION_SECRET)
      .update(encodedPayload)
      .digest("base64url");
    const actualBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(
      expectedSignature,
      "utf8"
    );
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      return null;
    }
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    );
    if (
      !payload ||
      typeof payload.email !== "string" ||
      !payload.email.trim() ||
      typeof payload.exp !== "number" ||
      !Number.isSafeInteger(payload.exp) ||
      Date.now() >= payload.exp
    ) {
      return null;
    }
    const configuredEmail = process.env.ADMIN_EMAIL;
    if (
      typeof configuredEmail !== "string" ||
      !configuredEmail.trim() ||
      payload.email.toLowerCase() !==
        configuredEmail.trim().toLowerCase()
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, {
      authenticated: false,
      error: "Method not allowed."
    });
  }
  if (!process.env.SESSION_SECRET || !process.env.ADMIN_EMAIL) {
    console.error("Admin authentication is not configured.");
    return send(res, 500, {
      authenticated: false,
      error: "Authentication is not configured."
    });
  }
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies.uxy_admin_session;
  const session = verifyToken(token);
  if (!session) {
    return send(res, 401, {
      authenticated: false,
      error: "Authentication required."
    });
  }
  return send(res, 200, {
    authenticated: true,
    email: session.email
  });
}