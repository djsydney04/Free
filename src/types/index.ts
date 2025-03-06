export interface User {
  id: string;
  email?: string;
  username?: string;
  avatar_url?: string;
}

export interface FreeEvent {
  id: string;
  title: string;
  description: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
    buildingName?: string;
  };
  category: 'FOOD' | 'CONCERT' | 'SPORTS' | 'ACADEMIC' | 'OTHER';
  start_date: string;
  end_date?: string;
  created_by: string;
  images?: string[];
  created_at: string;
  university?: string;
  participants?: string[];
}

export interface UserProfile {
  id: string;
  user_id: string;
  university: string;
  bio?: string;
  interests?: string[];
  created_at: string;
  profileImage?: string;
} 