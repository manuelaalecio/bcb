import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from './auth/auth.module'
import { ClientsModule } from './clients/clients.module'
import { ConversationsModule } from './conversations/conversations.module'
import { MessagesModule } from './messages/messages.module'
import { PrismaModule } from './prisma/prisma.module'
import { RealtimeModule } from './realtime/realtime.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ClientsModule,
    ConversationsModule,
    MessagesModule,
    RealtimeModule,
  ],
})
export class AppModule {}
