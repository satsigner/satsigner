import { StyleSheet } from 'react-native';

import { Colors } from './Colors';

const baseStylesheet = StyleSheet.create({  
  text: {
    color: Colors.white,
    letterSpacing: 1,
    fontSize: 13
  },

});

export default StyleSheet.create({  
  ...baseStylesheet,

  container: {
    flex: 1,
    backgroundColor: Colors.gray0
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    marginTop: 30,
    paddingHorizontal: '6%'
  },
  label: {
    ...baseStylesheet.text,
    alignSelf: 'center',
    marginBottom: 7
  },  

});
