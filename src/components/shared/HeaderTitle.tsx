import {
  Text,
  StyleSheet,
} from 'react-native';

import { Typography } from '../../styles';

export default function HeaderTitle(props: any) {
  const styles = StyleSheet.create({  
    heading: {
      ...Typography.textHighlight.x5,
      ...Typography.capitalization.uppercase,
      ...Typography.fontFamily.sfProTextRegular
    },
  });
  
  return (
    <Text style={styles.heading}>{props.heading}</Text>
  );
}
