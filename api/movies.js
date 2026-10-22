// ============================================================
// UXY MOVIES — MOVIES API
// Database: Neon PostgreSQL
//
// GET    /api/movies          Published movies for visitors
// GET    /api/movies?admin=1  All movies (admin only)
// POST   /api/movies          Add movie (admin only)
// PATCH  /api/movies?id=123   Edit movie (admin only)
// DELETE /api/movies?id=123   Delete movie (admin only)
//
// Required environment variables:
// DATABASE_URL
// SESSION_SECRET
// ADMIN_EMAIL
// ============================================================
import { neon } from "@neondatabase/serverless";
const ALLOWED_FIELDS = [
  "title",
  "year",
  "genre",
  "quality",
  "duration",
  "description",
  "poster_url",
  "video_url",
  "download_url",
  "status"
];
function send(res, status, data) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(data);
}
function getBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return null;
    }
  }
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return null;
  }
  return body;
}
function getId(req) {
  const raw = req.query?.id;
  if (
    typeof raw !== "string" &&
    typeof raw !== "number"
  ) {
    return null;
  }
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) {
    return null;
  }
  return id;
}
// Check the existing session through api/auth.js.
async function isAdmin(req) {
  try {
    const host =
      req.headers["x-forwarded-host"] ||
      req.headers.host;
    if (!host) return false;
    const forwardedProtocol =
      req.headers["x-forwarded-proto"];
    const protocol =
      forwardedProtocol === "https" ||
      forwardedProtocol === "http"
        ? forwardedProtocol
        : "https";
    const cookie = req.headers.cookie || "";
    const response = await fetch(
      `${protocol}://${host}/api/auth`,
      {
        method: "GET",
        headers: { cookie },
        redirect: "error"
      }
    );
    if (!response.ok) return false;
    const result = await response.json();
    return result.authenticated === true;
  } catch (error) {
    console.error(
      "Admin session verification failed:",
      error.message
    );
    return false;
  }
}
function normalizeMovie(body, partial = false) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return {
      error: "A valid JSON movie object is required."
    };
  }
  const keys = Object.keys(body);
  if (
    keys.some(
      (key) => !ALLOWED_FIELDS.includes(key)
    )
  ) {
    return {
      error: "The request contains unsupported fields."
    };
  }
  if (!partial && !String(body.title || "").trim()) {
    return {
      error: "Movie title is required."
    };
  }
  if (partial && keys.length === 0) {
    return {
      error: "Provide at least one field to update."
    };
  }
  const movie = {};
  for (const key of keys) {
    const value = body[key];
    if (key === "year") {
      if (value === "" || value === null) {
        movie.year = null;
      } else {
        const year = Number(value);
        if (
          !Number.isInteger(year) ||
          year < 1888 ||
          year > 2200
        ) {
          return {
            error: "Enter a valid movie year."
          };
        }
        movie.year = year;
      }
      continue;
    }
    if (
      value !== null &&
      typeof value !== "string"
    ) {
      return {
        error: `The ${key} field must be text or null.`
      };
    }
    movie[key] =
      typeof value === "string"
        ? value.trim()
        : null;
  }
  if (
    Object.hasOwn(movie, "title") &&
    !movie.title
  ) {
    return {
      error: "Movie title cannot be empty."
    };
  }
  if (
    Object.hasOwn(movie, "status") &&
    !["published", "draft"].includes(movie.status)
  ) {
    return {
      error: "Status must be published or draft."
    };
  }
  return { movie };
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (!process.env.DATABASE_URL) {
      console.error("DATABASE_URL is not configured.");
      return send(res, 500, {
        success: false,
        error: "The database is not configured."
      });
    }
    const sql = neon(process.env.DATABASE_URL);
    const method = req.method;
    // --------------------------------------------------------
    // GET — published movies are public.
    // Admins can request all movies using ?admin=1.
    // --------------------------------------------------------
    if (method === "GET") {
      const adminView = req.query?.admin === "1";
      if (adminView && !(await isAdmin(req))) {
        return send(res, 401, {
          success: false,
          error: "Admin authentication required."
        });
      }
      const movies = adminView
        ? await sql`
            SELECT *
            FROM movies
            ORDER BY created_at DESC
          `
        : await sql`
            SELECT
              id,
              title,
              year,
              genre,
              quality,
              duration,
              description,
              poster_url,
              video_url,
              download_url,
              created_at,
              updated_at
            FROM movies
            WHERE status = 'published'
            ORDER BY created_at DESC
          `;
      return send(res, 200, {
        success: true,
        movies
      });
    }
    // --------------------------------------------------------
    // POST — create a movie (admin only).
    // --------------------------------------------------------
    if (method === "POST") {
      if (!(await isAdmin(req))) {
        return send(res, 401, {
          success: false,
          error: "Admin authentication required."
        });
      }
      const result = normalizeMovie(getBody(req));
      if (result.error) {
        return send(res, 400, {
          success: false,
          error: result.error
        });
      }
      const m = result.movie;
      const rows = await sql`
        INSERT INTO movies (
          title,
          year,
          genre,
          quality,
          duration,
          description,
          poster_url,
          video_url,
          download_url,
          status
        )
        VALUES (
          ${m.title},
          ${m.year ?? null},
          ${m.genre ?? null},
          ${m.quality ?? null},
          ${m.duration ?? null},
          ${m.description ?? null},
          ${m.poster_url ?? null},
          ${m.video_url ?? null},
          ${m.download_url ?? null},
          ${m.status ?? "published"}
        )
        RETURNING *
      `;
      return send(res, 201, {
        success: true,
        message: "Movie added successfully.",
        movie: rows[0]
      });
    }
    // --------------------------------------------------------
    // PATCH — update a movie (admin only).
    // Explicit null values clear nullable fields.
    // --------------------------------------------------------
    if (method === "PATCH") {
      if (!(await isAdmin(req))) {
        return send(res, 401, {
          success: false,
          error: "Admin authentication required."
        });
      }
      const id = getId(req);
      if (!id) {
        return send(res, 400, {
          success: false,
          error: "A valid movie ID is required."
        });
      }
      const result = normalizeMovie(
        getBody(req),
        true
      );
      if (result.error) {
        return send(res, 400, {
          success: false,
          error: result.error
        });
      }
      const m = result.movie;
      const rows = await sql`
        UPDATE movies
        SET
          title = CASE
            WHEN ${Object.hasOwn(m, "title")}
            THEN ${m.title ?? null}
            ELSE title
          END,
          year = CASE
            WHEN ${Object.hasOwn(m, "year")}
            THEN ${m.year ?? null}
            ELSE year
          END,
          genre = CASE
            WHEN ${Object.hasOwn(m, "genre")}
            THEN ${m.genre ?? null}
            ELSE genre
          END,
          quality = CASE
            WHEN ${Object.hasOwn(m, "quality")}
            THEN ${m.quality ?? null}
            ELSE quality
          END,
          duration = CASE
            WHEN ${Object.hasOwn(m, "duration")}
            THEN ${m.duration ?? null}
            ELSE duration
          END,
          description = CASE
            WHEN ${Object.hasOwn(m, "description")}
            THEN ${m.description ?? null}
            ELSE description
          END,
          poster_url = CASE
            WHEN ${Object.hasOwn(m, "poster_url")}
            THEN ${m.poster_url ?? null}
            ELSE poster_url
          END,
          video_url = CASE
            WHEN ${Object.hasOwn(m, "video_url")}
            THEN ${m.video_url ?? null}
            ELSE video_url
          END,
          download_url = CASE
            WHEN ${Object.hasOwn(m, "download_url")}
            THEN ${m.download_url ?? null}
            ELSE download_url
          END,
          status = CASE
            WHEN ${Object.hasOwn(m, "status")}
            THEN ${m.status ?? null}
            ELSE status
          END,
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      if (!rows.length) {
        return send(res, 404, {
          success: false,
          error: "Movie not found."
        });
      }
      return send(res, 200, {
        success: true,
        message: "Movie updated successfully.",
        movie: rows[0]
      });
    }
    // --------------------------------------------------------
    // DELETE — delete a movie (admin only).
    // --------------------------------------------------------
    if (method === "DELETE") {
      if (!(await isAdmin(req))) {
        return send(res, 401, {
          success: false,
          error: "Admin authentication required."
        });
      }
      const id = getId(req);
      if (!id) {
        return send(res, 400, {
          success: false,
          error: "A valid movie ID is required."
        });
      }
      const rows = await sql`
        DELETE FROM movies
        WHERE id = ${id}
        RETURNING id, title
      `;
      if (!rows.length) {
        return send(res, 404, {
          success: false,
          error: "Movie not found."
        });
      }
      return send(res, 200, {
        success: true,
        message: "Movie deleted successfully.",
        movie: rows[0]
      });
    }
    res.setHeader(
      "Allow",
      "GET, POST, PATCH, DELETE"
    );
    return send(res, 405, {
      success: false,
      error: "Method not allowed."
    });
  } catch (error) {
    console.error(
      "Movies API error:",
      error.message
    );
    return send(res, 500, {
      success: false,
      error: "An internal server error occurred."
    });
  }
}