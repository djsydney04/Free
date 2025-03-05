import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dkrjgkaafmifkytqskiy.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrcmpna2FhZm1pZmt5dHFza2l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEwNTg3NzAsImV4cCI6MjA1NjYzNDc3MH0.-S5c5Ke7PZ-Br6LV6CJDeCgu8_sOUjCARWmmGn9EQYM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
}); 