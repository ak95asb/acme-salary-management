import type { TokenPayload } from "@acme/types";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}
