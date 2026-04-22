-- 0013 · Open read access on lewis_cards + lewis_card_prices to anon.
--
-- Original policies (migration 0012) required `to authenticated`, so
-- anonymous visitors to /card/[id] saw zero rows and got the MOCK
-- price chip regardless of sync coverage. Market prices aren't
-- sensitive — they mirror TCGplayer's public data — so gating them
-- behind auth was an over-conservative default.
--
-- We drop the authenticated-only read policies and replace them with
-- policies open to both anon and authenticated. Write policies are
-- untouched (admin-only).

-- ----------------------------------------------------------------
-- lewis_cards
-- ----------------------------------------------------------------
drop policy if exists "lewis_cards: authenticated read" on public.lewis_cards;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'lewis_cards'
      and policyname = 'lewis_cards: public read'
  ) then
    create policy "lewis_cards: public read"
      on public.lewis_cards for select
      to anon, authenticated
      using (true);
  end if;
end $$;

-- ----------------------------------------------------------------
-- lewis_card_prices
-- ----------------------------------------------------------------
drop policy if exists "lewis_card_prices: authenticated read"
  on public.lewis_card_prices;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'lewis_card_prices'
      and policyname = 'lewis_card_prices: public read'
  ) then
    create policy "lewis_card_prices: public read"
      on public.lewis_card_prices for select
      to anon, authenticated
      using (true);
  end if;
end $$;
