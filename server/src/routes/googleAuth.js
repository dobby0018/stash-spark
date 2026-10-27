
import express from 'express';
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client();

export function createGoogleAuthRouter({
  User,
  createToken,
  cookieOptions,
  publicUser,
  authLimiter
}) {
  const router = express.Router();

  router.post('/google', authLimiter, async (req, res, next) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;

    if (!clientId) {
      return res.status(503).json({
        error: 'Google sign-in is not configured.'
      });
    }

    const credential = req.body?.credential;

    if (
      typeof credential !== 'string' ||
      credential.length === 0 ||
      credential.length > 10000
    ) {
      return res.status(400).json({
        error: 'A valid Google credential is required.'
      });
    }

    let payload;

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: clientId
      });

      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({
        error: 'Google sign-in verification failed.'
      });
    }

    if (
      !payload?.sub ||
      !payload.email ||
      payload.email_verified !== true
    ) {
      return res.status(401).json({
        error: 'Google did not provide a verified email address.'
      });
    }

    const email = payload.email.trim().toLowerCase();

    try {
      // Select passwordHash explicitly because the User model hides it
      // from queries by default.
      let user = await User.findOne({
        googleId: payload.sub
      }).select('+passwordHash');

      if (!user) {
        user = await User.findOne({ email })
          .select('+passwordHash');

        if (user) {
          // Do not automatically link an unrelated Google identity
          // to an account using an unverified domain.
          const googleControlsEmail =
            email.endsWith('@gmail.com') ||
            Boolean(payload.hd);

          if (!googleControlsEmail) {
            return res.status(409).json({
              error:
                'This email already has an account. Sign in using your existing method first.'
            });
          }

          if (user.googleId && user.googleId !== payload.sub) {
            return res.status(409).json({
              error:
                'This account is linked to another Google account.'
            });
          }

          user.googleId = payload.sub;
          await user.save();
        } else {
          // New Google users are always customers.
          user = await User.create({
            email,
            googleId: payload.sub,
            role: 'user'
          });
        }
      }

      const needsPasswordSetup = !user.passwordHash;

      res.cookie('session', createToken(user), cookieOptions);

      return res.json({
        message: needsPasswordSetup
          ? 'Google account created. Create a password to continue.'
          : 'Signed in with Google.',
        user: publicUser(user),
        needsPasswordSetup
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({
          error:
            'This account already exists. Please try signing in again.'
        });
      }

      return next(error);
    }
  });

  return router;
}
