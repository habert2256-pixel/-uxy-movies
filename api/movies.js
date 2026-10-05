// ============================================================
// UXY MOVIES
// MOVIES API
//
// GET    /api/movies
// POST   /api/movies
// PATCH  /api/movies?id=123
// DELETE /api/movies?id=123
//
// Database: Neon PostgreSQL
// Environment variable: DATABASE_URL
// ============================================================

import { neon } from "@neondatabase/serverless";


// ============================================================
// DATABASE
// ============================================================

const databaseUrl =
  process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    "DATABASE_URL environment variable is missing."
  );
}

const sql =
  databaseUrl
    ? neon(databaseUrl)
    : null;


// ============================================================
// CORS / RESPONSE HELPERS
// ============================================================

function setHeaders(res) {

  res.setHeader(
    "Content-Type",
    "application/json"
  );

  res.setHeader(
    "Cache-Control",
    "no-store"
  );

}


// ============================================================
// JSON RESPONSE
// ============================================================

function send(
  res,
  status,
  data
) {

  setHeaders(res);

  res.status(status).json(data);

}


// ============================================================
// DATABASE CHECK
// ============================================================

function checkDatabase(
  res
) {

  if (!sql) {

    send(
      res,
      500,
      {
        success: false,
        message:
          "Database connection is not configured."
      }
    );

    return false;

  }

  return true;

}


// ============================================================
// METHOD CHECK
// ============================================================

function methodNotAllowed(
  res
) {

  res.setHeader(
    "Allow",
    "GET, POST, PATCH, DELETE"
  );

  send(
    res,
    405,
    {
      success: false,
      message:
        "Method not allowed."
    }
  );

}


// ============================================================
// PARSE REQUEST BODY
// ============================================================

function getBody(
  req
) {

  if (!req.body) {
    return {};
  }


  if (
    typeof req.body ===
    "object"
  ) {

    return req.body;

  }


  try {

    return JSON.parse(
      req.body
    );

  } catch {

    return {};

  }

}


// ============================================================
// CLEAN STRING
// ============================================================

function cleanString(
  value
) {

  if (
    value === undefined ||
    value === null
  ) {

    return null;

  }


  const result =
    String(value).trim();


  return result
    ? result
    : null;

}


// ============================================================
// YEAR
// ============================================================

function cleanYear(
  value
) {

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {

    return null;

  }


  const year =
    Number(value);


  if (
    !Number.isInteger(year)
  ) {

    return null;

  }


  if (
    year < 1800 ||
    year > 2100
  ) {

    return null;

  }


  return year;

}


// ============================================================
// ID
// ============================================================

function getMovieId(
  req
) {

  const rawId =
    req.query?.id;


  if (
    rawId === undefined ||
    rawId === null ||
    rawId === ""
  ) {

    return null;

  }


  const id =
    Number(rawId);


  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {

    return null;

  }


  return id;

}


// ============================================================
// GET MOVIES
// ============================================================

async function getMovies(
  req,
  res
) {

  try {

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


    send(
      res,
      200,
      {
        success: true,
        movies
      }
    );


  } catch (error) {

    console.error(
      "GET /api/movies error:",
      error
    );


    send(
      res,
      500,
      {
        success: false,
        message:
          "Unable to load movies."
      }
    );

  }

}


// ============================================================
// ADD MOVIE
// ============================================================

