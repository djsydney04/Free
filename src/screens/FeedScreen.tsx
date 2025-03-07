import React, { useEffect, useState, useCallback, Fragment } from 'react';
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
  TextInput,
  StatusBar,
} from 'react-native';
import { supabase } from '../services/supabase';
import type { FreeEvent } from '../types';
import type { MainTabScreenProps } from '../types/navigation';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { format } from 'date-fns';

const CATEGORIES = ['ALL', 'FOOD', 'CONCERT', 'SPORTS', 'ACADEMIC', 'OTHER'] as const;
const SORT_OPTIONS = ['RECENT', 'POPULAR', 'NEARBY'] as const;
const DISTANCE_OPTIONS = [0.5, 1, 2, 5] as const; // maximum 5 miles
const { width } = Dimensions.get('window');

export default function FeedScreen({ navigation }: MainTabScreenProps<'Feed'>) {
  const [events, setEvents] = useState<FreeEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<FreeEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<typeof CATEGORIES[number]>('ALL');
  const [selectedSortOption, setSelectedSortOption] = useState<typeof SORT_OPTIONS[number]>('RECENT');
  const [selectedDistance, setSelectedDistance] = useState<typeof DISTANCE_OPTIONS[number]>(5);
  const [userUniversity, setUserUniversity] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<FreeEvent | null>(null);
  const [creatorName, setCreatorName] = useState<string>('');
  const [isFiltering, setIsFiltering] = useState(false);
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [showDistanceOptions, setShowDistanceOptions] = useState(false);
  const [showExpandedEvent, setShowExpandedEvent] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

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
      
      // Apply distance filtering only when not in NEARBY mode
      if (userLocation && selectedSortOption !== 'NEARBY') {
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
      } else if (userLocation && selectedSortOption === 'NEARBY') {
        // For NEARBY, just filter out events without location data
        filtered = filtered.filter(event => {
          return event.location && 
                 typeof event.location.latitude === 'number' && 
                 typeof event.location.longitude === 'number';
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
  
  // Completely rewrite the renderExpandedEventModal function
  const renderExpandedEventModal = () => {
    if (!selectedEvent) return null;
    
    const eventDate = new Date(selectedEvent.start_date);
    const formattedDate = eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    const formattedTime = eventDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Check if there's a valid address for directions
    const hasValidAddress = selectedEvent.location && 
      (selectedEvent.location.address || 
      (selectedEvent.location.latitude && selectedEvent.location.longitude));

    return (
      <View style={styles.modalOverlay}>
        <View style={styles.partialModalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Event</Text>
            <TouchableOpacity 
              onPress={() => setShowExpandedEvent(false)}
              style={styles.closeButton}
              accessibilityLabel="Close"
              accessibilityHint="Double tap to close event details"
            >
              <Ionicons name="close" size={24} color="#8e8e93" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.eventDetailTitle}>{selectedEvent.title}</Text>
            
            <View style={styles.categoryBadge}>
              <Ionicons 
                name={getCategoryIconName(selectedEvent.category)} 
                size={18} 
                color="#007AFF" 
              />
              <Text style={styles.categoryBadgeText}>{selectedEvent.category}</Text>
            </View>
            
            <View style={styles.dateTimeSection}>
              <Ionicons name="calendar-outline" size={20} color="#8e8e93" />
              <View style={styles.dateTimeContent}>
                <Text style={styles.dateText}>{formattedDate}</Text>
                <Text style={styles.timeText}>{formattedTime}</Text>
              </View>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>About</Text>
              <View style={styles.sectionContent}>
                <Text style={styles.detailText}>
                  {selectedEvent.description || "No description provided."}
                </Text>
              </View>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Location</Text>
              <View style={styles.sectionContent}>
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={20} color="#8e8e93" />
                  <Text style={styles.locationText}>
                    {selectedEvent.location.buildingName || selectedEvent.location.address || "No location specified."}
                  </Text>
                </View>
                
                {hasValidAddress && (
                  <TouchableOpacity
                    style={styles.directionsButton}
                    onPress={() => getDirections(selectedEvent)}
                    accessibilityLabel="Get directions"
                    accessibilityHint="Double tap to get directions to this location"
                  >
                    <Ionicons name="navigate-outline" size={20} color="white" />
                    <Text style={styles.directionsButtonText}>Get Directions</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    );
  };

  // Helper function to get the icon name for each category
  const getCategoryIconName = (category: string) => {
    switch (category) {
      case 'FOOD': return 'restaurant-outline';
      case 'CONCERT': return 'musical-notes-outline';
      case 'SPORTS': return 'football-outline';
      case 'ACADEMIC': return 'school-outline';
      case 'OTHER': return 'star-outline';
      default: return 'star-outline';
    }
  };

  const renderEventCard = ({ item }: { item: FreeEvent }) => {
    const formattedDate = formatEventDate(new Date(item.start_date));
    
    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => {
          setSelectedEvent(item);
          setShowExpandedEvent(true);
        }}
        activeOpacity={0.7}
        accessibilityLabel={`${item.title} event card`}
        accessibilityHint="Double tap to view event details"
      >
        <View style={styles.cardHeader}>
          <Text style={styles.eventTitle}>{item.title}</Text>
          <View style={styles.categoryTag}>
            <Text style={styles.categoryTagText}>{item.category}</Text>
          </View>
        </View>
        
        {item.description && (
          <Text 
            style={styles.eventDescription} 
            numberOfLines={2}
          >
            {item.description}
          </Text>
        )}
        
        <View style={styles.eventDetails}>
          <View style={styles.detailItem}>
            <Ionicons name="location-outline" size={16} color="#8e8e93" style={styles.detailIcon} />
            <Text style={styles.detailText}>
              {item.location.buildingName || item.location.address || 'Location not specified'}
            </Text>
          </View>
          
          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={16} color="#8e8e93" style={styles.detailIcon} />
            <Text style={styles.detailText}>{formattedDate}</Text>
          </View>
        </View>
        
        <View style={styles.tapForDetails}>
          <Text style={styles.tapForDetailsText}>Tap for details</Text>
          <Ionicons name="chevron-forward" size={16} color="#8e8e93" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyStateContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={[styles.emptyStateText, { marginTop: 16 }]}>
            Loading events...
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyStateContainer}>
        <Ionicons name="calendar-outline" size={64} color="#c7c7cc" style={{ marginBottom: 16 }} />
        <Text style={styles.emptyStateTitle}>No Events Found</Text>
        <Text style={styles.emptyStateText}>
          {selectedCategory !== 'ALL' 
            ? `No ${selectedCategory.toLowerCase()} events are currently available.`
            : 'There are no events matching your criteria.'}
        </Text>
        <TouchableOpacity
          style={styles.emptyStateButton}
          onPress={() => {
            setSelectedCategory('ALL');
            setSelectedSortOption('RECENT');
            fetchEvents();
          }}
          accessibilityLabel="Reset filters"
          accessibilityHint="Double tap to show all events"
        >
          <Text style={styles.emptyStateButtonText}>Reset Filters</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCategoryPill = (category: typeof CATEGORIES[number]) => {
    const isSelected = selectedCategory === category;
    return (
      <View style={[styles.categoryPill, isSelected && styles.selectedCategoryFilter]}>
        {getCategoryIcon(category, isSelected)}
        <Text style={[
          styles.categoryText,
          isSelected && styles.selectedCategoryFilterText
        ]}>
          {category}
        </Text>
      </View>
    );
  };
  
  const getCategoryIcon = (category: typeof CATEGORIES[number], isSelected: boolean = false) => {
    const color = isSelected ? "#ffffff" : "#007AFF";
    
    switch (category) {
      case 'FOOD':
        return <Ionicons name="restaurant-outline" size={18} color={color} style={styles.pillIcon} />;
      case 'CONCERT':
        return <Ionicons name="musical-notes-outline" size={18} color={color} style={styles.pillIcon} />;
      case 'SPORTS':
        return <Ionicons name="football-outline" size={18} color={color} style={styles.pillIcon} />;
      case 'ACADEMIC':
        return <Ionicons name="school-outline" size={18} color={color} style={styles.pillIcon} />;
      case 'OTHER':
        return <Ionicons name="star-outline" size={18} color={color} style={styles.pillIcon} />;
      default:
        return <Ionicons name="help-outline" size={18} color={color} style={styles.pillIcon} />;
    }
  };

  const renderSortOption = (option: typeof SORT_OPTIONS[number]) => {
    const isActive = selectedSortOption === option;
    let iconName: any = 'time-outline';
    
    if (option === 'RECENT') {
      iconName = 'time-outline';
    } else if (option === 'POPULAR') {
      iconName = 'flame-outline';
    } else if (option === 'NEARBY') {
      iconName = 'location-outline';
    }
    
    return (
      <TouchableOpacity
        key={option}
        style={[
          styles.sortOption,
          isActive && styles.activeSortOption
        ]}
        onPress={() => {
          setSelectedSortOption(option);
          setShowSortOptions(false);
          
          if (option === 'NEARBY') {
            getUserLocation();
          }
        }}
      >
        <Ionicons
          name={iconName}
          size={18}
          color={isActive ? '#6366f1' : '#6b7280'}
          style={styles.sortOptionIcon}
        />
        <Text style={[
          styles.sortOptionText,
          isActive && styles.activeSortOptionText
        ]}>
          {option === 'RECENT' ? 'Most Recent' : 
           option === 'POPULAR' ? 'Most Popular' : 
           'Nearest'}
        </Text>
        {isActive && (
          <Ionicons name="checkmark" size={18} color="#6366f1" style={{ marginLeft: 'auto' }} />
        )}
      </TouchableOpacity>
    );
  };

  const renderDistanceOption = (distance: typeof DISTANCE_OPTIONS[number]) => (
    <TouchableOpacity
      key={distance}
      style={[
        styles.distanceOption,
        selectedDistance === distance && styles.activeDistanceOption
      ]}
      onPress={() => {
        setSelectedDistance(distance);
        setShowDistanceOptions(false);
        getUserLocation(); // Refresh with new distance filter
      }}
    >
      <Text style={[
        styles.distanceOptionText,
        selectedDistance === distance && styles.activeDistanceOptionText
      ]}>
        {distance === 0.5 ? 'Any Distance' :
         `Within ${distance} ${distance === 1 ? 'mile' : 'miles'}`}
      </Text>
      {selectedDistance === distance && (
        <Ionicons name="checkmark" size={18} color="#6366f1" style={{ marginLeft: 'auto' }} />
      )}
    </TouchableOpacity>
  );

  const getSortLabel = () => {
    switch (selectedSortOption) {
      case 'RECENT':
        return 'Most Recent';
      case 'POPULAR':
        return 'Most Popular';
      case 'NEARBY':
        return 'Nearest to Me';
    }
  };

  const formatEventDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderSearchModal = () => (
    <View style={styles.searchModalContainer}>
      <View style={styles.searchModalContent}>
        <View style={styles.searchModalHeader}>
          <TouchableOpacity onPress={() => setShowSearchModal(false)}>
            <Ionicons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.searchModalTitle}>Search Events</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#8e8e93" style={styles.searchInputIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search events..."
            placeholderTextColor="#8e8e93"
          />
        </View>
        
        <Text style={styles.searchModalMessage}>
          Search functionality coming soon!
        </Text>
      </View>
    </View>
  );

  // Add function to get sort icon name
  const getSortIconName = (option: typeof SORT_OPTIONS[number]) => {
    switch (option) {
      case 'RECENT':
        return 'time-outline';
      case 'POPULAR':
        return 'flame-outline';
      case 'NEARBY':
        return 'navigate-outline';
      default:
        return 'time-outline';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Discover</Text>
        <TouchableOpacity 
          style={styles.searchButton}
          onPress={() => setShowSearchModal(true)}
          accessibilityLabel="Search events"
          accessibilityHint="Double tap to search for events"
        >
          <Ionicons name="search" size={22} color="#8e8e93" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.filterContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.categoryFilters}
          contentContainerStyle={styles.categoryFiltersContent}
        >
          <TouchableOpacity
            style={[
              styles.categoryFilter,
              selectedCategory === 'ALL' && styles.selectedCategoryFilter
            ]}
            onPress={() => setSelectedCategory('ALL')}
            accessibilityLabel="All events category filter"
            accessibilityState={{ selected: selectedCategory === 'ALL' }}
          >
            <Ionicons name="grid-outline" size={20} color={selectedCategory === 'ALL' ? "#ffffff" : "#007AFF"} />
            <Text style={[
              styles.categoryFilterText,
              selectedCategory === 'ALL' && styles.selectedCategoryFilterText
            ]}>
              All Events
            </Text>
          </TouchableOpacity>
          
          {CATEGORIES.filter(cat => cat !== 'ALL').map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryFilter,
                selectedCategory === category && styles.selectedCategoryFilter
              ]}
              onPress={() => setSelectedCategory(category)}
              accessibilityLabel={`${category} category filter`}
              accessibilityState={{ selected: selectedCategory === category }}
            >
              {getCategoryIcon(category, selectedCategory === category)}
              <Text style={[
                styles.categoryFilterText,
                selectedCategory === category && styles.selectedCategoryFilterText
              ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        <View style={styles.sortFilterContainer}>
          <TouchableOpacity
            style={styles.pillFilter}
            onPress={() => {
              setShowSortOptions(!showSortOptions);
            }}
            accessibilityLabel="Sort events"
            accessibilityHint="Double tap to change sort order"
          >
            <Ionicons 
              name={getSortIconName(selectedSortOption)} 
              size={18} 
              color="#007AFF"
              style={styles.pillFilterIcon} 
            />
            <Text style={styles.pillFilterText}>{getSortLabel()}</Text>
            <Ionicons 
              name={showSortOptions ? "chevron-up" : "chevron-down"} 
              size={14} 
              color="#007AFF" 
            />
          </TouchableOpacity>
          
          {/* Radius filter pill - show on all pages EXCEPT when NEARBY is selected */}
          {selectedSortOption !== 'NEARBY' && (
            <TouchableOpacity
              style={styles.pillFilter}
              onPress={() => {
                // Toggle between 1, 2, and 5 miles
                setSelectedDistance(selectedDistance === 1 ? 2 : 
                                    selectedDistance === 2 ? 5 : 1);
                getUserLocation();
              }}
              accessibilityLabel="Distance radius"
              accessibilityHint="Double tap to change radius distance"
            >
              <Ionicons 
                name="radio-outline" 
                size={18} 
                color="#007AFF"
                style={styles.pillFilterIcon} 
              />
              <Text style={styles.pillFilterText}>{selectedDistance} miles</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {showSortOptions && (
          <View style={styles.optionsContainer}>
            {SORT_OPTIONS.map((option) => renderSortOption(option))}
          </View>
        )}
      </View>
      
      <FlatList
        data={filteredEvents}
        renderItem={renderEventCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchEvents} tintColor="#007AFF" />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={null}
      />
      
      {showSearchModal && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={showSearchModal}
          onRequestClose={() => setShowSearchModal(false)}
        >
          {renderSearchModal()}
        </Modal>
      )}
      
      {showExpandedEvent && selectedEvent && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={showExpandedEvent}
          onRequestClose={() => setShowExpandedEvent(false)}
        >
          {renderExpandedEventModal()}
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#000000',
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f2f2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    backgroundColor: '#ffffff',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
  },
  categoryFilters: {
    paddingHorizontal: 16,
  },
  categoryFiltersContent: {
    paddingVertical: 8,
  },
  categoryFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    marginRight: 8,
    backgroundColor: '#efeff4',
  },
  selectedCategoryFilter: {
    backgroundColor: '#007AFF',
  },
  categoryFilterText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#007AFF',
    marginLeft: 6,
  },
  selectedCategoryFilterText: {
    color: '#ffffff',
  },
  sortFilterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pillFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  pillFilterIcon: {
    marginRight: 6,
  },
  pillFilterText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#007AFF',
    marginRight: 4,
  },
  optionsContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  scrollContainer: {
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  eventCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    marginRight: 8,
  },
  categoryTag: {
    backgroundColor: '#f0f0ff',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  categoryTagText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#5856d6',
  },
  eventDescription: {
    fontSize: 15,
    color: '#3a3a3c',
    marginBottom: 12,
  },
  eventDetails: {
    marginTop: 4,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailIcon: {
    marginRight: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#8e8e93',
  },
  tapForDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5ea',
  },
  tapForDetailsText: {
    fontSize: 15,
    color: '#5856d6',
    fontWeight: '500',
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#3c3c43',
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyStateButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#007AFF',
    borderRadius: 12,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  partialModalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: '80%',
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
    position: 'relative',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  closeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  eventDetailTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.1)'
  },
  categoryBadgeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
    marginLeft: 8,
  },
  dateTimeSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
    paddingBottom: 16,
  },
  dateTimeContent: {
    marginLeft: 12,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  timeText: {
    fontSize: 15,
    color: '#3a3a3c',
    marginTop: 4,
  },
  detailSection: {
    marginBottom: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  sectionContent: {
    backgroundColor: '#f2f2f7',
    padding: 16,
    borderRadius: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationText: {
    fontSize: 16,
    color: '#3a3a3c',
    marginLeft: 12,
    flex: 1,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  directionsButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    marginLeft: 8,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  activeSortOption: {
    backgroundColor: '#f0f1fe',
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
    color: '#6366f1',
    fontWeight: '600',
  },
  distanceOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  activeDistanceOption: {
    backgroundColor: '#f0f1fe',
  },
  distanceOptionText: {
    color: '#4b5563',
    fontSize: 14,
    fontWeight: '500',
  },
  activeDistanceOptionText: {
    color: '#6366f1',
    fontWeight: '600',
  },
  searchModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  searchModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchModalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#efeff4',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 44,
  },
  searchInputIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 17,
    color: '#000000',
  },
  searchModalMessage: {
    fontSize: 15,
    color: '#8e8e93',
    textAlign: 'center',
    marginTop: 40,
  },
  categoryPill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#f2f2f7',
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#007AFF',
    marginLeft: 4,
  },
  pillIcon: {
    marginRight: 4,
  },
}); 