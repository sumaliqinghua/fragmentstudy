import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/lib/theme';
import type { PathNode } from '@/lib/types';

export function StreakRow({
  streak,
  xp,
  onProfile,
}: {
  streak: number;
  xp: number;
  onProfile?: () => void;
}) {
  return (
    <View style={styles.streakRow}>
      <Pressable onPress={onProfile} style={styles.brand}>
        <View style={styles.logo} />
        <Text style={styles.brandText}>FragmentStudy</Text>
      </Pressable>
      <View style={styles.badges}>
        <View style={styles.badge}>
          <Text style={styles.badgeEmoji}>🔥</Text>
          <Text style={styles.badgeMute}>连续 {streak} 天</Text>
        </View>
        <View style={[styles.badge, styles.badgeGold]}>
          <Text style={styles.badgeEmoji}>⭐</Text>
          <Text style={styles.badgeGoldText}>{xp} XP</Text>
        </View>
      </View>
    </View>
  );
}

export function GuestHint({ onLogin }: { onLogin: () => void }) {
  return (
    <Pressable onPress={onLogin} style={styles.guestHint}>
      <Text style={styles.guestHintText}>导入自己的长文？点击登录同步</Text>
    </Pressable>
  );
}

export function PathTrail({
  nodes,
  onContinue,
}: {
  nodes: PathNode[];
  onContinue?: () => void;
}) {
  return (
    <View style={styles.path}>
      {nodes.map((node, index) => {
        const isLast = index === nodes.length - 1;
        const lineSolid = node.status === 'done' || node.status === 'opened';

        return (
          <View key={node.id} style={styles.pathItem}>
            {node.kind === 'chest' ? (
              <View style={styles.chestWrap}>
                <View style={styles.chest}>
                  <Text style={styles.chestEmoji}>{node.status === 'opened' ? '✨' : '🎁'}</Text>
                </View>
                <Text style={styles.nodeLabelMute}>{node.label}</Text>
              </View>
            ) : (
              <View style={styles.stopWrap}>
                <View
                  style={[
                    styles.stopCircle,
                    node.status === 'current' && styles.stopCurrent,
                    node.status === 'done' && styles.stopDone,
                    node.status === 'locked' && styles.stopLocked,
                  ]}
                >
                  <Text
                    style={[
                      styles.stopNumber,
                      (node.status === 'current' || node.status === 'done') && styles.stopNumberActive,
                    ]}
                  >
                    {node.status === 'done' ? '✓' : node.number}
                  </Text>
                </View>
                <Text style={[styles.nodeLabel, node.status === 'locked' && styles.nodeLabelMute]}>
                  {node.label}
                </Text>
                {node.status === 'current' && node.actionLabel ? (
                  <Pressable onPress={onContinue} style={styles.continueBtn}>
                    <Text style={styles.continueText}>{node.actionLabel}</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
            {!isLast ? (
              <View style={[styles.connector, lineSolid ? styles.connectorSolid : styles.connectorDashed]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logo: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.teal },
  brandText: { fontSize: 16, fontWeight: '700', color: colors.ink },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: colors.gray100,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeGold: { backgroundColor: colors.goldSoft },
  badgeEmoji: { fontSize: 13 },
  badgeMute: { fontSize: 13, fontWeight: '700', color: colors.mute },
  badgeGoldText: { fontSize: 13, fontWeight: '700', color: colors.gold },
  guestHint: {
    backgroundColor: colors.tealSoft,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  guestHintText: { fontSize: 13, fontWeight: '600', color: colors.teal },
  path: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  pathItem: { alignItems: 'center', width: '100%' },
  stopWrap: { alignItems: 'center', gap: 8 },
  stopCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopCurrent: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 6,
    borderColor: colors.teal,
    backgroundColor: colors.teal,
    elevation: 4,
  },
  stopDone: { borderColor: colors.teal, backgroundColor: colors.teal },
  stopLocked: { borderColor: colors.line, backgroundColor: colors.white },
  stopNumber: { fontSize: 16, fontWeight: '700', color: colors.faint },
  stopNumberActive: { color: colors.white, fontSize: 20 },
  nodeLabel: { fontSize: 13, fontWeight: '700', color: colors.ink },
  nodeLabelMute: { fontSize: 11, fontWeight: '600', color: colors.mute, textTransform: 'uppercase' },
  continueBtn: {
    backgroundColor: colors.teal,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  continueText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  chestWrap: { alignItems: 'center', paddingVertical: 8 },
  chest: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chestEmoji: { fontSize: 28 },
  connector: { width: 0, height: 32, marginVertical: 4, borderLeftWidth: 2 },
  connectorSolid: { borderColor: colors.teal, borderStyle: 'solid' },
  connectorDashed: { borderColor: colors.line, borderStyle: 'dashed' },
});
