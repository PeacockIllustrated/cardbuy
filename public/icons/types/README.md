# Pokémon TCG type icons

Vendored from [partywhale/pokemon-type-icons](https://github.com/partywhale/pokemon-type-icons) (MIT, © 2022 James Watkins — see `LICENSE`).

Mapping from partywhale's filenames to ours:

| partywhale | cardbuy       |
|------------|---------------|
| electric   | lightning     |
| normal     | colorless     |
| dark       | (not vendored — Gen 2+) |
| steel      | (not vendored — Gen 2+) |
| fairy      | (not vendored — Gen 2+) |
| dragon     | (not vendored — Gen 2+) |

Others (fire, water, grass, psychic, fighting) keep their original names.

Used by `components/cardbuy/particles/recipes.ts` as particle sprites. Each SVG is a coloured disc with a white pictogram on top (256×256 viewBox). Canvas draws them over a shared pop-art ink outline ring so the brand surround stays consistent across types.

To add more types later: curl the equivalent file from the partywhale repo, rename it to the cardbuy naming convention, add the mapping to `resolveElementalType()` in `recipes.ts`.
