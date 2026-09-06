import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { AppError } from '@domain/errors';

interface HttpResponseLike {
  status(code: number): { json(body: unknown): void };
}

// Maps AppError -> HTTP (2.api-surface.md's error envelope). Also normalizes
// Nest's own HttpException (e.g. the global ValidationPipe's 400s) and anything
// unexpected into the same shape, so a client sees one error contract everywhere.
@Catch()
export class AppErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponseLike>();

    if (exception instanceof AppError) {
      response.status(exception.statusCode).json({
        error: { code: exception.code, message: exception.message, details: exception.details },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : (body as { message?: string | string[] }).message;
      response.status(status).json({
        error: {
          code: exception.constructor.name.replace(/Exception$/, '').toUpperCase(),
          message: Array.isArray(message) ? message.join('; ') : (message ?? exception.message),
        },
      });
      return;
    }

    // eslint-disable-next-line no-console
    console.error(exception);
    response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
}
