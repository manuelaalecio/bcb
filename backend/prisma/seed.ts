import {
  DocumentType,
  MessageStatus,
  PlanType,
  Prisma,
  PrismaClient,
  Priority,
  SenderType,
} from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Cliente pré-pago (PF) com saldo.
  const prepaid = await prisma.client.upsert({
    where: { documentId: '52998224725' },
    update: { balance: new Prisma.Decimal('50.00'), active: true },
    create: {
      name: 'Loja do Zé (Pré-pago)',
      documentId: '52998224725',
      documentType: DocumentType.CPF,
      planType: PlanType.prepaid,
      balance: new Prisma.Decimal('50.00'),
    },
  })

  // Cliente pós-pago (PJ) com limite mensal.
  await prisma.client.upsert({
    where: { documentId: '11222333000181' },
    update: {
      monthlyLimit: new Prisma.Decimal('100.00'),
      monthlyUsage: new Prisma.Decimal('0.00'),
      active: true,
    },
    create: {
      name: 'Mercado Central (Pós-pago)',
      documentId: '11222333000181',
      documentType: DocumentType.CNPJ,
      planType: PlanType.postpaid,
      monthlyLimit: new Prisma.Decimal('100.00'),
    },
  })

  // Conversa de exemplo para o cliente pré-pago (apenas se ainda não houver).
  const existing = await prisma.conversation.count({
    where: { clientId: prepaid.id },
  })
  if (existing === 0) {
    const recipientId = 'recipient-joao'
    const conversation = await prisma.conversation.create({
      data: {
        clientId: prepaid.id,
        recipientId,
        recipientName: 'João Silva',
        lastMessageContent: 'Perfeito, muito obrigado!',
        lastMessageTime: new Date(),
      },
    })

    await prisma.message.createMany({
      data: [
        {
          conversationId: conversation.id,
          content: 'Olá! Seu pedido foi confirmado.',
          senderId: prepaid.id,
          senderType: SenderType.client,
          priority: Priority.normal,
          status: MessageStatus.read,
          cost: new Prisma.Decimal('0.25'),
        },
        {
          conversationId: conversation.id,
          content: 'Quando chega?',
          senderId: recipientId,
          senderType: SenderType.user,
          priority: Priority.normal,
          status: MessageStatus.read,
          cost: new Prisma.Decimal('0.00'),
        },
        {
          conversationId: conversation.id,
          content: 'Perfeito, muito obrigado!',
          senderId: recipientId,
          senderType: SenderType.user,
          priority: Priority.normal,
          status: MessageStatus.read,
          cost: new Prisma.Decimal('0.00'),
        },
      ],
    })
  }

  console.log(
    'Seed concluído: clientes pré-pago e pós-pago + conversa de exemplo.',
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
