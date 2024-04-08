import { StyleSheet } from 'react-native';
import { Typography, Layout, Colors } from '../../../styles';

export const styles = StyleSheet.create({
  container: {
    ...Layout.container.base,
    ...Layout.container.horizontalPaddedThin,
  },
  createButtonContainer: {
    backgroundColor: Colors.background,
  },
  createButton: {
    borderRadius: 0,
    marginTop: 0,
    borderTopColor: Colors.grey48,
    borderTopWidth: 1,
  },
  scrollContainer: {
    paddingTop: 10,
  },
  emptyList: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 38,
  },
  emptyListText: {
    textTransform: 'uppercase',
    color: Colors.grey62,
    ...Typography.fontSize.x5,
  },
  info: {},
  openAccount: {
    position: 'absolute',
    right: 0,
    top: 50
  },
  account: {
    paddingBottom: 18,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.grey44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fingerprint: {
    ...Typography.textMuted.x1,
  },
  accountName: {
    fontSize: 15.5,
    marginTop: 2,
    color: Colors.middleGrey,
  },
  currency: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 1,
  },
  sats: {
    ...Typography.fontFamily.sfProTextLight,
    fontSize: 26,
    color: Colors.white,
  },
  satsLabel: {
    fontSize: 18,
    color: Colors.middleGrey,
    marginLeft: 3,
  },
  usd: {
    fontSize: 14,
    color: Colors.middleGrey,
  },
  usdLabel: {
    fontSize: 10,
    color: Colors.quarterGrey,
    marginLeft: 3,
  },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    marginTop: 15,
  },
  metric: {
    fontSize: 14,
    color: Colors.white,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 10,
    color: Colors.grey130,
  },
});
