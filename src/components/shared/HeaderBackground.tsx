import { StyleSheet } from 'react-native';

import BackgroundGradient from './BackgroundGradient';

export default function HeaderBackground(props: any) {
  const gradientOrientation = props.gradientOrientation || 'diagonal';

  const styles = StyleSheet.create({  
    header: {
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
  
  return (
    <BackgroundGradient orientation={gradientOrientation} style={styles.header} />
  );
}
