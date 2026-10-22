import { v2 as cloudinary } from "cloudinary";

function send(res, status, data) {
  return res.status(status).json(data);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return send(res, 405, {
      success: false,
      error: "Method not allowed."
    });
  }

  try {
    const host =
      req.headers["x-forwarded-host"] ||
      req.headers.host;

    if (!host) {
      return send(res, 401, {
        success: false,
        error: "Authentication required."
      });
    }

    const protocol =
      req.headers["x-forwarded-proto"] || "https";

    const authResponse = await fetch(
      `${protocol}://${host}/api/auth`,
      {
        method: "GET",
        headers: {
          cookie: req.headers.cookie || ""
        }
      }
    );

    if (!authResponse.ok) {
      return send(res, 401, {
        success: false,
        error: "Admin authentication required."
      });
    }

    const auth = await authResponse.json();

    if (auth.authenticated !== true) {
      return send(res, 401, {
        success: false,
        error: "Admin authentication required."
      });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return send(res, 500, {
        success: false,
        error: "Cloudinary environment variables are missing."
      });
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret
    });

    const timestamp = Math.floor(Date.now() / 1000);

    const params = {
      timestamp,
      folder: "uxy-movies"
    };

    const signature = cloudinary.utils.api_sign_request(
      params,
      apiSecret
    );

    return send(res, 200, {
      success: true,
      timestamp,
      signature,
      folder: "uxy-movies",
      apiKey,
      cloudName
    });

  } catch (error) {
    console.error("Cloudinary signature error:", error);

    return send(res, 500, {
      success: false,
      error: "Could not prepare the upload."
    });
  }
}