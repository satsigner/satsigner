import { StyleSheet, View } from "react-native";

import { AppText } from "../../../components/shared/AppText";
import notImplementedAlert from "../../../components/shared/NotImplementedAlert";
import CameraIcon from '../../../assets/images/camera.svg';
import { Colors, Typography } from "../../../styles";

import ActionButton from "./ActionButton";

export default function ActionBar() {
  return (
    <View style={styles.actionBar}>
      <ActionButton style={{
          borderRightWidth: 1,
          borderRightColor: Colors.grey48,                
        }}
        onPress={notImplementedAlert}
      >
        <AppText style={styles.actionLabel}>Sign & Send</AppText>
      </ActionButton>
      <ActionButton
        style={{width: '20%'}}
        onPress={notImplementedAlert}
      >
        <CameraIcon width={18} height={13} />
      </ActionButton>
      <ActionButton style={{
          borderLeftWidth: 1,
          borderLeftColor: Colors.grey48,                
        }}
        onPress={notImplementedAlert}
      >
        <AppText style={styles.actionLabel}>New Invoice</AppText>
      </ActionButton>
    </View>
  );
}

const styles = StyleSheet.create({
  actionBar: {
    height: 62,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center'
  },
  actionLabel: {
    ...Typography.capitalization.uppercase
  }
})