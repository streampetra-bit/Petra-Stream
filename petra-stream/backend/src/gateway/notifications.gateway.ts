import { WebSocketServer, WebSocketGateway } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true })
export class NotificationsGateway {
  // Use the definite-assignment assertion so TS won't complain.
  @WebSocketServer()
  server!: Server;

  // emit tip notification to a stream room (clients should join `stream:<streamId>`)
  notifyTip(streamId: string, payload: any) {
    try {
      this.server.to(`stream:${streamId}`).emit('tip', payload);
      this.server.to(`streamer:${streamId}`).emit('tip', payload);
    } catch (err) {
      // If server is not ready yet, swallow the error for now - logs could be added.
      // In production you'd want better lifecycle handling.
      // console.warn('notifyTip failure', err);
    }
  }

  notifyUser(user: string, payload: any) {
    try {
      this.server.to(`user:${user}`).emit('notification', payload);
    } catch (err) {
      // swallow
    }
  }

  notifyUsers(users: string[], payload: any) {
    users.forEach((user) => this.notifyUser(user, payload));
  }
}
