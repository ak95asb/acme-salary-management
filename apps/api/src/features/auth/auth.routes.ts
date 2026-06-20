import { Router, type Router as RouterType } from "express";
import { loginSchema } from "@acme/types";
import { login, refresh, logout } from "./auth.service";
import { AppError } from "../../lib/errors";

const COOKIE_NAME = "refresh_token";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

const router: RouterType = Router();

router.post("/login", async (req, res, next) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    return next(
      new AppError("VALIDATION_ERROR", "Invalid input", 400, parse.error.flatten())
    );
  }

  try {
    const { email, password } = parse.data;
    const result = await login(email, password);

    res.cookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTS);
    res.json({
      success: true,
      data: { accessToken: result.accessToken, user: result.user },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/refresh", async (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return next(new AppError("UNAUTHORIZED", "No refresh token", 401));
  }

  try {
    const { accessToken, user } = await refresh(token);
    res.json({ success: true, data: { accessToken, user } });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", async (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME];

  try {
    if (token) await logout(token);
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
