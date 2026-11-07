drop policy if exists "Admins can view all social boost orders" on public.social_boost_orders;
create policy "Admins can view all social boost orders" on public.social_boost_orders
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins can update social boost orders" on public.social_boost_orders;
create policy "Admins can update social boost orders" on public.social_boost_orders
  for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Resellers can delete own social boost prices" on public.social_boost_reseller_pricing;
create policy "Resellers can delete own social boost prices" on public.social_boost_reseller_pricing
  for delete to authenticated using (auth.uid() = user_id);
