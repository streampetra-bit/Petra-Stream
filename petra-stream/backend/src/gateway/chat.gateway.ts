import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { StreamsService } from '../streams/streams.service';
import { mongoListChatMessages, mongoSaveChatMessage } from '../db/mongo';

type Participant = { user: string; streamId: string };

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private participants = new Map<string, Set<string>>(); // streamId => users
  private clientMeta = new Map<string, Participant>(); // socketId => meta

  constructor(private readonly streams: StreamsService) {}

  handleConnection() {
    // no-op
  }

  handleDisconnect(client: Socket) {
    const meta = this.clientMeta.get(client.id);
    if (meta) {
      const set = this.participants.get(meta.streamId);
      if (set) {
        set.delete(meta.user);
        this.participants.set(meta.streamId, set);
        this.broadcastParticipants(meta.streamId);
      }
      this.clientMeta.delete(client.id);
      this.streams.removeViewer(meta.streamId, meta.user);
    }
  }

  @SubscribeMessage('join')
  handleJoin(@MessageBody() room: string, @ConnectedSocket() client: Socket) {
    client.join(room);

    // track participants only for stream rooms ("stream:<id>")
    if (room?.startsWith('stream:')) {
      const streamId = room.replace('stream:', '');
      const user = client.handshake.query.user?.toString() || `anon-${client.id.slice(0, 4)}`;
      this.trackParticipant(client, streamId, user);
      this.streams.addViewer(streamId, user);
      // send recent chat history to this client
      mongoListChatMessages(streamId, 120)
        .then(history => {
          client.emit('chat:history', { streamId, messages: history ?? [] });
        })
        .catch(() => {});
    }
    return { ok: true };
  }

  @SubscribeMessage('chat:message')
  handleMessage(@MessageBody() payload: any, @ConnectedSocket() client: Socket) {
    const streamId = payload?.streamId;
    if (!streamId) return;
    const room = `stream:${streamId}`;
    client.join(room);
    this.server.to(room).emit('chat:message', payload);
    // ensure participant list includes sender
    const user = payload?.user || client.handshake.query.user?.toString() || `anon-${client.id.slice(0, 4)}`;
    this.trackParticipant(client, streamId, user);
    this.streams.addViewer(streamId, user);
    this.broadcastParticipants(streamId);
    // persist message for history
    mongoSaveChatMessage({
      id: payload?.id || `${Date.now()}-${Math.random()}`,
      streamId,
      user,
      text: payload?.text || '',
      ts: payload?.ts || Date.now()
    }).catch(() => {});
  }

  @SubscribeMessage('chat:typing')
  handleTyping(@MessageBody() payload: any, @ConnectedSocket() client: Socket) {
    const streamId = payload?.streamId;
    if (!streamId) return;
    const room = `stream:${streamId}`;
    client.join(room);
    this.server.to(room).emit('chat:typing', payload);
  }

  @SubscribeMessage('chat:moderate')
  handleModeration(@MessageBody() payload: any, @ConnectedSocket() client: Socket) {
    const streamId = payload?.streamId;
    if (!streamId) return;
    const room = `stream:${streamId}`;
    if (payload?.action === 'delete') {
      this.server.to(room).emit('chat:moderation:deleted', { id: payload.id, streamId });
    }
    // timeouts not enforced in this MVP
  }

  private trackParticipant(client: Socket, streamId: string, user: string) {
    this.clientMeta.set(client.id, { streamId, user });
    const set = this.participants.get(streamId) ?? new Set<string>();
    set.add(user);
    this.participants.set(streamId, set);
  }

  private broadcastParticipants(streamId: string) {
    const list = Array.from(this.participants.get(streamId) ?? []);
    this.server.to(`stream:${streamId}`).emit('chat:participants', { streamId, participants: list });
  }
}
