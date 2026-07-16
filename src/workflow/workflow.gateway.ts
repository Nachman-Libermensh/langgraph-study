import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'; // ודא שייבאת את OnGatewayConnection ו- OnGatewayDisconnect
import { Server, Socket } from 'socket.io';
import { WorkflowService } from './workflow.service';

@WebSocketGateway({ cors: true })
export class WorkflowGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly workflowService: WorkflowService) {}

  // פונקציה שתרוץ אוטומטית כשלקוח מתחבר
  handleConnection(client: Socket) {
    console.log(`[Socket] לקוח חדש התחבר! מזהה: ${client.id}`);
  }

  // פונקציה שתרוץ אוטומטית כשלקוח מתנתק
  handleDisconnect(client: Socket) {
    console.log(`[Socket] לקוח התנתק: ${client.id}`);
  }

  @SubscribeMessage('runWorkflow')
  async handleRunWorkflow(
    @MessageBody() data: { message: string; threadId: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log('[Socket] קיבלתי בקשה להרצת הגרף!', data);
    client.emit('workflowLog', { status: 'הגרף מתחיל לרוץ...' });

    try {
      const finalState = await this.workflowService.runStreamGraph(
        data.message,
        data.threadId,
        (chunk) => {
          client.emit('workflowLog', { update: chunk });
        },
      );

      client.emit('workflowLog', {
        status: 'הריצה הסתיימה בהצלחה!',
        finalState,
      });
    } catch (error) {
      console.error('[Socket Error]', error);

      const message = error instanceof Error ? error.message : 'Unknown error';

      client.emit('workflowError', { error: message });
    }
  }
}
