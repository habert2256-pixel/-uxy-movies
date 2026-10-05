// UXY MOVIES
// Secure admin login endpoint

import crypto from "crypto";

function createToken(email) {
  const payload = {
    email,
    exp: Date.now() + 24 * 60 * 60 * 1000
  };

  const encodedPayload = Buffer
    .from(JSON.stringify(payload))
    .toString("base64url");

  const signature = crypto
    .createHmac("sha256", process.env.SESSION_SECRET)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {

    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required."
      });
    }

    const adminEmail =
      process.env.ADMIN_EMAIL;

    const adminPassword =
      process.env.ADMIN_PASSWORD;

    const sessionSecret =
      process.env.SESSION_SECRET;

    if (!adminEmail || !adminPassword || !sessionSecret) {
      console.error(
        "Missing authentication environment variables."
      );

      return res.status(500).json({
        success: false,
        message: "Authentication is not configured."
      });
    }

    if (
      email.trim().toLowerCase() !==
      adminEmail.trim().toLowerCase()
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    if (password !== adminPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const token = createToken(
      adminEmail.trim().toLowerCase()
    );

    res.setHeader(
      "Set-Cookie",
      [
        `uxy_admin_session=${token}`,
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        "Max-Age=86400"
      ].join("; ")
    );

    return res.status(200).json({
      success: true
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Server error."
    });

  }
}