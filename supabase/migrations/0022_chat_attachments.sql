alter table public.chat_messages add column attachment_path text;

insert into storage.buckets (id, name, public) values
  ('chat-attachments', 'chat-attachments', false);

create policy "chat attachments participants read" on storage.objects
  for select using (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.chat_threads t
      where t.id::text = (storage.foldername(name))[1]
        and (t.renter_id = auth.uid() or t.owner_id = auth.uid() or public.is_admin())
    )
  );

create policy "chat attachments participants insert" on storage.objects
  for insert with check (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.chat_threads t
      where t.id::text = (storage.foldername(name))[1]
        and (t.renter_id = auth.uid() or t.owner_id = auth.uid())
    )
  );
