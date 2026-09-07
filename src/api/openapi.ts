import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Code-first: DTOs are the source, the @nestjs/swagger CLI plugin (nest-cli.json)
// infers schemas from them — this just wires DocumentBuilder + the /docs route
// (1.overall-architecture.md, OpenAPI).
export function setupOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Blotato Comments API')
    .setDescription('Multi-platform comment retrieval and reply service')
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'blotato-api-key', in: 'header' }, 'blotato-api-key')
    // addApiKey above only registers the scheme; nothing marks any route as
    // requiring it, so Swagger UI won't attach the header on "Execute" without
    // this — Authorize alone would just store the key and never send it.
    .addSecurityRequirements('blotato-api-key')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Without this, Swagger UI's default (persistAuthorization: false) forgets
  // whatever's typed into "Authorize" on every reload — annoying for a reviewer
  // re-visiting /docs, and the key is a demo constant anyway, not a real secret.
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
