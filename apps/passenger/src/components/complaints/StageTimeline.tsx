import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { colors } from '@trisakay/ui';
import type { ComplaintStageState } from '../../utils/complaintStages';
import { styles } from './StageTimeline.styles';

export interface TimelineStage {
  title: string;
  body?: string;
  date?: string;
  state: ComplaintStageState;
}

export interface StageTimelineProps {
  stages: TimelineStage[];
  /** Terminal statuses (README §4.3): hide bodies, tighten row spacing. */
  compact?: boolean;
}

function Marker({ state, connectorDone }: { state: ComplaintStageState; connectorDone: boolean }) {
  if (state === 'done') {
    return (
      <View style={styles.markerDone}>
        <Ionicons name="checkmark" size={11} color={colors.white} />
      </View>
    );
  }
  if (state === 'current') {
    return (
      <View style={styles.markerCurrentHalo}>
        <View style={styles.markerCurrent}>
          <View style={styles.markerCurrentDot} />
        </View>
      </View>
    );
  }
  return <View style={styles.markerPending} />;
}

export function StageTimeline({ stages, compact = false }: StageTimelineProps) {
  return (
    <View>
      {stages.map((stage, index) => {
        const isLast = index === stages.length - 1;
        // The connector below a marker is green only once the stage above it is done.
        const connectorDone = stage.state === 'done';
        return (
          <View key={stage.title} style={styles.row}>
            <View style={styles.markerCol}>
              <Marker state={stage.state} connectorDone={connectorDone} />
              {!isLast && (
                <View
                  style={[
                    styles.connector,
                    compact && styles.connectorCompact,
                    { backgroundColor: connectorDone ? colors.accentGreen : colors.line },
                  ]}
                />
              )}
            </View>
            <View style={[styles.textCol, compact && styles.textColCompact, isLast && styles.textColLast]}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, stage.state === 'pending' && styles.titlePending]}>{stage.title}</Text>
                {stage.date && <Text style={styles.date}>{stage.date}</Text>}
              </View>
              {!compact && stage.body && <Text style={styles.body}>{stage.body}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}
