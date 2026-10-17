-- Keep Master Admin global while Assistant Admin stays assignment-scoped.
-- Run after the base schema and the staff/assignment migrations.

drop policy if exists "profiles_select_self_or_staff" on public.profiles;
create policy "profiles_select_self_or_staff"
on public.profiles
for select
using (
  auth.uid() = id
  or public.current_role() = 'master_admin'
  or public.can_access_user(coalesce(user_id, id))
);

drop policy if exists "carts_self_or_staff" on public.carts;
create policy "carts_self_or_staff"
on public.carts
for all
using (public.can_access_user(user_id))
with check (public.can_access_user(user_id));

drop policy if exists "cart_items_self_or_staff" on public.cart_items;
create policy "cart_items_self_or_staff"
on public.cart_items
for all
using (
  exists (
    select 1
    from public.carts c
    where c.id = cart_id
      and public.can_access_user(c.user_id)
  )
)
with check (
  exists (
    select 1
    from public.carts c
    where c.id = cart_id
      and public.can_access_user(c.user_id)
  )
);

drop policy if exists "document_reviews_staff_only" on public.document_reviews;
create policy "document_reviews_staff_only"
on public.document_reviews
for all
using (
  public.current_role() = 'master_admin'
  or exists (
    select 1
    from public.documents d
    where d.id = document_id
      and public.can_access_user(d.user_id)
  )
)
with check (
  public.current_role() = 'master_admin'
  or exists (
    select 1
    from public.documents d
    where d.id = document_id
      and public.can_access_user(d.user_id)
  )
);

drop policy if exists "notifications_self_or_staff" on public.notifications;
create policy "notifications_self_or_staff"
on public.notifications
for select
using (
  user_id is null
  or public.can_access_user(user_id)
);

drop policy if exists "notifications_self_update_read" on public.notifications;
create policy "notifications_self_update_read"
on public.notifications
for update
using (
  user_id is not null
  and public.can_access_user(user_id)
)
with check (
  user_id is not null
  and public.can_access_user(user_id)
);
