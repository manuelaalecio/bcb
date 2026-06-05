import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import type { Client } from '@prisma/client'
import { CurrentClient } from '../common/decorators/current-client'
import { AuthGuard } from '../common/guards/auth.guard'
import { SendMessageDto } from './dto/send-message.dto'
import { SendMessageResponseDto } from './dto/send-message-response.dto'
import { MessagesService } from './messages.service'

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @ApiOperation({
    summary: 'Enviar mensagem',
    description:
      'Cobra o cliente (pré/pós-pago), cria a mensagem em fila e a enfileira para processamento.',
  })
  @ApiCreatedResponse({ type: SendMessageResponseDto })
  @ApiResponse({ status: 401, description: 'Token inválido ou não fornecido.' })
  @ApiResponse({ status: 404, description: 'Conversa não encontrada.' })
  @ApiResponse({
    status: 422,
    description: 'Saldo insuficiente (pré-pago) ou limite excedido (pós-pago).',
  })
  send(@CurrentClient() client: Client, @Body() dto: SendMessageDto) {
    return this.messagesService.send(client, dto)
  }
}
