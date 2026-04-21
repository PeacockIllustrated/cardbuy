-- ================================================================
-- Phase 7 · Shop seed
-- ================================================================
-- Ports the 12 rows from `lib/mock/mock-listings.ts` into
-- `lewis_listings` so the freshly-migrated shop has inventory the
-- moment `/shop` loads. Idempotent — `on conflict (sku) do nothing`.
--
-- Lewis can edit / add / remove via `/admin/inventory` after this.
-- Re-running the seed is a no-op.
-- ================================================================

insert into lewis_listings (
  card_id, sku, variant, condition, grading_company, grade,
  price_gbp, cost_basis_gbp, qty_in_stock, qty_reserved,
  status, is_featured, featured_priority, condition_notes
) values
  -- Featured headline pieces
  ('base1-4',  'BASE1-4-PSA9-01',  'graded', null, 'PSA', '9',   949,   700, 1, 0, 'active', true, 1, 'Centring 55/45, sharp corners.'),
  ('base1-2',  'BASE1-2-PSA10-02', 'graded', null, 'PSA', '10', 3990,  3100, 1, 0, 'active', true, 2, 'Pristine. Sealed in PSA case.'),
  ('base1-15', 'BASE1-15-PSA9-03', 'graded', null, 'PSA', '9',   695,   510, 1, 0, 'active', true, 3, 'Strong centring, clean surface.'),
  ('base3-15', 'BASE3-15-PSA9-13', 'graded', null, 'PSA', '9',  1180,   820, 1, 0, 'active', true, 4, 'Fossil Zapdos — electric and iconic.'),

  -- Raw mid-tier inventory
  ('base1-4',  'BASE1-4-NM-04',  'raw',    'NM', null, null,  425,   320, 1, 0, 'active', false, null, 'Clean. No whitening.'),
  ('base1-4',  'BASE1-4-LP-05',  'raw',    'LP', null, null,  320,   240, 2, 0, 'active', false, null, 'Light edge wear.'),
  ('base1-13', 'BASE1-13-NM-06', 'raw',    'NM', null, null,   95,    65, 3, 0, 'active', false, null, null),
  ('base2-6',  'BASE2-6-NM-07',  'raw',    'NM', null, null,   38,    22, 8, 1, 'active', false, null, null),
  ('base3-1',  'BASE3-1-PSA10-08', 'graded', null, 'PSA', '10', 165,  105, 2, 0, 'active', false, null, null),
  ('base4-3',  'BASE4-3-NM-09',  'raw',    'NM', null, null,  175,   110, 1, 0, 'active', false, null, 'Fresh from box.'),

  -- Bulk
  ('base1-58', 'BASE1-58-NM-10', 'raw',    'NM', null, null,    6.5,   2.4, 47, 0, 'active', false, null, 'Bulk Base Set Pikachu.'),

  -- Hidden / sold-out edge cases
  ('base1-15', 'BASE1-15-MP-11', 'raw',    'MP', null, null,   60,    40, 0, 0, 'sold_out', false, null, null),
  ('base5-4',  'BASE5-4-NM-12',  'raw',    'NM', null, null,  480,   320, 1, 0, 'hidden',   false, null, 'Hidden pending photo refresh.')
on conflict (sku) do nothing;

-- ================================================================
-- Done.
-- ================================================================
