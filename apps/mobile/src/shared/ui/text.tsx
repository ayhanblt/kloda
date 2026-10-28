import { Text as NativeText, useWindowDimensions, type TextProps } from 'react-native';

export function Text(props: TextProps & { className?: string }) {
  const { fontScale } = useWindowDimensions();
  // Native custom-font measurements can remain stale after an OS text-size change.
  return <NativeText key={fontScale} {...props} />;
}
