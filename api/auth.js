// UXY MOVIES
// Admin authentication check

import crypto from "crypto";


function parseCookies(
  cookieHeader = ""
) {

  const cookies = {};

  cookieHeader
    .split(";")
    .forEach(part => {

      const separator =
        part.indexOf("=");

      if (separator === -1) {
        return;
      }

      const name =
        part
          .slice(0, separator)
          .trim();

      const value =
        part
          .slice(separator + 1)
          .trim();

      cookies[name] = value;

    });


  return cookies;

}


function verifyToken(token) {

  if (!token) {
    return null;
  }


  const parts =
    token.split(".");


  if (parts.length !== 2) {
    return null;
  }


  const [
    encodedPayload,
    signature
  ] = parts;


  if (
    !process.env.SESSION_SECRET
  ) {

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


  const signaturesMatch =
    crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );


  if (!signaturesMatch) {
    return null;
  }


  try {

    const payload =
      JSON.parse(
        Buffer
          .from(
            encodedPayload,
            "base64url"
          )
          .toString("utf8")
      );


    if (!payload.email) {
      return null;
    }


    if (!payload.exp) {
      return null;
    }


    if (
      Date.now() >= payload.exp
    ) {

      return null;

    }


    return payload;


  } catch {

    return null;

  }

}


export default async function handler(
  req,
  res
) {

  if (req.method !== "GET") {

    return res.status(405).json({
      authenticated: false
    });

  }


  const cookies =
    parseCookies(
      req.headers.cookie || ""
    );


  const token =
    cookies.uxy_admin_session;


  const session =
    verifyToken(token);


  if (!session) {

    return res.status(401).json({
      authenticated: false
    });

  }


  return res.status(200).json({

    authenticated: true,

    email: session.email

  });

}