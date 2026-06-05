import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import type { Client } from '@prisma/client'
import { CurrentClient } from '../common/decorators/current-client'
import { AuthGuard } from '../common/guards/auth.guard'
import { ConversationsService } from './conversations.service'
import { ConversationResponseDto } from './dto/conversation-response.dto'
import { MessageResponseDto } from './dto/message-response.dto'

@ApiTags('conversations')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar conversas',
    description:
      'Retorna todas as conversas do cliente autenticado, ordenadas pela última mensagem.',
  })
  @ApiOkResponse({
    type: [ConversationResponseDto],
    description: 'Lista de conversas.',
  })
  @ApiResponse({ status: 401, description: 'Token inválido ou não fornecido.' })
  findAll(@CurrentClient() client: Client) {
    return this.conversationsService.findAll(client.id)
  }

  @Get(':id/messages')
  @ApiOperation({
    summary: 'Histórico de mensagens',
    description:
      'Retorna as mensagens de uma conversa do cliente autenticado, em ordem cronológica.',
  })
  @ApiOkResponse({
    type: [MessageResponseDto],
    description: 'Lista de mensagens da conversa.',
  })
  @ApiResponse({ status: 401, description: 'Token inválido ou não fornecido.' })
  @ApiResponse({ status: 404, description: 'Conversa não encontrada.' })
  findMessages(@Param('id') id: string, @CurrentClient() client: Client) {
    return this.conversationsService.findMessages(id, client.id)
  }
}
