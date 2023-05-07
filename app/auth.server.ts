import arc from "@architect/functions";
import { createCookieSessionStorage, json } from "@remix-run/node";
import { Authenticator, Strategy } from "remix-auth";
import { FormStrategy } from "remix-auth-form";
import {
  GoogleStrategy,
  FacebookStrategy,
  SocialsProvider,
} from "remix-auth-socials";
import invariant from "tiny-invariant";
// import { sessionStorage } from "~/session.server";
import { findOrCreate, verifyLogin } from "./models/user.server";

// Create an instance of the authenticator
type AuthUser = {
  refreshToken?: string;
  accessToken?: string;
  userId: string;
};

export const sessionStorage = createCookieSessionStorage({
    cookie: {
      name: "__session",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secrets: [process.env.SESSION_SECRET || ""],
      secure: process.env.NODE_ENV === "production",
    },
  });

// console.log(sessionStorage)
export let authenticator = new Authenticator<AuthUser>(sessionStorage, {
  sessionKey: "__session",
});

// You may specify a <User> type which the strategies will return (this will be stored in the session)
const getCallback = (provider: SocialsProvider) => {
  const path = `auth/${provider}/callback`;
  if (process.env.ARC_ENV === "staging") {
    return `https://staging.popcrop.studio/${path}`;
  } else if (process.env.ARC_ENV === "production") {
    return `https://popcrop.studio/${path}`;
  }
  return `http://localhost:3000/${path}`;
};

const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

invariant(GOOGLE_OAUTH_CLIENT_ID, "GOOGLE_OAUTH_CLIENT_ID not set.");
invariant(GOOGLE_OAUTH_CLIENT_SECRET, "GOOGLE_OAUTH_CLIENT_SECRET not set.");

const googleStrategy = new GoogleStrategy(
  {
    clientID: GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: GOOGLE_OAUTH_CLIENT_SECRET,
    callbackURL: getCallback(SocialsProvider.GOOGLE),
  },
  async ({ accessToken, refreshToken, extraParams, profile }) => {
    // Get the user data from your DB or API using the tokens and profile
    const user = await findOrCreate({
      email: profile.emails[0].value,
      picture: profile.photos[0].value,
      provider: profile.provider,
      providerID: profile.id,
      name: profile.displayName,
    });
    console.log(`${user.id} authenticating using Google.`)
    return {
      userId: user.id,
      accessToken: accessToken,
      refreshToken: refreshToken,
    };
  }
);

authenticator.use(googleStrategy, SocialsProvider.GOOGLE);

authenticator.use(
  new FormStrategy(async ({ context }) => {
    invariant(context, "authenticate form strategy did not receive context")
    const formData = context.formData as FormData;
    let email = formData.get("email");
    let password = formData.get("password");

    invariant(typeof email === "string", "email must be a string");
    invariant(typeof password === "string", "password must be a string");

    console.log(`${email} verifying using user and password.`)
    let user = await verifyLogin(email, password);
    
    if (!user) {
        throw json(
            { errors: { email: null, password: "User or password is incorrect." } },
            { status: 400 }
        );
    }
    console.log(`${email} ${user.id} verified using user and password.`)
    return {
      userId: user.id,
    };
  }),
  "user-pass"
);

// Setup strat for discord
// https://github.com/JonnyBnator/remix-auth-discord

// setupAuth();
