"use client";
import React from "react";
import type { ActiveTopic, ConnectionStatus } from "@/hooks/useLiveTopic";

function getConnectionStatusColor(status: ConnectionStatus) {
  switch (status) {
    case "connected":
      return "bg-green-500";
    case "connecting":
      return "bg-yellow-500 animate-pulse";
    default:
      return "bg-gray-400";
  }
}

function getConnectionStatusText(status: ConnectionStatus) {
  switch (status) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting...";
    default:
      return "Disconnected";
  }
}

export function LiveControls({
  activeTopic,
  connectionStatus,
  isLiveUpdating,
  maxMessages,
  onChangeMax,
  onToggleLive,
}: {
  activeTopic: ActiveTopic;
  connectionStatus: ConnectionStatus;
  isLiveUpdating: boolean;
  maxMessages: number;
  onChangeMax: (n: number) => void;
  onToggleLive: () => void;
}) {
  if (!activeTopic) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-xl">
      <div className="flex items-center gap-3">
        <div
          className={`w-3 h-3 rounded-full ${getConnectionStatusColor(
            connectionStatus
          )}`}
        />
        <div className="flex flex-col">
          <span className="text-xs text-white">
            {getConnectionStatusText(connectionStatus)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-white">Limit:</label>
        <input
          type="number"
          value={maxMessages}
          onChange={(e) =>
            onChangeMax(Number.parseInt(e.target.value || "10", 10))
          }
          className="w-16 px-2 py-1 bg-input border border-border rounded text-foreground text-xs focus:outline-none  focus:ring-primary transition-all"
          min={1}
          max={100}
        />
      </div>
      <button
        onClick={onToggleLive}
        className={`cursor-pointer text-xs px-3 py-1.5 font-medium rounded-lg transition-colors ${
          isLiveUpdating
            ? "bg-green-600/70 border border-green-500 hover:bg-green-600 text-white"
            : "bg-primary/60 border border-primary hover:bg-primary/70 text-white"
        }`}
      >
        {isLiveUpdating ? "Stop Live" : "Start Live"}
      </button>
    </div>
  );
}
