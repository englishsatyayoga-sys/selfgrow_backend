import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodTypeAny } from 'zod';

export const validate = (schema: AnyZodObject | ZodTypeAny) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const isZodObject = 'shape' in schema;
      const shape = isZodObject ? (schema as any).shape : null;

      if (shape && (shape.body || shape.query || shape.params)) {
        const parsed = await (schema as AnyZodObject).parseAsync({
          body: req.body,
          query: req.query,
          params: req.params,
        });
        if (parsed.body !== undefined) req.body = parsed.body;
        if (parsed.query !== undefined) req.query = parsed.query;
        if (parsed.params !== undefined) req.params = parsed.params;
      } else {
        req.body = await schema.parseAsync(req.body);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
