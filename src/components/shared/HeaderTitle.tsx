import {
  Text,
  StyleSheet,
} from 'react-native';

import GlobalStyles from '../../GlobalStyles';

export default (props) => {
  const styles = StyleSheet.create({  
    heading: {
      ...GlobalStyles.text,
      textTransform: 'uppercase'
    },
  });
  
  return (
    <Text style={styles.heading}>{props.heading}</Text>
  );
}
