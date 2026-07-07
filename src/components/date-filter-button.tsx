import { useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DATE_FILTER_OPTIONS, type DateFilter } from '@/lib/date-filter';

export function DateFilterButton({
  value,
  onChange,
}: {
  value: DateFilter;
  onChange: (filter: DateFilter) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selectedLabel =
    DATE_FILTER_OPTIONS.find((option) => option.value === value)?.label ?? 'All Time';

  return (
    <>
      <Pressable onPress={() => setOpen(true)}>
        <ThemedView type="backgroundElement" style={styles.button}>
          <ThemedText type="smallBold">Filter: {selectedLabel} ▾</ThemedText>
        </ThemedView>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <ThemedView type="backgroundElement" style={styles.menu}>
            {DATE_FILTER_OPTIONS.map((option) => {
              const selected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={[
                    styles.menuItem,
                    { backgroundColor: selected ? theme.backgroundSelected : 'transparent' },
                  ]}>
                  <ThemedText type={selected ? 'smallBold' : 'small'}>{option.label}</ThemedText>
                </Pressable>
              );
            })}
          </ThemedView>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: Spacing.four,
  },
  menu: {
    width: '100%',
    maxWidth: 280,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
});
