// UXY MOVIES
// Movie management API
//
// GET    /api/movies       -> list movies
// POST   /api/movies       -> create movie
// PUT    /api/movies       -> update movie
// DELETE /api/movies?id=1  -> delete movie

import crypto from "crypto";
import { neon } from "@neondatabase/serverless";


/* =========================================================
   DATABASE
========================================================= */

const sql = neon(process.env.DATABASE_URL);


/* =========================================================
   COOKIE PARSER
========================================================= */

function parseCookies(cookieHeader = "") {

  const cookies = {};

  cookieHeader
    .split(";")
    .forEach(part => {

      const separator = part.indexOf("=");

      if (separator === -1) {
        return;
      }

      const name =
        part.slice(0, separator).trim();

      const value =
        part.slice(separator + 1).trim();

      cookies[name] = value;

    });

  return cookies;
}


/* =========================================================
   VERIFY ADMIN SESSION
========================================================= */

function verifyToken(token) {

  if (!token) {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [
    encodedPayload,
    signature
  ] = parts;

  if (!process.env.SESSION_SECRET) {
    return null;
  }

  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        process.env.SESSION_SECRET
      )
      .update(encodedPayload)
      .digest("base64url");

  if (
    signature.length !==
    expectedSignature.length
  ) {
    return null;
  }

  try {

    const signaturesMatch =
      crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

    if (!signaturesMatch) {
      return null;
    }

    const payload =
      JSON.parse(
        Buffer
          .from(
            encodedPayload,
            "base64url"
          )
          .toString("utf8")
      );

    if (!payload.email || !payload.exp) {
      return null;
    }

    if (Date.now() >= payload.exp) {
      return null;
    }

    return payload;

  } catch {

    return null;

  }
}


/* =========================================================
   AUTHENTICATION
========================================================= */

function authenticate(req) {

  const cookies =
    parseCookies(
      req.headers.cookie || ""
    );

  return verifyToken(
    cookies.uxy_admin_session
  );

}


/* =========================================================
   HANDLER
========================================================= */

export default async function handler(req, res) {

  try {

    /* -----------------------------------------
       REQUIRE ADMIN LOGIN
    ----------------------------------------- */

    const session =
      authenticate(req);

    if (!session) {

      return res.status(401).json({
        success: false,
        message: "Unauthorized."
      });

    }


    /* =========================================
       GET — LIST MOVIES
    ========================================= */

    if (req.method === "GET") {

      const movies =
        await sql`
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
            status,
            created_at,
            updated_at
          FROM movies
          ORDER BY created_at DESC
        `;

      return res.status(200).json({
        success: true,
        movies
      });

    }


    /* =========================================
       POST — CREATE MOVIE
    ========================================= */

    if (req.method === "POST") {

      const {
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
      } = req.body || {};


      if (!title || !title.trim()) {

        return res.status(400).json({
          success: false,
          message: "Movie title is required."
        });

      }


      const movieStatus =
        status === "draft"
          ? "draft"
          : "published";


      const result =
        await sql`
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
            ${title.trim()},
            ${year || null},
            ${genre || null},
            ${quality || null},
            ${duration || null},
            ${description || null},
            ${poster_url || null},
            ${video_url || null},
            ${download_url || null},
            ${movieStatus}
          )
          RETURNING *
        `;


      return res.status(201).json({
        success: true,
        movie: result[0]
      });

    }


    /* =========================================
       PUT — UPDATE MOVIE
    ========================================= */

    if (req.method === "PUT") {

      const {
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
        status
      } = req.body || {};


      if (!id) {

        return res.status(400).json({
          success: false,
          message: "Movie ID is required."
        });

      }


      if (!title || !title.trim()) {

        return res.status(400).json({
          success: false,
          message: "Movie title is required."
        });

      }


      const movieStatus =
        status === "draft"
          ? "draft"
          : "published";


      const result =
        await sql`
          UPDATE movies
          SET
            title = ${title.trim()},
            year = ${year || null},
            genre = ${genre || null},
            quality = ${quality || null},
            duration = ${duration || null},
            description = ${description || null},
            poster_url = ${poster_url || null},
            video_url = ${video_url || null},
            download_url = ${download_url || null},
            status = ${movieStatus},
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `;


      if (!result.length) {

        return res.status(404).json({
          success: false,
          message: "Movie not found."
        });

      }


      return res.status(200).json({
        success: true,
        movie: result[0]
      });

    }


    /* =========================================
       DELETE — DELETE MOVIE
    ========================================= */

    if (req.method === "DELETE") {

      const id =
        req.query?.id;


      if (!id) {

        return res.status(400).json({
          success: false,
          message: "Movie ID is required."
        });

      }


      const result =
        await sql`
          DELETE FROM movies
          WHERE id = ${id}
          RETURNING id
        `;


      if (!result.length) {

        return res.status(404).json({
          success: false,
          message: "Movie not found."
        });

      }


      return res.status(200).json({
        success: true,
        message: "Movie deleted."
      });

    }


    /* =========================================
       METHOD NOT ALLOWED
    ========================================= */

    return res.status(405).json({
      success: false,
      message: "Method not allowed."
    });


  } catch (error) {

    console.error(
      "Movies API error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Database error."
    });

  }

}