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
// Environment variables required:
// DATABASE_URL
// SESSION_SECRET
// ============================================================

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

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
  return res.status(status).json(data);
}

function getBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }

  return null;
}

function getId(req) {
  const id = Number(req.query?.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return null;
  }

  return id;
}

// Verify the existing admin session through api/auth.js.
// The browser's session cookie is forwarded to the auth endpoint.
async function isAdmin(req) {
  try {
    const host = req.headers["x-forwarded-host"] || req.headers.host;

    if (!host) return false;

    const protocol =
      req.headers["x-forwarded-proto"] || "https";

    const cookie = req.headers.cookie || "";

    const response = await fetch(
      `${protocol}://${host}/api/auth`,
      {
        method: "GET",
        headers: {
          cookie
        }
      }
    );

    if (!response.ok) return false;

    const result = await response.json();

    return result.authenticated === true;
  } catch (error) {
    console.error("Admin verification failed:", error);
    return false;
  }
}

function normalizeMovie(body, partial = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "A valid JSON movie object is required." };
  }

  const keys = Object.keys(body);

  if (keys.some((key) => !ALLOWED_FIELDS.includes(key))) {
    return { error: "The request contains unsupported fields." };
  }

  if (!partial && !String(body.title || "").trim()) {
    return { error: "Movie title is required." };
  }

  if (
    partial &&
    Object.keys(body).length === 0
  ) {
    return { error: "Provide at least one field to update." };
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
          return { error: "Enter a valid movie year." };
        }

        movie.year = year;
      }

      continue;
    }

    if (value !== null && typeof value !== "string") {
      return {
        error: `The ${key} field must be text or null.`
      };
    }

    movie[key] =
      typeof value === "string" ? value.trim() : null;
  }

  if (movie.title !== undefined && !movie.title) {
    return { error: "Movie title cannot be empty." };
  }

  if (movie.status !== undefined) {
    if (!["published", "draft"].includes(movie.status)) {
      return {
        error: "Status must be published or draft."
      };
    }
  }

  return { movie };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (!process.env.DATABASE_URL) {
      return send(res, 500, {
        success: false,
        error: "DATABASE_URL is not configured."
      });
    }

    const method = req.method;

    // --------------------------------------------------------
    // GET — published movies for public pages.
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
    // POST — create a movie.
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
    // PATCH — update an existing movie.
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

      const result = normalizeMovie(getBody(req), true);

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
          title = COALESCE(${m.title ?? null}, title),
          year = CASE
            WHEN ${Object.hasOwn(m, "year")}
            THEN ${m.year ?? null}
            ELSE year
          END,
          genre = COALESCE(${m.genre ?? null}, genre),
          quality = COALESCE(${m.quality ?? null}, quality),
          duration = COALESCE(${m.duration ?? null}, duration),
          description = COALESCE(${m.description ?? null}, description),
          poster_url = COALESCE(${m.poster_url ?? null}, poster_url),
          video_url = COALESCE(${m.video_url ?? null}, video_url),
          download_url = COALESCE(${m.download_url ?? null}, download_url),
          status = COALESCE(${m.status ?? null}, status),
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
    // DELETE — delete a movie.
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

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");

    return send(res, 405, {
      success: false,
      error: "Method not allowed."
    });

  } catch (error) {
    console.error("Movies API error:", error);

    return send(res, 500, {
      success: false,
      error: "An internal server error occurred."
    });
  }
}