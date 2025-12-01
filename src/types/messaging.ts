import { PulsarMessage } from "@/lib/pulsarService";

export type SendResult = {
  target: string;
  response: unknown;
  succeeded: boolean;
  message: string;
  timestamp: number;
};

export type MessageEntry = {
  key: string;
  message: PulsarMessage;
};

export type MessageLike = {
  messageId?: unknown;
  payload?: unknown;
  [key: string]: unknown;
};
