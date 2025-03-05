import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '../services/supabase';
import type { FreeEvent } from '../types';
import type { MainTabScreenProps } from '../types/navigation';
import { useFocusEffect } from '@react-navigation/native';

const INITIAL_REGION = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

export default function MapScreen({ navigation }: MainTabScreenProps<'Map'>) {
  const [events, setEvents] = useState<FreeEvent[]>([]);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(
    null
  );
  const [searchRadius, setSearchRadius] = useState(10); // 10km default
  const mapRef = useRef<MapView>(null);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);

      // Move map to user's location
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
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

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={INITIAL_REGION}
        showsUserLocation
        showsMyLocationButton
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
            title={event.title}
            description={event.description}
            pinColor="#6366f1"
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
}); 