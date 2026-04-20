# TCG card data

First-generation Pokémon TCG card data, sourced from the open-source
[`PokemonTCG/pokemon-tcg-data`](https://github.com/PokemonTCG/pokemon-tcg-data)
repository. MIT-licensed and safe to commit.

## Contents (`en/`)

| File          | Set                          | Cards |
|---------------|------------------------------|------:|
| `base1.json`  | Base Set                     |   102 |
| `base2.json`  | Jungle                       |    64 |
| `base3.json`  | Fossil                       |    62 |
| `base4.json`  | Base Set 2                   |   130 |
| `base5.json`  | Team Rocket                  |    83 |
| `basep.json`  | Wizards Black Star Promos    |    53 |

Total: ~494 cards.

## Schema

pokemontcg.io **v2** card shape. Card ids are `{setId}-{number}`
(e.g. `base1-4` for Base Set Charizard). Images are hosted at
`images.pokemontcg.io` — `small` and `large` URLs per card.

See [`lib/types/card.ts`](../../lib/types/card.ts) for the TypeScript
interface and [`lib/fixtures/cards.ts`](../../lib/fixtures/cards.ts) for
the loader.

## Why in-repo

~2 MB total, never changes (these sets are locked first-generation
history), and committing means zero setup friction. Phase 2 will swap
this fixture for Supabase-backed data; until then it's a static read
at build time.

## Last upstream sync

2022-10-10 — the point at which the upstream repo's first-generation
files were last touched. If we ever update them, bump the
`LAST_SYNCED` constant in [`lib/fixtures/cards.ts`](../../lib/fixtures/cards.ts).

## Licence

MIT, per the upstream repository.
