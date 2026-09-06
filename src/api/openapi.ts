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
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
}
