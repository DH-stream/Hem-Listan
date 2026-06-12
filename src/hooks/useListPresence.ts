import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { UserProfile } from "../types";
import { getSupabaseClient } from "../lib/supabase";
import { mapPresenceState, type ListPresenceMeta, type PresentUser } from "../lib/presence";

const DEBUG_STORAGE_KEY = "hem-listan-debug-enabled";

const isDebugEnabled = () => {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("debug") === "1"
      || window.localStorage.getItem(DEBUG_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const presenceLog = (message: string, details: Record<string, unknown>) => {
  if (isDebugEnabled()) console.log(`[presence] ${message}`, details);
};

export interface CurrentPresenceProfile {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  avatarPath?: string | null;
}

export const useListPresence = (
  listId: string | null,
  currentProfile: CurrentPresenceProfile | UserProfile | null,
) => {
  const [presentUsers, setPresentUsers] = useState<PresentUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const userId = currentProfile?.userId ?? null;
  const displayName = currentProfile?.displayName ?? "";
  const avatarUrl = currentProfile?.avatarUrl ?? null;
  const avatarPath = currentProfile?.avatarPath ?? null;

  useEffect(() => {
    if (!listId || !userId || !displayName) {
      setPresentUsers([]);
      setIsConnected(false);
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setPresentUsers([]);
      setIsConnected(false);
      return;
    }

    let channel: RealtimeChannel | null = null;
    let disposed = false;

    try {
      presenceLog("subscribe start", { listId });
      channel = client.channel(`list-presence:${listId}`, {
        config: { presence: { key: userId } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          if (!channel || disposed) return;
          const users = mapPresenceState(
            channel.presenceState<ListPresenceMeta>() as Record<string, ListPresenceMeta[]>,
            userId,
          );
          setPresentUsers(users);
          presenceLog("sync", { count: users.length });
        })
        .subscribe(async (status) => {
          if (disposed || !channel) return;
          if (status !== "SUBSCRIBED") {
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              setIsConnected(false);
              setPresentUsers([]);
            }
            return;
          }

          setIsConnected(true);
          presenceLog("subscribed", { listId });
          presenceLog("track user", { userId });
          try {
            await channel.track({
              userId,
              displayName,
              avatarUrl,
              avatarPath,
              listId,
              lastSeenAt: new Date().toISOString(),
            });
          } catch (error) {
            if (isDebugEnabled()) console.warn("[presence] track failed", { listId, userId, error });
          }
        });
    } catch (error) {
      setPresentUsers([]);
      setIsConnected(false);
      if (isDebugEnabled()) console.warn("[presence] subscribe failed", { listId, error });
    }

    return () => {
      disposed = true;
      setPresentUsers([]);
      setIsConnected(false);
      presenceLog("unsubscribe", { listId });
      if (channel) {
        const channelToRemove = channel;
        void (async () => {
          try {
            await channelToRemove.untrack();
          } catch {
            // Realtime may already be disconnected; list navigation must still continue.
          }
          try {
            await client.removeChannel(channelToRemove);
          } catch {
            // Presence is best-effort and must never block the list UI.
          }
        })();
      }
    };
  }, [avatarPath, avatarUrl, displayName, listId, userId]);

  return { presentUsers, isConnected };
};
