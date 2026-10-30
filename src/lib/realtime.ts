// supabase-js hands back the *existing* channel when `channel(topic)` is
// called with a topic that's already registered, and calling `.on()` on a
// channel that has already joined throws. Two components subscribing to the
// same stream (or a StrictMode double-mount racing `removeChannel`) would hit
// exactly that, so every subscription gets its own topic.
export function uniqueChannelName(base: string): string {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : // randomUUID is only exposed in secure contexts (https / localhost).
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${base}:${suffix}`
}
