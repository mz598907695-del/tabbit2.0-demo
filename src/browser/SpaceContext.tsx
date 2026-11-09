import { createContext } from 'react';
import { spaceIconByName } from '../spaceIcons';
import type { SpaceAppearance } from '../SpaceIcon';

const spaceIcons = ["汉堡", "游戏手柄", "18 禁", "树", "脑子", "蘑菇", "薯条", "酷", "车"].map((name) => spaceIconByName[name]);
const spaceNames = ["美团", "游戏", "娱乐", "生活", "思考", "灵感", "休闲", "个人", "汽车"];
export const defaultSpaceAppearances = spaceNames.slice(0, 5).map((name, index) => ({ name, icon: spaceIcons[index] }));
export const SpaceContext = createContext<{ selectedSpace: number; selectSpace: (index: number) => void; visibleSpaceIds: number[]; spaces: SpaceAppearance[] }>({ selectedSpace: 0, selectSpace: () => {}, visibleSpaceIds: defaultSpaceAppearances.map((_, index) => index), spaces: defaultSpaceAppearances });
