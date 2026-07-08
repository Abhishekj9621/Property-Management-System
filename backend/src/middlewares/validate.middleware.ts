import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";
import { ApiError } from "../utils/ApiError";

/**
 * Turns Zod's issue list into a flat `{ field, message }[]`, stripping the
 * leading "body."/"query"."/"params." segment every issue has here (since
 * every schema in this app is shaped `{ body?, query?, params? }`).
 *
 * This exists because `ZodError#flatten()` only buckets errors by the
 * *top-level* schema key — since that top-level key is always "body" (or
 * "query"/"params"), every validation error on every route used to come
 * back as `fieldErrors: { body: ["..."] }` with no indication of which
 * field inside the body actually failed. The client had no way to show
 * anything more useful than a generic "Validation failed" toast.
 */
function formatZodIssues(err: ZodError): { field: string; message: string }[] {
  return err.issues.map((issue) => {
    const [, ...rest] = issue.path; // drop the "body"/"query"/"params" prefix
    const field = rest.length ? rest.join(".") : (issue.path[0] as string) || "value";
    return { field, message: issue.message };
  });
}

/**
 * Validates req.body / req.query / req.params against a Zod schema shaped as
 * { body?, query?, params? }. On success, replaces the request objects with
 * the parsed (and type-coerced/defaulted) values.
 */
export function validate(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (parsed.body) req.body = parsed.body;
      if (parsed.query) req.query = parsed.query;
      if (parsed.params) req.params = parsed.params;
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        const fieldErrors = formatZodIssues(err);
        const summary = fieldErrors.map((f) => `${f.field}: ${f.message}`).join("; ");
        return next(ApiError.badRequest(summary ? `Validation failed — ${summary}` : "Validation failed", { fieldErrors }));
      }
      return next(err);
    }
  };
}
