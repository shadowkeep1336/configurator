import { ammoNames, icon, type Catalog } from '../data';

export function DamageGlyph({ catalog, damage }: { catalog: Catalog; damage: number })
{
  const def = catalog.data.damageTypes.find((d) => d.type === damage);
  return def?.icon ? <img className="glyph element" src={icon(def.icon)} alt={def.name} /> : null;
}

export function EnergyGlyph({ catalog, energy }: { catalog: Catalog; energy: number })
{
  const def = catalog.data.energyTypes.find((e) => e.type === energy);
  return def?.icon ? <img className="glyph element" src={icon(def.icon)} alt={`${def.name} energy`} /> : null;
}

export function AmmoGlyph({ catalog, ammo }: { catalog: Catalog; ammo: number })
{
  const def = catalog.data.ammoTypes.find((a) => a.type === ammo);
  return def?.icon ? <img className="glyph ammo" src={icon(def.icon)} alt={`${ammoNames[ammo]} ammo`} /> : null;
}
