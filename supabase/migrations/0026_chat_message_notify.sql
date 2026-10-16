create or replace function public.trg_chat_message_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread public.chat_threads;
  v_recipient uuid;
  v_title text;
begin
  select * into v_thread from public.chat_threads where id = new.thread_id;
  v_recipient := case
    when new.sender_id = v_thread.renter_id then v_thread.owner_id
    else v_thread.renter_id
  end;
  select title into v_title from public.billboards where id = v_thread.billboard_id;

  perform public.notify(
    v_recipient,
    'new_message',
    'New message about "' || coalesce(v_title, 'a billboard') || '"',
    new.thread_id
  );

  return new;
end;
$$;

create trigger chat_messages_notify
  after insert on public.chat_messages
  for each row execute function public.trg_chat_message_notify();
