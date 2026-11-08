import { useState } from 'react';
import { energyNames, type Catalog, type Hash, type SocketDef, type SocketKind } from '../data';
import { energyUse, type ItemState } from '../model';
import { Dropdown } from './Dropdown';
import { PlugIcon } from './Tile';

type SetPlug = (index: number, plug: Hash) => void;

export function PerkColumns({
  catalog,
  sockets,
  state,
  setPlug,
}: {
  catalog: Catalog;
  sockets: SocketDef[];
  state: ItemState;
  setPlug: SetPlug;
})
{
  return (
    <div className="perk-columns">
      {sockets.map((s) =>
      {
        const pool = catalog.pool(s);
        return (
          <div className="perk-column" key={s.index}>
            {pool.map((h) =>
            {
              const plug = catalog.plug(h);
              const on = state.plugs[s.index] === h;
              return (
                <button
                  key={h}
                  className={`perk ${on ? 'on' : ''}`}
                  onClick={() => setPlug(s.index, h)}
                  aria-label={plug?.name}
                  aria-pressed={on}
                >
                  <PlugIcon plug={plug} round size={48} />
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function modBlocked(catalog: Catalog, socket: SocketDef, state: ItemState, plug: Hash): string | null
{
  if (socket.kind !== 'mod') return null;
  const cost = catalog.plug(plug)?.cost;
  const energy = energyUse(catalog, state);
  if (!cost || !energy) return null;
  if (cost[1] !== 0 && cost[1] !== energy.type) return `Needs ${energyNames[cost[1]]} armor`;
  const current = catalog.plug(state.plugs[socket.index])?.cost?.[0] ?? 0;
  const free = energy.capacity - (energy.used - current);
  if (cost[0] > free) return `Costs ${cost[0]} energy, ${free} free`;
  return null;
}

const kindLabels: Partial<Record<SocketKind, string>> = {
  shader: 'Shader',
  ornament: 'Ornament',
  tracker: 'Tracker',
  mod: 'Mod',
  masterwork: 'Masterwork',
  armorMasterwork: 'Masterwork',
  intrinsic: 'Intrinsic',
  perk: 'Perk',
};

export function socketLabel(catalog: Catalog, socket: SocketDef): string
{
  const pool = catalog.pool(socket);
  const categories = pool.map((h) => catalog.plug(h)?.category ?? '');
  if (socket.kind === 'mod')
  {
    if (categories.some((c) => c.startsWith('enhancements.season'))) return 'Seasonal mod';
    if (categories.some((c) => c.startsWith('v300.weapon.damage_type'))) return 'Damage type';
    if (categories.some((c) => c === 'enhancements.v2_general')) return 'General mod';
    if (categories.some((c) => /^enhancements\.v2_/.test(c))) return 'Armor mod';
    return 'Mod';
  }
  if (socket.kind === 'masterwork')
  {
    return pool.some((h) => catalog.plug(h)?.name.includes('Catalyst')) ? 'Catalyst' : 'Masterwork';
  }
  return kindLabels[socket.kind] ?? 'Socket';
}

export function PlugBox({
  catalog,
  socket,
  state,
  setPlug,
  options,
  nameOf,
}: {
  catalog: Catalog;
  socket: SocketDef;
  state: ItemState;
  setPlug: SetPlug;
  options?: Hash[];
  nameOf?: (h: Hash) => string;
})
{
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const pool = options ?? catalog.pool(socket);
  const currentHash = state.plugs[socket.index];
  const current = catalog.plug(currentHash);
  const label = (h: Hash) => (nameOf ? nameOf(h) : catalog.plug(h)?.name ?? '');
  const locked = pool.length < 2;
  const searchable = socket.kind !== 'mod' && pool.length > 16;
  const q = query.trim().toLowerCase();
  const shown = q ? pool.filter((h) => label(h).toLowerCase().includes(q)) : pool;

  return (
    <Dropdown
      open={open}
      setOpen={(o) =>
      {
        setOpen(o);
        if (!o) setQuery('');
      }}
      className="box"
      triggerClassName="box-current"
      disabled={locked}
      trigger={
        <>
          <PlugIcon plug={current} size={44} />
          <span className="box-text">
            <span className="box-label">{socketLabel(catalog, socket)}</span>
            <span className="box-name">{current ? label(currentHash) : '—'}</span>
            {current?.cost && current.cost[0] > 0 && (
              <span className={`cost energy-${energyNames[current.cost[1]].toLowerCase()}`}>{current.cost[0]} energy</span>
            )}
          </span>
        </>
      }
    >
      {searchable && (
        <input className="search-input dropdown-search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
      )}
      <div className="dropdown-list" role="listbox">
        {shown.map((h) =>
        {
          const plug = catalog.plug(h);
          const blocked = modBlocked(catalog, socket, state, h);
          const on = currentHash === h;
          return (
            <button
              key={h}
              role="option"
              aria-selected={on}
              className={`dropdown-option plug-option ${on ? 'on' : ''}`}
              disabled={!!blocked && !on}
              onClick={() =>
              {
                setPlug(socket.index, h);
                setOpen(false);
                setQuery('');
              }}
            >
              <PlugIcon plug={plug} size={32} />
              <span className="option-text">
                <span className="option-name">{label(h)}</span>
                {blocked ? (
                  <span className="option-sub blocked">{blocked}</span>
                ) : plug?.cost && plug.cost[0] > 0 ? (
                  <span className={`option-sub energy-${energyNames[plug.cost[1]].toLowerCase()}`}>
                    {plug.cost[0]} {energyNames[plug.cost[1]]}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
        {shown.length === 0 && <p className="muted small">Nothing matches.</p>}
      </div>
    </Dropdown>
  );
}

export function EnergyBox({ catalog, socket, state, setPlug }: { catalog: Catalog; socket: SocketDef; state: ItemState; setPlug: SetPlug })
{
  const energy = energyUse(catalog, state);
  const options = catalog
    .pool(socket)
    .map((h) => ({ h, e: catalog.energyOf(h)! }))
    .filter((o) => o.e);
  const types = [...new Set(options.map((o) => o.e.type))];
  const pick = (type: number) =>
  {
    const full = options.filter((o) => o.e.type === type).sort((a, b) => b.e.capacity - a.e.capacity)[0];
    if (full) setPlug(socket.index, full.h);
  };
  if (!energy) return null;
  const color = energyNames[energy.type].toLowerCase();
  return (
    <div className="box energy">
      <span className="box-label">
        Energy · {energyNames[energy.type]} · mods use {energy.used} of {energy.capacity}
        {energy.used > energy.capacity ? ' (over)' : ''}
      </span>
      <div className="chips">
        {types.map((t) => (
          <button key={t} className={`chip energy-chip energy-${energyNames[t].toLowerCase()} ${t === energy.type ? 'on' : ''}`} onClick={() => pick(t)}>
            {energyNames[t]}
          </button>
        ))}
      </div>
      <div className={`meter energy-${color}`} role="img" aria-label={`Mods use ${energy.used} of ${energy.capacity} energy`}>
        {Array.from({ length: energy.capacity }, (_, i) => i + 1).map((n) => (
          <span key={n} className={`pip cap ${n <= energy.used ? 'used' : ''}`} />
        ))}
      </div>
    </div>
  );
}
