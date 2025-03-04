import React, { useState } from 'react';
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
import { supabase } from '../services/supabase';
import type { MainTabScreenProps } from '../types/navigation';

const CATEGORIES = ['FOOD', 'CONCERT', 'SPORTS', 'ACADEMIC', 'OTHER'] as const;

export default function CreateEventScreen({ navigation }: MainTabScreenProps<'Create'>) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('OTHER');
  const [startDate, setStartDate] = useState(new Date());
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Sorry, we need camera roll permissions to upload images!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      // Upload image to Supabase Storage
      try {
        const fileName = uri.split('/').pop();
        const fileExt = fileName?.split('.').pop();
        const filePath = `${Date.now()}.${fileExt}`;

        const formData = new FormData();
        formData.append('file', {
          uri,
          name: fileName,
          type: `image/${fileExt}`,
        } as any);

        const { data, error } = await supabase.storage
          .from('event-images')
          .upload(filePath, formData);

        if (error) throw error;

        const { data: publicUrl } = supabase.storage
          .from('event-images')
          .getPublicUrl(filePath);

        setImages([...images, publicUrl.publicUrl]);
      } catch (error: any) {
        Alert.alert('Error uploading image', error.message);
      }
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

  const handleSubmit = async () => {
    if (!title || !description || !location) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('Not authenticated');

      const { error } = await supabase.from('events').insert([
        {
          title,
          description,
          category,
          location,
          start_date: startDate.toISOString(),
          created_by: user.data.user.id,
          images,
        },
      ]);

      if (error) throw error;

      Alert.alert('Success', 'Event created successfully!');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error creating event', error.message);
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

        <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
          <Text style={styles.imageButtonText}>
            {images.length > 0
              ? `Add More Images (${images.length})`
              : 'Add Images'}
          </Text>
        </TouchableOpacity>

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
  categoryContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#4b5563',
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