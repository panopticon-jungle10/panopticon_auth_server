import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Enable CORS for local development so Swagger UI can be accessed from the browser
  app.enableCors();

  // Swagger/OpenAPI setup (only enabled outside of production)
  if ((process.env.NODE_ENV || 'development') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Panopticon Auth API')
      .setDescription('Authentication and user management for Panopticon')
      .setVersion('0.1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'jwt')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
    console.log('Swagger UI available at /docs (development only)');
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 8080;
  await app.listen(port);
  console.log(`panopticon-auth-server listening on ${port}`);
}

bootstrap();