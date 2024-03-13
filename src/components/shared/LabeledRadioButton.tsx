import {
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import { AppText } from '../shared/AppText';
import { Colors, Typography } from '../../styles';

export default function LabeledRadioButton(props: any) {
  const styles = StyleSheet.create({  
    touchableOpacitySelected: {
      borderRadius: 3,
      borderColor: 'rgba(255, 255, 255, 0.68)',
      borderStyle: 'solid',
      borderWidth: 2,
      backgroundColor: Colors.actionBackground,
      height: 62,
      marginVertical: 8
    },  
    buttonSelected: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    touchableOpacityUnselected: {
      borderRadius: 3,
      backgroundColor: Colors.background,
      height: 62,
      marginVertical: 8
    },
    disabled: {
      opacity: 0.3
    },
    buttonUnselected: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonText: {
      ...Typography.textHighlight.x5,
      ...Typography.capitalization.uppercase,
      color: Colors.actionText
    }
  });
  
  return (
    <TouchableOpacity
      activeOpacity={0.5}
      style={[
        props.selected ?
          styles.touchableOpacitySelected :
          styles.touchableOpacityUnselected,
        props.disabled ?
          styles.disabled : 
          {}
      ]}
      onPress={()=>{props.onPress(props.value)}}
    >
      <View style={props.selected ?
        styles.buttonSelected :
        styles.buttonUnselected}>
        <AppText style={styles.buttonText}>
          {props.title}
        </AppText>
      </View>
    </TouchableOpacity>
  );
}
