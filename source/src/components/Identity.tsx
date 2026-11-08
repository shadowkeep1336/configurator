import { useMemo, useState, type Dispatch, type ReactNode } from 'react';
import { icon, type Catalog, type Hash } from '../data';
import type { Action, Character } from '../model';
import { Dropdown } from './Dropdown';

type Open = 'emblem' | 'gender' | 'race' | null;

export function IdentityPanel({
  catalog,
  character,
  index,
  dispatch,
}: {
  catalog: Catalog;
  character: Character;
  index: number;
  dispatch: Dispatch<Action>;
})
{
  const [open, setOpen] = useState<Open>(null);
  const toggle = (which: Exclude<Open, null>) => (o: boolean) => setOpen(o ? which : null);
  const emblem = catalog.item(character.emblem);
  const race = catalog.data.races.find((r) => r.type === character.raceType);
  const gender = catalog.data.genders.find((g) => g.type === character.genderType);

  return (
    <section className="identity">
      <div className="identity-boxes">
        <Field
          label="Emblem"
          open={open === 'emblem'}
          setOpen={toggle('emblem')}
          wide
          body={
            <span className="dropdown-value">
              {emblem?.icon && <img className="emblem-icon" src={icon(emblem.icon)} alt="" />}
              <span className="dropdown-text">{emblem?.name}</span>
            </span>
          }
        >
          <EmblemList
            catalog={catalog}
            value={character.emblem}
            onPick={(h) =>
            {
              dispatch({ type: 'emblem', character: index, emblem: h });
              setOpen(null);
            }}
          />
        </Field>

        <Field
          label="Gender"
          open={open === 'gender'}
          setOpen={toggle('gender')}
          body={
            <span className="dropdown-value">
              <span className="dropdown-text">{gender?.name}</span>
            </span>
          }
        >
          <Options
            options={catalog.data.genders.map((g) => ({ value: g.type, label: g.name }))}
            value={character.genderType}
            onPick={(genderType) =>
            {
              dispatch({ type: 'identity', character: index, genderType });
              setOpen(null);
            }}
          />
        </Field>

        <Field
          label="Race"
          open={open === 'race'}
          setOpen={toggle('race')}
          body={
            <span className="dropdown-value">
              <span className="dropdown-text">{race?.name}</span>
            </span>
          }
        >
          <Options
            options={catalog.data.races.map((r) => ({ value: r.type, label: r.name }))}
            value={character.raceType}
            onPick={(raceType) =>
            {
              dispatch({ type: 'identity', character: index, raceType });
              setOpen(null);
            }}
          />
        </Field>
      </div>
    </section>
  );
}

const emblemStyle = (e?: { nameplate?: string; color?: [number, number, number] }) => ({
  backgroundImage: e?.nameplate ? `url(${icon(e.nameplate)})` : undefined,
  backgroundColor: e?.color ? `rgb(${e.color.join(',')})` : undefined,
});

function Field({
  label,
  body,
  open,
  setOpen,
  wide,
  children,
}: {
  label: string;
  body: ReactNode;
  open: boolean;
  setOpen: (o: boolean) => void;
  wide?: boolean;
  children: ReactNode;
})
{
  return (
    <Dropdown
      open={open}
      setOpen={setOpen}
      triggerClassName="identity-box dropdown-trigger"
      panelClassName={wide ? 'wide' : ''}
      trigger={
        <>
          <span className="identity-head">
            <span className="identity-label">{label}</span>
          </span>
          {body}
        </>
      }
    >
      {children}
    </Dropdown>
  );
}

function Options<T extends number>({ options, value, onPick }: { options: { value: T; label: string }[]; value: T; onPick: (v: T) => void })
{
  return (
    <div className="dropdown-list" role="listbox">
      {options.map((o) => (
        <button key={o.value} role="option" aria-selected={o.value === value} className={`dropdown-option ${o.value === value ? 'on' : ''}`} onClick={() => onPick(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function EmblemList({ catalog, value, onPick }: { catalog: Catalog; value: Hash; onPick: (h: Hash) => void })
{
  const [query, setQuery] = useState('');
  const all = useMemo(() => catalog.groupsFor('emblem'), [catalog]);
  const shown = useMemo(() =>
  {
    const q = query.trim().toLowerCase();
    return q
      ? all.filter((h) =>
      {
          const e = catalog.item(h)!;
          return e.name.toLowerCase().includes(q) || (e.source ?? '').toLowerCase().includes(q);
        })
      : all;
  }, [catalog, all, query]);
  return (
    <>
      <input
        className="search-input dropdown-search"
        placeholder="Search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="dropdown-list emblem-list" role="listbox">
        {shown.map((h) =>
        {
          const e = catalog.item(h)!;
          return (
            <button
              key={h}
              role="option"
              aria-selected={value === h}
              className={`dropdown-option emblem-option ${value === h ? 'on' : ''}`}
              onClick={() => onPick(h)}
            >
              <span className="emblem-art" style={emblemStyle(e)} />
              <span className="emblem-name">{e.name}</span>
            </button>
          );
        })}
        {shown.length === 0 && <p className="muted small">Nothing matches.</p>}
      </div>
    </>
  );
}
