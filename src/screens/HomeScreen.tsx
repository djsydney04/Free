import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Modal,
  Image,
  Linking,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import { supabase } from '../services/supabase';
import type { FreeEvent } from '../types';
import type { MainTabScreenProps } from '../types/navigation';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const CATEGORIES = ['ALL', 'FOOD', 'CONCERT', 'SPORTS', 'ACADEMIC', 'OTHER'] as const;
const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }: MainTabScreenProps<'Home'>) {
  const [events, setEvents] = useState<FreeEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<typeof CATEGORIES[number]>('ALL');
  const [userUniversity, setUserUniversity] = useState<string | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<FreeEvent | null>(null);
  const [creatorName, setCreatorName] = useState<string>('');

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      if (userData.user) {
        // Get user's university
        const { data: profileData } = await supabase
          .from('profiles')
          .select('university')
          .eq('user_id', userData.user.id)
          .single();

        if (profileData) {
          setUserUniversity(profileData.university);
          console.log('User university:', profileData.university);
        } else {
          console.log('No university found for user');
        }
      }

      // Get today's date at the start of the day (midnight)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      console.log('Filtering events from:', today.toISOString());
      console.log('Current category filter:', selectedCategory);
      
      // Fetch events
      let query = supabase
        .from('events')
        .select('*')
        .gte('start_date', today.toISOString()) // Today or future events
        .order('start_date', { ascending: true });

      if (selectedCategory !== 'ALL') {
        query = query.eq('category', selectedCategory);
      }

      // Temporarily make university filter more inclusive to see all events
      // If we have a university, fetch events from that university OR events with no university set
      if (userUniversity) {
        try {
          // Prepare base queries with date filter
          let universityQuery = supabase
            .from('events')
            .select('*')
            .gte('start_date', today.toISOString())
            .eq('university', userUniversity);
            
          let publicQuery = supabase
            .from('events')
            .select('*')
            .gte('start_date', today.toISOString())
            .is('university', null);
            
          // Apply category filter if not ALL
          if (selectedCategory !== 'ALL') {
            universityQuery = universityQuery.eq('category', selectedCategory);
            publicQuery = publicQuery.eq('category', selectedCategory);
          }
          
          // Execute both queries
          const [universityResult, publicResult] = await Promise.all([
            universityQuery,
            publicQuery
          ]);
          
          // Combine the results
          const combinedEvents = [
            ...(universityResult.data || []), 
            ...(publicResult.data || [])
          ];
          
          // Sort by start date
          combinedEvents.sort((a, b) => 
            new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
          );
          
          setEvents(combinedEvents);
          console.log('Combined events fetched:', combinedEvents.length);
          
          // Skip the regular query since we've already fetched events
          return;
        } catch (err) {
          console.error('Error with combined query, falling back to regular query:', err);
          // Fall back to a simple filter
          query = query.eq('university', userUniversity);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      
      console.log('Events fetched:', data?.length);
      if (data && data.length > 0) {
        console.log('First event:', {
          title: data[0].title,
          category: data[0].category,
          date: data[0].start_date,
          university: data[0].university
        });
      } else {
        console.log('No events found for the current filters');
      }
      setEvents(data || []);
    } catch (error: any) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('Category selected:', selectedCategory);
    fetchEvents();
  }, [selectedCategory]);

  // Add useFocusEffect to refresh events when the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log("HomeScreen focused - refreshing events");
      fetchEvents();
      return () => {
        // cleanup if needed
      };
    }, [])
  );

  // Function to get directions to the event
  const getDirections = (event: FreeEvent) => {
    if (!event.location) {
      Alert.alert('Error', 'No location information available');
      return;
    }
    
    const { latitude, longitude } = event.location;
    const scheme = Platform.OS === 'ios' ? 'maps:' : 'geo:';
    const url = Platform.OS === 'ios' 
      ? `${scheme}?ll=${latitude},${longitude}&q=${encodeURIComponent(event.location.address || 'Event Location')}`
      : `${scheme}${latitude},${longitude}?q=${encodeURIComponent(event.location.address || 'Event Location')}`;
      
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open maps application');
    });
  };
  
  // Function to fetch creator profile information
  const fetchCreatorProfile = async (userId: string) => {
    try {
      const { data: user, error } = await supabase
        .from('profiles')
        .select('university')
        .eq('user_id', userId)
        .single();
        
      if (error) throw error;
      
      if (user) {
        // Just using university as the "name" for now
        setCreatorName(user.university || 'Anonymous');
      }
    } catch (error) {
      console.error('Error fetching creator profile:', error);
      setCreatorName('Anonymous');
    }
  };
  
  // Expanded event modal
  const renderExpandedEventModal = () => {
    if (!expandedEvent) return null;
    
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={!!expandedEvent}
        onRequestClose={() => setExpandedEvent(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setExpandedEvent(null)}
            >
              <Ionicons name="close-circle" size={28} color="#6b7280" />
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>{expandedEvent.title}</Text>
            
            <View style={styles.modalCategoryContainer}>
              <Text style={styles.modalCategory}>{expandedEvent.category}</Text>
              <Text style={styles.modalDate}>
                {new Date(expandedEvent.start_date).toLocaleDateString()} at {' '}
                {new Date(expandedEvent.start_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </Text>
            </View>
            
            <Text style={styles.modalDescription}>{expandedEvent.description}</Text>
            
            {expandedEvent.location && (
              <View style={styles.modalLocationContainer}>
                <Text style={styles.modalSectionTitle}>Location</Text>
                <Text style={styles.modalLocation}>
                  {expandedEvent.location.address || 'Location not specified'}
                </Text>
                <TouchableOpacity 
                  style={styles.directionsButton}
                  onPress={() => getDirections(expandedEvent)}
                >
                  <Ionicons name="navigate-circle-outline" size={18} color="#fff" />
                  <Text style={styles.directionsButtonText}>Get Directions</Text>
                </TouchableOpacity>
              </View>
            )}
            
            <View style={styles.modalFooter}>
              <Text style={styles.modalSectionTitle}>Event Details</Text>
              <Text style={styles.modalFooterText}>
                Posted by: {creatorName}
              </Text>
              <Text style={styles.modalFooterText}>
                Posted on: {new Date(expandedEvent.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderEventCard = ({ item }: { item: FreeEvent }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => {
        setExpandedEvent(item);
        fetchCreatorProfile(item.created_by);
      }}
    >
      <Text style={styles.eventTitle}>{item.title}</Text>
      <Text style={styles.eventDescription} numberOfLines={2}>
        {item.description}
      </Text>
      
      {item.location && (
        <View style={styles.locationContainer}>
          <Ionicons name="location-outline" size={14} color="#6b7280" style={styles.locationIcon} />
          <Text style={styles.eventLocation}>
            {item.location.address || 'Location not specified'}
          </Text>
        </View>
      )}
      
      <View style={styles.eventFooter}>
        <Text style={styles.eventCategory}>{item.category}</Text>
        <Text style={styles.eventDate}>
          {new Date(item.start_date).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.cardActionHint}>
        <Text style={styles.cardActionHintText}>Tap to view details</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsContainer}
        >
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.pill,
                selectedCategory === category && styles.activePill,
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                style={[
                  styles.pillText,
                  selectedCategory === category && styles.activePillText,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={events}
        renderItem={renderEventCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchEvents} />
        }
      />
      
      {renderExpandedEventModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  filtersContainer: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  pillsContainer: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  activePill: {
    backgroundColor: '#6366f1',
    borderColor: '#4f46e5',
  },
  pillText: {
    color: '#4b5563',
    fontWeight: '600',
    fontSize: 13,
  },
  activePillText: {
    color: '#fff',
  },
  listContent: {
    padding: 15,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationIcon: {
    marginRight: 8,
  },
  eventLocation: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  cardActionHint: {
    marginTop: 8,
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    borderRadius: 4,
    alignItems: 'center',
  },
  cardActionHintText: {
    color: '#6b7280',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    width: width * 0.9,
    maxHeight: width * 0.9,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  modalCategoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalCategory: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  modalDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  modalDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  modalLocationContainer: {
    marginBottom: 12,
  },
  modalSectionTitle: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  modalLocation: {
    fontSize: 12,
    color: '#6b7280',
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderWidth: 1,
    borderColor: '#6b7280',
    borderRadius: 4,
  },
  directionsButtonText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 8,
  },
  modalFooter: {
    marginTop: 12,
    alignItems: 'center',
  },
  modalFooterText: {
    fontSize: 12,
    color: '#6b7280',
  },
}); 