import { Redirect, Tabs } from 'expo-router';
import { Text, useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

export default function TabLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { session, initializing } = useAuth();

  if (initializing) {
    return null;
  }

  if (!session) {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      initialRouteName="map"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ size }) => <TabIcon symbol="🗺️" size={size} />,
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: 'List',
          tabBarIcon: ({ size }) => <TabIcon symbol="📋" size={size} />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ symbol, size }: { symbol: string; size: number }) {
  return <Text style={{ fontSize: size }}>{symbol}</Text>;
}
