import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  Dimensions, 
  Platform, 
  TouchableOpacity, 
  Text,
  Modal,
  TextInput,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_DEFAULT, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '../services/supabase';
import type { FreeEvent } from '../types';
import type { MainTabScreenProps } from '../types/navigation';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const INITIAL_REGION = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

export default function MapScreen({ navigation }: MainTabScreenProps<'Map'>) {
  const [events, setEvents] = useState<FreeEvent[]>([]);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [searchRadius, setSearchRadius] = useState(10); // 10km default but not displayed to user
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchAddress, setSearchAddress] = useState('');
  const [customLocationModalVisible, setCustomLocationModalVisible] = useState(false);
  const [customLatitude, setCustomLatitude] = useState('');
  const [customLongitude, setCustomLongitude] = useState('');
  const mapRef = useRef<MapView>(null);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);

      // Move map to user's location with more zoom
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01, // More zoomed in (smaller value = more zoom)
          longitudeDelta: 0.01, // More zoomed in
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      if (!userLocation) return;

      const { data, error } = await supabase
        .rpc('get_events_within_radius', {
          user_lat: userLocation.coords.latitude,
          user_lng: userLocation.coords.longitude,
          radius_km: searchRadius,
        })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  useEffect(() => {
    getLocation();
  }, []);

  useEffect(() => {
    if (userLocation) {
      fetchEvents();
    }
  }, [userLocation, searchRadius]);

  // Add useFocusEffect to refresh events when the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log("MapScreen focused - refreshing events");
      if (userLocation) {
        fetchEvents();
      }
      return () => {
        // cleanup if needed
      };
    }, [userLocation, searchRadius])
  );

  const searchLocation = async () => {
    if (!searchAddress.trim()) {
      Alert.alert('Error', 'Please enter an address to search');
      return;
    }

    try {
      const results = await Location.geocodeAsync(searchAddress);
      if (results.length > 0) {
        const { latitude, longitude } = results[0];
        
        // Update user location
        setUserLocation({
          coords: {
            latitude,
            longitude,
            altitude: null,
            accuracy: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null
          },
          timestamp: Date.now()
        });
        
        // Move map to searched location
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude,
            longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          });
        }
        
        setSearchModalVisible(false);
        setSearchAddress('');
      } else {
        Alert.alert('Error', 'No results found for this address');
      }
    } catch (error) {
      console.error('Error searching location:', error);
      Alert.alert('Error', 'Could not find the specified location');
    }
  };
  
  const setCustomLocation = () => {
    const lat = parseFloat(customLatitude);
    const lng = parseFloat(customLongitude);
    
    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('Error', 'Please enter valid coordinates');
      return;
    }
    
    // Update user location
    setUserLocation({
      coords: {
        latitude: lat,
        longitude: lng,
        altitude: null,
        accuracy: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      },
      timestamp: Date.now()
    });
    
    // Move map to custom location
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    }
    
    setCustomLocationModalVisible(false);
    setCustomLatitude('');
    setCustomLongitude('');
  };

  const getMarkerIcon = (category: string) => {
    switch (category) {
      case 'FOOD':
        return 'restaurant';
      case 'CONCERT':
        return 'musical-notes';
      case 'SPORTS':
        return 'football';
      case 'ACADEMIC':
        return 'school';
      default:
        return 'pin';
    }
  };

  const getMarkerColor = (category: string) => {
    switch (category) {
      case 'FOOD':
        return '#FF9500'; // Orange
      case 'CONCERT':
        return '#FF2D55'; // Pink
      case 'SPORTS':
        return '#5AC8FA'; // Blue
      case 'ACADEMIC':
        return '#4CD964'; // Green
      default:
        return '#6366f1'; // Purple (default)
    }
  };

  const getLocationDisplayName = (event: FreeEvent) => {
    if (!event.location) return 'Location not specified';
    
    return event.location.buildingName ? 
      event.location.buildingName + (event.location.address ? ` (${event.location.address})` : '') : 
      event.location.address || 'Location coordinates only';
  };

  const renderSearchModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={searchModalVisible}
      onRequestClose={() => setSearchModalVisible(false)}
    >
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Search Location</Text>
            <TouchableOpacity 
              onPress={() => setSearchModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#6b7280" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Enter an address, city, or place"
              value={searchAddress}
              onChangeText={setSearchAddress}
              returnKeyType="search"
              onSubmitEditing={searchLocation}
            />
          </View>
          
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={searchLocation}
          >
            <Text style={styles.primaryButtonText}>Search</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setSearchModalVisible(false);
              setCustomLocationModalVisible(true);
            }}
          >
            <Text style={styles.secondaryButtonText}>Enter Custom Coordinates</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
  
  const renderCustomLocationModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={customLocationModalVisible}
      onRequestClose={() => setCustomLocationModalVisible(false)}
    >
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Custom Coordinates</Text>
            <TouchableOpacity 
              onPress={() => setCustomLocationModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.label}>Latitude</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 37.7749"
            value={customLatitude}
            onChangeText={setCustomLatitude}
            keyboardType="numeric"
          />
          
          <Text style={styles.label}>Longitude</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. -122.4194"
            value={customLongitude}
            onChangeText={setCustomLongitude}
            keyboardType="numeric"
          />
          
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={setCustomLocation}
          >
            <Text style={styles.primaryButtonText}>Set Location</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: 40.7128,
            longitude: -74.0060,
            latitudeDelta: 0.01, // More zoomed in
            longitudeDelta: 0.01, // More zoomed in
          }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {userLocation && (
            <Circle
              center={{
                latitude: userLocation.coords.latitude,
                longitude: userLocation.coords.longitude,
              }}
              radius={searchRadius * 1000}
              strokeWidth={1}
              strokeColor="#6366f1"
              fillColor="rgba(99, 102, 241, 0.1)"
            />
          )}
          {events.map((event) => (
            <Marker
              key={event.id}
              coordinate={{
                latitude: event.location.latitude,
                longitude: event.location.longitude,
              }}
            >
              <View style={[styles.customMarker, { backgroundColor: getMarkerColor(event.category) }]}>
                <Ionicons name={getMarkerIcon(event.category)} size={16} color="#fff" />
              </View>
              <Callout tooltip>
                <View style={styles.calloutContainer}>
                  <Text style={styles.calloutTitle}>{event.title}</Text>
                  <Text style={styles.calloutCategory}>{event.category}</Text>
                  <Text style={styles.calloutDate}>
                    {new Date(event.start_date).toLocaleDateString()}
                  </Text>
                  <Text style={styles.calloutLocation} numberOfLines={2}>
                    {getLocationDisplayName(event)}
                  </Text>
                  <Text style={styles.calloutDescription} numberOfLines={3}>
                    {event.description}
                  </Text>
                  <Text style={styles.calloutTap}>Tap to view more</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>

        <TouchableOpacity 
          style={styles.recenterButton}
          onPress={getLocation}
          accessibilityLabel="Recenter map to my location"
          accessibilityHint="Double tap to recenter the map on your current location"
        >
          <Ionicons name="locate" size={24} color="#007AFF" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.searchButton}
          onPress={() => setSearchModalVisible(true)}
          accessibilityLabel="Search locations"
          accessibilityHint="Double tap to search for locations"
        >
          <Ionicons name="search" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      {renderSearchModal()}
      {renderCustomLocationModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  searchButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: '#6366f1',
    borderRadius: 30,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  customMarker: {
    width: 35,
    height: 35,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 5,
  },
  calloutContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    width: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 5,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  calloutCategory: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 4,
  },
  calloutDate: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  calloutLocation: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  calloutDescription: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 8,
  },
  calloutTap: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6366f1',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  modalCloseButton: {
    padding: 5,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#1f2937',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4b5563',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#6366f1',
    fontSize: 15,
    fontWeight: '500',
  },
  recenterButton: {
    position: 'absolute',
    bottom: 90, // Above the search button
    right: 16,
    backgroundColor: '#fff',
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
}); 