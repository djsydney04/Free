import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  MainApp: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Feed: undefined;
  Map: undefined;
  Create: undefined;
  Profile: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = 
  NativeStackScreenProps<RootStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = 
  NativeStackScreenProps<MainTabParamList, T>; 