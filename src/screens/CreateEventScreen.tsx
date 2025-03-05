import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../services/supabase';
import { supabaseAnonKey } from '../services/supabase';
import type { MainTabScreenProps, RootStackParamList } from '../types/navigation';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const CATEGORIES = ['FOOD', 'CONCERT', 'SPORTS', 'ACADEMIC', 'OTHER'] as const;

export default function CreateEventScreen({ navigation: tabNavigation }: MainTabScreenProps<'Create'>) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('OTHER');
  
  // Set default date to now
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);

  // Add auth state check on component mount
  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      console.log('Auth state check:', { 
        isAuthenticated: !!user, 
        userId: user?.id,
        error: error?.message
      });
    } catch (error) {
      console.error('Auth check error:', error);
    }
  };

  // Completely disabled image upload functionality
  const pickImage = async () => {
    if (uploadingImage) return;
    
    try {
      setUploadingImage(true);
      
      // Show user a message that image uploads are disabled
      Alert.alert(
        'Feature Temporarily Disabled',
        'Image uploads are temporarily disabled. Your event will be created without an image.',
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setUploadingImage(false);
    }
  };

  const getCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission to access location was denied');
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    setLocation({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });

    // Get address from coordinates
    try {
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address) {
        setLocation((prev) => ({
          ...prev!,
          address: `${address.street}, ${address.city}, ${address.region}`,
        }));
      }
    } catch (error) {
      console.error('Error getting address:', error);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const handleSubmit = async () => {
    if (!title || !description || !location || !category) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('Not authenticated');

      // Get user's university
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('university')
        .eq('user_id', userData.user.id)
        .single();

      if (profileError) throw profileError;

      // Create the event without images
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert([
          {
            title,
            description,
            category,
            location,
            start_date: startDate.toISOString(),
            created_by: userData.user.id,
            // Don't include images field at all
            university: profileData.university,
          },
        ])
        .select()
        .single();

      if (eventError) throw eventError;

      // Clear form fields
      setTitle('');
      setDescription('');
      setCategory('OTHER');
      setStartDate(new Date());
      setLocation(null);

      Alert.alert('Success', 'Event created successfully!');
      
      // Navigate to Home tab instead of just going back
      tabNavigation.navigate('Home');
    } catch (error: any) {
      console.error('Error creating event:', error);
      Alert.alert('Error', `Failed to create event: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Create Free Event</Text>

        <TextInput
          style={styles.input}
          placeholder="Event Title"
          value={title}
          onChangeText={setTitle}
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Event Description"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />

        <View style={styles.categoryContainer}>
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryButton,
                  category === cat && styles.categoryButtonActive,
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    category === cat && styles.categoryButtonTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity
          style={styles.locationButton}
          onPress={getCurrentLocation}
        >
          <Text style={styles.locationButtonText}>
            {location ? 'Update Location' : 'Add Location'}
          </Text>
        </TouchableOpacity>

        {location?.address && (
          <Text style={styles.locationText}>{location.address}</Text>
        )}

        <TouchableOpacity 
          style={[
            styles.imageButton, 
            { backgroundColor: '#e0e0e0' }
          ]} 
          onPress={pickImage}
        >
          <Text style={[styles.imageButtonText, { color: '#757575' }]}>
            Image Uploads Temporarily Disabled
          </Text>
        </TouchableOpacity>

        <View style={styles.dateContainer}>
          <Text style={styles.secondaryLabel}>Event Date (optional - defaults to now)</Text>
          <TouchableOpacity 
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateButtonText}>
              Change Date: {startDate.toLocaleDateString()}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display="default"
              onChange={onDateChange}
            />
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Creating...' : 'Create Event'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#1f2937',
  },
  input: {
    backgroundColor: '#f3f4f6',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  dateContainer: {
    marginBottom: 20,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#4b5563',
  },
  secondaryLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 10,
    color: '#6b7280',
  },
  dateButton: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dateButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  categoryContainer: {
    marginBottom: 20,
  },
  categoryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 10,
  },
  categoryButtonActive: {
    backgroundColor: '#6366f1',
  },
  categoryButtonText: {
    color: '#4b5563',
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  locationButton: {
    backgroundColor: '#6366f1',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  locationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  locationText: {
    color: '#4b5563',
    marginBottom: 20,
  },
  imageButton: {
    backgroundColor: '#e0e7ff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  imageButtonText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#6366f1',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 