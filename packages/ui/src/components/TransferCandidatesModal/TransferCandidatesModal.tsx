import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { colors } from '../../theme';
import { Button } from '../Button';
import { Spinner } from '../Spinner';
import { styles } from './TransferCandidatesModal.styles';

export interface TransferCandidate {
  driverId: string;
  driverName: string | null;
  distanceKm: number;
  freeSeats: number;
}

export interface TransferCandidatesModalProps {
  visible: boolean;
  title: string;
  loading: boolean;
  candidates: TransferCandidate[];
  emptyMessage: string;
  distanceLabel: (km: number) => string;
  seatsLabel: (seats: number) => string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmLoading?: boolean;
  /** Up to 3 — invite_transfer's own limit. */
  maxSelected?: number;
  onConfirm: (driverIds: string[]) => void;
  onCancel: () => void;
}

/**
 * D1 (UAT audit): the FROM driver's candidate picker — up to 3 nearby,
 * adequately-seated online drivers, checkbox multi-select (unlike
 * ReasonPickerModal's single-select radio list, since invite_transfer takes
 * an array).
 */
export function TransferCandidatesModal({
  visible,
  title,
  loading,
  candidates,
  emptyMessage,
  distanceLabel,
  seatsLabel,
  confirmLabel,
  cancelLabel = 'Back',
  confirmLoading = false,
  maxSelected = 3,
  onConfirm,
  onCancel,
}: TransferCandidatesModalProps) {
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) setSelected([]);
  }, [visible]);

  function toggle(driverId: string) {
    setSelected((prev) => {
      if (prev.includes(driverId)) return prev.filter((id) => id !== driverId);
      if (prev.length >= maxSelected) return prev;
      return [...prev, driverId];
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {loading ? (
            <Spinner />
          ) : candidates.length === 0 ? (
            <Text style={styles.empty}>{emptyMessage}</Text>
          ) : (
            <ScrollView style={styles.list}>
              {candidates.map((candidate) => {
                const isSelected = selected.includes(candidate.driverId);
                return (
                  <Pressable
                    key={candidate.driverId}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    disabled={confirmLoading}
                    style={[styles.candidate, isSelected && styles.candidateSelected]}
                    onPress={() => toggle(candidate.driverId)}
                  >
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={isSelected ? colors.accentBlue : colors.inkSoft}
                    />
                    <View style={styles.candidateInfo}>
                      <Text style={styles.candidateName}>{candidate.driverName ?? '—'}</Text>
                      <Text style={styles.candidateMeta}>
                        {distanceLabel(candidate.distanceKm)} · {seatsLabel(candidate.freeSeats)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          <View style={styles.actions}>
            <View style={styles.actionButton}>
              <Button label={cancelLabel} variant="outline" tone="neutral" fullWidth disabled={confirmLoading} onPress={onCancel} />
            </View>
            <View style={styles.actionButton}>
              <Button
                label={confirmLabel}
                variant="solid"
                tone="primary"
                fullWidth
                loading={confirmLoading}
                disabled={selected.length === 0}
                onPress={() => onConfirm(selected)}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
