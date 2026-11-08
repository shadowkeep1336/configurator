import { energyNames, icon, type Catalog, type Hash, type PlugDef } from '../data';
import { energyUse, type ItemState } from '../model';

const tierClasses: Record<number, string> = { 2: 'common', 3: 'uncommon', 4: 'rare', 5: 'legendary', 6: 'exotic' };

export function ItemIcon({
  catalog,
  hash,
  state,
  size = 64,
  count,
}: {
  catalog: Catalog;
  hash: Hash;
  state?: ItemState | null;
  size?: number | string;
  count?: number;
})
{
  const item = catalog.item(hash);
  if (!item) return <div className="item-icon missing" style={{ width: size, height: size }} />;
  const energy = state ? energyUse(catalog, state) : undefined;
  const masterworked = isMasterworked(catalog, state);
  return (
    <div
      className={`item-icon tier-${tierClasses[item.tier] ?? 'basic'} ${masterworked ? 'masterworked' : ''}`}
      style={{ width: size, height: size }}
    >
      {item.icon ? <img src={icon(item.icon)} alt="" loading="lazy" /> : <span className="noicon">{item.name[0]}</span>}
      {energy && (
        <span className={`energy-badge energy-${energyNames[energy.type].toLowerCase()}`}>
          {energy.capacity}
        </span>
      )}
      {count !== undefined && count > 1 && <span className="count">×{count}</span>}
    </div>
  );
}

function isMasterworked(catalog: Catalog, state?: ItemState | null)
{
  if (!state) return false;
  const def = catalog.item(state.hash);
  if (def?.classType !== undefined) return true;
  for (const s of def?.sockets ?? [])
  {
    const plug = catalog.plug(state.plugs[s.index]);
    if (s.kind === 'masterwork' && plug?.stat?.[1] === 10) return true;
    if (s.kind === 'masterwork' && plug?.name.includes('Catalyst')) return true;
    if (s.kind === 'energy' && plug?.capacity?.[0] === 10) return true;
  }
  return false;
}

const initials = (name?: string) =>
  name
    ? name
        .split(/\s+/)
        .filter((w) => /^[A-Za-z]/.test(w))
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('')
    : '?';

export function PlugIcon({ plug, round, size = 40 }: { plug?: PlugDef; round?: boolean; size?: number })
{
  return (
    <span className={`plug-icon ${round ? 'round' : ''}`} style={{ width: size, height: size }}>
      {plug?.icon ? <img src={icon(plug.icon)} alt="" /> : <span className="noicon">{initials(plug?.name)}</span>}
    </span>
  );
}
