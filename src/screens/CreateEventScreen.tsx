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
  Dimensions,
  Image,
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
const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function CreateEventScreen({ navigation: tabNavigation }: MainTabScreenProps<'Create'>) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('OTHER');
  
  // Set default date to now
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showQuickDateOptions, setShowQuickDateOptions] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [customLocationModalVisible, setCustomLocationModalVisible] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
    buildingName?: string;
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
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this feature.');
        return;
      }

      setLoading(true);
      const location = await Location.getCurrentPositionAsync({});
      
      // Get address from coordinates
      const [result] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      if (result) {
        const address = [
          result.street,
          result.city,
          result.region,
          result.postalCode,
          result.country
        ].filter(Boolean).join(', ');
        
        setLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: address,
          buildingName: result.name || ''
        });
        
        Alert.alert('Success', 'Current location added successfully!');
      } else {
        Alert.alert('Error', 'Could not determine your address. Please add location manually.');
      }
    } catch (error: any) {
      console.error('Error getting current location:', error);
      Alert.alert('Error', `Failed to get current location: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const addCustomLocation = () => {
    try {
      // Validate inputs
      if (!buildingName && !customAddress) {
        Alert.alert('Error', 'Please provide at least a building name or address');
        return;
      }
      
      // If building name is provided, we can use it
      if (buildingName) {
        // If only building name is provided, create location with only that
        setLocation({
          latitude: 0,
          longitude: 0,
          address: customAddress || '',
          buildingName: buildingName
        });
        
        setCustomLocationModalVisible(false);
        setBuildingName('');
        setCustomAddress('');
        return;
      }
      
      // If no building name, validate address
      if (!customAddress) {
        Alert.alert('Error', 'Please provide an address');
        return;
      }
      
      // Set location with address only
      setLocation({
        latitude: 0,
        longitude: 0,
        address: customAddress,
        buildingName: ''
      });
      
      setCustomLocationModalVisible(false);
      setBuildingName('');
      setCustomAddress('');
    } catch (error: any) {
      Alert.alert('Error', `Failed to add location: ${error.message}`);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      // Keep the time from the current startDate, only change the date
      const newDate = new Date(selectedDate);
      newDate.setHours(
        startDate.getHours(),
        startDate.getMinutes(),
        startDate.getSeconds(),
        startDate.getMilliseconds()
      );
      setStartDate(newDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      // Keep the date from the current startDate, only change the time
      const newDate = new Date(startDate);
      newDate.setHours(
        selectedTime.getHours(),
        selectedTime.getMinutes(),
        selectedTime.getSeconds(),
        selectedTime.getMilliseconds()
      );
      setStartDate(newDate);
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
      dayOptions.push({ 
        label: dayName, 
        value: i.toString(),
        date: futureDate.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric'
        })
      });
    }
    
    return (
      <View style={styles.quickDateContainer}>
        <Text style={styles.quickDateHeader}>Quick Date Options</Text>
        
        <TouchableOpacity 
          style={styles.quickDateOption}
          onPress={() => setQuickDate('today')}
        >
          <View style={styles.quickDateOptionContent}>
            <Text style={styles.quickDateText}>Today</Text>
            <Text style={styles.quickDateSubtext}>
              {today.toLocaleDateString(undefined, { 
                month: 'short', 
                day: 'numeric' 
              })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#6b7280" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickDateOption}
          onPress={() => setQuickDate('tomorrow')}
        >
          <View style={styles.quickDateOptionContent}>
            <Text style={styles.quickDateText}>Tomorrow</Text>
            <Text style={styles.quickDateSubtext}>
              {new Date(today.getTime() + 86400000).toLocaleDateString(undefined, { 
                month: 'short', 
                day: 'numeric' 
              })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#6b7280" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickDateOption}
          onPress={() => setQuickDate('thisWeekend')}
        >
          <View style={styles.quickDateOptionContent}>
            <Text style={styles.quickDateText}>This Weekend</Text>
            <Text style={styles.quickDateSubtext}>Saturday</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#6b7280" />
        </TouchableOpacity>
        
        {dayOptions.map(option => (
          <TouchableOpacity 
            key={option.value}
            style={styles.quickDateOption}
            onPress={() => setQuickDate(option.value)}
          >
            <View style={styles.quickDateOptionContent}>
              <Text style={styles.quickDateText}>{option.label}</Text>
              <Text style={styles.quickDateSubtext}>{option.date}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#6b7280" />
          </TouchableOpacity>
        ))}
        
        <TouchableOpacity 
          style={[styles.customDateTimeButton]}
          onPress={() => {
            setShowQuickDateOptions(false);
            setShowDatePicker(true);
          }}
        >
          <Text style={styles.customDateTimeButtonText}>Custom Date & Time</Text>
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
          
          <Text style={styles.label}>Building or Place Name</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="e.g. Science Building, Campus Center"
              value={buildingName}
              onChangeText={setBuildingName}
              placeholderTextColor="#a0a0a0"
            />
          </View>
          
          <Text style={styles.label}>Address</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter location address"
              value={customAddress}
              onChangeText={setCustomAddress}
              placeholderTextColor="#a0a0a0"
            />
          </View>
          
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
    <SafeAreaView style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.screenTitle}>Create</Text>
      </View>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView style={styles.scrollView}>
          {/* Event Image Picker */}
          <TouchableOpacity 
            style={styles.imagePicker} 
            onPress={pickImage}
            accessibilityLabel="Add event image"
            accessibilityHint="Double tap to select an image for your event"
          >
            {location ? (
              <Image source={{ uri: `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-s+007AFF(${location.longitude},${location.latitude})/${location.longitude},${location.latitude},12/400x200?access_token=${supabaseAnonKey}` }} style={styles.eventImage} />
            ) : (
              <View style={styles.placeholderContainer}>
                <Ionicons name="camera-outline" size={32} color="#8e8e93" />
                <Text style={styles.placeholderText}>Add Event Photo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Event Title */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Event title"
              placeholderTextColor="#8e8e93"
              value={title}
              onChangeText={setTitle}
              maxLength={75}
              autoCapitalize="words"
              accessibilityLabel="Event title input"
            />
          </View>

          {/* Event Category */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoriesContainer}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    category === cat && styles.selectedCategory
                  ]}
                  onPress={() => setCategory(cat)}
                  accessibilityLabel={`${cat} category`}
                  accessibilityState={{ selected: category === cat }}
                >
                  <Text 
                    style={[
                      styles.categoryButtonText,
                      category === cat && styles.selectedCategoryText
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Event Description */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your event"
              placeholderTextColor="#8e8e93"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              accessibilityLabel="Event description input"
            />
          </View>

          {/* Event Date & Time */}
          <View style={styles.formGroup}>
            <Text style={styles.sectionLabel}>Date & Time</Text>
            
            <View style={styles.dateTimeContainer}>
              <TouchableOpacity
                style={styles.dateTimeCard}
                onPress={() => setShowDatePicker(true)}
                accessibilityLabel="Select date"
                accessibilityHint="Double tap to select a date for your event"
              >
                <View style={styles.dateTimeCardContent}>
                  <Ionicons name="calendar" size={24} color="#007AFF" style={styles.dateTimeIcon} />
                  <Text style={styles.dateTimeText}>
                    {startDate.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.dateTimeCard}
                onPress={() => setShowTimePicker(true)}
                accessibilityLabel="Select time"
                accessibilityHint="Double tap to select a time for your event"
              >
                <View style={styles.dateTimeCardContent}>
                  <Ionicons name="time" size={24} color="#007AFF" style={styles.dateTimeIcon} />
                  <Text style={styles.dateTimeText}>
                    {startDate.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            
            {/* Date Picker Modal */}
            {showDatePicker && (
              <Modal
                transparent={true}
                animationType="slide"
                visible={showDatePicker}
                onRequestClose={() => setShowDatePicker(false)}
              >
                <View style={styles.pickerModalOverlay}>
                  <View style={styles.pickerModalContainer}>
                    <View style={styles.pickerHeader}>
                      <Text style={styles.pickerTitle}>Select Date</Text>
                      <TouchableOpacity 
                        style={styles.pickerDoneButton}
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={styles.pickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    
                    <DateTimePicker
                      value={startDate}
                      mode="date"
                      display="spinner"
                      onChange={onDateChange}
                      minimumDate={new Date()}
                      textColor="#000"
                      style={styles.datePicker}
                    />
                  </View>
                </View>
              </Modal>
            )}
            
            {/* Time Picker Modal */}
            {showTimePicker && (
              <Modal
                transparent={true}
                animationType="slide"
                visible={showTimePicker}
                onRequestClose={() => setShowTimePicker(false)}
              >
                <View style={styles.pickerModalOverlay}>
                  <View style={styles.pickerModalContainer}>
                    <View style={styles.pickerHeader}>
                      <Text style={styles.pickerTitle}>Select Time</Text>
                      <TouchableOpacity 
                        style={styles.pickerDoneButton}
                        onPress={() => setShowTimePicker(false)}
                      >
                        <Text style={styles.pickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    
                    <DateTimePicker
                      value={startDate}
                      mode="time"
                      display="spinner"
                      onChange={onTimeChange}
                      textColor="#000"
                      style={styles.timePicker}
                    />
                  </View>
                </View>
              </Modal>
            )}
          </View>

          {/* Event Location */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Location</Text>
            <View style={styles.locationButtonsContainer}>
              <TouchableOpacity
                style={[
                  styles.locationButton,
                  location && styles.selectedLocationButton
                ]}
                onPress={getCurrentLocation}
                accessibilityLabel="Use current location"
                accessibilityHint="Double tap to use your current location for the event"
              >
                <Ionicons name="locate-outline" size={20} color={location ? "#ffffff" : "#007AFF"} />
                <Text style={[
                  styles.locationButtonText, 
                  location && styles.selectedLocationButtonText
                ]}>
                  Current Location
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.locationButton,
                  customLocationModalVisible && styles.selectedLocationButton
                ]}
                onPress={() => setCustomLocationModalVisible(true)}
                accessibilityLabel="Add custom location"
                accessibilityHint="Double tap to enter a custom location for the event"
              >
                <Ionicons name="pin-outline" size={20} color={customLocationModalVisible ? "#ffffff" : "#007AFF"} />
                <Text style={[
                  styles.locationButtonText,
                  customLocationModalVisible && styles.selectedLocationButtonText
                ]}>
                  Custom Location
                </Text>
              </TouchableOpacity>
            </View>
            
            {(location || customLocationModalVisible) && (
              <View style={styles.locationDetailsContainer}>
                {buildingName ? (
                  <Text style={styles.locationText}>
                    {buildingName}
                    {location?.address ? ` (${location.address})` : ''}
                  </Text>
                ) : (
                  <Text style={styles.locationText}>{location?.address || 'Location set'}</Text>
                )}
                
                <TouchableOpacity
                  style={styles.clearLocationButton}
                  onPress={() => {
                    setLocation(null);
                    setCustomLocationModalVisible(false);
                    setBuildingName('');
                    setCustomAddress('');
                  }}
                  accessibilityLabel="Clear location"
                  accessibilityHint="Double tap to remove the selected location"
                >
                  <Ionicons name="close-circle" size={20} color="#8e8e93" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Create Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!title || !category || !location) && styles.disabledButton
            ]}
            onPress={handleSubmit}
            disabled={!title || !category || !location}
            accessibilityLabel="Create event"
            accessibilityHint="Double tap to publish your event"
            accessibilityState={{ disabled: !title || !category || !location }}
          >
            <Text style={styles.submitButtonText}>Create Event</Text>
          </TouchableOpacity>
        </ScrollView>
        
        {/* Custom Location Modal */}
        <Modal
          visible={customLocationModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setCustomLocationModalVisible(false)}
        >
          {renderCustomLocationModal()}
        </Modal>
      </KeyboardAvoidingView>
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
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  imagePicker: {
    height: 200,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  eventImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8e8e93',
    marginTop: 12,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 10,
  },
  input: {
    padding: 16,
    fontSize: 17,
    color: '#000',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textArea: {
    height: 120,
    paddingTop: 16,
    paddingBottom: 16,
    textAlignVertical: 'top',
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  categoryButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
    margin: 4,
    backgroundColor: '#f2f2f7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  selectedCategory: {
    backgroundColor: '#007AFF',
  },
  categoryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  selectedCategoryText: {
    color: '#ffffff',
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 16,
  },
  dateTimeContainer: {
    backgroundColor: 'white',
  },
  dateTimeCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dateTimeCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateTimeIcon: {
    marginRight: 12,
  },
  dateTimeText: {
    fontSize: 17,
    color: '#000',
    fontWeight: '500',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  pickerModalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 30,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  pickerDoneButton: {
    padding: 4,
  },
  pickerDoneText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
  },
  datePicker: {
    height: 220,
  },
  timePicker: {
    height: 220,
  },
  locationButtonsContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    flex: 1,
    marginRight: 8,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  selectedLocationButton: {
    backgroundColor: '#007AFF',
  },
  locationButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#007AFF',
    marginLeft: 8,
  },
  selectedLocationButtonText: {
    color: '#ffffff',
  },
  locationDetailsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  locationText: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    marginRight: 8,
  },
  clearLocationButton: {
    padding: 4,
  },
  submitButton: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 20,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#a2c9f7',
    shadowOpacity: 0,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
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
    maxHeight: '80%',
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
    borderRadius: 12,
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
    borderRadius: 12,
    marginTop: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    zIndex: 1000,
  },
  quickDateHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  quickDateOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#f3f4f6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickDateOptionContent: {
    flex: 1,
  },
  quickDateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1c1c1e',
  },
  quickDateSubtext: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  customDateTimeButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  customDateTimeButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  iosPickerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 2000,
    justifyContent: 'flex-end',
    height: SCREEN_HEIGHT,
  },
  iosPickerContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 0, // Extra padding for iOS home indicator
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  iosPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  iosPickerDone: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366f1',
  },
  iosPicker: {
    height: 200,
    width: '100%',
  },
  inputContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eeeeee',
    backgroundColor: '#ffffff',
  },
  screenTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -1,
  },
}); 