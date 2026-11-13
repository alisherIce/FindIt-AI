-- FindIt AI query-plan improvements: index the contact-request FK and
-- evaluate auth.uid() once per statement instead of once per candidate row.

create index if not exists item_contact_requests_item_id_idx
  on public.item_contact_requests (item_id);

drop policy if exists "Anyone can view active reports" on public.items;
create policy "Anyone can view active reports"
  on public.items for select
  using (status = 'active' or owner_id = (select auth.uid()));

drop policy if exists "Signed-in users can create their own reports" on public.items;
create policy "Signed-in users can create their own reports"
  on public.items for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "Owners can update their own reports" on public.items;
create policy "Owners can update their own reports"
  on public.items for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "Owners can delete their own reports" on public.items;
create policy "Owners can delete their own reports"
  on public.items for delete
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Participants can read contact requests" on public.item_contact_requests;
create policy "Participants can read contact requests"
  on public.item_contact_requests for select
  to authenticated
  using (sender_id = (select auth.uid()) or owner_id = (select auth.uid()));

drop policy if exists "Users can contact the owner of an active report" on public.item_contact_requests;
create policy "Users can contact the owner of an active report"
  on public.item_contact_requests for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and owner_id <> (select auth.uid())
    and exists (
      select 1 from public.items i
      where i.id = item_contact_requests.item_id
        and i.owner_id = item_contact_requests.owner_id
        and i.status = 'active'
    )
  );

drop policy if exists "Only report owners can respond to contact requests" on public.item_contact_requests;
create policy "Only report owners can respond to contact requests"
  on public.item_contact_requests for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and status in ('accepted', 'declined'));
