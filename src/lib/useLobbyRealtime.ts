import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

/**
 * Subscribes to Supabase Realtime changes on the matchmaking tables
 * (matchmaking_lobbies and matchmaking_lobby_members).
 *
 * When any INSERT, UPDATE, or DELETE occurs on either table,
 * the provided `onChanged` callback is invoked (debounced to avoid
 * rapid successive re-fetches).
 *
 * Enable Realtime on these tables in your Supabase Dashboard:
 *   Database → Tables → matchmaking_lobbies → toggle "Enable Realtime"
 *   Database → Tables → matchmaking_lobby_members → toggle "Enable Realtime"
 */
export function useLobbyRealtime(onChanged: () => void) {
  const callbackRef = useRef(onChanged);
  callbackRef.current = onChanged;

  useEffect(() => {
    // Debounce rapid events (e.g. multiple members joining near-simultaneously)
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        callbackRef.current();
      }, 400);
    };

    const channel = supabase
      .channel('lobby-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matchmaking_lobbies',
        },
        debouncedRefresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matchmaking_lobby_members',
        },
        debouncedRefresh,
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);
}
