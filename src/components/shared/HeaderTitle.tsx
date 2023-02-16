import { StyleSheet } from 'react-native';

import { Typography } from '../../styles';

import { AppText } from '../shared/AppText';

export default function HeaderTitle(props: any) {
  const styles = StyleSheet.create({  
    heading: {
      ...Typography.capitalization.uppercase,
    },
  });
  
  return (
    <AppText style={styles.heading}>{props.heading}</AppText>
  );
}
