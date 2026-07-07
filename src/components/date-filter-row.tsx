import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DATE_FILTER_OPTIONS, type DateFilter } from '@/lib/date-filter';

export function DateFilterRow({
  value,
  onChange,
}: {
  value: DateFilter;
  onChange: (filter: DateFilter) => void;
}) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scrollView}
      contentContainerStyle={styles.row}>
      {DATE_FILTER_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.chip,
              { backgroundColor: selected ? theme.text : theme.backgroundElement },
            ]}>
            <ThemedText type="small" style={{ color: selected ? theme.background : theme.text }}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  chip: {
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
