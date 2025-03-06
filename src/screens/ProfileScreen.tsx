import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
  Platform,
  Image,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { supabase } from '../services/supabase';
import type { User, UserProfile, FreeEvent } from '../types';
import type { MainTabScreenProps } from '../types/navigation';
// Use a try-catch for importing Ionicons
let Ionicons: any;
try {
  Ionicons = require('react-native-vector-icons/Ionicons').default;
} catch (e) {
  console.warn('Ionicons not found, using fallback');
  // Fallback implementation if needed
  Ionicons = {
    name: () => null,
  };
}

export default function ProfileScreen({ navigation }: MainTabScreenProps<'Profile'>) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userEvents, setUserEvents] = useState<FreeEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hostedEvents, setHostedEvents] = useState<FreeEvent[]>([]);

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      setUser(user);

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch user's events
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (eventsError) throw eventsError;
      setUserEvents(eventsData);

      // Only keep hosted events
      const hostedEvents = eventsData.filter(event => event.created_by === user.id);
      setHostedEvents(hostedEvents);
    } catch (error: any) {
      console.error('Error fetching profile:', error.message);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: any) {
      Alert.alert('Error signing out', error.message);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserProfile();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const renderEventCard = (event: FreeEvent) => {
    const eventDate = new Date(event.start_date);
    const now = new Date();
    const isExpired = eventDate < now;
    
    // Format the location properly
    const locationText = event.location?.address || 
                        event.location?.buildingName || 
                        'No location specified';
    
    return (
      <View key={event.id} style={[styles.eventCard, isExpired && styles.expiredCard]}>
        <Text style={styles.eventTitle}>{event.title}</Text>
        <Text style={styles.eventDescription} numberOfLines={2}>
          {event.description}
        </Text>
        <View style={styles.eventMeta}>
          <Text style={styles.eventLocation}>{locationText}</Text>
          <Text style={styles.eventDate}>
            {eventDate.toLocaleDateString()}
          </Text>
        </View>
      </View>
    );
  };

  const renderEvents = (events: FreeEvent[]) => {
    if (events.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="alert-circle" size={40} color="#8e8e93" style={styles.emptyStateIcon} />
          <Text style={styles.emptyStateText}>No events found</Text>
        </View>
      );
    }
    return events.map(renderEventCard);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.profileImageContainer}>
            {profile?.profileImage ? (
              <Image 
                source={{ uri: profile.profileImage }} 
                style={styles.profileImage}
                accessibilityLabel="Profile image"
              />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Ionicons name="person" size={40} color="#c7c7cc" />
              </View>
            )}
          </View>
          
          <Text style={styles.username}>
            {user?.username || user?.email?.split('@')[0] || 'User'}
          </Text>
          
          {profile?.bio && (
            <Text style={styles.bio}>{profile.bio}</Text>
          )}
          
          <TouchableOpacity 
            style={styles.editProfileButton}
            onPress={() => {
              console.log('Edit profile pressed');
            }}
            accessibilityLabel="Edit profile"
            accessibilityHint="Double tap to edit your profile information"
          >
            <Text style={styles.editProfileButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Events</Text>
          </View>
          
          {hostedEvents.length > 0 ? (
            renderEvents(hostedEvents)
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={40} color="#c7c7cc" />
              <Text style={styles.emptyStateText}>
                You haven't created any events yet
              </Text>
            </View>
          )}
        </View>
        
        <TouchableOpacity 
          style={styles.signOutButton}
          onPress={handleSignOut}
          accessibilityLabel="Sign out"
          accessibilityHint="Double tap to sign out of your account"
        >
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 32,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
    backgroundColor: '#ffffff',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  profileImageContainer: {
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f2f2f7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e5ea',
  },
  username: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  bio: {
    fontSize: 15,
    color: '#3c3c43',
    marginBottom: 20,
    textAlign: 'center',
    maxWidth: '80%',
  },
  editProfileButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#f2f2f7',
  },
  editProfileButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#007AFF',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e5ea',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  loader: {
    padding: 30,
  },
  emptyStateContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateIcon: {
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8e8e93',
    textAlign: 'center',
  },
  eventCard: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
    backgroundColor: '#ffffff',
  },
  eventTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 14,
    color: '#3c3c43',
    marginBottom: 12,
  },
  eventMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eventDate: {
    fontSize: 13,
    color: '#8e8e93',
  },
  eventLocation: {
    fontSize: 13,
    color: '#8e8e93',
  },
  expiredCard: {
    opacity: 0.7,
    borderColor: '#e5e5ea',
  },
  signOutButton: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  signOutButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ff3b30', // iOS red color for destructive actions
  },
}); 