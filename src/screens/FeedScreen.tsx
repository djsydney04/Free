import React, { useEffect, useState, useCallback } from 'react';
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
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { supabase } from '../services/supabase';
import type { FreeEvent } from '../types';
import type { MainTabScreenProps } from '../types/navigation';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

const CATEGORIES = ['ALL', 'FOOD', 'CONCERT', 'SPORTS', 'ACADEMIC', 'OTHER'] as const;
const SORT_OPTIONS = ['RECENT', 'POPULAR', 'NEARBY'] as const;
const DISTANCE_OPTIONS = [0.5, 1, 2, 5, 10] as const; // miles
const { width } = Dimensions.get('window');

export default function FeedScreen({ navigation }: MainTabScreenProps<'Feed'>) {
  const [events, setEvents] = useState<FreeEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<FreeEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<typeof CATEGORIES[number]>('ALL');
  const [selectedSortOption, setSelectedSortOption] = useState<typeof SORT_OPTIONS[number]>('RECENT');
  const [selectedDistance, setSelectedDistance] = useState<typeof DISTANCE_OPTIONS[number]>(5);
  const [userUniversity, setUserUniversity] = useState<string | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<FreeEvent | null>(null);
  const [creatorName, setCreatorName] = useState<string>('');
  const [isFiltering, setIsFiltering] = useState(false);
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [showDistanceOptions, setShowDistanceOptions] = useState(false);

  // Get user location
  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('Location permission denied');
        return;
      }
      
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
    } catch (error) {
      console.log('Error getting location:', error);
    }
  };

  // Calculate distance between two coordinates in miles
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3958.8; // Earth's radius in miles
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

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
        }
      }

      // Get today's date at the start of the day (midnight)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Prepare base queries with date filter to get ALL events regardless of category
      let universityQuery = supabase
        .from('events')
        .select('*')
        .gte('start_date', today.toISOString());
        
      let publicQuery = supabase
        .from('events')
        .select('*')
        .gte('start_date', today.toISOString())
        .is('university', null);
        
      // If we have a university, include it in the first query  
      if (userUniversity) {
        universityQuery = universityQuery.eq('university', userUniversity);
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

      // Get user location for distance calculations
      if (selectedSortOption === 'NEARBY' && !userLocation) {
        await getUserLocation();
      }
      
      setEvents(combinedEvents);
      
      // Apply any existing category filter and sort options
      applyFiltersAndSort(combinedEvents);
      
    } catch (error: any) {
      console.error('Error fetching events:', error);
      Alert.alert('Error', 'Failed to fetch events. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // This function handles both filtering and sorting
  const applyFiltersAndSort = useCallback((eventsToFilter: FreeEvent[]) => {
    setIsFiltering(true);
    
    try {
      // First filter by category
      let filtered = eventsToFilter;
      if (selectedCategory !== 'ALL') {
        filtered = filtered.filter(event => event.category === selectedCategory);
      }
      
      // Then filter by distance if applicable
      if (userLocation && selectedSortOption === 'NEARBY') {
        filtered = filtered.filter(event => {
          if (!event.location || typeof event.location.latitude !== 'number' || typeof event.location.longitude !== 'number') {
            return false;
          }
          
          const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            event.location.latitude,
            event.location.longitude
          );
          
          return distance <= selectedDistance;
        });
      }
      
      // Now sort based on selected option
      switch (selectedSortOption) {
        case 'RECENT':
          filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          break;
        case 'POPULAR':
          // If you had a likes or views field, you would sort by it here
          // For now, let's assume newer events are more popular
          filtered.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
          break;
        case 'NEARBY':
          if (userLocation) {
            filtered.sort((a, b) => {
              if (!a.location || !b.location) return 0;
              
              const distanceA = calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                a.location.latitude,
                a.location.longitude
              );
              
              const distanceB = calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                b.location.latitude,
                b.location.longitude
              );
              
              return distanceA - distanceB;
            });
          }
          break;
      }

      setFilteredEvents(filtered);
    } catch (error) {
      console.error('Error filtering events:', error);
    } finally {
      setIsFiltering(false);
    }
  }, [selectedCategory, selectedSortOption, selectedDistance, userLocation]);

  // Apply filters whenever they change
  useEffect(() => {
    if (events.length > 0) {
      applyFiltersAndSort(events);
    }
  }, [selectedCategory, selectedSortOption, selectedDistance, userLocation, applyFiltersAndSort]);

  // Fetch events and user location when the screen loads or comes into focus
  useFocusEffect(
    React.useCallback(() => {
      getUserLocation();
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
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setExpandedEvent(null)}
            >
              <Ionicons name="close" size={24} color="#6366f1" />
            </TouchableOpacity>
            
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
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
                  <View style={styles.modalSectionTitleContainer}>
                    <Ionicons name="location" size={16} color="#4b5563" style={{marginRight: 6}} />
                    <Text style={styles.modalSectionTitle}>Location</Text>
                  </View>
                  <Text style={styles.modalLocation}>
                    {expandedEvent.location.address || 'Location not specified'}
                  </Text>
                  <TouchableOpacity 
                    style={styles.directionsButton}
                    onPress={() => getDirections(expandedEvent)}
                  >
                    <Ionicons name="navigate" size={18} color="#fff" />
                    <Text style={styles.directionsButtonText}>Get Directions</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              <View style={styles.modalFooter}>
                <View style={styles.modalSectionTitleContainer}>
                  <Ionicons name="information-circle" size={16} color="#4b5563" style={{marginRight: 6}} />
                  <Text style={styles.modalSectionTitle}>Event Details</Text>
                </View>
                <View style={styles.postedByContainer}>
                  <Text style={styles.postedByLabel}>Posted by:</Text>
                  <Text style={styles.postedByValue}>{creatorName}</Text>
                </View>
                <View style={styles.postedByContainer}>
                  <Text style={styles.postedByLabel}>Posted on:</Text>
                  <Text style={styles.postedByValue}>
                    {new Date(expandedEvent.created_at).toLocaleDateString()} at {' '}
                    {new Date(expandedEvent.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
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
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.eventTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.eventCategoryContainer}>
          <Text style={styles.eventCategory}>{item.category}</Text>
        </View>
      </View>
      
      <Text style={styles.eventDescription} numberOfLines={2}>
        {item.description}
      </Text>
      
      <View style={styles.cardDetailsContainer}>
        {item.location && (
          <View style={styles.locationContainer}>
            <Ionicons name="location-outline" size={14} color="#6b7280" style={styles.detailIcon} />
            <Text style={styles.eventLocation} numberOfLines={1}>
              {item.location.address || 'Location not specified'}
            </Text>
          </View>
        )}
        
        <View style={styles.dateContainer}>
          <Ionicons name="calendar-outline" size={14} color="#6b7280" style={styles.detailIcon} />
          <Text style={styles.eventDate}>
            {new Date(item.start_date).toLocaleDateString()}
          </Text>
        </View>
      </View>
      
      <View style={styles.cardActionHint}>
        <Text style={styles.cardActionHintText}>Tap for details</Text>
        <Ionicons name="chevron-forward" size={14} color="#6b7280" />
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (loading || isFiltering) {
      return (
        <View style={styles.emptyStateContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.emptyStateText}>Loading events...</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.emptyStateContainer}>
        <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
        <Text style={styles.emptyStateTitle}>No events found</Text>
        <Text style={styles.emptyStateText}>
          {selectedCategory === 'ALL' 
            ? 'There are no upcoming events in your area.'
            : `There are no upcoming ${selectedCategory.toLowerCase()} events.`}
        </Text>
        <TouchableOpacity 
          style={styles.emptyStateButton}
          onPress={() => {
            setSelectedCategory('ALL');
            setSelectedSortOption('RECENT');
            setSelectedDistance(5);
          }}
        >
          <Text style={styles.emptyStateButtonText}>See all events</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCategoryPill = (category: typeof CATEGORIES[number]) => (
    <TouchableOpacity
      key={category}
      style={[
        styles.pill,
        selectedCategory === category && styles.activePill,
      ]}
      onPress={() => setSelectedCategory(category)}
    >
      {getCategoryIcon(category)}
      <Text
        style={[
          styles.pillText,
          selectedCategory === category && styles.activePillText,
        ]}
      >
        {category}
      </Text>
    </TouchableOpacity>
  );
  
  const getCategoryIcon = (category: typeof CATEGORIES[number]) => {
    let iconName = 'apps-outline';
    
    switch (category) {
      case 'FOOD':
        iconName = 'restaurant-outline';
        break;
      case 'CONCERT':
        iconName = 'musical-notes-outline';
        break;
      case 'SPORTS':
        iconName = 'football-outline';
        break;
      case 'ACADEMIC':
        iconName = 'school-outline';
        break;
      case 'OTHER':
        iconName = 'star-outline';
        break;
    }
    
    return (
      <Ionicons 
        name={iconName as any} 
        size={16} 
        color={selectedCategory === category ? '#ffffff' : '#6366f1'} 
        style={styles.pillIcon}
      />
    );
  };

  const renderSortOption = (option: typeof SORT_OPTIONS[number]) => {
    let label = '';
    let iconName = '';
    
    switch (option) {
      case 'RECENT':
        label = 'Most Recent';
        iconName = 'time-outline';
        break;
      case 'POPULAR':
        label = 'Most Popular';
        iconName = 'flame-outline';
        break;
      case 'NEARBY':
        label = 'Nearest';
        iconName = 'location-outline';
        break;
    }
    
    return (
      <TouchableOpacity
        key={option}
        style={[
          styles.sortOption,
          selectedSortOption === option && styles.activeSortOption,
        ]}
        onPress={() => {
          setSelectedSortOption(option);
          setShowSortOptions(false);
          if (option === 'NEARBY' && !userLocation) {
            getUserLocation();
          }
        }}
      >
        <Ionicons 
          name={iconName as any} 
          size={16} 
          color={selectedSortOption === option ? '#ffffff' : '#6366f1'} 
          style={styles.sortOptionIcon}
        />
        <Text
          style={[
            styles.sortOptionText,
            selectedSortOption === option && styles.activeSortOptionText,
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderDistanceOption = (distance: typeof DISTANCE_OPTIONS[number]) => (
    <TouchableOpacity
      key={distance}
      style={[
        styles.distanceOption,
        selectedDistance === distance && styles.activeDistanceOption,
      ]}
      onPress={() => {
        setSelectedDistance(distance);
        setShowDistanceOptions(false);
      }}
    >
      <Text
        style={[
          styles.distanceOptionText,
          selectedDistance === distance && styles.activeDistanceOptionText,
        ]}
      >
        {distance < 1 ? `${distance * 10}/10` : distance} {distance === 1 ? 'mile' : 'miles'}
      </Text>
    </TouchableOpacity>
  );

  const getSortLabel = () => {
    switch (selectedSortOption) {
      case 'RECENT':
        return 'Most Recent';
      case 'POPULAR':
        return 'Most Popular';
      case 'NEARBY':
        return `Within ${selectedDistance} ${selectedDistance === 1 ? 'mile' : 'miles'}`;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover Events</Text>
      </View>
      
      {/* Category Filter Pills */}
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsContainer}
        >
          {CATEGORIES.map(renderCategoryPill)}
        </ScrollView>
      </View>

      {/* Sort and Distance Options */}
      <View style={styles.sortContainer}>
        <TouchableOpacity 
          style={styles.sortButton}
          onPress={() => {
            setShowSortOptions(!showSortOptions);
            setShowDistanceOptions(false);
          }}
        >
          <Ionicons name="options-outline" size={16} color="#6366f1" />
          <Text style={styles.sortButtonText}>{getSortLabel()}</Text>
          <Ionicons 
            name={showSortOptions ? "chevron-up" : "chevron-down"} 
            size={16} 
            color="#6366f1" 
          />
        </TouchableOpacity>
        
        {selectedSortOption === 'NEARBY' && (
          <TouchableOpacity 
            style={styles.distanceButton}
            onPress={() => {
              setShowDistanceOptions(!showDistanceOptions);
              setShowSortOptions(false);
            }}
          >
            <Ionicons name="compass-outline" size={16} color="#6366f1" />
            <Text style={styles.distanceButtonText}>{selectedDistance} {selectedDistance === 1 ? 'mile' : 'miles'}</Text>
            <Ionicons 
              name={showDistanceOptions ? "chevron-up" : "chevron-down"} 
              size={16} 
              color="#6366f1" 
            />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Sort Options Dropdown */}
      {showSortOptions && (
        <View style={styles.optionsDropdown}>
          {SORT_OPTIONS.map(renderSortOption)}
        </View>
      )}
      
      {/* Distance Options Dropdown */}
      {showDistanceOptions && (
        <View style={styles.optionsDropdown}>
          {DISTANCE_OPTIONS.map(renderDistanceOption)}
        </View>
      )}

      <FlatList
        data={filteredEvents}
        renderItem={renderEventCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          filteredEvents.length === 0 && { flex: 1, justifyContent: 'center' }
        ]}
        refreshControl={
          <RefreshControl 
            refreshing={loading} 
            onRefresh={fetchEvents}
            tintColor="#6366f1"
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={true}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
      />
      
      {renderExpandedEventModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
  },
  filtersContainer: {
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  pillsContainer: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minWidth: 80,
    height: 36,
  },
  activePill: {
    backgroundColor: '#6366f1',
    borderColor: '#4f46e5',
  },
  pillIcon: {
    marginRight: 4,
  },
  pillText: {
    color: '#6366f1',
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  activePillText: {
    color: '#fff',
  },
  sortContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    zIndex: 5,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sortButtonText: {
    color: '#6366f1',
    fontWeight: '600',
    fontSize: 13,
    marginHorizontal: 6,
  },
  distanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  distanceButtonText: {
    color: '#6366f1',
    fontWeight: '600',
    fontSize: 13,
    marginHorizontal: 6,
  },
  optionsDropdown: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 4,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  activeSortOption: {
    backgroundColor: '#6366f1',
  },
  sortOptionIcon: {
    marginRight: 8,
  },
  sortOptionText: {
    color: '#4b5563',
    fontSize: 14,
    fontWeight: '500',
  },
  activeSortOptionText: {
    color: '#ffffff',
  },
  distanceOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  activeDistanceOption: {
    backgroundColor: '#6366f1',
  },
  distanceOptionText: {
    color: '#4b5563',
    fontSize: 14,
    fontWeight: '500',
  },
  activeDistanceOptionText: {
    color: '#ffffff',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    flex: 1,
    marginRight: 12,
  },
  eventDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  eventCategoryContainer: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  eventCategory: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
  },
  cardDetailsContainer: {
    marginBottom: 12,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailIcon: {
    marginRight: 6,
  },
  eventLocation: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventDate: {
    fontSize: 13,
    color: '#6b7280',
  },
  cardActionHint: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardActionHintText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '500',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyStateButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyStateButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30, // Extra padding for iOS
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 6,
  },
  modalScrollView: {
    marginTop: 10,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
    marginRight: 30,
  },
  modalCategoryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 12,
  },
  modalCategory: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  modalDescription: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 24,
    lineHeight: 24,
  },
  modalLocationContainer: {
    marginBottom: 24,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
  },
  modalSectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalSectionTitle: {
    fontSize: 16,
    color: '#4b5563',
    fontWeight: '600',
  },
  modalLocation: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 22,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    marginTop: 8,
  },
  directionsButtonText: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 8,
  },
  modalFooter: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 16,
    marginBottom: 20,
  },
  postedByContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  postedByLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
    width: 80,
  },
  postedByValue: {
    fontSize: 14,
    color: '#4b5563',
    flex: 1,
  },
}); 