import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import "react-native-reanimated";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "@/hooks/useColorScheme";
import NotificationProvider from "@/app/context/NotificationContext";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [session, setSession] = useState<Session | null>(null);
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Keep track of auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <NotificationProvider>
            <Stack screenOptions={{ headerShown: false }}>
              {session ? (
                <>
                  <Stack.Screen
                    name="(tabs)"
                    options={{
                      animation: "fade_from_bottom",
                    }}
                  />
                  <Stack.Screen
                    name="chat/[id]"
                    options={{
                      animation: "slide_from_right",
                      presentation: "modal",
                    }}
                  />
                  <Stack.Screen
                    name="swipe/[id]"
                    options={{
                      animation: "slide_from_right",
                    }}
                  />
                  <Stack.Screen
                    name="new-run"
                    options={{
                      animation: "slide_from_right",
                    }}
                  />
                </>
              ) : (
                <>
                  <Stack.Screen
                    name="login"
                    options={{
                      animation: "slide_from_left",
                      animationTypeForReplace: "push",
                    }}
                  />
                  <Stack.Screen
                    name="signup"
                    options={{
                      animation: "slide_from_right",
                      animationTypeForReplace: "push",
                    }}
                  />
                </>
              )}
            </Stack>
            <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
          </NotificationProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
