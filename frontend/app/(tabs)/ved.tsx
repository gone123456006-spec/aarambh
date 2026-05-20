import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, SafeAreaView, StatusBar, Dimensions } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function VedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Video Player Area */}
      <View style={[styles.playerContainer, { paddingTop: insets.top }]}>
        <View style={styles.videoWrapper}>
           <Image 
             source={{ uri: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=1000' }} 
             style={styles.placeholderVideo}
           />
           <View style={styles.videoOverlay}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Feather name="chevron-down" size={28} color="#fff" />
              </TouchableOpacity>
              
              <View style={styles.centerControls}>
                <TouchableOpacity style={styles.controlIcon}>
                  <Ionicons name="play-back-outline" size={32} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.playBtn}>
                  <Ionicons name="pause" size={48} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.controlIcon}>
                  <Ionicons name="play-forward-outline" size={32} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.bottomControls}>
                <View style={styles.progressBar}>
                  <View style={styles.progressFill} />
                  <View style={styles.progressKnob} />
                </View>
                <View style={styles.timeRow}>
                  <Text style={styles.timeText}>04:20 / 08:45</Text>
                  <TouchableOpacity>
                    <Feather name="maximize" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
           </View>
        </View>
      </View>

      {/* Content Below Video */}
      <View style={styles.content}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.infoSection}>
            <Text style={styles.videoTitle}>Introduction to English - Beginner Level</Text>
            <Text style={styles.videoStats}>1.2k views • 2 days ago</Text>
            
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionItem}>
                <Feather name="thumbs-up" size={22} color="#4A5568" />
                <Text style={styles.actionLabel}>240</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionItem}>
                <Feather name="share-2" size={22} color="#4A5568" />
                <Text style={styles.actionLabel}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionItem}>
                <Feather name="download" size={22} color="#4A5568" />
                <Text style={styles.actionLabel}>Download</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.descriptionBox}>
            <Text style={styles.descriptionTitle}>Lesson Description</Text>
            <Text style={styles.descriptionText}>
              In this lesson, we will cover the basic foundations of the English language. 
              Starting from the alphabet to simple sentence structures.
            </Text>
          </View>

          <View style={styles.relatedSection}>
            <Text style={styles.sectionTitle}>Up Next</Text>
            <TouchableOpacity style={styles.nextCard}>
              <Image source={{ uri: 'https://picsum.photos/seed/b2/200/120' }} style={styles.nextThumb} />
              <View style={styles.nextInfo}>
                <Text style={styles.nextTitle}>Basic Words & Sentences</Text>
                <Text style={styles.nextMeta}>Lesson 2 • 10:15</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

import { ScrollView } from 'react-native-gesture-handler';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  playerContainer: {
    backgroundColor: '#000',
    width: '100%',
    aspectRatio: 16 / 9,
  },
  videoWrapper: {
    flex: 1,
    position: 'relative',
  },
  placeholderVideo: {
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  backBtn: {
    alignSelf: 'flex-start',
  },
  centerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  controlIcon: {
    opacity: 0.8,
  },
  playBtn: {
    backgroundColor: 'rgba(230, 0, 0, 0.8)',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControls: {
    width: '100%',
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    position: 'relative',
    marginBottom: 8,
  },
  progressFill: {
    width: '50%',
    height: '100%',
    backgroundColor: '#e60000',
    borderRadius: 2,
  },
  progressKnob: {
    position: 'absolute',
    left: '50%',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e60000',
    marginLeft: -6,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  infoSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  videoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A202C',
    lineHeight: 24,
  },
  videoStats: {
    fontSize: 13,
    color: '#718096',
    marginTop: 6,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 30,
  },
  actionItem: {
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: {
    fontSize: 12,
    color: '#4A5568',
    fontWeight: '600',
  },
  descriptionBox: {
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  descriptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#4A5568',
    lineHeight: 20,
  },
  relatedSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A202C',
    marginBottom: 16,
  },
  nextCard: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  nextThumb: {
    width: 120,
    height: 70,
    borderRadius: 10,
  },
  nextInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  nextTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A202C',
  },
  nextMeta: {
    fontSize: 12,
    color: '#718096',
    marginTop: 4,
  },
});
