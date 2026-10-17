// Shared test setup for the Camp: two players by name, with a given amount of Scrap each.
import { freshCamp, freshWallet, withWallet, type CampState } from '../../src/game/loadout';
import type { Team } from '../../src/game/types';

/** Alex plays Team Past and Sam plays Team Future, like tests/scenes/fakes.ts `players`. */
export const NAMES: Record<Team, string> = { PAST: 'Alex', FUTURE: 'Sam' };

export function campWith(alex: number, sam = 0): CampState {
  return withWallet(
    withWallet(freshCamp(), { ...freshWallet('Alex'), scrap: alex, earned: alex }),
    { ...freshWallet('Sam'), scrap: sam, earned: sam },
  );
}
