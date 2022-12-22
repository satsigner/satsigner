import {
  Text,
  StyleSheet,
} from 'react-native';

import { Typography } from '../../styles';

export default (props: any) => {
  const styles = StyleSheet.create({  
    heading: {
      ...Typography.textHighlight.x5,
      ...Typography.capitalization.uppercase
    },
  });
  
  return (
    <Text style={styles.heading}>{props.heading}</Text>
  );
}
