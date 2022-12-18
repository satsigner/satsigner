import React from 'react';
import {
  View,
  Text,
} from 'react-native';

import GlobalStyles from '../GlobalStyles';

export default (props) => {
  return (
    <View style={GlobalStyles.container}>
      <View style={GlobalStyles.content}>
        <View>
          <Text style={GlobalStyles.label}>
            Just a placeholder
          </Text>
        </View>
      </View>
    </View>
  );
}
