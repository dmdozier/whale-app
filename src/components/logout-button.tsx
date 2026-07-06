import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';

export function LogoutButton() {
  return (
    <Pressable style={styles.button} onPress={() => supabase.auth.signOut()}>
      <ThemedText type="small" themeColor="textSecondary">
        Log out
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 16,
    zIndex: 1,
  },
});
