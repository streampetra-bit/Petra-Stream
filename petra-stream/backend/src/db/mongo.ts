import mongoose, { Schema, model } from 'mongoose';

type StreamDoc = {
  streamId: string;
  streamer: string;
  title?: string;
  description?: string;
  status?: string;
  streamKey?: string;
  tags?: string[];
  playbackUrl?: string;
  screenPlaybackUrl?: string;
  cameraPlaybackUrl?: string;
  webrtcPlaybackUrl?: string;
  screenWebrtcPlaybackUrl?: string;
  cameraWebrtcPlaybackUrl?: string;
  sourceMode?: string;
  thumbnail?: string;
  viewerCount?: number;
};

type TipDoc = {
  streamId: string;
  from: string;
  to: string;
  token: string;
  amount: string;
  memo?: string | null;
  txHash?: string;
};

type UserDoc = {
  username: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  followers?: string[];
  following?: string[];
};

type ChatDoc = {
  id: string;
  streamId: string;
  user: string;
  text: string;
  ts: number;
  replyToUser?: string;
  replyToText?: string;
};

type NotificationDoc = {
  user: string;
  title: string;
  description?: string;
  kind: string;
  ts: number;
};

const StreamModel = model<StreamDoc>(
  'Stream',
  new Schema<StreamDoc>(
    {
      streamId: { type: String, index: true, unique: true },
      streamer: String,
      title: String,
      description: String,
      status: String,
      streamKey: String,
      tags: [String],
      playbackUrl: String,
      screenPlaybackUrl: String,
      cameraPlaybackUrl: String,
      webrtcPlaybackUrl: String,
      screenWebrtcPlaybackUrl: String,
      cameraWebrtcPlaybackUrl: String,
      sourceMode: String,
      thumbnail: String,
      viewerCount: Number
    },
    { timestamps: true }
  )
);

const TipModel = model<TipDoc>(
  'Tip',
  new Schema<TipDoc>(
    {
      streamId: { type: String, index: true },
      from: String,
      to: String,
      token: String,
      amount: String,
      memo: String,
      txHash: String
    },
    { timestamps: true }
  )
);

const UserModel = model<UserDoc>(
  'User',
  new Schema<UserDoc>(
    {
      username: { type: String, index: true, unique: true },
      displayName: String,
      bio: String,
      avatar: String,
      followers: [String],
      following: [String]
    },
    { timestamps: true }
  )
);

const ChatModel = model<ChatDoc>(
  'Chat',
  new Schema<ChatDoc>(
    {
      id: { type: String, index: true, unique: true },
      streamId: { type: String, index: true },
      user: String,
      text: String,
      ts: Number,
      replyToUser: String,
      replyToText: String
    },
    { timestamps: true }
  )
);

const NotificationModel = model<NotificationDoc>(
  'Notification',
  new Schema<NotificationDoc>(
    {
      user: { type: String, index: true },
      title: String,
      description: String,
      kind: String,
      ts: Number
    },
    { timestamps: true }
  )
);

let mongoReady = false;
let mongoConnecting: Promise<boolean> | null = null;

async function ensureMongo(): Promise<boolean> {
  if (mongoReady) return true;
  if (!process.env.MONGO_URL) return false;
  if (mongoConnecting) return mongoConnecting;

  mongoConnecting = mongoose
    .connect(process.env.MONGO_URL, {
      maxPoolSize: 4
    })
    .then(() => {
      mongoReady = true;
      return true;
    })
    .catch(err => {
      console.error('Mongo fallback connection failed', err?.message || err);
      mongoReady = false;
      return false;
    })
    .finally(() => {
      mongoConnecting = null;
    });

  return mongoConnecting;
}

export async function mongoUpsertStream(data: StreamDoc) {
  if (!(await ensureMongo())) return;
  await StreamModel.findOneAndUpdate({ streamId: data.streamId }, { $set: data }, { upsert: true, new: true }).exec();
}

export async function mongoMarkOffline(streamId: string) {
  if (!(await ensureMongo())) return;
  await StreamModel.findOneAndUpdate({ streamId }, { $set: { status: 'offline' } }).exec();
}

export async function mongoListActiveStreams(): Promise<StreamDoc[]> {
  if (!(await ensureMongo())) return [];
  return StreamModel.find({ status: 'online' }).sort({ updatedAt: -1 }).lean().exec();
}

export async function mongoFindStream(streamId: string): Promise<StreamDoc | null> {
  if (!(await ensureMongo())) return null;
  return StreamModel.findOne({ streamId }).lean().exec();
}

export async function mongoFindStreamByKey(streamKey: string): Promise<StreamDoc | null> {
  if (!(await ensureMongo())) return null;
  return StreamModel.findOne({ streamKey }).lean().exec();
}

export async function mongoSaveTip(data: TipDoc) {
  if (!(await ensureMongo())) return;
  await TipModel.create(data);
}

export async function mongoListTips(streamId: string, limit = 50): Promise<TipDoc[]> {
  if (!(await ensureMongo())) return [];
  return TipModel.find({ streamId }).sort({ createdAt: -1 }).limit(limit).lean().exec();
}

export async function mongoUpsertUser(data: Partial<UserDoc> & { username: string }) {
  if (!(await ensureMongo())) return;
  await UserModel.findOneAndUpdate({ username: data.username }, { $set: data }, { upsert: true, new: true }).exec();
}

export async function mongoFindUser(username: string): Promise<UserDoc | null> {
  if (!(await ensureMongo())) return null;
  return UserModel.findOne({ username }).lean().exec();
}

export async function mongoToggleFollow(username: string, target: string, follow: boolean) {
  if (!(await ensureMongo())) return;
  await UserModel.updateOne(
    { username },
    follow ? { $addToSet: { following: target } } : { $pull: { following: target } },
    { upsert: true }
  ).exec();
  await UserModel.updateOne(
    { username: target },
    follow ? { $addToSet: { followers: username } } : { $pull: { followers: username } },
    { upsert: true }
  ).exec();
}

export async function mongoSaveChatMessage(msg: ChatDoc) {
  if (!(await ensureMongo())) return;
  await ChatModel.findOneAndUpdate({ id: msg.id }, { $set: msg }, { upsert: true }).exec();
}

export async function mongoListChatMessages(streamId: string, limit = 100): Promise<ChatDoc[]> {
  if (!(await ensureMongo())) return [];
  return ChatModel.find({ streamId }).sort({ ts: 1 }).limit(limit).lean().exec();
}

export async function mongoSaveNotification(data: NotificationDoc) {
  if (!(await ensureMongo())) return;
  await NotificationModel.create(data);
}

export async function mongoListNotifications(user: string, limit = 20): Promise<NotificationDoc[]> {
  if (!(await ensureMongo())) return [];
  return NotificationModel.find({ user }).sort({ ts: -1, createdAt: -1 }).limit(limit).lean().exec();
}
