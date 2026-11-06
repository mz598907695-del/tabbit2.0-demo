import { pickSpaceIcon } from "./spaceIcons";
export type SpaceAppearance = { name: string; icon: string };

export default function SpaceIcon({ space, className = "" }: { space: SpaceAppearance; className?: string }) {
  return <img className={className} src={space.icon || pickSpaceIcon(space.name)} alt="" draggable={false}/>;
}
