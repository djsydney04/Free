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
  KeyboardAvoidingView,
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
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
import { Ionicons } from '@expo/vector-icons';

const CATEGORIES = ['FOOD', 'CONCERT', 'SPORTS', 'ACADEMIC', 'OTHER'] as const;

export default function CreateEventScreen({ navigation: tabNavigation }: MainTabScreenProps<'Create'>) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('OTHER');
  
  // Set default date to now
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showQuickDateOptions, setShowQuickDateOptions] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [customLocationModalVisible, setCustomLocationModalVisible] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const [customLatitude, setCustomLatitude] = useState('');
  const [customLongitude, setCustomLongitude] = useState('');
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
          address: `${address.street || ''}, ${address.city || ''}, ${address.region || ''}`.replace(/^, /, ''),
        }));
      }
    } catch (error) {
      console.error('Error getting address:', error);
    }
  };
  
  const addCustomLocation = () => {
    // Validate inputs
    const lat = parseFloat(customLatitude);
    const lng = parseFloat(customLongitude);
    
    if (isNaN(lat) || isNaN(lng) || !customAddress) {
      Alert.alert('Error', 'Please enter a valid address and coordinates');
      return;
    }
    
    setLocation({
      latitude: lat,
      longitude: lng,
      address: customAddress
    });
    
    setCustomLocationModalVisible(false);
    setCustomAddress('');
    setCustomLatitude('');
    setCustomLongitude('');
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const formatDateForDisplay = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    
    const timeString = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    if (dateOnly.getTime() === today.getTime()) {
      return `Today at ${timeString}`;
    } else if (dateOnly.getTime() === tomorrow.getTime()) {
      return `Tomorrow at ${timeString}`;
    } else {
      // Check if it's within the next week
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      if (dateOnly < nextWeek) {
        const options: Intl.DateTimeFormatOptions = { weekday: 'long' };
        return `${date.toLocaleDateString(undefined, options)} at ${timeString}`;
      } else {
        return `${date.toLocaleDateString()} at ${timeString}`;
      }
    }
  };

  const setQuickDate = (option: string) => {
    const now = new Date();
    const newDate = new Date(now);
    
    switch (option) {
      case 'today':
        // Keep current date, just update hours
        newDate.setHours(now.getHours() + 1, 0, 0, 0);
        break;
      case 'tomorrow':
        newDate.setDate(now.getDate() + 1);
        newDate.setHours(12, 0, 0, 0); // Noon tomorrow
        break;
      case 'thisWeekend':
        // Find next Saturday
        const daysUntilWeekend = (6 - now.getDay() + 7) % 7;
        newDate.setDate(now.getDate() + daysUntilWeekend);
        newDate.setHours(14, 0, 0, 0); // 2PM
        break;
      default:
        // If it's a number, it's days from now
        const days = parseInt(option);
        if (!isNaN(days)) {
          newDate.setDate(now.getDate() + days);
          newDate.setHours(12, 0, 0, 0);
        }
    }
    
    setStartDate(newDate);
    setShowQuickDateOptions(false);
  };

  const renderQuickDateOptions = () => {
    if (!showQuickDateOptions) return null;
    
    const today = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Generate options for the next 7 days
    const dayOptions = [];
    for (let i = 2; i < 7; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + i);
      const dayName = dayNames[futureDate.getDay()];
      dayOptions.push({ label: dayName, value: i.toString() });
    }
    
    return (
      <View style={styles.quickDateContainer}>
        <TouchableOpacity 
          style={styles.quickDateOption}
          onPress={() => setQuickDate('today')}
        >
          <Text style={styles.quickDateText}>Today</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickDateOption}
          onPress={() => setQuickDate('tomorrow')}
        >
          <Text style={styles.quickDateText}>Tomorrow</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickDateOption}
          onPress={() => setQuickDate('thisWeekend')}
        >
          <Text style={styles.quickDateText}>This Weekend</Text>
        </TouchableOpacity>
        
        {dayOptions.map(option => (
          <TouchableOpacity 
            key={option.value}
            style={styles.quickDateOption}
            onPress={() => setQuickDate(option.value)}
          >
            <Text style={styles.quickDateText}>{option.label}</Text>
          </TouchableOpacity>
        ))}
        
        <TouchableOpacity 
          style={[styles.quickDateOption, { backgroundColor: '#6366f1' }]}
          onPress={() => {
            setShowQuickDateOptions(false);
            setShowDatePicker(true);
          }}
        >
          <Text style={[styles.quickDateText, { color: '#ffffff' }]}>Custom Date & Time</Text>
        </TouchableOpacity>
      </View>
    );
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
      
      // Navigate to Feed tab instead of just going back
      tabNavigation.navigate('Feed');
    } catch (error: any) {
      console.error('Error creating event:', error);
      Alert.alert('Error', `Failed to create event: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderCustomLocationModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={customLocationModalVisible}
      onRequestClose={() => setCustomLocationModalVisible(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Custom Location</Text>
            <TouchableOpacity 
              onPress={() => setCustomLocationModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter location address"
            value={customAddress}
            onChangeText={setCustomAddress}
          />
          
          <Text style={styles.label}>Latitude</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter latitude (e.g. 37.7749)"
            value={customLatitude}
            onChangeText={setCustomLatitude}
            keyboardType="numeric"
          />
          
          <Text style={styles.label}>Longitude</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter longitude (e.g. -122.4194)"
            value={customLongitude}
            onChangeText={setCustomLongitude}
            keyboardType="numeric"
          />
          
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={addCustomLocation}
          >
            <Text style={styles.primaryButtonText}>Add Location</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={true}
      >
        <SafeAreaView style={styles.content}>
          <Text style={styles.headingTitle}>Create Event</Text>
          <Text style={styles.title}>Create New Event</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Event Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Give your event a title"
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What's this event about?"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoriesContainer}>
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
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Location</Text>
            <View style={styles.locationButtonsContainer}>
              <TouchableOpacity
                style={styles.locationActionButton}
                onPress={getCurrentLocation}
              >
                <Ionicons name="navigate" size={20} color="#ffffff" />
                <Text style={styles.locationButtonText}>
                  {location ? 'Update Current Location' : 'Use Current Location'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.locationActionButton}
                onPress={() => setCustomLocationModalVisible(true)}
              >
                <Ionicons name="compass" size={20} color="#ffffff" />
                <Text style={styles.locationButtonText}>
                  Add Custom Location
                </Text>
              </TouchableOpacity>
            </View>
            
            {location?.address && (
              <View style={styles.currentLocationDisplay}>
                <Ionicons name="location" size={18} color="#6366f1" style={{ marginRight: 8 }} />
                <Text style={styles.locationText}>{location.address}</Text>
              </View>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Date & Time</Text>
            <TouchableOpacity 
              style={styles.dateButton}
              onPress={() => setShowQuickDateOptions(true)}
            >
              <Ionicons name="calendar" size={20} color="#6366f1" style={{ marginRight: 8 }} />
              <Text style={styles.dateButtonText}>
                {formatDateForDisplay(startDate)}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={startDate}
                mode="datetime"
                display="default"
                onChange={onDateChange}
                minimumDate={new Date()}
              />
            )}
            {renderQuickDateOptions()}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.submitButtonText}>Create Event</Text>
              </>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </ScrollView>
      {renderCustomLocationModal()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
    color: '#000000',
    letterSpacing: -0.5,
  },
  headingTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333333',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1c1c1e',
  },
  input: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    color: '#1c1c1e',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginHorizontal: -4,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e2e2',
  },
  categoryButtonActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  categoryButtonText: {
    color: '#1c1c1e',
    fontWeight: '500',
    fontSize: 14,
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  locationButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  locationActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    padding: 12,
    borderRadius: 10,
    marginHorizontal: 4,
  },
  locationButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  currentLocationDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f5',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  locationText: {
    color: '#4b5563',
    flex: 1,
  },
  dateButton: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e2e2',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#1c1c1e',
  },
  submitButton: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    color: '#1c1c1e',
  },
  modalCloseButton: {
    padding: 4,
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  quickDateContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    marginTop: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    zIndex: 1000,
  },
  quickDateOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f3f4f6',
  },
  quickDateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1c1c1e',
  },
}); 