async function createMovie(
  req,
  res
) {

  const body =
    getBody(req);


  const title =
    cleanString(
      body.title
    );


  if (!title) {

    send(
      res,
      400,
      {
        success: false,
        message:
          "Movie title is required."
      }
    );

    return;

  }


  const year =
    cleanYear(
      body.year
    );


  const genre =
    cleanString(
      body.genre
    );


  const quality =
    cleanString(
      body.quality
    );


  const duration =
    cleanString(
      body.duration
    );


  const description =
    cleanString(
      body.description
    );


  const posterUrl =
    cleanString(
      body.poster_url
    );


  const videoUrl =
    cleanString(
      body.video_url
    );


  const downloadUrl =
    cleanString(
      body.download_url
    );


  const status =
    body.status === "draft"
      ? "draft"
      : "published";


  try {

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
          ${title},
          ${year},
          ${genre},
          ${quality},
          ${duration},
          ${description},
          ${posterUrl},
          ${videoUrl},
          ${downloadUrl},
          ${status}
        )
        RETURNING
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
      `;


    send(
      res,
      201,
      {
        success: true,
        message:
          "Movie added successfully.",
        movie:
          result[0]
      }
    );


  } catch (error) {

    console.error(
      "POST /api/movies error:",
      error
    );


    send(
      res,
      500,
      {
        success: false,
        message:
          "Unable to add movie."
      }
    );

  }

}


// ============================================================
// UPDATE MOVIE
// ============================================================

async function updateMovie(
  req,
  res
) {

  const id =
    getMovieId(req);


  if (!id) {

    send(
      res,
      400,
      {
        success: false,
        message:
          "A valid movie ID is required."
      }
    );

    return;

  }


  const body =
    getBody(req);


  const title =
    cleanString(
      body.title
    );


  if (!title) {

    send(
      res,
      400,
      {
        success: false,
        message:
          "Movie title is required."
      }
    );

    return;

  }


  const year =
    cleanYear(
      body.year
    );


  const genre =
    cleanString(
      body.genre
    );


  const quality =
    cleanString(
      body.quality
    );


  const duration =
    cleanString(
      body.duration
    );


  const description =
    cleanString(
      body.description
    );


  const posterUrl =
    cleanString(
      body.poster_url
    );


  const videoUrl =
    cleanString(
      body.video_url
    );


  const downloadUrl =
    cleanString(
      body.download_url
    );


  const status =
    body.status === "draft"
      ? "draft"
      : "published";


  try {

    const result =
      await sql`
        UPDATE movies
        SET
          title = ${title},
          year = ${year},
          genre = ${genre},
          quality = ${quality},
          duration = ${duration},
          description = ${description},
          poster_url = ${posterUrl},
          video_url = ${videoUrl},
          download_url = ${downloadUrl},
          status = ${status},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING
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
      `;


    if (
      result.length === 0
    ) {

      send(
        res,
        404,
        {
          success: false,
          message:
            "Movie not found."
        }
      );

      return;

    }


    send(
      res,
      200,
      {
        success: true,
        message:
          "Movie updated successfully.",
        movie:
          result[0]
      }
    );


  } catch (error) {

    console.error(
      "PATCH /api/movies error:",
      error
    );


    send(
      res,
      500,
      {
        success: false,
        message:
          "Unable to update movie."
      }
    );

  }

}


// ============================================================
// DELETE MOVIE
// ============================================================

async function deleteMovie(
  req,
  res
) {

  const id =
    getMovieId(req);


  if (!id) {

    send(
      res,
      400,
      {
        success: false,
        message:
          "A valid movie ID is required."
      }
    );

    return;

  }


  try {

    const result =
      await sql`
        DELETE FROM movies
        WHERE id = ${id}
        RETURNING id, title
      `;


    if (
      result.length === 0
    ) {

      send(
        res,
        404,
        {
          success: false,
          message:
            "Movie not found."
        }
      );

      return;

    }


    send(
      res,
      200,
      {
        success: true,
        message:
          "Movie deleted successfully.",
        movie:
          result[0]
      }
    );


  } catch (error) {

    console.error(
      "DELETE /api/movies error:",
      error
    );


    send(
      res,
      500,
      {
        success: false,
        message:
          "Unable to delete movie."
      }
    );

  }

}


// ============================================================
// MAIN HANDLER
// ============================================================

export default async function handler(
  req,
  res
) {

  if (
    !checkDatabase(res)
  ) {

    return;

  }


  try {

    switch (
      req.method
    ) {

      case "GET":

        await getMovies(
          req,
          res
        );

        break;


      case "POST":

        await createMovie(
          req,
          res
        );

        break;


      case "PATCH":

        await updateMovie(
          req,
          res
        );

        break;


      case "DELETE":

        await deleteMovie(
          req,
          res
        );

        break;


      default:

        methodNotAllowed(
          res
        );

    }

  } catch (error) {

    console.error(
      "Movies API fatal error:",
      error
    );


    if (!res.headersSent) {

      send(
        res,
        500,
        {
          success: false,
          message:
            "Internal server error."
        }
      );

    }

  }

}