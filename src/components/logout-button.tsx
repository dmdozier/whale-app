import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';

export function LogoutButton({ topOffset = 0 }: { topOffset?: number }) {
  // Absolutely positioned views ignore a parent SafeAreaView's padding, so
  // the inset has to be applied directly here to clear the status bar.
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      style={[styles.button, { top: insets.top + topOffset, right: insets.right }]}
      onPress={() => supabase.auth.signOut()}>
      <ThemedText type="small" themeColor="textSecondary">
        Log out
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    padding: 16,
    zIndex: 1,
  },
});
