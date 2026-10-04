import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class LiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LiveGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to WebSocket: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from WebSocket: ${client.id}`);
  }

  @SubscribeMessage('join_match')
  handleJoinMatch(@MessageBody() matchId: string, @ConnectedSocket() client: Socket) {
    const roomName = `match_${matchId}`;
    client.join(roomName);
    this.logger.log(`Client ${client.id} joined WebSocket room: ${roomName}`);
    return { event: 'joined_match', room: roomName };
  }

  @SubscribeMessage('leave_match')
  handleLeaveMatch(@MessageBody() matchId: string, @ConnectedSocket() client: Socket) {
    const roomName = `match_${matchId}`;
    client.leave(roomName);
    this.logger.log(`Client ${client.id} left WebSocket room: ${roomName}`);
  }

  /**
   * Broadcast real-time score updates to all viewers in the match room
   */
  broadcastScoreUpdate(matchId: string, payload: any) {
    const roomName = `match_${matchId}`;
    this.server.to(roomName).emit('score.updated', payload);
    this.logger.log(`Broadcasted score.updated to room ${roomName}`);
  }

  /**
   * Broadcast general live events (e.g. match completed, over ended)
   */
  broadcastMatchEvent(matchId: string, eventName: string, payload: any) {
    const roomName = `match_${matchId}`;
    this.server.to(roomName).emit(eventName, payload);
  }
}
