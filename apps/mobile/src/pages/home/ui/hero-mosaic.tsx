import { Image, StyleSheet, View } from 'react-native';

export interface HeroPhoto {
  id: string;
  uri: string;
}

const styles = StyleSheet.create({
  mosaicImage: { width: '100%', height: '100%' },
});

function Tile({ uri, dimmed }: { uri: string; dimmed: boolean }) {
  return (
    <View className="flex-1 overflow-hidden">
      <Image
        source={{ uri }}
        style={styles.mosaicImage}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
        className={dimmed ? 'opacity-50' : ''}
      />
    </View>
  );
}

export function HeroMosaic({ photos, dimmed }: { photos: HeroPhoto[]; dimmed: boolean }) {
  if (photos.length === 1) {
    return (
      <View className="aspect-[1.75] w-full overflow-hidden bg-surface-2">
        <Tile uri={photos[0]!.uri} dimmed={dimmed} />
      </View>
    );
  }
  if (photos.length === 2) {
    return (
      <View className="aspect-[1.75] w-full flex-row gap-1 bg-surface-2">
        {photos.map((photo) => <Tile key={photo.id} uri={photo.uri} dimmed={dimmed} />)}
      </View>
    );
  }
  if (photos.length === 3) {
    return (
      <View className="aspect-[1.75] w-full flex-row gap-1 bg-surface-2">
        <Tile uri={photos[0]!.uri} dimmed={dimmed} />
        <View className="flex-1 gap-1">
          {photos.slice(1, 3).map((photo) => <Tile key={photo.id} uri={photo.uri} dimmed={dimmed} />)}
        </View>
      </View>
    );
  }
  return (
    <View className="aspect-[1.75] w-full flex-row gap-1 bg-surface-2">
      <Tile uri={photos[0]!.uri} dimmed={dimmed} />
      <View className="flex-1 gap-1">
        <Tile uri={photos[1]!.uri} dimmed={dimmed} />
        <View className="flex-1 flex-row gap-1">
          <Tile uri={photos[2]!.uri} dimmed={dimmed} />
          <Tile uri={photos[3]!.uri} dimmed={dimmed} />
        </View>
      </View>
    </View>
  );
}

export function HeroMosaicSkeleton() {
  return (
    <View testID="hero-mosaic-skeleton" accessible={false} className="aspect-[1.75] w-full flex-row gap-1 bg-surface-2">
      <View className="flex-1 bg-surface-1/60" />
      <View className="flex-1 gap-1">
        <View className="flex-1 bg-surface-1/60" />
        <View className="flex-1 flex-row gap-1">
          <View className="flex-1 bg-surface-1/60" />
          <View className="flex-1 bg-surface-1/60" />
        </View>
      </View>
    </View>
  );
}
