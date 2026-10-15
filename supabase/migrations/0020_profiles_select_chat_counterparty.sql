create policy profiles_select_chat_counterparty on public.profiles
  for select using (
    exists (
      select 1 from public.chat_threads t
      where (t.renter_id = profiles.id and t.owner_id = auth.uid())
         or (t.owner_id = profiles.id and t.renter_id = auth.uid())
    )
  );
