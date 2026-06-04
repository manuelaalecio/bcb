import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AuthGuard } from '../common/guards/auth.guard'
import { ClientsController } from './clients.controller'
import { ClientsService } from './clients.service'

@Module({
  imports: [AuthModule],
  controllers: [ClientsController],
  providers: [ClientsService, AuthGuard],
})
export class ClientsModule {}
