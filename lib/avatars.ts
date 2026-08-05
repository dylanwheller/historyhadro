import { ImageSourcePropType } from 'react-native';

export const AVATARS: ImageSourcePropType[] = [
  require('../assets/avatars/avatar_0.png'),
  require('../assets/avatars/avatar_1.png'),
  require('../assets/avatars/avatar_2.png'),
  require('../assets/avatars/avatar_3.png'),
  require('../assets/avatars/avatar_4.png'),
  require('../assets/avatars/avatar_5.png'),
];

export function getAvatarSource(id: number): ImageSourcePropType {
  const safe = Math.max(0, Math.min(Math.floor(id ?? 0), AVATARS.length - 1));
  return AVATARS[safe];
}
