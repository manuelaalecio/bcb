import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors()
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
  app.useGlobalFilters(new HttpExceptionFilter())

  const config = new DocumentBuilder()
    .setTitle('BCB — Big Chat Brasil')
    .setDescription('API para envio de mensagens corporativas')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config))

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0')
}

void bootstrap()
