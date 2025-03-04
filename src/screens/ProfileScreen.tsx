import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { supabase } from '../services/supabase';
import type { User, UserProfile, FreeEvent } from '../types';
import type { MainTabScreenProps } from '../types/navigation';

export default function ProfileScreen({ navigation }: MainTabScreenProps<'Profile'>) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userEvents, setUserEvents] = useState<FreeEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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
    const isExpired = eventDate < new Date();

    return (
      <View key={event.id} style={[styles.eventCard, isExpired && styles.expiredCard]}>
        <Text style={styles.eventTitle}>{event.title}</Text>
        <Text style={styles.eventDescription} numberOfLines={2}>
          {event.description}
        </Text>
        <View style={styles.eventFooter}>
          <Text style={styles.eventCategory}>{event.category}</Text>
          <Text style={styles.eventDate}>
            {eventDate.toLocaleDateString()}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.profileSection}>
        <Text style={styles.email}>{user?.email}</Text>
        {profile && (
          <View style={styles.profileInfo}>
            <Text style={styles.university}>{profile.university}</Text>
            {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          </View>
        )}
      </View>

      <View style={styles.eventsSection}>
        <Text style={styles.sectionTitle}>Your Events</Text>
        {userEvents.length > 0 ? (
          userEvents.map(renderEventCard)
        ) : (
          <Text style={styles.noEventsText}>
            You haven't created any events yet
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  signOutButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  signOutButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  profileSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  email: {
    fontSize: 18,
    color: '#4b5563',
    marginBottom: 8,
  },
  profileInfo: {
    marginTop: 12,
  },
  university: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '600',
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    color: '#6b7280',
  },
  eventsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  expiredCard: {
    opacity: 0.6,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventCategory: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  eventDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  noEventsText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 20,
  },
}); 