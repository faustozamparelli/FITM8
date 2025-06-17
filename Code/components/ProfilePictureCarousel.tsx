import React, { useState } from "react";
import { View, Image, FlatList, Dimensions, StyleSheet } from "react-native";
import { ThemedText } from "./ThemedText";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ProfilePictureCarouselProps {
  profilePics: string[];
  getImageUrl: (bucketRef: string) => string;
  cardWidth?: number;
}

export function ProfilePictureCarousel({
  profilePics,
  getImageUrl,
  cardWidth = SCREEN_WIDTH * 0.9,
}: ProfilePictureCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!profilePics || profilePics.length === 0) {
    return (
      <View style={[styles.container, { width: cardWidth - 40 }]}>
        <View style={styles.placeholderImage}>
          <ThemedText style={styles.placeholderText}>No Photo</ThemedText>
        </View>
      </View>
    );
  }

  const imageWidth = cardWidth - 40; // Account for card padding

  const renderPicture = ({ item }: { item: string; index: number }) => (
    <Image
      source={{ uri: getImageUrl(item) }}
      style={[styles.image, { width: imageWidth }]}
      resizeMode="cover"
    />
  );

  const onScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / imageWidth);
    setCurrentIndex(currentIndex);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={profilePics}
        renderItem={renderPicture}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        snapToInterval={imageWidth}
        decelerationRate="fast"
      />

      {profilePics.length > 1 && (
        <View style={styles.dotsContainer}>
          {profilePics.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, index === currentIndex && styles.activeDot]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  image: {
    height: 300,
    borderRadius: 15,
  },
  placeholderImage: {
    height: 300,
    backgroundColor: "#f0f0f0",
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: 18,
    opacity: 0.5,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.3)",
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: "#007AFF",
  },
});
