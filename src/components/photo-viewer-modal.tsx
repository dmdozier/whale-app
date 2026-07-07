import { Image, Modal, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function PhotoViewerModal({
  photoUrl,
  onClose,
}: {
  photoUrl: string | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={photoUrl !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.image} resizeMode="contain" />
        ) : null}
        <SafeAreaView style={styles.closeButtonSafeArea} pointerEvents="box-none">
          <Pressable onPress={onClose} style={styles.closeButton} hitSlop={12}>
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closeButtonSafeArea: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  closeButton: {
    padding: 16,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '600',
  },
});
