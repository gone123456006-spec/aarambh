import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Dimensions, Pressable, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

const SLIDER_DATA = [
  { id: '1', image: require('../assets/images/intro1.png') },
  { id: '2', image: require('../assets/images/intro2.png') },
  { id: '3', image: require('../assets/images/intro3.png') },
  { id: '4', image: require('../assets/images/intro4.png') },
];

export default function IntroScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const timer = setInterval(() => {
      let nextIndex = currentIndex + 1;
      if (nextIndex >= SLIDER_DATA.length) {
        nextIndex = 0; // loop back to start
      }
      setCurrentIndex(nextIndex);
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }, 3000); // 3 seconds per slide

    return () => clearInterval(timer);
  }, [currentIndex]);

  const renderItem = ({ item }: { item: typeof SLIDER_DATA[0] }) => {
    return (
      <View style={styles.slide}>
        <Image source={item.image} style={styles.slideImage} resizeMode="contain" />
      </View>
    );
  };

  const handleGetStarted = () => {
    router.push('/login');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

      {/* Header Logo */}
      <View style={styles.logoContainer}>
        <Image source={require('../assets/images/aarambh-icon.png')} style={styles.logoImage} resizeMode="contain" />
      </View>

      {/* Dashed Separator Line */}
      <View style={styles.separatorLine} />

      {/* Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.titleText}>
          Unlock Your English Skills with{'\n'}
          <Text style={styles.highlightText}>Expert Guidance</Text>
        </Text>
      </View>

      {/* Image Carousel */}
      <View style={styles.carouselContainer}>
        <FlatList
          ref={flatListRef}
          data={SLIDER_DATA}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          renderItem={renderItem}
          onScrollToIndexFailed={(info) => {
            const wait = new Promise(resolve => setTimeout(resolve, 500));
            wait.then(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
            });
          }}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / width);
            setCurrentIndex(index);
          }}
        />
      </View>

      {/* Carousel Dots */}
      <View style={styles.dotContainer}>
        {SLIDER_DATA.map((_, index) => (
          <View
            key={`dot-${Math.random().toString()}`}
            style={[
              styles.dot,
              currentIndex === index ? styles.activeDot : styles.inactiveDot
            ]}
          />
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={handleGetStarted}
        >
          <Text style={styles.buttonText}>Get started</Text>
        </Pressable>

        <Pressable style={styles.signInContainer} onPress={() => router.push('/login')}>
          <Text style={styles.signInText}>
            Already have an account? <Text style={styles.signInLink}>Sign in</Text>
          </Text>
        </Pressable>
      </View>

      {/* Terms */}
      <View style={styles.termsContainer}>
        <Text style={styles.termsText}>
          By proceeding you agree to our{'\n'}
          <Text style={styles.termsLink}>Terms & Condition</Text> and <Text style={styles.termsLink}>privacy policy</Text>
        </Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  logoImage: {
    width: 48,
    height: 48,
  },
  separatorLine: {
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1.5,
    borderStyle: 'dashed',
    width: '80%',
    alignSelf: 'center',
    marginBottom: 20,
  },
  titleContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: '#000000',
    lineHeight: 32,
  },
  highlightText: {
    color: '#e60000',
  },
  carouselContainer: {
    height: width * 0.8, // Adjust to fit aspect ratio properly
  },
  slide: {
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideImage: {
    width: width * 0.8,
    height: '100%',
  },
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: '#e60000',
  },
  inactiveDot: {
    backgroundColor: '#c4c4c4',
  },
  actionsContainer: {
    paddingHorizontal: 20,
    marginTop: 'auto',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#e60000',
    borderRadius: 8,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  signInContainer: {
    alignItems: 'center',
  },
  signInText: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '600',
  },
  signInLink: {
    color: '#e60000',
  },
  termsContainer: {
    alignItems: 'center',
    paddingVertical: 15,
    backgroundColor: '#f9f9f9',
    width: '100%',
  },
  termsText: {
    fontSize: 12,
    textAlign: 'center',
    color: '#8b8b8b',
    lineHeight: 18,
  },
  termsLink: {
    color: '#e60000',
  },
});
