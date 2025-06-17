import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/database.types";

const supabaseUrl = "https://qozpzfeobdmsdhflguwf.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvenB6ZmVvYmRtc2RoZmxndXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MDQyODgsImV4cCI6MjA2MDk4MDI4OH0.M5NCvzpKS-xOQWlyhLnNEKcrb7jvkmP6iKf-_11qwy4";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
