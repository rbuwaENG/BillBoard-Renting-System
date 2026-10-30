import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { uniqueChannelName } from '@/lib/realtime'
import { supabase } from '@/lib/supabase'

export interface ChatThread {
  id: string
  billboardId: string
  renterId: string
  ownerId: string
  createdAt: string
}

export interface ChatMessage {
  id: string
  threadId: string
  senderId: string
  body: string
  attachmentPath: string | null
  createdAt: string
}

interface ChatThreadRow {
  id: string
  billboard_id: string
  renter_id: string
  owner_id: string
  created_at: string
}

interface ChatMessageRow {
  id: string
  thread_id: string
  sender_id: string
  body: string
  attachment_path: string | null
  created_at: string
}

function toChatThread(row: ChatThreadRow): ChatThread {
  return {
    id: row.id,
    billboardId: row.billboard_id,
    renterId: row.renter_id,
    ownerId: row.owner_id,
    createdAt: row.created_at,
  }
}

function toChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    body: row.body,
    attachmentPath: row.attachment_path,
    createdAt: row.created_at,
  }
}

// Renter-side: get (or lazily create) the single thread for this billboard.
export function useChatThread(billboardId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['chat-thread', billboardId, user?.uid],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_or_create_chat_thread', {
        p_billboard_id: billboardId,
      })
      if (error) throw error
      return toChatThread(data)
    },
    enabled: !!user && !!billboardId,
  })
}

export function useStartChatThread() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (billboardId: string) => {
      const { data, error } = await supabase.rpc('get_or_create_chat_thread', {
        p_billboard_id: billboardId,
      })
      if (error) throw error
      return toChatThread(data)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-chat-threads'] }),
  })
}

export function useChatMessages(threadId: string | undefined) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!threadId) return
    const channel = supabase
      .channel(uniqueChannelName(`chat-messages:${threadId}`))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        () => qc.invalidateQueries({ queryKey: ['chat-messages', threadId] }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [threadId, qc])

  return useQuery({
    queryKey: ['chat-messages', threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data as ChatMessageRow[]).map(toChatMessage)
    },
    enabled: !!threadId,
  })
}

export function useSendChatMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      threadId,
      senderId,
      body,
      attachmentPath,
    }: {
      threadId: string
      senderId: string
      body: string
      attachmentPath?: string
    }) => {
      const { error } = await supabase.from('chat_messages').insert({
        thread_id: threadId,
        sender_id: senderId,
        body,
        attachment_path: attachmentPath ?? null,
      })
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['chat-messages', vars.threadId] })
      qc.invalidateQueries({ queryKey: ['my-chat-threads'] })
      qc.invalidateQueries({ queryKey: ['owner-chat-threads'] })
    },
  })
}

export interface ChatThreadPreview extends ChatThread {
  counterpartName: string
  billboardTitle: string
  lastMessage: { body: string; senderId: string; createdAt: string } | null
}

interface ThreadPreviewRow extends ChatThreadRow {
  billboards: { title: string } | null
  counterpart: { display_name: string }[] | { display_name: string } | null
  chat_messages:
    { body: string; sender_id: string; created_at: string }[] | null
}

function toThreadPreview(row: ThreadPreviewRow): ChatThreadPreview {
  const counterpart = Array.isArray(row.counterpart)
    ? row.counterpart[0]
    : row.counterpart
  return {
    ...toChatThread(row),
    counterpartName: counterpart?.display_name ?? 'Unknown',
    billboardTitle: row.billboards?.title ?? 'Billboard',
    lastMessage: row.chat_messages?.[0]
      ? {
          body: row.chat_messages[0].body,
          senderId: row.chat_messages[0].sender_id,
          createdAt: row.chat_messages[0].created_at,
        }
      : null,
  }
}

// Renter-side inbox: every thread the renter started, with the owner's name.
export function useMyChatThreads() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-chat-threads', user?.uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_threads')
        .select(
          '*, billboards(title), counterpart:profiles!chat_threads_owner_id_fkey(display_name), chat_messages(body, sender_id, created_at)',
        )
        .eq('renter_id', user!.uid)
        .order('created_at', {
          foreignTable: 'chat_messages',
          ascending: false,
        })
        .limit(1, { foreignTable: 'chat_messages' })
      if (error) throw error
      return (data as unknown as ThreadPreviewRow[]).map(toThreadPreview)
    },
    enabled: !!user,
  })
}

// Rentor-side inbox: every thread started against one of the owner's billboards.
export function useOwnerChatThreads() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['owner-chat-threads', user?.uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_threads')
        .select(
          '*, billboards(title), counterpart:profiles!chat_threads_renter_id_fkey(display_name), chat_messages(body, sender_id, created_at)',
        )
        .eq('owner_id', user!.uid)
        .order('created_at', {
          foreignTable: 'chat_messages',
          ascending: false,
        })
        .limit(1, { foreignTable: 'chat_messages' })
      if (error) throw error
      return (data as unknown as ThreadPreviewRow[]).map(toThreadPreview)
    },
    enabled: !!user,
  })
}
