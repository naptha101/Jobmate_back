import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as LinkedInStrategy } from "passport-linkedin-oauth2";

import jwt from "jsonwebtoken";
import User from "../models/User.js";

const generateToken = (user) => {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "3d" });
};


// Google OAuth Strategy
console.log(process.env.GOOGLE_CLIENT_ID)
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/api/auth/google/callback",
  passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ email: profile.emails[0].value });

    if (!user) {
      user = await User.create({
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        email: profile.emails[0].value,
        googleId: profile.id,
        profilePicture: profile.photos[0].value
      });
    }

    return done(null, { user, token: generateToken(user) });
  } catch (error) {
    return done(error, false);
  }
}));

// LinkedIn OAuth Strategy
// passport.use(new LinkedInStrategy({
//   clientID: process.env.LINKEDIN_CLIENT_ID,
//   clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
//   callbackURL: "/api/auth/linkedin/callback",
//   scope: ['r_emailaddress', 'r_liteprofile'],
//   passReqToCallback: true
// }, async (req, accessToken, refreshToken, profile, done) => {
//   try {
//     let user = await User.findOne({ email: profile.emails[0].value });

//     if (!user) {
//       user = await User.create({
//         firstName: profile.name.givenName,
//         lastName: profile.name.familyName,
//         email: profile.emails[0].value,
//         linkedinId: profile.id,
//         profilePicture: profile.photos[0].value
//       });
//     }

//     return done(null, { user, token: generateToken(user) });
//   } catch (error) {
//     return done(error, false);
//   }
// }));

export const passp=passport;
