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
  ScrollView,
} from 'react-native';
import { supabase } from '../services/supabase';
import type { RootStackScreenProps } from '../types/navigation';

export default function SignUpScreen({ navigation }: RootStackScreenProps<'SignUp'>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [university, setUniversity] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const validateInputs = () => {
    setErrorMessage('');
    
    if (!email.trim()) {
      setErrorMessage('Please enter your email');
      return false;
    }
    
    if (!password.trim()) {
      setErrorMessage('Please enter a password');
      return false;
    }
    
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      return false;
    }
    
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return false;
    }
    
    if (!university.trim()) {
      setErrorMessage('Please enter your university');
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

  const handleSignUp = async () => {
    if (loading) return;
    
    if (!validateInputs()) return;

    setLoading(true);
    try {
      // First sign up the user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          throw new Error('This email is already registered. Please log in instead.');
        } else {
          throw signUpError;
        }
      }
      
      if (!signUpData.user) {
        throw new Error('Sign up failed. Please try again later.');
      }

      // Create user profile with university info
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            user_id: signUpData.user.id,
            university: university.trim(),
            created_at: new Date().toISOString(),
          },
        ]);

      if (profileError) throw profileError;

      Alert.alert(
        'Account Created',
        'Your account was created successfully! Please check your email for verification instructions.',
        [{ text: 'Log In', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error: any) {
      setErrorMessage(error.message);
      console.error('Sign up error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join the Community</Text>
          
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
            style={[styles.input, errorMessage && (!password.trim() || password.length < 6) && styles.inputError]}
            placeholder="Password (min 6 characters)"
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

          <TextInput
            style={[styles.input, errorMessage && password !== confirmPassword && styles.inputError]}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
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

          <TextInput
            style={[styles.input, errorMessage && !university.trim() && styles.inputError]}
            placeholder="University"
            value={university}
            onChangeText={(text) => {
              setUniversity(text);
              setErrorMessage('');
            }}
            autoCapitalize="words"
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Login')}
            disabled={loading}
          >
            <Text style={styles.linkText}>
              Already have an account? Log in here
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 30,
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
});