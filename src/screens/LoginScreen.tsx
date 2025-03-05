import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../services/supabase';
import type { RootStackScreenProps } from '../types/navigation';

export default function LoginScreen({ navigation }: RootStackScreenProps<'Login'>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const validateInputs = () => {
    setErrorMessage('');
    
    if (!email.trim()) {
      setErrorMessage('Please enter your email');
      return false;
    }
    
    if (!password.trim()) {
      setErrorMessage('Please enter your password');
      return false;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid email address');
      return false;
    }
    
    return true;
  };

  const handleLogin = async () => {
    if (loading) return;
    
    if (!validateInputs()) return;

    setLoading(true);
    try {
      // Try to sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          // Provide a more helpful error message
          throw new Error(
            'Email or password is incorrect. Please check your credentials or use the "Forgot password" option.'
          );
        } else {
          throw error;
        }
      }
      
      // Check if we actually got user data back
      if (!data || !data.user) {
        throw new Error('Login failed. Please try again later.');
      }
      
      // Navigation will be handled by auth state change
      console.log('Login successful', data.user.id);
    } catch (error: any) {
      setErrorMessage(error.message);
      console.error('Login error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to create demo account
  const createTestAccount = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const testEmail = 'demo@example.com';
      const testPassword = 'Demo123!';
      
      // First check if the user already exists
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });
      
      if (!signInError && signInData.user) {
        // User exists, login successful
        console.log('Demo login successful with existing account');
        return;
      }
      
      console.log('Creating new demo account...');
      
      // User doesn't exist, create a new one
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
        options: {
          // Auto-confirm the email for demo accounts
          data: {
            university: 'Demo University',
          }
        }
      });

      if (signUpError) {
        console.error('Error creating demo account:', signUpError);
        throw signUpError;
      }
      
      if (!signUpData.user) {
        throw new Error('Failed to create demo account');
      }
      
      console.log('Demo account created successfully');
      
      // Create profile with university info
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            user_id: signUpData.user.id,
            university: 'Demo University',
            created_at: new Date().toISOString(),
          },
        ]);
        
      if (profileError) {
        console.error('Error creating demo profile:', profileError);
      }
        
      // Now sign in with the created account
      const { error: finalLoginError } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });
      
      if (finalLoginError) {
        throw finalLoginError;
      }
      
      console.log('Demo login successful with new account');
      
    } catch (error: any) {
      setErrorMessage('Could not create demo account: ' + error.message);
      console.error('Demo account error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>FreeV2</Text>
        <Text style={styles.subtitle}>Find Free Events Near You</Text>

        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <TextInput
          style={[styles.input, errorMessage && !email.trim() && styles.inputError]}
          placeholder="Email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setErrorMessage('');
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />

        <TextInput
          style={[styles.input, errorMessage && !password.trim() && styles.inputError]}
          placeholder="Password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setErrorMessage('');
          }}
          secureTextEntry
          textContentType="oneTimeCode"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="default"
          returnKeyType="done"
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Log In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate('SignUp')}
          disabled={loading}
        >
          <Text style={styles.linkText}>
            Don't have an account? Sign up here
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate('ForgotPassword')}
          disabled={loading}
        >
          <Text style={styles.linkText}>
            Forgot your password?
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.demoButton}
          onPress={createTestAccount}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#6366f1" />
          ) : (
            <Text style={styles.demoButtonText}>
              Try Demo Account
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#6366f1',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#f3f4f6',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  inputError: {
    borderColor: '#D32F2F',
    backgroundColor: '#FFEBEE',
  },
  button: {
    backgroundColor: '#6366f1',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: '#6366f1',
    fontSize: 16,
  },
  demoButton: {
    backgroundColor: '#e0e7ff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  demoButtonText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '600',
  },
}); 